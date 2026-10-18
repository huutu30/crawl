const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Cấu hình
const OUTPUT_FILE = 'anhcoconchao3.txt';
const TARGET_NEW_PHONES = 4000;
const CHUNK_SIZE = 1000;

// Các tên miền cần cào bds / phongtro
const DOMAINS_CONFIG = [
    {
        domain: 'phongtro123.com',
        seeds: ['https://phongtro123.com/tinh-thanh/ha-noi', 'https://phongtro123.com/tinh-thanh/ho-chi-minh', 'https://phongtro123.com/tinh-thanh/binh-duong']
    },
    {
        domain: 'bds123.vn',
        seeds: ['https://bds123.vn/nha-dat-ban-ho-chi-minh.html', 'https://bds123.vn/nha-dat-ban-ha-noi.html']
    },
    {
        domain: 'tromoi.com',
        seeds: ['https://tromoi.com/cho-thue-phong-tro-ha-noi', 'https://tromoi.com/cho-thue-phong-tro-ho-chi-minh']
    },
    {
        domain: 'guland.vn',
        seeds: ['https://guland.vn/cho-thue-nha-dat']
    },
    {
        domain: 'thuecanho123.com',
        seeds: ['https://thuecanho123.com/cho-thue-can-ho-chung-cu-ho-chi-minh.html', 'https://thuecanho123.com/cho-thue-can-ho-chung-cu-ha-noi.html']
    },
    {
        domain: 'bds.com.vn',
        seeds: ['https://bds.com.vn/cho-thue-nha-dat']
    },
    {
        domain: 'chothuephongtro.me',
        seeds: ['https://chothuephongtro.me/']
    }
];

const delay = (min, max) => {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, time));
};

const PHONE_REGEX = /(?<!\d)(0[35789]\d{8})(?!\d)/g;

const BLACKLIST_PHONES = [
    '0909316890', // Tổng đài phongtro123
    '0313588502', // GPKD phongtro123
    '0287300123', // Hotline
];

// Danh sách các URL quảng cáo/tracker cần chặn để tăng tốc cực độ
const TRACKER_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.com',
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
    'criteo.com', 'hotjar.com', 'zalo.me'
];

const extractPhoneNumbers = (text) => {
    const cleanText = text.replace(/[\s\.\-]/g, '');
    const matches = cleanText.match(PHONE_REGEX);
    return matches ? matches : [];
};

// Đọc toàn bộ các tệp txt có sẵn để lọc trùng
const loadAllExistingPhones = () => {
    const globalPhoneNumbers = new Set();
    const files = fs.readdirSync(__dirname);
    let countFiles = 0;
    for (const file of files) {
        if (file.toLowerCase().endsWith('.txt')) {
            countFiles++;
            try {
                const data = fs.readFileSync(file, 'utf-8');
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g);
                if (matches) {
                    matches.forEach(phone => {
                        if (globalPhoneNumbers.size < 200000) {
                            globalPhoneNumbers.add(phone.trim());
                        }
                    });
                }
            } catch (err) { }
        }
    }
    console.log(`[Deduplication] Quét ${countFiles} file txt, đã nạp ${globalPhoneNumbers.size} SĐT loại trừ.`);
    return globalPhoneNumbers;
};

(async () => {
    console.log(`🚀 Khởi động Trình cào BĐS & Phòng trọ - Lưu tập trung vào ${OUTPUT_FILE}...`);
    console.log(`🎯 Chỉ tiêu: Cào thêm ${TARGET_NEW_PHONES} SĐT mới trong phiên chạy này.`);

    const globalPhoneNumbers = loadAllExistingPhones();
    let newPhoneCountThisSession = 0;
    let isFinished = false;

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1600x900'
        ]
    });

    const runWorker = async (config) => {
        const domain = config.domain;
        const STATE_FILE = `state_bds_${domain}.json`;  // Sử dụng file state độc lập tránh xung đột

        let queue = [...config.seeds];
        let visited = new Set();

        // Khôi phục bộ nhớ cào cũ nếu có
        if (fs.existsSync(STATE_FILE)) {
            try {
                const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                if (stateData.queue && stateData.queue.length > 0) queue = stateData.queue;
                if (stateData.visited) visited = new Set(stateData.visited);
                console.log(`[Tab ${domain}] Phục hồi trạng thái: ${visited.size} link đã quét, ${queue.length} link chờ.`);
            } catch (err) { }
        }

        let page;
        let crawledPagesCount = 0;

        // Hàm giúp tái tạo lại tab trình duyệt để giải phóng RAM triệt để
        const recreatePage = async () => {
            if (page) {
                await page.close().catch(() => { });
            }
            page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.setRequestInterception(true);
            page.on('request', (req) => {
                try {
                    if (req.isInterceptResolutionHandled && req.isInterceptResolutionHandled()) return;
                    const resourceType = req.resourceType();
                    const reqUrl = req.url().toLowerCase();

                    // Chặn Ảnh, CSS, Font và Video để load siêu tốc
                    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                        return req.abort().catch(() => { });
                    }

                    const isTracker = TRACKER_DOMAINS.some(tracker => reqUrl.includes(tracker));
                    if (isTracker) {
                        return req.abort().catch(() => { });
                    }

                    req.continue().catch(() => { });
                } catch (e) { }
            });
        };

        await recreatePage();

        while (queue.length > 0 && !isFinished) {
            const url = queue.shift();
            if (visited.has(url)) continue;
            visited.add(url);

            // Kiểm tra giải phóng bộ nhớ sau mỗi 80 trang
            if (crawledPagesCount > 0 && crawledPagesCount % 80 === 0) {
                console.log(`[Tab ${domain}] 🔄 Đang khởi động lại tab định kỳ để giải phóng bộ nhớ RAM (đã duyệt ${crawledPagesCount} trang)...`);
                await recreatePage();
            }
            crawledPagesCount++;

            console.log(`[Tab ${domain}] ⚡ Quét: ${url} | Đã có thêm: ${newPhoneCountThisSession}/${TARGET_NEW_PHONES}`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
                await delay(200, 500);

                await page.evaluate(async () => {
                    // Click nút hiển thị số điện thoại bị ẩn nếu có
                    const buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
                    buttons.forEach(btn => {
                        const text = btn.innerText ? btn.innerText.toLowerCase() : '';
                        if (text.includes('hiện số') || text.includes('bấm để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                            try { btn.click(); } catch (e) { }
                        }
                    });

                    // Cuộn trang nhanh để kích hoạt load thêm các phần nội dung ẩn / số điện thoại
                    let totalHeight = 0;
                    let distance = 1000;
                    while (totalHeight < document.body.scrollHeight && totalHeight < 5000) {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        await new Promise(r => setTimeout(r, 60));
                    }
                });

                await delay(800, 1200);

                const pageHTML = await page.evaluate(() => {
                    let text = document.body.innerText + " ";
                    document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                    return text;
                });

                const foundPhones = extractPhoneNumbers(pageHTML);
                const newPhonesFound = [];

                if (foundPhones.length > 0) {
                    foundPhones.forEach(phone => {
                        if (!BLACKLIST_PHONES.includes(phone) && !globalPhoneNumbers.has(phone)) {
                            globalPhoneNumbers.add(phone);
                            newPhonesFound.push(phone);
                        }
                    });

                    if (newPhonesFound.length > 0) {
                        newPhoneCountThisSession += newPhonesFound.length;
                        // Ghi ngay lập tức danh sách số điện thoại mới tìm thấy vào file đầu ra tập trung
                        fs.appendFileSync(OUTPUT_FILE, newPhonesFound.join('\n') + '\n', 'utf-8');
                        console.log(`[Tab ${domain}] => ✅ Tìm thấy ${newPhonesFound.length} SĐT mới. File ${OUTPUT_FILE} tăng lên: ${newPhoneCountThisSession} số phiên này.`);
                    }
                }

                // Nếu đã đạt target 4000 số mới thì chấm dứt toàn bộ chiến dịch
                if (newPhoneCountThisSession >= TARGET_NEW_PHONES) {
                    isFinished = true;
                    console.log(`\n🎉 [THÀNH CÔNG RỰC RỠ] Đã đạt chỉ tiêu thu thập ${TARGET_NEW_PHONES} số điện thoại mới!`);
                    break;
                }

                // Thu thập liên kết khám phá tiếp theo
                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
                });

                for (const href of hrefs) {
                    if (href.startsWith('http') && !visited.has(href) && !queue.includes(href)) {
                        if (href.includes(domain)) {
                            // Ưu tiên các trang chi tiết tin đăng (bất động sản, phòng trọ) lên đầu hàng đợi để cào trước
                            if (href.match(/-pr\d+\.html/) || href.match(/\/\d+\.htm/) || href.match(/id\d+/) || href.match(/-\d{5,}\./)) {
                                queue.unshift(href);
                            } else {
                                queue.push(href);
                            }
                        }
                    }
                }

            } catch (error) {
                // console.error(`[Tab ${domain}] Lỗi khi load trang: ${error.message}`);
            }

            // Lưu tiến độ định kỳ
            try {
                fs.writeFileSync(STATE_FILE, JSON.stringify({
                    queue: queue,
                    visited: Array.from(visited)
                }), 'utf-8');
            } catch (e) { }
        }

        await page.close().catch(() => { });
    };

    const workers = [];
    for (const config of DOMAINS_CONFIG) {
        workers.push(runWorker(config));
        await delay(400, 800);
    }

    await Promise.all(workers);

    if (browser) {
        await browser.close();
    }

    // Nếu hoàn thành toàn bộ hàng đợi mà chưa đạt 4000, xóa các file state tạm
    if (newPhoneCountThisSession >= TARGET_NEW_PHONES) {
        DOMAINS_CONFIG.forEach(config => {
            const STATE_FILE = `state_bds_${config.domain}.json`;
            if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
        });
    }

    console.log(`\n🎉 HOÀN TẤT PHIÊN LÀM VIỆC. Đã cào thêm được: ${newPhoneCountThisSession} số điện thoại vào file ${OUTPUT_FILE}.`);

})();
