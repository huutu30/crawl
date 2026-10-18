const puppeteer = require('puppeteer');
const fs = require('fs');

// Cấu hình
const TARGET_COUNT = 10000;
const CHUNK_SIZE = 1000;

// DANH SÁCH 7 TÊN MIỀN HIỆU QUẢ NHẤT (CHẾ ĐỘ TURBO)
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
    'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr', 
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 
    'criteo.com', 'hotjar.com', 'zalo.me'
];

const extractPhoneNumbers = (text) => {
    const cleanText = text.replace(/[\s\.\-]/g, '');
    const matches = cleanText.match(PHONE_REGEX);
    return matches ? matches : [];
};

// Hàm dùng chung để load tất cả số điện thoại đã lưu trong hệ thống vào Set
const loadAllExistingPhones = () => {
    const globalPhoneNumbers = new Set();
    const files = fs.readdirSync(__dirname);
    for (const file of files) {
        if (file.endsWith('.txt') && 
            (file.startsWith('data_') || 
             file.includes('khach_hang') || 
             file.startsWith('binhtan') || 
             file.startsWith('databinhtan') || 
             file.startsWith('binhchanh') || 
             file.startsWith('bc_hm_nb') || 
             file === 'Lich_Su_Da_Xuat.txt')) {
            try {
                const data = fs.readFileSync(file, 'utf-8');
                const phones = data.split('\n').filter(p => p.trim());
                phones.forEach(phone => {
                    if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) globalPhoneNumbers.add(phone.trim());
                });
            } catch (err) {}
        }
    }
    return globalPhoneNumbers;
};

(async () => {
    console.log(`🚀 Khởi động Deep Crawler - CHẾ ĐỘ TURBO TÀNG HÌNH (${DOMAINS_CONFIG.length} Tabs)...`);

    if (fs.existsSync('crawler_state.json') && !fs.existsSync('state_phongtro123.com.json')) {
        fs.renameSync('crawler_state.json', 'state_phongtro123.com.json');
    }
    
    const globalPhoneNumbers = loadAllExistingPhones();
    console.log(`Đã tải tổng cộng ${globalPhoneNumbers.size} số từ toàn bộ các file cũ để chặn trùng lặp.`);

    // CHẾ ĐỘ HEADLESS MỚI ĐỂ CHẠY NGẦM, TIẾT KIỆM TỐI ĐA RAM & CPU
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080'
        ]
    });

    let isFinished = false;

    const runWorker = async (config) => {
        const domain = config.domain;
        const STATE_FILE = `state_${domain}.json`;
        const DATA_FILE_PREFIX = `data_${domain.replace(/\./g, '_')}`; 
        
        let queue = [...config.seeds];
        let visited = new Set();
        const localPhoneNumbers = new Set();

        // PHỤC HỒI DATA CŨ CỦA TAB NÀY ĐỂ KHÔNG BỊ GHI ĐÈ
        const files = fs.readdirSync(__dirname);
        for (const file of files) {
            if (file.startsWith(DATA_FILE_PREFIX) && file.endsWith('.txt')) {
                const data = fs.readFileSync(file, 'utf-8');
                const phones = data.split('\n').filter(p => p.trim());
                phones.forEach(phone => {
                    if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) localPhoneNumbers.add(phone.trim());
                });
            }
        }

        if (fs.existsSync(STATE_FILE)) {
            try {
                const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                if (stateData.queue && stateData.queue.length > 0) {
                    queue = stateData.queue;
                }
                if (stateData.visited) {
                    visited = new Set(stateData.visited);
                }
                console.log(`[Tab ${domain}] Đã khôi phục bộ nhớ: ${visited.size} link đã quét, ${queue.length} link đang chờ.`);
            } catch (err) {}
        }

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const reqUrl = req.url().toLowerCase();
            
            // Chặn Hình ảnh, CSS, Font và Video
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                return req.abort();
            }
            
            // ADBLOCK Tích hợp: Chặn Tracker và Quảng cáo để load cực nhanh
            const isTracker = TRACKER_DOMAINS.some(tracker => reqUrl.includes(tracker));
            if (isTracker) {
                return req.abort();
            }
            
            req.continue();
        });

        while (queue.length > 0 && localPhoneNumbers.size < TARGET_COUNT && !isFinished) {
            const url = queue.shift();
            
            if (visited.has(url)) continue;
            visited.add(url);

            console.log(`[Tab ${domain}] ⚡ Quét: ${url} | Đã gom: ${localPhoneNumbers.size}`);
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                // Ép xung: Giảm thời gian chờ
                await delay(200, 500);

                await page.evaluate(async () => {
                    const buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
                    buttons.forEach(btn => {
                        const text = btn.innerText ? btn.innerText.toLowerCase() : '';
                        if (text.includes('hiện số') || text.includes('bấm để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                            try { btn.click(); } catch (e) {}
                        }
                    });
                    
                    // Ép xung: Cuộn trang tốc độ bàn thờ
                    let totalHeight = 0;
                    let distance = 1000;
                    while (totalHeight < document.body.scrollHeight && totalHeight < 6000) {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        await new Promise(r => setTimeout(r, 50)); 
                    }
                });

                // Ép xung: Rút ngắn thời gian chờ nút bấm phản hồi
                await delay(1000, 1500);

                const pageHTML = await page.evaluate(() => {
                    let text = document.body.innerText + " ";
                    document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                    return text;
                });
                
                const foundPhones = extractPhoneNumbers(pageHTML);
                let newPhonesCount = 0;

                if (foundPhones.length > 0) {
                    foundPhones.forEach(phone => {
                        if (!BLACKLIST_PHONES.includes(phone) && !globalPhoneNumbers.has(phone)) {
                            globalPhoneNumbers.add(phone);
                            localPhoneNumbers.add(phone);
                            newPhonesCount++;
                        }
                    });
                    
                    if (newPhonesCount > 0) {
                        const numbersArray = Array.from(localPhoneNumbers);
                        for (let i = 0; i < numbersArray.length; i += CHUNK_SIZE) {
                            const chunk = numbersArray.slice(i, i + CHUNK_SIZE);
                            const fileName = `${DATA_FILE_PREFIX}_part_${Math.floor(i / CHUNK_SIZE) + 1}.txt`;
                            fs.writeFileSync(fileName, chunk.join('\n') + '\n', 'utf-8');
                        }
                        
                        console.log(`[Tab ${domain}] => ✅ Thêm ${newPhonesCount} số. Tổng tab: ${localPhoneNumbers.size}`);
                    }
                }

                if (globalPhoneNumbers.size >= TARGET_COUNT * DOMAINS_CONFIG.length) {
                    isFinished = true;
                    console.log(`\n[THÀNH CÔNG] Đã đạt giới hạn tối đa.`);
                    break;
                }

                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
                });

                for (const href of hrefs) {
                    if (href.startsWith('http') && !visited.has(href) && !queue.includes(href)) {
                        if (href.includes(domain)) {
                            if (href.match(/-pr\d+\.html/) || href.match(/\/\d+\.htm/) || href.match(/id\d+/) || href.match(/-\d{5,}\./)) {
                                queue.unshift(href);
                            } 
                            else {
                                queue.push(href);
                            }
                        }
                    }
                }

            } catch (error) {}

            try {
                fs.writeFileSync(STATE_FILE, JSON.stringify({
                    queue: queue,
                    visited: Array.from(visited)
                }), 'utf-8');
            } catch(e) {}
        }
        
        await page.close();
    };

    const workers = [];
    for (const config of DOMAINS_CONFIG) {
        workers.push(runWorker(config));
        // Tạo một khoảng thời gian giãn cách nhỏ để máy không bị sốc RAM khi spawn browser
        await delay(300, 600);
    }

    await Promise.all(workers);

    if (browser) {
        await browser.close();
    }
    console.log(`\n🎉 KẾT THÚC! Tổng cộng cả hệ thống đã có: ${globalPhoneNumbers.size} số.`);

})();
