const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'ngoaithanh.txt';
const STATE_FILE = 'crawl_state_tieu_thuong.json';

// Danh sách toàn bộ 137 phường, xã, thị trấn của 10 quận/huyện mục tiêu
const TARGET_AREAS = [
    // --- 1. BÌNH TÂN (10 Phường) ---
    'Phường Bình Hưng Hòa Bình Tân',
    'Phường Bình Hưng Hòa A Bình Tân',
    'Phường Bình Hưng Hòa B Bình Tân',
    'Phường Bình Trị Đông Bình Tân',
    'Phường Bình Trị Đông A Bình Tân',
    'Phường Bình Trị Đông B Bình Tân',
    'Phường Tân Tạo Bình Tân',
    'Phường Tân Tạo A Bình Tân',
    'Phường An Lạc Bình Tân',
    'Phường An Lạc A Bình Tân',
    
    // --- 2. QUẬN 5 (14 Phường) ---
    'Phường 1 Quận 5',
    'Phường 2 Quận 5',
    'Phường 3 Quận 5',
    'Phường 4 Quận 5',
    'Phường 5 Quận 5',
    'Phường 6 Quận 5',
    'Phường 7 Quận 5',
    'Phường 8 Quận 5',
    'Phường 9 Quận 5',
    'Phường 10 Quận 5',
    'Phường 11 Quận 5',
    'Phường 12 Quận 5',
    'Phường 13 Quận 5',
    'Phường 14 Quận 5',
    
    // --- 3. QUẬN 6 (14 Phường) ---
    'Phường 1 Quận 6',
    'Phường 2 Quận 6',
    'Phường 3 Quận 6',
    'Phường 4 Quận 6',
    'Phường 5 Quận 6',
    'Phường 6 Quận 6',
    'Phường 7 Quận 6',
    'Phường 8 Quận 6',
    'Phường 9 Quận 6',
    'Phường 10 Quận 6',
    'Phường 11 Quận 6',
    'Phường 12 Quận 6',
    'Phường 13 Quận 6',
    'Phường 14 Quận 6',
    
    // --- 4. QUẬN 8 (16 Phường) ---
    'Phường 1 Quận 8',
    'Phường 2 Quận 8',
    'Phường 3 Quận 8',
    'Phường 4 Quận 8',
    'Phường 5 Quận 8',
    'Phường 6 Quận 8',
    'Phường 7 Quận 8',
    'Phường 8 Quận 8',
    'Phường 9 Quận 8',
    'Phường 10 Quận 8',
    'Phường 11 Quận 8',
    'Phường 12 Quận 8',
    'Phường 13 Quận 8',
    'Phường 14 Quận 8',
    'Phường 15 Quận 8',
    'Phường 16 Quận 8',
    
    // --- 5. QUẬN 12 (11 Phường) ---
    'Phường An Phú Đông Quận 12',
    'Phường Đông Hưng Thuận Quận 12',
    'Phường Hiệp Thành Quận 12',
    'Phường Tân Chánh Hiệp Quận 12',
    'Phường Tân Hưng Thuận Quận 12',
    'Phường Tân Thới Hiệp Quận 12',
    'Phường Tân Thới Nhất Quận 12',
    'Phường Thạnh Lộc Quận 12',
    'Phường Thạnh Xuân Quận 12',
    'Phường Thới An Quận 12',
    'Phường Trung Mỹ Tây Quận 12',
    
    // --- 6. GÒ VẤP (16 Phường) ---
    'Phường 1 Gò Vấp',
    'Phường 3 Gò Vấp',
    'Phường 4 Gò Vấp',
    'Phường 5 Gò Vấp',
    'Phường 6 Gò Vấp',
    'Phường 7 Gò Vấp',
    'Phường 8 Gò Vấp',
    'Phường 9 Gò Vấp',
    'Phường 10 Gò Vấp',
    'Phường 11 Gò Vấp',
    'Phường 12 Gò Vấp',
    'Phường 13 Gò Vấp',
    'Phường 14 Gò Vấp',
    'Phường 15 Gò Vấp',
    'Phường 16 Gò Vấp',
    'Phường 17 Gò Vấp',
    
    // --- 7. BÌNH CHÁNH (1 Thị trấn, 15 Xã) ---
    'Thị trấn Tân Túc Bình Chánh',
    'Xã An Phú Tây Bình Chánh',
    'Xã Bình Chánh Bình Chánh',
    'Xã Bình Hưng Bình Chánh',
    'Xã Bình Lợi Bình Chánh',
    'Xã Đa Phước Bình Chánh',
    'Xã Hưng Long Bình Chánh',
    'Xã Lê Minh Xuân Bình Chánh',
    'Xã Phạm Văn Hai Bình Chánh',
    'Xã Phong Phú Bình Chánh',
    'Xã Quy Đức Bình Chánh',
    'Xã Tân Kiên Bình Chánh',
    'Xã Tân Nhựt Bình Chánh',
    'Xã Tân Quý Tây Bình Chánh',
    'Xã Vĩnh Lộc A Bình Chánh',
    'Xã Vĩnh Lộc B Bình Chánh',
    
    // --- 8. HÓC MÔN (1 Thị trấn, 11 Xã) ---
    'Thị trấn Hóc Môn Hóc Môn',
    'Xã Bà Điểm Hóc Môn',
    'Xã Đông Thạnh Hóc Môn',
    'Xã Nhị Bình Hóc Môn',
    'Xã Tân Hiệp Hóc Môn',
    'Xã Tân Thới Nhì Hóc Môn',
    'Xã Tân Xuân Hóc Môn',
    'Xã Thới Tam Thôn Hóc Môn',
    'Xã Trung Chánh Hóc Môn',
    'Xã Xuân Thới Đông Hóc Môn',
    'Xã Xuân Thới Sơn Hóc Môn',
    'Xã Xuân Thới Thượng Hóc Môn',
    
    // --- 9. NHÀ BÈ (1 Thị trấn, 6 Xã) ---
    'Thị trấn Nhà Bè Nhà Bè',
    'Xã Hiệp Phước Nhà Bè',
    'Xã Long Thới Nhà Bè',
    'Xã Nhơn Đức Nhà Bè',
    'Xã Phú Xuân Nhà Bè',
    'Xã Phước Kiển Nhà Bè',
    'Xã Phước Lộc Nhà Bè',
    
    // --- 10. CỦ CHI (1 Thị trấn, 20 Xã) ---
    'Thị trấn Củ Chi Củ Chi',
    'Xã An Nhơn Tây Củ Chi',
    'Xã An Phú Củ Chi',
    'Xã Bình Mỹ Củ Chi',
    'Xã Hòa Phú Củ Chi',
    'Xã Nhuận Đức Củ Chi',
    'Xã Phạm Văn Cội Củ Chi',
    'Xã Phú Hòa Đông Củ Chi',
    'Xã Phú Mỹ Hưng Củ Chi',
    'Xã Phước Hiệp Củ Chi',
    'Xã Phước Thạnh Củ Chi',
    'Xã Phước Vĩnh An Củ Chi',
    'Xã Tân An Hội Củ Chi',
    'Xã Tân Phú Trung Củ Chi',
    'Xã Tân Thạnh Đông Củ Chi',
    'Xã Tân Thạnh Tây Củ Chi',
    'Xã Tân Thông Hội Củ Chi',
    'Xã Trung An Củ Chi',
    'Xã Trung Lập Hạ Củ Chi',
    'Xã Trung Lập Thượng Củ Chi',
    'Xã Thái Mỹ Củ Chi'
];

// Danh sách 18 từ khóa tiểu thương, đại lý và ngành nghề giàu ngầm
const KEYWORDS = [
    // --- Ăn uống, làm đẹp & Bán lẻ phổ thông ---
    'tạp hóa',
    'tiệm tạp hóa',
    'cửa hàng tạp hóa',
    'shop quần áo',
    'tiệm tóc',
    'salon tóc',
    'tiệm nail',
    'quán ăn',
    'quán lẩu',
    'quán cafe',
    
    // --- Cơ khí, Xây dựng, Sửa chữa ---
    'sửa xe máy',
    'cửa hàng điện nước',
    'tiệm nhôm kính',
    'đại lý sơn',
    'đồ sắt kim khí',
    
    // --- Đại lý bán buôn & dịch vụ thiết yếu ---
    'đại lý gạo',
    'đại lý gas',
    'quầy thuốc'
];

const TRACKER_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.com', 
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 
    'criteo.com', 'hotjar.com'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadExistingPhones = () => {
    const currentPhones = new Set();
    const files = fs.readdirSync(__dirname);
    let txtFileCount = 0;
    
    for (const file of files) {
        if (file.toLowerCase().endsWith('.txt')) {
            txtFileCount++;
            try {
                const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g);
                if (matches) {
                    matches.forEach(phone => currentPhones.add(phone));
                }
            } catch (e) {
                console.error(`Lỗi đọc file ${file}:`, e.message);
            }
        }
    }
    console.log(`[Deduplication] Đã quét ${txtFileCount} file .txt, nạp ${currentPhones.size} SĐT duy nhất vào danh sách chặn trùng.`);
    return currentPhones;
};

// Hàm đọc tiến độ đã cào
const loadCrawlState = () => {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        } catch (e) {
            console.error(`Lỗi đọc file tiến độ ${STATE_FILE}:`, e.message);
        }
    }
    return { completed: {} };
};

// Hàm lưu tiến độ đã cào
const saveCrawlState = (state) => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Lỗi ghi file tiến độ ${STATE_FILE}:`, e.message);
    }
};

const appendPhones = (newPhones) => {
    if (newPhones.length === 0) return;
    try {
        fs.appendFileSync(OUTPUT_FILE, newPhones.join('\n') + '\n', 'utf-8');
    } catch (e) {
        console.error(`Lỗi ghi file ${OUTPUT_FILE}:`, e);
    }
};

(async () => {
    console.log("🚀 KHỞI ĐỘNG TRÌNH THU THẬP SĐT TIỂU THƯƠNG SIÊU TỐC QUA GOOGLE MAPS...");
    
    const existingPhones = loadExistingPhones();
    const crawlState = loadCrawlState();
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1200,900'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        const reqUrl = req.url().toLowerCase();
        if (['image', 'media', 'font'].includes(resourceType)) {
            return req.abort();
        }
        const isTracker = TRACKER_DOMAINS.some(domain => reqUrl.includes(domain));
        if (isTracker) {
            return req.abort();
        }
        req.continue();
    });
    
    let totalCollectedThisSession = 0;
    
    for (const area of TARGET_AREAS) {
        for (const kw of KEYWORDS) {
            const query = `${kw} ${area}`;
            
            // Nếu truy vấn này đã được cào xong trước đó -> bỏ qua hoàn toàn không gọi Google Maps nữa
            if (crawlState.completed[query]) {
                continue;
            }
            
            const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
            console.log(`\n🔍 Đang tìm kiếm: "${query}"...`);
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForSelector('div[role="feed"]', { timeout: 4000 }).catch(() => {});
                
                await page.evaluate(async () => {
                    const getFeedContainer = () => {
                        let container = document.querySelector('div[role="feed"]');
                        if (!container) {
                            const divs = Array.from(document.querySelectorAll('div'));
                            container = divs.find(d => {
                                const style = window.getComputedStyle(d);
                                return (style.overflowY === 'scroll' || style.overflowY === 'auto') && d.scrollHeight > d.clientHeight;
                            });
                        }
                        return container;
                    };
                    
                    const container = getFeedContainer();
                    if (container) {
                        for (let i = 0; i < 5; i++) {
                            container.scrollTop = container.scrollHeight;
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    } else {
                        for (let i = 0; i < 5; i++) {
                            window.scrollBy(0, 1000);
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    }
                });
                
                const pageText = await page.evaluate(() => document.body.innerText);
                const phoneRegex = /(?:\+84|0)(?:\s*\d){9,11}/g;
                const matches = pageText.match(phoneRegex) || [];
                
                const newPhonesFound = [];
                const mobilePrefixRegex = /^(?:84|0)(?:9|3|5|7|8)\d{8}$/;
                
                for (const rawPhone of matches) {
                    let clean = rawPhone.replace(/[.\s-]/g, '');
                    if (clean.startsWith('+84')) {
                        clean = '0' + clean.slice(3);
                    } else if (clean.startsWith('84')) {
                        clean = '0' + clean.slice(2);
                    }
                    
                    if (mobilePrefixRegex.test(clean) && !existingPhones.has(clean)) {
                        existingPhones.add(clean);
                        newPhonesFound.push(clean);
                    }
                }
                
                if (newPhonesFound.length > 0) {
                    appendPhones(newPhonesFound);
                    totalCollectedThisSession += newPhonesFound.length;
                    
                    let ngoaithanhCount = 0;
                    if (fs.existsSync(OUTPUT_FILE)) {
                        ngoaithanhCount = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n').filter(p => p.trim()).length;
                    }
                    console.log(`  => ✅ Tìm thấy ${newPhonesFound.length} SĐT mới. File ngoaithanh.txt hiện có: ${ngoaithanhCount} số.`);
                } else {
                    console.log(`  => ❌ Không tìm thấy SĐT mới nào (hoặc trùng).`);
                }
                
                // Đánh dấu hoàn thành truy vấn này và lưu lại tiến độ
                crawlState.completed[query] = true;
                saveCrawlState(crawlState);
                
                await delay(1000);
                
            } catch (err) {
                console.error(`  => ⚠️ Lỗi khi cào "${query}": ${err.message}`);
            }
        }
    }
    
    console.log(`\n🎉 HOÀN THÀNH CHIẾN DỊCH!`);
    console.log(`- Số SĐT mới thu được: ${totalCollectedThisSession}`);
    
    // Xóa file lưu tiến độ khi đã hoàn thành toàn bộ chiến dịch
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
    
    await browser.close();
})();
