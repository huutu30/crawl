const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// BẢN BACKUP: KIẾN TRÚC HÀNG ĐỢI CHUNG (SHARED QUEUE)
// Thích hợp để mở nhiều tab "tấn công" cào thật sâu vào DUY NHẤT 1 TRANG WEB.
// ==========================================

const TARGET_COUNT = 10000;
const CHUNK_SIZE = 1000;
const OUTPUT_FILE = 'data_khach_hang_shared.txt';
const STATE_FILE = 'crawler_state_shared.json';
const MAX_CONCURRENT_PAGES = 5; // Mở 5 tab cào chung 1 đống link

// CHÚ Ý: Ở phiên bản này, bạn chỉ nên để link của 1 web duy nhất (ví dụ phongtro123) 
// để 5 tab cùng dồn lực cào web đó mà không bị loãng data.
const SEED_URLS = [
    'https://phongtro123.com/tinh-thanh/ha-noi',
    'https://phongtro123.com/tinh-thanh/ho-chi-minh',
    'https://phongtro123.com/tinh-thanh/binh-duong',
    'https://phongtro123.com/tinh-thanh/dong-nai'
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

const extractPhoneNumbers = (text) => {
    const cleanText = text.replace(/[\s\.\-]/g, '');
    const matches = cleanText.match(PHONE_REGEX);
    return matches ? matches : [];
};

(async () => {
    console.log(`[BACKUP] Khởi động Deep Crawler (Hàng đợi chung - ${MAX_CONCURRENT_PAGES} Tabs)...`);
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-notifications']
    });

    const allPhoneNumbers = new Set();

    if (fs.existsSync(OUTPUT_FILE)) {
        const existingData = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        const existingPhones = existingData.split('\n').filter(p => p.trim());
        existingPhones.forEach(phone => {
            if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) allPhoneNumbers.add(phone.trim());
        });
    }

    // Tải thêm từ các file chunk nếu có
    for (let i = 1; i <= Math.ceil(TARGET_COUNT / CHUNK_SIZE); i++) {
        const fileName = `data_khach_hang_shared_part_${i}.txt`;
        if (fs.existsSync(fileName)) {
            const existingData = fs.readFileSync(fileName, 'utf-8');
            const existingPhones = existingData.split('\n').filter(p => p.trim());
            existingPhones.forEach(phone => {
                if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) allPhoneNumbers.add(phone.trim());
            });
        }
    }
    console.log(`Đã tải ${allPhoneNumbers.size} số từ file cũ.`);

    let queue = [...SEED_URLS];
    let visited = new Set();

    if (fs.existsSync(STATE_FILE)) {
        try {
            const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            if (stateData.queue && stateData.queue.length > 0) {
                queue = stateData.queue;
            }
            if (stateData.visited) {
                visited = new Set(stateData.visited);
            }
            console.log(`Đã khôi phục bộ nhớ: nhớ được ${visited.size} link đã quét, còn ${queue.length} link đang chờ.`);
        } catch (err) {
            console.log('Không thể đọc file trạng thái, bắt đầu quét lại từ đầu.');
        }
    }

    let activeWorkers = 0;
    let isFinished = false;

    // Hàm tạo 1 worker (tab)
    const runWorker = async (workerId) => {
        activeWorkers++;
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        while (queue.length > 0 && allPhoneNumbers.size < TARGET_COUNT && !isFinished) {
            // Lấy link ra khỏi hàng đợi chung (các tab tự động chia nhau link)
            const url = queue.shift();
            
            if (visited.has(url)) continue;
            visited.add(url);

            console.log(`\n[Tab ${workerId}] Đang quét: ${url} | Tiến độ chung: ${allPhoneNumbers.size}/${TARGET_COUNT}`);
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await delay(1000, 2000);

                await page.evaluate(async () => {
                    const buttons = document.querySelectorAll('button, div[role="button"]');
                    buttons.forEach(btn => {
                        const text = btn.innerText ? btn.innerText.toLowerCase() : '';
                        if (text.includes('hiện số') || text.includes('bấm để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                            try { btn.click(); } catch (e) {}
                        }
                    });
                    
                    let totalHeight = 0;
                    let distance = 500;
                    while (totalHeight < document.body.scrollHeight && totalHeight < 4000) {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        await new Promise(r => setTimeout(r, 100));
                    }
                });

                await delay(2000, 3000);

                const pageHTML = await page.evaluate(() => {
                    let text = document.body.innerText + " ";
                    document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                    return text;
                });
                
                const foundPhones = extractPhoneNumbers(pageHTML);
                let newPhonesCount = 0;

                if (foundPhones.length > 0) {
                    foundPhones.forEach(phone => {
                        if (!BLACKLIST_PHONES.includes(phone) && !allPhoneNumbers.has(phone)) {
                            allPhoneNumbers.add(phone);
                            newPhonesCount++;
                        }
                    });
                    
                    if (newPhonesCount > 0) {
                        // Ghi file đồng bộ theo từng chunk (mỗi file 1000 số)
                        const numbersArray = Array.from(allPhoneNumbers);
                        for (let i = 0; i < numbersArray.length; i += CHUNK_SIZE) {
                            const chunk = numbersArray.slice(i, i + CHUNK_SIZE);
                            const fileName = `data_khach_hang_shared_part_${Math.floor(i / CHUNK_SIZE) + 1}.txt`;
                            fs.writeFileSync(fileName, chunk.join('\n') + '\n', 'utf-8');
                        }
                        fs.writeFileSync(OUTPUT_FILE, numbersArray.join('\n') + '\n', 'utf-8');
                        
                        console.log(`[Tab ${workerId}] => Thêm ${newPhonesCount} số mới. Tổng: ${allPhoneNumbers.size}/${TARGET_COUNT}`);
                    } else {
                        console.log(`[Tab ${workerId}] => Các số trên trang này đã bị trùng.`);
                    }
                } else {
                    console.log(`[Tab ${workerId}] => Không có số điện thoại nào.`);
                }

                if (allPhoneNumbers.size >= TARGET_COUNT) {
                    isFinished = true;
                    console.log(`\n[THÀNH CÔNG] Đã thu thập đủ ${TARGET_COUNT} số điện thoại!`);
                    break;
                }

                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
                });

                for (const href of hrefs) {
                    if (href.startsWith('http') && !visited.has(href) && !queue.includes(href)) {
                        // Chặn web rác nếu có lọt vào
                        if (href.includes('id.chotot.com') || href.includes('facebook.com') || href.includes('zalo.me')) {
                            continue;
                        }
                        
                        if (href.match(/-pr\d+\.html/) || href.match(/\/\d+\.htm/) || href.match(/id\d+/) || href.match(/-\d{5,}\./)) {
                            queue.unshift(href);
                        } 
                        else {
                            queue.push(href);
                        }
                    }
                }

            } catch (error) {
                console.error(`[Tab ${workerId}] Lỗi tải trang: ${error.message}`);
            }

            try {
                // Sử dụng block try-catch để ngăn lỗi đồng thời khi ghi file JSON
                fs.writeFileSync(STATE_FILE, JSON.stringify({
                    queue: queue,
                    visited: Array.from(visited)
                }), 'utf-8');
            } catch(e) {}
        }
        
        await page.close();
        activeWorkers--;
    };

    // Khởi động các worker
    const workers = [];
    for (let i = 1; i <= MAX_CONCURRENT_PAGES; i++) {
        workers.push(runWorker(i));
        await delay(500, 1000);
    }

    await Promise.all(workers);

    if (browser) {
        await browser.close();
    }
    console.log(`\nKẾT THÚC! Tổng cộng đã thu thập được: ${allPhoneNumbers.size} số.`);

})();
