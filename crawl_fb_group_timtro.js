const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// CẤU HÌNH CẦN THIẾT
// Hãy điền URL các nhóm Facebook bạn đã tham gia vào đây:
const GROUP_URLS = [
    'https://www.facebook.com/groups/timtronghanhpham', // Thay thế bằng các link nhóm của bạn
    'https://www.facebook.com/groups/phongtrogiarehcm'
];

const OUTPUT_FILE = path.join(__dirname, 'sdt_timtro.txt');
const DEDUPLICATE_FILES = ['sdt', 'ngoaithanh.txt', 'sdt_timtro.txt']; // Các file chứa SĐT cũ để tránh trùng

// Từ khóa bắt buộc phải có cho bài viết "Tìm Trọ" (của khách thuê cần tìm phòng)
const TENANT_KEYWORDS = [
    'cần tìm phòng', 'cần tìm trọ', 'cần tìm nhà', 'cần tìm chung cư', 'cần tìm ở ghép',
    'tìm phòng tuyển', 'tìm trọ gấp', 'tìm phòng gấp', 'tìm phòng trọ', 'tìm trọ', 'tìm phòng',
    'cần thuê phòng', 'cần thuê nhà', 'cần thuê trọ', 'cần thuê chung cư',
    'muốn thuê phòng', 'muốn thuê trọ', 'muốn thuê nhà',
    'kiếm phòng', 'kiếm trọ', 'kiếm nhà', 'kiếm ở ghép',
    'tìm ở ghép', 'cần ở ghép', 'muốn ở ghép'
];

// Từ khóa của CHỦ NHÀ / MÔI GIỚI (nếu chứa thì BỎ QUA bài viết này để tránh lẫn bài "Cho thuê")
const LANDLORD_KEYWORDS = [
    'cho thuê', 'cho thue',
    'còn phòng', 'con phong', 'trống phòng', 'trong phong', 'phòng trống', 'phong trong',
    'còn trống', 'con trong', 'trống 1 phòng', 'trống một phòng',
    'pass phòng', 'pass phong', 'nhượng phòng', 'nhuong phong',
    'chính chủ', 'chinh chu', 'phòng mới xây', 'phong moi xay',
    'cho nam thuê', 'cho nữ thuê', 'cho thue phong', 'còn duy nhất'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm tải danh sách SĐT đã có để chống trùng lặp chéo giữa các hệ thống
const loadExistingPhones = () => {
    const uniquePhones = new Set();
    for (const fileName of DEDUPLICATE_FILES) {
        const filePath = path.join(__dirname, fileName);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf-8');
                // Regex trích xuất tất cả chuỗi 10 chữ số bắt đầu bằng đầu số di động VN
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g);
                if (matches) {
                    matches.forEach(phone => uniquePhones.add(phone));
                }
            } catch (e) {
                console.error(`⚠️ Không thể đọc file chống trùng ${fileName}:`, e.message);
            }
        }
    }
    console.log(`[Deduplication] Nạp ${uniquePhones.size} SĐT đã tồn tại làm danh sách chặn trùng.`);
    return uniquePhones;
};

// Hàm trích xuất và chuẩn hóa SĐT từ text
const extractPhones = (text) => {
    // Regex tìm các SĐT di động Việt Nam (cho phép có khoảng trắng, chấm, gạch ngang ở giữa các chữ số)
    const phoneRegex = /(?:\+84|0)(?:[\s\.\-]*\d){9}/g;
    const matches = text.match(phoneRegex) || [];
    const results = [];

    for (const match of matches) {
        let clean = match.replace(/[\s\.\-]/g, '');
        if (clean.startsWith('+84')) {
            clean = '0' + clean.slice(3);
        }
        if (/^0[35789]\d{8}$/.test(clean)) {
            results.push(clean);
        }
    }
    return [...new Set(results)]; // Lọc trùng cục bộ trong bài viết
};

// Hàm kiểm tra bài đăng có thuộc loại "Tìm Trọ" hay không
const isLookingForRoom = (text) => {
    const lower = text.toLowerCase();

    // 1. Phải chứa ít nhất 1 từ khóa của khách tìm trọ
    const hasTenantKeyword = TENANT_KEYWORDS.some(kw => lower.includes(kw));

    // 2. Không được chứa từ khóa của người đăng tin cho thuê
    const hasLandlordKeyword = LANDLORD_KEYWORDS.some(kw => lower.includes(kw));

    return hasTenantKeyword && !hasLandlordKeyword;
};

(async () => {
    console.log("🚀 ĐANG HÀM CRAWL SĐT TỪ CÁC BÀI ĐĂNG 'TÌM TRỌ' TRÊN FACEBOOK...");

    const existingPhones = loadExistingPhones();
    let browser;

    try {
        // Kết nối tới trình duyệt Chrome đang bật remote debugging
        browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222',
            defaultViewport: null
        });
        console.log("✅ Đã kết nối thành công tới Chrome Debugger!");
    } catch (err) {
        console.error("❌ KẾT NỐI THẤT BẠI: Vui lòng kiểm tra lại Chrome.");
        console.error("Đảm bảo bạn đã mở Chrome bằng lệnh:");
        console.error('  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\ChromeDebug"');
        process.exit(1);
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Tắt loading tải ảnh/video để tối ưu băng thông và đỡ lag
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'media', 'font'].includes(type) || req.url().includes('google-analytics.com')) {
            return req.abort();
        }
        req.continue();
    });

    let totalNewPhones = 0;

    for (const url of GROUP_URLS) {
        if (url.includes('diachi-group')) {
            console.log(`\n⚠️ Vui lòng cấu hình URL nhóm thực tế thay thế cho link ví dụ: "${url}"`);
            continue;
        }

        console.log(`\n========================================`);
        console.log(`🔍 Truy cập nhóm: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await delay(3000); // Chờ load trang ổn định

            let lastHeight = await page.evaluate('document.body.scrollHeight');
            const scrollSteps = 15; // Số lần cuộn trang xuống, tăng lên nếu muốn quét sâu hơn

            console.log("⏳ Bắt đầu cuộn trang tự động để tải thêm bài viết...");
            for (let step = 0; step < scrollSteps; step++) {
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                // Delay ngẫu nhiên từ 2.5s đến 4s để giả lập người dùng thật tránh bị FB phạt
                await delay(2500 + Math.random() * 1500);

                let newHeight = await page.evaluate('document.body.scrollHeight');
                if (newHeight === lastHeight) {
                    console.log("   Đã cuộn đến cuối danh sách bài viết.");
                    break;
                }
                lastHeight = newHeight;
                process.stdout.write(`.`); // Tiến trình cuộn trang
            }
            console.log("\n   Cuộn hoàn tất. Đang đọc dữ liệu bài viết...");

            // Trích xuất các bài viết từ DOM của Facebook
            const rawPosts = await page.evaluate(() => {
                // Lấy toàn bộ các phần tử bài đăng
                // FB dùng role="feed" chứa các bài đăng, mỗi bài thường bọc trong data-ad-comet-preview="message" hoặc có role="article"
                const articles = Array.from(document.querySelectorAll('div[data-ad-comet-preview="message"], div[data-ad-preview="message"]'));

                if (articles.length > 0) {
                    return articles.map(el => ({
                        text: el.innerText || '',
                        html: el.outerHTML // hỗ trợ kiểm tra thêm nếu cần
                    }));
                }

                // Fallback: Tìm các div chứa bài đăng nếu Facebook thay đổi class/attributes
                const divArticles = Array.from(document.querySelectorAll('div[role="feed"] div[dir="auto"]'));
                return divArticles.map(el => ({
                    text: el.innerText || '',
                    html: el.outerHTML
                })).filter(item => item.text.length > 30); // chỉ lấy các div có lượng chữ đáng kể
            });

            console.log(`📊 Tìm thấy tổng cộng ${rawPosts.length} khối nội dung bài đăng.`);

            let phonesSavedThisGroup = 0;

            for (const post of rawPosts) {
                const text = post.text.trim();
                if (!text) continue;

                // 1. Kiểm tra xem có đúng là bài đăng "Tìm Trọ" của khách không
                if (!isLookingForRoom(text)) {
                    continue; // Bỏ qua nếu là bài cho thuê hoặc không có nhu cầu tìm trọ
                }

                // 2. Trích xuất số điện thoại có trong văn bản
                const matchPhones = extractPhones(text);
                if (matchPhones.length === 0) continue;

                // 3. Lọc trùng với danh sách đã có
                const newPhones = matchPhones.filter(phone => !existingPhones.has(phone));

                if (newPhones.length > 0) {
                    newPhones.forEach(phone => {
                        existingPhones.add(phone);
                        fs.appendFileSync(OUTPUT_FILE, phone + '\n', 'utf-8');
                        console.log(`   ✨ [Tìm thấy] SĐT: ${phone} (Bài đăng: "${text.substring(0, 70).replace(/\n/g, ' ')}...")`);
                    });
                    phonesSavedThisGroup += newPhones.length;
                    totalNewPhones += newPhones.length;
                }
            }

            console.log(`✅ Kết quả nhóm này: Thu hoạch được ${phonesSavedThisGroup} SĐT "Tìm Trọ" mới.`);

        } catch (err) {
            console.error(`❌ Lỗi khi xử lý nhóm ${url}:`, err.message);
        }
    }

    console.log(`\n========================================`);
    console.log(`🎉 HỒN THÀNH CHIẾN DỊCH QUÉT TÌM TRỌ!`);
    console.log(`- Đã lưu thêm ${totalNewPhones} SĐT mới vào file: ${OUTPUT_FILE}`);
    console.log(`- Tổng số SĐT hiện có trong danh sách chặn trùng: ${existingPhones.size}`);

    await page.close();
    await browser.disconnect();
})();
