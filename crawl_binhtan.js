const puppeteer = require('puppeteer');
const fs = require('fs');

const TARGET_COUNT = 5000;
const OUTPUT_FILE = 'data_tram.txt';

// Cấu hình Seed URLs tập trung 100% vào Quận Bình Tân
const DOMAINS_CONFIG = [
    {
        domain: 'nha.chotot.com',
        seeds: ['https://nha.chotot.com/tp-ho-chi-minh/quan-binh-tan/cho-thue-bat-dong-san', 'https://nha.chotot.com/tp-ho-chi-minh/quan-binh-tan/mua-ban-bat-dong-san']
    },
    {
        domain: 'phongtro123.com',
        seeds: ['https://phongtro123.com/quan-binh-tan']
    },
    {
        domain: 'bds123.vn',
        seeds: ['https://bds123.vn/nha-dat-ban-quan-binh-tan-ho-chi-minh.html', 'https://bds123.vn/cho-thue-nha-dat-quan-binh-tan-ho-chi-minh.html']
    },
    {
        domain: 'tromoi.com',
        seeds: ['https://tromoi.com/cho-thue-phong-tro-quan-binh-tan-ho-chi-minh']
    },
    {
        domain: 'guland.vn',
        seeds: ['https://guland.vn/ban-do-gia/ho-chi-minh/quan-binh-tan']
    },
    {
        domain: 'thuecanho123.com',
        seeds: ['https://thuecanho123.com/cho-thue-can-ho-chung-cu-quan-binh-tan-ho-chi-minh.html']
    },
    {
        domain: 'alonhadat.com.vn',
        seeds: ['https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/quan-binh-tan.html']
    },
    {
        domain: 'homedy.com',
        seeds: ['https://homedy.com/cho-thue-nha-dat-quan-binh-tan-tp-ho-chi-minh']
    },
    {
        domain: 'chothuenha.com.vn',
        seeds: ['https://chothuenha.com.vn/cho-thue-nha-quan-binh-tan-ho-chi-minh']
    },
    {
        domain: 'bds.com.vn',
        seeds: ['https://bds.com.vn/cho-thue-nha-dat-quan-binh-tan-ho-chi-minh']
    },
    {
        domain: 'chothuephongtro.me',
        seeds: ['https://chothuephongtro.me/cho-thue-phong-tro-quan-binh-tan.html']
    },
    {
        domain: 'i-batdongsan.com',
        seeds: ['https://i-batdongsan.com/cho-thue-nha-dat-quan-binh-tan.htm']
    },
    {
        domain: 'phongtromoi.com',
        seeds: ['https://phongtromoi.com/cho-thue-phong-tro-quan-binh-tan']
    }
];

const delay = (min, max) => {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, time));
};

const PHONE_REGEX = /(?<!\d)(0[35789]\d{8})(?!\d)/g;
const BLACKLIST_PHONES = ['0909316890', '0313588502', '0287300123'];
const TRACKER_DOMAINS = ['google-analytics.com', 'googletagmanager.com', 'facebook.com/tr', 'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'criteo.com', 'hotjar.com', 'zalo.me'];

const extractPhoneNumbers = (text) => {
    // Regex tối ưu để khớp số điện thoại Việt Nam (cho phép có dấu cách, dấu chấm, gạch ngang, gạch chéo, gạch dưới)
    // Tránh việc ghép các chữ số ngẫu nhiên ở cách xa nhau tạo thành số điện thoại giả
    const regex = /(?<!\d)(0[35789](?:[ ._/-]?\d){8})(?!\d)/g;
    const matches = text.match(regex);
    if (!matches) return [];
    return matches.map(m => m.replace(/[ ._/-]/g, ''));
};

const loadAllOtherPhones = () => {
    const otherPhones = new Set();
    const files = fs.readdirSync(__dirname);
    for (const file of files) {
        if (file.endsWith('.txt') && file !== OUTPUT_FILE) {
            try {
                const data = fs.readFileSync(file, 'utf-8');
                // Trích xuất và chuẩn hóa tất cả số điện thoại từ các file khác để loại bỏ trùng lặp triệt để
                const phones = extractPhoneNumbers(data);
                phones.forEach(phone => otherPhones.add(phone));
            } catch (err) {}
        }
    }
    return otherPhones;
};

(async () => {
    console.log(`🚀 Khởi động Crawler Chuyên Biệt - CHIẾN DỊCH QUẬN BÌNH TÂN...`);

    const globalPhoneNumbers = new Set();
    if (fs.existsSync(OUTPUT_FILE)) {
        const data = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        data.split('\n').filter(p => p.trim()).forEach(phone => globalPhoneNumbers.add(phone.trim()));
    }

    const blockerPhoneNumbers = loadAllOtherPhones();
    console.log(`Đã tải: ${globalPhoneNumbers.size} số cũ ở file ${OUTPUT_FILE}. Chặn trùng thêm ${blockerPhoneNumbers.size} số từ các file khác.`);

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu']
    });

    let isFinished = false;

    const runWorker = async (config) => {
        const domain = config.domain;
        // Dùng file trạng thái riêng để không bị nhầm lẫn với file của index.js
        const STATE_FILE = `state_binhtan_${domain}.json`;

        let queue = [...config.seeds];
        let visited = new Set();

        if (fs.existsSync(STATE_FILE)) {
            try {
                const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                if (stateData.queue && stateData.queue.length > 0) queue = stateData.queue;
                if (stateData.visited) visited = new Set(stateData.visited);
            } catch (err) { }
        }

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const reqUrl = req.url().toLowerCase();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) return req.abort();
            if (TRACKER_DOMAINS.some(tracker => reqUrl.includes(tracker))) return req.abort();
            req.continue();
        });

        while (queue.length > 0 && !isFinished) {
            const url = queue.shift();
            if (visited.has(url)) continue;
            visited.add(url);

            console.log(`[Bình Tân - ${domain}] ⚡ Quét: ${url}`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await delay(200, 500);

                await page.evaluate(async () => {
                    const buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
                    buttons.forEach(btn => {
                        const text = btn.innerText ? btn.innerText.toLowerCase() : '';
                        if (text.includes('hiện số') || text.includes('bấm để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                            try { btn.click(); } catch (e) { }
                        }
                    });

                    let totalHeight = 0;
                    let distance = 1000;
                    while (totalHeight < document.body.scrollHeight && totalHeight < 6000) {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        await new Promise(r => setTimeout(r, 50));
                    }
                });

                await delay(1000, 1500);

                const pageHTML = await page.evaluate(() => {
                    let text = document.body.innerText + " ";
                    document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                    return text;
                });

                // LỌC NGHIÊM NGẶT 2 LỚP: URL hoặc Nội dung trang phải có từ khóa Bình Tân
                const lowerText = pageHTML.toLowerCase();
                const isBinhTan = url.toLowerCase().includes('binh-tan') || lowerText.includes('bình tân') || lowerText.includes('binh tan') || lowerText.includes('bình-tân');

                if (isBinhTan) {
                    const foundPhones = extractPhoneNumbers(pageHTML);
                    let newPhonesCount = 0;

                    if (foundPhones.length > 0) {
                        foundPhones.forEach(phone => {
                            if (!BLACKLIST_PHONES.includes(phone) && !globalPhoneNumbers.has(phone) && !blockerPhoneNumbers.has(phone)) {
                                globalPhoneNumbers.add(phone);
                                newPhonesCount++;
                            }
                        });

                        if (newPhonesCount > 0) {
                            fs.writeFileSync(OUTPUT_FILE, Array.from(globalPhoneNumbers).join('\n') + '\n', 'utf-8');
                            console.log(`[Bình Tân - ${domain}] => 🎯 TÌM THẤY ${newPhonesCount} SỐ Ở BÌNH TÂN. Tổng: ${globalPhoneNumbers.size}`);
                        }
                    }
                } else {
                    console.log(`[Bình Tân - ${domain}] => ❌ Bỏ qua (Tin đăng không thuộc Bình Tân)`);
                }

                if (globalPhoneNumbers.size >= TARGET_COUNT) {
                    isFinished = true;
                    break;
                }

                const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href));

                for (const href of hrefs) {
                    if (href.startsWith('http') && !visited.has(href) && !queue.includes(href) && href.includes(domain)) {
                        const hrefLower = href.toLowerCase();
                        const isDetailPage = href.match(/-pr\d+\.html/) || href.match(/\/\d+\.htm/) || href.match(/id\d+/) || href.match(/-\d{5,}\./);

                        if (isDetailPage) {
                            // Trang chi tiết: Đưa lên đầu hàng đợi để quét ngay
                            queue.unshift(href);
                        } else {
                            // Trang danh sách/bộ lọc: Phải khớp khu vực mục tiêu, đưa xuống cuối hàng đợi
                            if (hrefLower.includes('binh-tan') || hrefLower.includes('binh-tân') || hrefLower.includes('binhtan')) {
                                queue.push(href);
                            }
                        }
                    }
                }

            } catch (error) { }

            try {
                fs.writeFileSync(STATE_FILE, JSON.stringify({ queue: queue, visited: Array.from(visited) }), 'utf-8');
            } catch (e) { }
        }
        try {
            await page.close();
        } catch (e) {}
    };

    const workers = [];
    for (const config of DOMAINS_CONFIG) {
        workers.push(runWorker(config));
        await delay(300, 600);
    }

    await Promise.all(workers);
    if (browser) await browser.close();
    console.log(`\n🎉 KẾT THÚC CHIẾN DỊCH BÌNH TÂN! Tổng cộng thu được: ${globalPhoneNumbers.size} số.`);
})();
