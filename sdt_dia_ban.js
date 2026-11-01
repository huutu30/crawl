/**
 * SDT_DIA_BAN.JS - CÔNG CỤ THU THẬP SĐT CHUYÊN SÂU QUẬN BÌNH TÂN (TP.HCM)
 * ------------------------------------------------------------------------------------
 * Phạm vi: DUY NHẤT QUẬN BÌNH TÂN (TP.HCM) - Quét vi mô vét cạn mọi ngóc ngách:
 *  - 10 Phường hành chính
 *  - 80+ Tuyến đường huyết mạch, đường nhánh, hẻm lớn
 *  - Các Khu dân cư (Tên Lửa, Vĩnh Lộc, Nam Hùng Vương, Hai Thành, Akari, Moonlight...)
 *  - Các Khu công nghiệp (KCN Tân Tạo, KCN Vĩnh Lộc, Tân Bình mở rộng)
 *  - Các chợ truyền thống và trung tâm thương mại (Aeon Mall, Chợ Bà Hom, Da Sà...)
 * 
 * Kiến trúc & Hiệu năng:
 *  - Concurrency: 6 tab song song
 *  - Chu kỳ xả RAM: Mỗi 150 truy vấn đóng/mở lại toàn bộ Browser để đưa RAM về mức tối thiểu
 *  - Giới hạn V8 heap 512MB/tab + Tái tạo tab con mỗi 25 lượt chống rò rỉ bộ nhớ
 *  - Tự động lọc trùng (Dedup) với toàn bộ kho số hiện có trong thư mục (100.000+ số)
 *  - Xuất ra file riêng: sdt_binh_tan.txt
 *  - Lưu tiến độ: sdt_dia_ban_state.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ===== CẤU HÌNH TỐI ƯU & CHỐNG CHẶN =====
const OUTPUT_FILE = 'sdt_binh_tan.txt';
const STATE_FILE = 'sdt_dia_ban_state.json';
const CONCURRENCY = 6;           // 6 luồng song song: cân bằng tốc độ và chống block IP
const CYCLE_QUERIES = 150;       // Đóng/khởi động lại toàn bộ Browser sau mỗi 150 truy vấn để xả 100% RAM rác
const PAGE_TIMEOUT_MS = 12000;   // 12s timeout mỗi truy vấn
const TAB_RECYCLE_AFTER = 25;    // Tái tạo tab sau mỗi 25 truy vấn để dọn DOM cache
const DELAY_MIN = 500;           // Delay tự nhiên 500ms
const DELAY_MAX = 900;           // Delay tối đa 900ms

// Danh sách User-Agents xoay vòng (Chrome / Edge thực tế)
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// ===== REGEX =====
const PHONE_REGEX_RAW = /(?:\+84|0)[\d\s.\-()]{8,15}\d/g;
const MOBILE_PREFIX = /^0[35789]\d{8}$/;

// ===== CÁC DOMAIN/LOẠI TÀI NGUYÊN CẦN CHẶN ĐỂ TỐI ƯU TỐC ĐỘ =====
const BLOCK_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);
const BLOCK_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.com',
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
    'criteo.com', 'hotjar.com',
];

// ===== TỪ KHÓA NGÀNH HÀNG ĐẶC TRƯNG TẠI BÌNH TÂN =====
const KEYWORDS = [
    // 1. Ẩm thực & Đồ uống
    'quán ăn', 'nhà hàng', 'quán cafe', 'quán nhậu', 'tiệm trà sữa',
    'tiệm bánh ngọt', 'bún bò', 'cơm tấm', 'quán ốc', 'quán lẩu',
    'quán nướng', 'quán bia', 'cafe sân vườn', 'quán chè',

    // 2. Làm đẹp & Sức khỏe
    'tiệm cắt tóc', 'salon tóc', 'tiệm nail', 'spa làm đẹp',
    'thẩm mỹ viện', 'phòng khám nha khoa', 'phòng khám đa khoa',
    'nhà thuốc tây', 'phòng khám tai mũi họng', 'phòng khám sản phụ khoa',

    // 3. Dịch vụ đời sống & Tiện ích
    'tiệm giặt ủi', 'in ấn photocopy', 'đại lý gas', 'đại lý gạo',
    'dịch vụ chuyển nhà', 'tiệm vàng', 'siêu thị mini', 'tạp hóa',
    'shop quần áo', 'cửa hàng mỹ phẩm', 'cửa hàng điện thoại',
    'đại lý bia nước ngọt', 'cửa hàng đồ gia dụng',

    // 4. Cơ khí, Xưởng may & Sản xuất gia công (Thế mạnh Bình Tân)
    'xưởng may gia công', 'tiệm may đo', 'cửa hàng vải',
    'tiệm sửa xe máy', 'tiệm vá vỏ xe tải', 'gara ô tô', 'rửa xe ô tô',
    'phụ tùng ô tô', 'phụ tùng xe máy', 'cửa hàng xe máy', 'tiệm dán phim xe',
    'sửa điện lạnh', 'thu mua phế liệu', 'xưởng mộc',

    // 5. Xây dựng & Nội thất
    'nhôm kính xingfa', 'cửa sắt cơ khí', 'cửa cuốn', 'vật liệu xây dựng',
    'cửa hàng đèn chiếu sáng', 'tiệm decal', 'nội thất decor', 'sơn nước chống thấm',
    'thợ điện nước', 'vật tư điện nước', 'đá hoa cương',

    // 6. Kho vận, Vận tải & Dịch vụ B2B
    'chành xe', 'xe tải chở hàng', 'kho bãi bốc xếp', 'xe cẩu',
    'văn phòng công chứng', 'văn phòng luật sư', 'dịch vụ kế toán',
    'làm bảng hiệu quảng cáo',

    // 7. Giải trí & Thể thao
    'quán bida', 'clb bida', 'sân bóng đá cỏ nhân tạo', 'sân cầu lông',
    'phòng gym', 'phòng yoga', 'quán net', 'karaoke',

    // 8. Động vật & Thú cưng
    'phòng khám thú y', 'cửa hàng thú cưng', 'spa chó mèo',
];

// ===== MA TRẬN ĐỊA BÀN VI MÔ QUẬN BÌNH TÂN =====
const LOCATIONS_BINH_TAN = [
    // --- 10 Phường hành chính ---
    'Phường An Lạc Quận Bình Tân',
    'Phường An Lạc A Quận Bình Tân',
    'Phường Bình Hưng Hòa Quận Bình Tân',
    'Phường Bình Hưng Hòa A Quận Bình Tân',
    'Phường Bình Hưng Hòa B Quận Bình Tân',
    'Phường Bình Trị Đông Quận Bình Tân',
    'Phường Bình Trị Đông A Quận Bình Tân',
    'Phường Bình Trị Đông B Quận Bình Tân',
    'Phường Tân Tạo Quận Bình Tân',
    'Phường Tân Tạo A Quận Bình Tân',

    // --- Khu vực Tên Lửa & An Lạc ---
    'Đường Tên Lửa Bình Tân',
    'Đường Vành Đai Trong Bình Tân',
    'Đường số 1 KDC Tên Lửa Bình Tân',
    'Đường số 7 KDC Tên Lửa Bình Tân',
    'Đường số 4 KDC Tên Lửa Bình Tân',
    'Đường số 19 KDC Tên Lửa Bình Tân',
    'Đường số 29 KDC Tên Lửa Bình Tân',
    'Đường số 32 KDC Tên Lửa Bình Tân',
    'Đường số 24 KDC Tên Lửa Bình Tân',
    'Đường số 28 KDC Tên Lửa Bình Tân',
    'Đường số 34 KDC Tên Lửa Bình Tân',
    'Đường số 22 KDC Tên Lửa Bình Tân',
    'Đường Kinh Dương Vương Bình Tân',
    'Đường Bùi Tư Toàn Bình Tân',
    'Đường Hồ Học Lãm Bình Tân',
    'Đường An Dương Vương Bình Tân',
    'Đường Lâm Hoành Bình Tân',
    'Đường Khiếu Năng Tĩnh Bình Tân',
    'Đường Sinco Bình Tân',
    'Đường Đỗ Năng Tế Bình Tân',
    'Đường Lê Công Phép Bình Tân',
    'Đường Hoàng Văn Hợp Bình Tân',
    'Đường Dương Tự Quán Bình Tân',
    'Đường Phan Văn Năm Bình Tân',

    // --- Khu vực Bình Trị Đông, Gò Xoài & Hương Lộ 2 ---
    'Đường Tỉnh Lộ 10 Bình Tân',
    'Đường Bà Hom Bình Tân',
    'Đường Hương Lộ 2 Bình Tân',
    'Đường Mã Lò Bình Tân',
    'Đường Lê Văn Quới Bình Tân',
    'Đường Bình Long Bình Tân',
    'Đường Đất Mới Bình Tân',
    'Đường Chiến Lược Bình Tân',
    'Đường Trương Phước Phan Bình Tân',
    'Đường Phan Anh Bình Tân',
    'Đường Đình Nghi Xuân Bình Tân',
    'Đường Gò Xoài Bình Tân',
    'Đường Miếu Gò Xoài Bình Tân',
    'Đường Bình Trị Đông Bình Tân',
    'Đường Cầu Đất Bình Tân',
    'Đường Cầu Kinh Bình Tân',
    'Đường Ao Đôi Bình Tân',
    'Đường Ấp Chiến Lược Bình Tân',
    'Đường Miếu Bình Đông Bình Tân',

    // --- Khu vực Bình Hưng Hòa, KCN Vĩnh Lộc & Tân Kỳ Tân Quý ---
    'Đường Tân Kỳ Tân Quý Bình Tân',
    'Đường Nguyễn Thị Tú Bình Tân',
    'Đường Lê Trọng Tấn Bình Tân',
    'Đường Phạm Đăng Giảng Bình Tân',
    'Đường Liên Khu 5-6 Bình Tân',
    'Đường Liên Khu 4-5 Bình Tân',
    'Đường Liên Khu 2-5 Bình Tân',
    'Đường Liên Khu 10-11 Bình Tân',
    'Đường Liên Khu 1-6 Bình Tân',
    'Đường Liên Khu 8-9 Bình Tân',
    'Đường Bình Thành Bình Tân',
    'Đường Tây Lân Bình Tân',
    'Đường Bùi Dương Lịch Bình Tân',
    'Đường 26/3 Bình Tân',
    'Đường Kênh 19/5 Bình Tân',
    'Đường Cây Cám Bình Tân',
    'Đường Kênh Nước Đen Bình Tân',
    'Đường số 18B Bình Hưng Hòa A Bình Tân',
    'Đường số 16 Bình Hưng Hòa A Bình Tân',
    'Đường số 8 Bình Hưng Hòa Bình Tân',
    'Đường số 3 Bình Hưng Hòa Bình Tân',
    'Đường số 5 Bình Hưng Hòa Bình Tân',
    'Đường M1 KCN Tân Bình Bình Hưng Hòa',
    'Đường CN1 KCN Tân Bình Bình Hưng Hòa',
    'Đường CN13 KCN Tân Bình Bình Hưng Hòa',

    // --- Khu vực Tân Tạo, Quốc Lộ 1A & Trần Văn Giàu ---
    'Đường Quốc Lộ 1A Bình Tân',
    'Đường Võ Văn Kiệt Bình Tân',
    'Đường Trần Văn Giàu Bình Tân',
    'Đường Trần Đại Nghĩa Bình Tân',
    'Đường Hồ Văn Long Bình Tân',
    'Đường Nguyễn Cửu Phú Bình Tân',
    'Đường Võ Trần Chí Bình Tân',
    'Đường Lê Đình Cẩn Bình Tân',
    'Đường Cầu Tân Tạo Bình Tân',
    'Đường Thoại Ngọc Hầu Bình Tân',
    'Đường Hòa Bình Bình Tân',
    'Đường Nguyễn Thức Đường Bình Tân',

    // --- Các KDC, KCN & Chợ Đầu Mối ---
    'KDC Tên Lửa Bình Tân',
    'KDC Vĩnh Lộc Bình Tân',
    'KDC Nam Hùng Vương Bình Tân',
    'KDC An Lạc Bình Tân',
    'KDC Hai Thành Bình Tân',
    'KDC Bắc Lương Bèo Bình Tân',
    'Chung cư Lê Thành Bình Tân',
    'Chung cư Akari City Bình Tân',
    'Chung cư Moonlight Boulevard Bình Tân',
    'Chung cư EHome 3 Bình Tân',
    'Chung cư Imperial Place Bình Tân',
    'KCN Tân Tạo Bình Tân',
    'KCN Vĩnh Lộc Bình Tân',
    'Aeon Mall Bình Tân',
    'Chợ Bà Hom Bình Tân',
    'Chợ Da Sà Bình Tân',
    'Chợ Bình Trị Đông Bình Tân',
    'Chợ Cây Da Sà Bình Tân',
    'Chợ Kiến Đức Bình Tân',
    'Chợ Tân Tạo Bình Tân',
    'Bến xe Miền Tây Bình Tân',
];

// ===== TIỆN ÍCH =====
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err && err.message ? err.message : err);
});

// ===== DEDUP: NẠP TẤT CẢ SĐT HIỆN CÓ ĐỂ TRÁNH TRÙNG =====
const loadExistingPhones = () => {
    const phones = new Set();
    let scanned = 0;
    const allFiles = fs.readdirSync(__dirname);

    for (const file of allFiles) {
        const lower = file.toLowerCase();
        if (!lower.endsWith('.txt')) continue;
        scanned++;
        try {
            const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
            const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g) || [];
            matches.forEach(p => {
                if (phones.size < 300000) phones.add(p);
            });
        } catch (e) { }
    }

    console.log(`[Dedup] Đã quét ${scanned} file dữ liệu cũ, nạp ${phones.size.toLocaleString()} SĐT vào danh sách chặn trùng.`);
    return phones;
};

// ===== QUẢN LÝ TIẾN ĐỘ =====
const loadState = () => {
    if (fs.existsSync(STATE_FILE)) {
        try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch (e) { }
    }
    return { completed: {} };
};

let _saveLock = false, _savePending = false;
const saveState = (state) => {
    if (_saveLock) { _savePending = true; return; }
    _saveLock = true;
    setTimeout(() => {
        try { fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8'); } catch (e) { }
        _saveLock = false;
        if (_savePending) { _savePending = false; saveState(state); }
    }, 800);
};

// ===== GHI SĐT RA FILE DUY NHẤT CHO BÌNH TÂN =====
const appendPhones = (phones) => {
    if (!phones.length) return;
    try {
        const text = phones.join('\n') + '\n';
        fs.appendFileSync(OUTPUT_FILE, text, 'utf-8');
    } catch (e) {
        console.error('[Lỗi ghi file]', e.message);
    }
};

// ===== SINH HÀNG ĐỢI ROUND-ROBIN (Trộn đều từ khóa x địa bàn) =====
const buildQueue = (keywords, locations, state) => {
    const byKw = {};
    for (const kw of keywords) {
        byKw[kw] = locations
            .map(loc => `${kw} ${loc}`)
            .filter(q => !state.completed[q]);
    }
    const queue = [];
    let added = true;
    while (added) {
        added = false;
        for (const kw of keywords) {
            if (byKw[kw].length > 0) {
                queue.push(byKw[kw].shift());
                added = true;
            }
        }
    }
    return queue;
};

// ===== CHUẨN HÓA SĐT =====
const normalizePhone = (raw) => {
    let clean = raw.replace(/[^\d+]/g, '');
    if (clean.startsWith('+84')) clean = '0' + clean.slice(3);
    else if (clean.startsWith('84') && clean.length === 11) clean = '0' + clean.slice(2);
    return MOBILE_PREFIX.test(clean) ? clean : null;
};

// ===== TẠO TAB VÀ CÀI ĐẶT CHẶN TÀI NGUYÊN + STEALTH =====
const createPage = async (browser) => {
    const page = await browser.newPage();
    page.on('error', () => { });
    await page.setViewport({ width: 1200, height: 900 });

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {}, loadTimes: () => { }, csi: () => { }, app: {} };
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        try {
            if (req.isInterceptResolutionHandled && req.isInterceptResolutionHandled()) return;
            const type = req.resourceType();
            const url = req.url().toLowerCase();
            if (BLOCK_TYPES.has(type)) return req.abort().catch(() => { });
            if (BLOCK_DOMAINS.some(d => url.includes(d))) return req.abort().catch(() => { });
            req.continue().catch(() => { });
        } catch (e) { }
    });

    return page;
};

// ===== BỘ ĐIỀU PHỐI BLOCK TẬP TRUNG (RÚT GỌN 25S CỐ ĐỊNH) =====
let isBlocked = false;
const COOLDOWN_DURATION_MS = 25000;
let cooldownResolver = null;
let cooldownPromise = null;

const notifyBlock = async (workerId) => {
    if (isBlocked) return cooldownPromise;
    isBlocked = true;

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║ 🛡️  [T${workerId}] GOOGLE RATE-LIMIT: Tự động hạ nhiệt ${COOLDOWN_DURATION_MS / 1000}s...      ║`);
    console.log(`║    (Tự động khôi phục toàn bộ luồng sau khi hạ nhiệt)         ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    cooldownPromise = new Promise((resolve) => {
        cooldownResolver = resolve;
    });

    setTimeout(() => {
        console.log(`\n⚡ [Hệ thống] Hết 25s hạ nhiệt, tiếp tục cào Quận Bình Tân...`);
        isBlocked = false;
        if (cooldownResolver) cooldownResolver();
    }, COOLDOWN_DURATION_MS);

    return cooldownPromise;
};

const waitIfBlocked = async () => {
    if (isBlocked && cooldownPromise) await cooldownPromise;
};

const isBlockedPage = (url, content) => {
    return (
        url.includes('google.com/sorry') ||
        url.includes('/sorry/index') ||
        content.includes('unusual traffic') ||
        content.includes('not a robot') ||
        content.includes('Our systems have detected')
    );
};

// ===== CÀO 1 TRUY VẤN =====
const crawlQuery = async (page, query, existingPhones, workerId) => {
    const searchUrl = Math.random() > 0.5
        ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/`
        : `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=vi`;

    try {
        await Promise.race([
            (async () => {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

                const currentUrl = page.url();
                const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
                if (isBlockedPage(currentUrl, bodyText.toLowerCase())) {
                    try {
                        const client = await page.target().createCDPSession();
                        await client.send('Network.clearBrowserCookies');
                        await client.send('Network.clearBrowserCache');
                    } catch (e) { }

                    await notifyBlock(workerId);
                    throw new Error('BLOCKED');
                }

                await page.waitForSelector('.Nv2PK, [role="main"]', { timeout: 2500 }).catch(() => { });

                await page.evaluate(async () => {
                    const getFeed = () => {
                        const feed = document.querySelector('div[role="feed"]');
                        if (feed) return feed;
                        return Array.from(document.querySelectorAll('div')).find(d => {
                            const s = window.getComputedStyle(d);
                            return (s.overflowY === 'scroll' || s.overflowY === 'auto') &&
                                d.scrollHeight > d.clientHeight;
                        });
                    };
                    const container = getFeed();
                    if (container) {
                        let last = 0;
                        for (let i = 0; i < 2; i++) {
                            if (container.scrollHeight === last) break;
                            last = container.scrollHeight;
                            container.scrollTop = container.scrollHeight;
                            await new Promise(r => setTimeout(r, 150));
                        }
                    } else {
                        window.scrollBy(0, 800);
                    }
                });

                await delay(200);
            })(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), PAGE_TIMEOUT_MS)
            )
        ]);

        const rawText = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
                .map(a => a.getAttribute('href').replace('tel:', ''));
            const ariaPhones = Array.from(document.querySelectorAll('[aria-label*="0"], [aria-label*="+84"]'))
                .map(el => el.getAttribute('aria-label') || '');
            return text + '\n' + telLinks.join('\n') + '\n' + ariaPhones.join('\n');
        });

        let allCandidates = [...new Set(
            (rawText.match(PHONE_REGEX_RAW) || []).map(normalizePhone).filter(Boolean)
        )];

        if (allCandidates.length === 0) {
            try {
                const cards = await page.$$('.Nv2PK');
                const limit = Math.min(cards.length, 2);
                for (let i = 0; i < limit; i++) {
                    await cards[i].click().catch(() => { });
                    await delay(200);
                    const detailText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
                    const detailPhones = (detailText.match(PHONE_REGEX_RAW) || []).map(normalizePhone).filter(Boolean);
                    for (const dp of detailPhones) {
                        if (!allCandidates.includes(dp)) allCandidates.push(dp);
                    }
                }
            } catch (clickErr) { }
        }

        const newPhones = [];
        for (const p of allCandidates) {
            if (!existingPhones.has(p)) {
                existingPhones.add(p);
                newPhones.push(p);
            }
        }

        if (newPhones.length > 0) {
            appendPhones(newPhones);
            console.log(`[T${workerId}] ✅ +${newPhones.length} MỚI [Bình Tân] (${allCandidates.length} trên Maps) | "${query}"`);
        } else if (allCandidates.length > 0) {
            console.log(`[T${workerId}] 🔁 ${allCandidates.length} SĐT đều đã có trong DB | "${query}"`);
        } else {
            console.log(`[T${workerId}] ⚪ Không tìm thấy SĐT | "${query}"`);
        }

        return newPhones.length;

    } catch (err) {
        throw err;
    }
};

// ===== MAIN =====
(async () => {
    try {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       🎯 SDT_DIA_BAN.JS - QUÉT CHUYÊN SÂU QUẬN BÌNH TÂN       ║');
        console.log('║        Vét cạn 10 Phường, 80+ Tuyến đường, KDC & KCN        ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');

        const existingPhones = loadExistingPhones();
        const state = loadState();

        const allQueries = buildQueue(KEYWORDS, LOCATIONS_BINH_TAN, state);
        const totalQueries = allQueries.length;

        if (totalQueries === 0) {
            console.log('✅ Tất cả truy vấn Bình Tân đã hoàn thành. Xóa sdt_dia_ban_state.json nếu muốn chạy lại từ đầu.');
            return;
        }

        console.log(`[Cấu hình] ${KEYWORDS.length} ngành hàng × ${LOCATIONS_BINH_TAN.length} địa bàn chi tiết Bình Tân`);
        console.log(`[Queue] Còn ${totalQueries.toLocaleString()} truy vấn Bình Tân chưa xử lý`);
        console.log(`[Cơ chế] Chạy ${CONCURRENCY} luồng song song | Chu kỳ tái tạo Browser mỗi ${CYCLE_QUERIES} truy vấn để xả 100% RAM`);
        console.log(`[Output] Toàn bộ SĐT mới sẽ lưu vào: ${OUTPUT_FILE}`);
        console.log('');

        let queryIndex = 0;
        let totalNew = 0;
        let cycleNumber = 0;
        const startTime = Date.now();

        while (queryIndex < allQueries.length) {
            cycleNumber++;
            const cycleTarget = Math.min(queryIndex + CYCLE_QUERIES, allQueries.length);
            const cycleRemaining = cycleTarget - queryIndex;

            console.log(`\n========================================================================`);
            console.log(`🚀 [CHU KỲ ${cycleNumber}] Khởi động Chrome mới (${CONCURRENCY} luồng) | Xử lý ${cycleRemaining} truy vấn Bình Tân (từ #${queryIndex + 1} -> #${cycleTarget}/${totalQueries})...`);
            console.log(`========================================================================\n`);

            const browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-accelerated-2d-canvas',
                    '--window-size=1200,900',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--js-flags=--max-old-space-size=512',
                ]
            });

            const getNext = () => (queryIndex < cycleTarget && queryIndex < allQueries.length) ? allQueries[queryIndex++] : null;

            const runWorker = async (workerId) => {
                let page = await createPage(browser);
                let handled = 0;

                while (true) {
                    await waitIfBlocked();

                    const query = getNext();
                    if (!query) break;

                    handled++;

                    if (handled > 1 && handled % TAB_RECYCLE_AFTER === 0) {
                        try { await page.close(); } catch (e) { }
                        page = await createPage(browser);
                        console.log(`[T${workerId}] ♻️  Tái tạo tab sau ${handled} truy vấn`);
                    }

                    try {
                        const n = await crawlQuery(page, query, existingPhones, workerId);
                        totalNew += n;

                        if (queryIndex % 20 === 0) {
                            const elapsed = (Date.now() - startTime) / 1000 / 60;
                            const rate = elapsed > 0 ? Math.round(totalNew / elapsed) : 0;
                            console.log(`\n📊 [Bình Tân] Tiến độ: ${queryIndex}/${totalQueries} (${Math.round(queryIndex / totalQueries * 100)}%) | +${totalNew} số mới tinh | ~${rate} số/phút\n`);
                        }

                        state.completed[query] = true;
                        saveState(state);

                        await waitIfBlocked();
                        await delay(DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)));

                    } catch (err) {
                        const msg = err.message || '';
                        if (msg === 'BLOCKED') {
                            allQueries.push(query);
                            await waitIfBlocked();
                        } else {
                            console.error(`[T${workerId}] ⚠️  Lỗi: ${msg.slice(0, 80)}`);
                        }
                        try { await page.close(); } catch (e) { }
                        page = await createPage(browser);
                        await delay(1500);
                    }
                }

                try { await page.close(); } catch (e) { }
            };

            const workers = [];
            for (let i = 1; i <= CONCURRENCY; i++) {
                workers.push(runWorker(i));
                await delay(500);
            }

            await Promise.all(workers);

            try { await browser.close(); } catch (e) { }

            if (queryIndex < allQueries.length) {
                console.log(`\n♻️  [Chu kỳ ${cycleNumber}] Đã đóng Chrome, giải phóng 100% RAM rác. Tự động nghỉ 3s trước chu kỳ mới...\n`);
                await delay(3000);
            }
        }

        const countLines = (filePath) => {
            if (!fs.existsSync(filePath)) return 0;
            return fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim()).length;
        };

        const finalCount = countLines(OUTPUT_FILE);
        const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       🎉 HOÀN THÀNH VÉT CẠN SĐT QUẬN BÌNH TÂN (TP.HCM)       ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`  ⏱️   Thời gian chạy: ${elapsed} phút`);
        console.log(`  📱  SĐT mới thu được đợt này: ${totalNew.toLocaleString()}`);
        console.log(`  📄  Tổng tích lũy trong ${OUTPUT_FILE}: ${finalCount.toLocaleString()}`);
        console.log('');

        if (queryIndex >= allQueries.length && fs.existsSync(STATE_FILE)) {
            fs.unlinkSync(STATE_FILE);
            console.log(`[State] Đã xóa ${STATE_FILE} (hoàn thành toàn bộ).`);
        }

    } catch (fatalErr) {
        console.error('[FATAL]', fatalErr.message || fatalErr);
        process.exit(1);
    }
})();
