const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'ngoaithanh.txt';
const STATE_FILE = 'crawl_state_tieu_thuong.json';


// Danh sách 20 ngành hàng TIỂU THƯƠNG MỚI ĐỢT 2 (100% mới tinh, tiềm năng SĐT cực cao)
const KEYWORDS = [
    // 1. Nhóm ẩm thực, ăn uống & F&B (Mật độ SĐT liên hệ đặt bàn/giao hàng cực lớn)
    'quán ăn',
    'quán cafe',
    'tiệm trà sữa',
    'quán nhậu',
    'tiệm bánh sinh nhật',

    // 2. Nhóm làm đẹp, tóc & chăm sóc sức khỏe
    'tiệm cắt tóc',
    'salon tóc',
    'tiệm nail',
    'spa làm đẹp',
    'thẩm mỹ viện',
    'phòng khám nha khoa',

    // 3. Nhóm dịch vụ thiết yếu & đời sống
    'tiệm giặt ủi',
    'in ấn photocopy',
    'đại lý gas',
    'đại lý gạo',
    'đại lý bia nước ngọt',
    'dịch vụ chuyển nhà',

    // 4. Nhóm xưởng sản xuất, buôn bán & đồ dùng
    'xưởng mộc',
    'cửa hàng đồ gia dụng',
    'thu mua phế liệu'
];

/* 
// [ĐÃ HOÀN TẤT ĐỢT 1 - LƯU LẠI THAM KHẢO]
const KEYWORDS_BATCH_1 = [
    'shop quần áo', 'tạp hóa', 'quầy thuốc', 'cửa hàng mỹ phẩm', 'cửa hàng hoa tươi', 'văn phòng phẩm',
    'sửa xe máy', 'phụ tùng xe máy', 'gara ô tô', 'cửa hàng xe điện', 'xưởng cơ khí', 'sửa điện lạnh',
    'cửa hàng điện nước', 'tiệm nhôm kính', 'vật liệu xây dựng', 'đại lý sơn', 'thiết kế nội thất',
    'tiệm rèm cửa', 'cửa hàng nệm', 'tiệm vàng', 'phòng khám thú y'
];
*/

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
        if (file.toLowerCase().endsWith('.txt') &&
            (file.startsWith('ngoaithanh') ||
                file.startsWith('data_khach_hang') ||
                file.startsWith('DATA_KHACH_HANG_TONG_HOP') ||
                file === 'Lich_Su_Da_Xuat.txt')) {
            txtFileCount++;
            try {
                const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g);
                if (matches) {
                    matches.forEach(phone => {
                        if (currentPhones.size < 150000) {
                            currentPhones.add(phone);
                        }
                    });
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

let isSaving = false;
let savePending = false;
const saveCrawlState = (state) => {
    if (isSaving) {
        savePending = true;
        return;
    }
    isSaving = true;
    setTimeout(() => {
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
        } catch (e) {
            console.error(`Lỗi ghi file tiến độ ${STATE_FILE}:`, e.message);
        } finally {
            isSaving = false;
            if (savePending) {
                savePending = false;
                saveCrawlState(state);
            }
        }
    }, 1000);
};

const appendPhones = (newPhones) => {
    if (newPhones.length === 0) return;
    try {
        fs.appendFileSync(OUTPUT_FILE, newPhones.join('\n') + '\n', 'utf-8');
    } catch (e) {
        console.error(`Lỗi ghi file ${OUTPUT_FILE}:`, e);
    }
};

// Số luồng chạy song song (Concurrency) - Tận dụng tối đa CPU 12 luồng
const CONCURRENCY = 6;

(async () => {
    console.log("🚀 KHỞI ĐỘNG TRÌNH THU THẬP SĐT TIỂU THƯƠNG SIÊU TỐC QUA GOOGLE MAPS...");
    console.log(`⚡ Chế độ tối ưu hóa: chạy ${CONCURRENCY} luồng song song (concurrency: ${CONCURRENCY}).`);

    const existingPhones = loadExistingPhones();
    const crawlState = loadCrawlState();

    let totalCollectedThisSession = 0;

    // Danh sách 275 địa bàn & phường/xã/trục đường phủ rộng toàn diện khắp 24 quận, huyện, TP. Thủ Đức (TP.HCM)
    const HCM_TARGETS = [
        // 1. Hóc Môn
        'Thị trấn Hóc Môn', 'Bà Điểm Hóc Môn', 'Xuân Thới Thượng Hóc Môn', 'Xuân Thới Đông Hóc Môn', 'Xuân Thới Sơn Hóc Môn',
        'Đông Thạnh Hóc Môn', 'Nhị Bình Hóc Môn', 'Tân Thới Nhì Hóc Môn', 'Tân Hiệp Hóc Môn', 'Thới Tam Thôn Hóc Môn',
        'Trung Chánh Hóc Môn', 'Tân Xuân Hóc Môn', 'Phan Văn Hớn Hóc Môn', 'Nguyễn Văn Bứa Hóc Môn', 'Đặng Thúc Vịnh Hóc Môn', 'Lê Thị Hà Hóc Môn',
        // 2. Bình Chánh
        'Thị trấn Tân Túc Bình Chánh', 'Vĩnh Lộc A Bình Chánh', 'Vĩnh Lộc B Bình Chánh', 'Tân Kiên Bình Chánh', 'Tân Nhựt Bình Chánh',
        'Bình Hưng Bình Chánh', 'Phong Phú Bình Chánh', 'Đa Phước Bình Chánh', 'An Phú Tây Bình Chánh', 'Hưng Long Bình Chánh',
        'Quy Đức Bình Chánh', 'Tân Quý Tây Bình Chánh', 'Bình Chánh Bình Chánh', 'Lê Minh Xuân Bình Chánh', 'Phạm Văn Hai Bình Chánh',
        'Quốc lộ 50 Bình Chánh', 'Quốc lộ 1A Bình Chánh', 'Đinh Đức Thiện Bình Chánh', 'Trần Văn Giàu Bình Chánh', 'Nguyễn Văn Linh Bình Chánh',
        // 3. Củ Chi
        'Thị trấn Củ Chi', 'Tân Phú Trung Củ Chi', 'Tân Thạnh Đông Củ Chi', 'Tân Thạnh Tây Củ Chi', 'Trung An Củ Chi',
        'Phú Hòa Đông Củ Chi', 'Bình Mỹ Củ Chi', 'An Nhơn Tây Củ Chi', 'Nhuận Đức Củ Chi', 'Phạm Văn Cội Củ Chi',
        'Thái Mỹ Củ Chi', 'Phước Vĩnh An Củ Chi', 'Phước Hiệp Củ Chi', 'Phước Thạnh Củ Chi', 'Tân Thông Hội Củ Chi',
        'Trung Lập Hạ Củ Chi', 'Trung Lập Thượng Củ Chi', 'Phú Mỹ Hưng Củ Chi', 'An Phú Củ Chi', 'Tân An Hội Củ Chi',
        'Tỉnh lộ 8 Củ Chi', 'Tỉnh lộ 15 Củ Chi', 'Tỉnh lộ 2 Củ Chi', 'Quốc lộ 22 Củ Chi',
        // 4. Nhà Bè
        'Thị trấn Nhà Bè', 'Phước Kiển Nhà Bè', 'Phước Lộc Nhà Bè', 'Nhơn Đức Nhà Bè', 'Phú Xuân Nhà Bè',
        'Long Thới Nhà Bè', 'Hiệp Phước Nhà Bè', 'Huỳnh Tấn Phát Nhà Bè', 'Nguyễn Hữu Thọ Nhà Bè', 'Lê Văn Lương Nhà Bè',
        // 5. Cần Giờ
        'Thị trấn Cần Thạnh Cần Giờ', 'Long Hòa Cần Giờ', 'Bình Khánh Cần Giờ', 'An Thới Đông Cần Giờ', 'Tam Thôn Hiệp Cần Giờ',
        'Lý Nhơn Cần Giờ', 'Thạnh An Cần Giờ', 'Duyên Hải Cần Giờ', 'Rừng Sác Cần Giờ',
        // 6. Quận 12
        'Thạnh Xuân Quận 12', 'Thạnh Lộc Quận 12', 'An Phú Đông Quận 12', 'Thới An Quận 12', 'Hiệp Thành Quận 12',
        'Tân Chánh Hiệp Quận 12', 'Tân Thới Hiệp Quận 12', 'Đông Hưng Thuận Quận 12', 'Tân Thới Nhất Quận 12', 'Tân Hưng Thuận Quận 12',
        'Trung Mỹ Tây Quận 12', 'Hà Huy Giáp Quận 12', 'Nguyễn Ảnh Thủ Quận 12', 'Lê Văn Khương Quận 12', 'Tô Ký Quận 12',
        // 7. Bình Tân
        'Bình Hưng Hòa Bình Tân', 'Bình Hưng Hòa A Bình Tân', 'Bình Hưng Hòa B Bình Tân', 'Bình Trị Đông Bình Tân', 'Bình Trị Đông A Bình Tân',
        'Bình Trị Đông B Bình Tân', 'Tân Tạo Bình Tân', 'Tân Tạo A Bình Tân', 'An Lạc Bình Tân', 'An Lạc A Bình Tân',
        'Khu Tên Lửa Bình Tân', 'Mã Lò Bình Tân', 'Hương Lộ 2 Bình Tân', 'Kinh Dương Vương Bình Tân',
        // 8. TP. Thủ Đức (Khu vực Thủ Đức, Quận 9, Quận 2)
        'Linh Xuân Thủ Đức', 'Hiệp Bình Phước Thủ Đức', 'Hiệp Bình Chánh Thủ Đức', 'Tam Bình Thủ Đức', 'Tam Phú Thủ Đức',
        'Bình Chiểu Thủ Đức', 'Linh Trung Thủ Đức', 'Linh Tây Thủ Đức', 'Linh Đông Thủ Đức', 'Linh Chiểu Thủ Đức',
        'Bình Thọ Thủ Đức', 'Trường Thọ Thủ Đức', 'Võ Văn Ngân Thủ Đức', 'Kha Vạn Cân Thủ Đức', 'Đặng Văn Bi Thủ Đức',
        'Long Trường Thủ Đức', 'Trường Thạnh Thủ Đức', 'Long Phước Thủ Đức', 'Long Bình Thủ Đức', 'Long Thạnh Mỹ Thủ Đức',
        'Phú Hữu Thủ Đức', 'Tăng Nhơn Phú A Thủ Đức', 'Tăng Nhơn Phú B Thủ Đức', 'Phước Long A Thủ Đức', 'Phước Long B Thủ Đức',
        'Hiệp Phú Thủ Đức', 'Tân Phú Thủ Đức', 'Lê Văn Việt Thủ Đức', 'Đỗ Xuân Hợp Thủ Đức', 'Nguyễn Duy Trinh Thủ Đức',
        'An Phú Thủ Đức', 'An Khánh Thủ Đức', 'Thảo Điền Thủ Đức', 'Bình Trưng Đông Thủ Đức', 'Bình Trưng Tây Thủ Đức',
        'Cát Lái Thủ Đức', 'Thạnh Mỹ Lợi Thủ Đức', 'Nguyễn Thị Định Thủ Đức',
        // 9. Tân Phú & Tân Bình
        'Tân Sơn Nhì Tân Phú', 'Tây Thạnh Tân Phú', 'Sơn Kỳ Tân Phú', 'Tân Quý Tân Phú', 'Tân Thành Tân Phú',
        'Phú Thọ Hòa Tân Phú', 'Phú Thạnh Tân Phú', 'Phú Trung Tân Phú', 'Hòa Thạnh Tân Phú', 'Hiệp Tân Tân Phú', 'Tân Thới Hòa Tân Phú',
        'Lũy Bán Bích Tân Phú', 'Thoại Ngọc Hầu Tân Phú',
        'Phường 15 Tân Bình', 'Phường 13 Tân Bình', 'Phường 12 Tân Bình', 'Phường 11 Tân Bình', 'Phường 10 Tân Bình',
        'Phường 8 Tân Bình', 'Phường 4 Tân Bình', 'Phường 2 Tân Bình', 'Cộng Hòa Tân Bình', 'Trường Chinh Tân Bình', 'Hoàng Hoa Thám Tân Bình',
        // 10. Gò Vấp & Phú Nhuận
        'Phường 16 Gò Vấp', 'Phường 15 Gò Vấp', 'Phường 14 Gò Vấp', 'Phường 12 Gò Vấp', 'Phường 11 Gò Vấp',
        'Phường 10 Gò Vấp', 'Phường 9 Gò Vấp', 'Phường 8 Gò Vấp', 'Phường 6 Gò Vấp', 'Phường 5 Gò Vấp', 'Phường 3 Gò Vấp', 'Phường 1 Gò Vấp',
        'Quang Trung Gò Vấp', 'Phan Văn Trị Gò Vấp', 'Lê Đức Thọ Gò Vấp', 'Nguyễn Oanh Gò Vấp', 'Thống Nhất Gò Vấp', 'Cây Trâm Gò Vấp',
        'Phường 7 Phú Nhuận', 'Phường 9 Phú Nhuận', 'Phường 15 Phú Nhuận', 'Phường 17 Phú Nhuận', 'Phan Xích Long Phú Nhuận', 'Hoàng Văn Thụ Phú Nhuận',
        // 11. Quận 7 & Quận 8
        'Tân Thuận Đông Quận 7', 'Tân Thuận Tây Quận 7', 'Tân Kiểng Quận 7', 'Tân Hưng Quận 7', 'Bình Thuận Quận 7',
        'Tân Quy Quận 7', 'Phú Thuận Quận 7', 'Tân Phong Quận 7', 'Phú Mỹ Quận 7', 'Huỳnh Tấn Phát Quận 7', 'Nguyễn Thị Thập Quận 7',
        'Phường 16 Quận 8', 'Phường 15 Quận 8', 'Phường 14 Quận 8', 'Phường 7 Quận 8', 'Phường 6 Quận 8', 'Phường 5 Quận 8', 'Phường 4 Quận 8', 'Phường 3 Quận 8', 'Phạm Thế Hiển Quận 8',
        // 12. Bình Thạnh
        'Phường 28 Bình Thạnh', 'Phường 27 Bình Thạnh', 'Phường 26 Bình Thạnh', 'Phường 25 Bình Thạnh', 'Phường 24 Bình Thạnh',
        'Phường 19 Bình Thạnh', 'Phường 17 Bình Thạnh', 'Phường 13 Bình Thạnh', 'Phường 12 Bình Thạnh', 'Phường 11 Bình Thạnh',
        'Nơ Trang Long Bình Thạnh', 'Bạch Đằng Bình Thạnh', 'Xô Viết Nghệ Tĩnh Bình Thạnh', 'Đinh Bộ Lĩnh Bình Thạnh',
        // 13. Quận 6, Quận 5, Quận 11, Quận 10
        'Phường 14 Quận 6', 'Phường 13 Quận 6', 'Phường 12 Quận 6', 'Phường 11 Quận 6', 'Phường 10 Quận 6', 'Phường 6 Quận 6', 'Hậu Giang Quận 6', 'Bà Hom Quận 6',
        'Phường 14 Quận 5', 'Phường 11 Quận 5', 'Phường 9 Quận 5', 'Phường 5 Quận 5', 'Chợ Lớn Quận 5', 'Trần Hưng Đạo Quận 5', 'Hải Thượng Lãn Ông Quận 5',
        'Phường 15 Quận 11', 'Phường 14 Quận 11', 'Phường 11 Quận 11', 'Phường 8 Quận 11', 'Phường 5 Quận 11', 'Lạc Long Quân Quận 11', 'Lê Đại Hành Quận 11',
        'Phường 15 Quận 10', 'Phường 14 Quận 10', 'Phường 12 Quận 10', 'Phường 10 Quận 10', 'Tô Hiến Thành Quận 10', 'Lý Thường Kiệt Quận 10', 'Thành Thái Quận 10',
        // 14. Quận 4, Quận 3, Quận 1
        'Phường 16 Quận 4', 'Phường 15 Quận 4', 'Phường 13 Quận 4', 'Phường 9 Quận 4', 'Phường 4 Quận 4', 'Hoàng Diệu Quận 4', 'Đoàn Văn Bơ Quận 4',
        'Phường Võ Thị Sáu Quận 3', 'Phường 14 Quận 3', 'Phường 12 Quận 3', 'Phường 11 Quận 3', 'Cách Mạng Tháng 8 Quận 3', 'Lê Văn Sỹ Quận 3',
        'Phường Tân Định Quận 1', 'Phường Đa Kao Quận 1', 'Phường Cầu Ông Lãnh Quận 1', 'Phường Cô Giang Quận 1', 'Phường Cầu Kho Quận 1'
    ];

    // Danh sách 169 địa bàn trọng điểm các Tỉnh miền Nam hoàn toàn mới
    const PROVINCE_TARGETS = [
        // Long An
        'Thành phố Tân An Long An', 'Bến Lức Long An', 'Đức Hòa Long An', 'Cần Giuộc Long An', 'Cần Đước Long An', 'Hậu Nghĩa Long An', 'Thủ Thừa Long An', 'Tân Thạnh Long An', 'Thạnh Hóa Long An', 'Châu Thành Long An', 'Tân Trụ Long An', 'Kiến Tường Long An',
        // Tiền Giang
        'Thành phố Mỹ Tho Tiền Giang', 'Thị xã Gò Công Tiền Giang', 'Thị xã Cai Lậy Tiền Giang', 'Châu Thành Tiền Giang', 'Cái Bè Tiền Giang', 'Chợ Gạo Tiền Giang', 'Tân Phước Tiền Giang', 'Gò Công Đông Tiền Giang', 'Gò Công Tây Tiền Giang',
        // Bến Tre
        'Thành phố Bến Tre Bến Tre', 'Mỏ Cày Nam Bến Tre', 'Mỏ Cày Bắc Bến Tre', 'Ba Tri Bến Tre', 'Châu Thành Bến Tre', 'Bình Đại Bến Tre', 'Giồng Trôm Bến Tre', 'Thạnh Phú Bến Tre', 'Chợ Lách Bến Tre',
        // Cần Thơ
        'Ninh Kiều Cần Thơ', 'Cái Khế Ninh Kiều Cần Thơ', 'Xuân Khánh Ninh Kiều Cần Thơ', 'An Khánh Ninh Kiều Cần Thơ', 'Cái Răng Cần Thơ', 'Lê Bình Cái Răng Cần Thơ', 'Hưng Phú Cái Răng Cần Thơ', 'Bình Thủy Cần Thơ', 'Trà Nóc Bình Thủy Cần Thơ', 'Long Hòa Bình Thủy Cần Thơ', 'Ô Môn Cần Thơ', 'Thốt Nốt Cần Thơ', 'Phong Điền Cần Thơ', 'Thới Lai Cần Thơ', 'Cờ Đỏ Cần Thơ',
        // Vĩnh Long
        'Thành phố Vĩnh Long Vĩnh Long', 'Thị xã Bình Minh Vĩnh Long', 'Long Hồ Vĩnh Long', 'Mang Thít Vĩnh Long', 'Tam Bình Vĩnh Long', 'Trà Ôn Vĩnh Long', 'Vũng Liêm Vĩnh Long', 'Bình Tân Vĩnh Long',
        // Đồng Tháp
        'Thành phố Cao Lãnh Đồng Tháp', 'Thành phố Sa Đéc Đồng Tháp', 'Thành phố Hồng Ngự Đồng Tháp', 'Huyện Lấp Vò Đồng Tháp', 'Huyện Lai Vung Đồng Tháp', 'Huyện Châu Thành Đồng Tháp', 'Huyện Tam Nông Đồng Tháp', 'Huyện Tân Hồng Đồng Tháp', 'Huyện Thanh Bình Đồng Tháp', 'Huyện Tháp Mười Đồng Tháp',
        // An Giang
        'Thành phố Long Xuyên An Giang', 'Thành phố Châu Đốc An Giang', 'Thị xã Tân Châu An Giang', 'Chợ Mới An Giang', 'Thoại Sơn An Giang', 'Tri Tôn An Giang', 'Tịnh Biên An Giang', 'Châu Phú An Giang', 'Châu Thành An Giang', 'Phú Tân An Giang', 'An Phú An Giang',
        // Kiên Giang
        'Thành phố Rạch Giá Kiên Giang', 'Thành phố Phú Quốc Kiên Giang', 'Thành phố Hà Tiên Kiên Giang', 'Huyện Kiên Lương Kiên Giang', 'Huyện Hòn Đất Kiên Giang', 'Huyện Tân Hiệp Kiên Giang', 'Huyện Châu Thành Kiên Giang', 'Huyện Giồng Riềng Kiên Giang', 'Huyện Gò Quao Kiên Giang', 'Huyện An Biên Kiên Giang', 'Huyện Vĩnh Thuận Kiên Giang',
        // Hậu Giang
        'Thành phố Vị Thanh Hậu Giang', 'Thành phố Ngã Bảy Hậu Giang', 'Thị xã Long Mỹ Hậu Giang', 'Huyện Phụng Hiệp Hậu Giang', 'Huyện Châu Thành Hậu Giang', 'Huyện Châu Thành A Hậu Giang', 'Huyện Vị Thủy Hậu Giang',
        // Trà Vinh
        'Thành phố Trà Vinh Trà Vinh', 'Huyện Càng Long Trà Vinh', 'Huyện Cầu Kè Trà Vinh', 'Huyện Tiểu Cần Trà Vinh', 'Huyện Châu Thành Trà Vinh', 'Huyện Cầu Ngang Trà Vinh', 'Huyện Trà Cú Trà Vinh', 'Thị xã Duyên Hải Trà Vinh',
        // Sóc Trăng
        'Thành phố Sóc Trăng Sóc Trăng', 'Thị xã Ngã Năm Sóc Trăng', 'Thị xã Vĩnh Châu Sóc Trăng', 'Huyện Kế Sách Sóc Trăng', 'Huyện Mỹ Tú Sóc Trăng', 'Huyện Thạnh Trị Sóc Trăng', 'Huyện Châu Thành Sóc Trăng', 'Huyện Mỹ Xuyên Sóc Trăng', 'Huyện Trần Đề Sóc Trăng',
        // Bạc Liêu
        'Thành phố Bạc Liêu Bạc Liêu', 'Thị xã Giá Rai Bạc Liêu', 'Huyện Hồng Dân Bạc Liêu', 'Huyện Phước Long Bạc Liêu', 'Huyện Vĩnh Lợi Bạc Liêu', 'Huyện Đông Hải Bạc Liêu', 'Huyện Hòa Bình Bạc Liêu',
        // Cà Mau
        'Thành phố Cà Mau Cà Mau', 'Huyện Đầm Dơi Cà Mau', 'Huyện Cái Nước Cà Mau', 'Huyện Trần Văn Thời Cà Mau', 'Huyện Thới Bình Cà Mau', 'Huyện Năm Căn Cà Mau', 'Huyện Phú Tân Cà Mau', 'Huyện U Minh Cà Mau',
        // Bình Dương
        'Thành phố Thủ Dầu Một Bình Dương', 'Thành phố Thuận An Bình Dương', 'Thành phố Dĩ An Bình Dương', 'Thành phố Tân Uyên Bình Dương', 'Thị xã Bến Cát Bình Dương', 'Huyện Bàu Bàng Bình Dương', 'Huyện Bắc Tân Uyên Bình Dương', 'Huyện Dầu Tiếng Bình Dương', 'Huyện Phú Giáo Bình Dương',
        // Đồng Nai
        'Thành phố Biên Hòa Đồng Nai', 'Thành phố Long Khánh Đồng Nai', 'Huyện Long Thành Đồng Nai', 'Huyện Nhơn Trạch Đồng Nai', 'Huyện Trảng Bom Đồng Nai', 'Huyện Thống Nhất Đồng Nai', 'Huyện Vĩnh Cửu Đồng Nai', 'Huyện Cẩm Mỹ Đồng Nai', 'Huyện Xuân Lộc Đồng Nai', 'Huyện Định Quán Đồng Nai', 'Huyện Tân Phú Đồng Nai',
        // Bà Rịa - Vũng Tàu
        'Thành phố Vũng Tàu Bà Rịa Vũng Tàu', 'Thành phố Bà Rịa Bà Rịa Vũng Tàu', 'Thị xã Phú Mỹ Bà Rịa Vũng Tàu', 'Huyện Châu Đức Bà Rịa Vũng Tàu', 'Huyện Long Điền Bà Rịa Vũng Tàu', 'Huyện Đất Đỏ Bà Rịa Vũng Tàu', 'Huyện Xuyên Mộc Bà Rịa Vũng Tàu',
        // Tây Ninh
        'Thành phố Tây Ninh Tây Ninh', 'Thị xã Trảng Bàng Tây Ninh', 'Thị xã Hòa Thành Tây Ninh', 'Huyện Bến Cầu Tây Ninh', 'Huyện Châu Thành Tây Ninh', 'Huyện Dương Minh Châu Tây Ninh', 'Huyện Gò Dầu Tây Ninh', 'Huyện Tân Biên Tây Ninh', 'Huyện Tân Châu Tây Ninh',
        // Bình Phước
        'Thành phố Đồng Xoài Bình Phước', 'Thị xã Chơn Thành Bình Phước', 'Thị xã Bình Long Bình Phước', 'Thị xã Phước Long Bình Phước', 'Huyện Đồng Phú Bình Phước', 'Huyện Hớn Quản Bình Phước', 'Huyện Lộc Ninh Bình Phước', 'Huyện Bù Đăng Bình Phước', 'Huyện Bù Đốp Bình Phước'
    ];

    // Hàm sinh hàng đợi Ma trận thuần khiết (Pure Matrix Round-Robin)
    // Rút lần lượt từng từ khóa khác nhau: 1 shop quần áo -> 1 sửa xe máy -> 1 tạp hóa...
    // Đảm bảo suốt từ đầu đến cuối không bao giờ có 2 lượt kế tiếp trùng ngành hàng!
    const generatePureMatrix = (keywords, locations, state) => {
        const byKw = {};
        keywords.forEach(k => byKw[k] = []);
        for (const kw of keywords) {
            for (const loc of locations) {
                const q = `${kw} ${loc}`;
                if (!state.completed[q]) {
                    byKw[kw].push(q);
                }
            }
        }
        const queue = [];
        let added = true;
        while (added) {
            added = false;
            for (const kw of keywords) {
                if (byKw[kw] && byKw[kw].length > 0) {
                    queue.push(byKw[kw].shift());
                    added = true;
                }
            }
        }
        return queue;
    };

    // Chế độ ĐỊA BÀN MỚI: 169 ĐỊA BÀN TRỌNG ĐIỂM CÁC TỈNH MIỀN NAM & LÂN CẬN (Bình Dương, Đồng Nai, Vũng Tàu, Long An, Cần Thơ,...)
    // Tỷ lệ SĐT mới cực cao, giải quyết triệt để tình trạng trùng lặp tại TP.HCM
    const allQueries = generatePureMatrix(KEYWORDS, PROVINCE_TARGETS, crawlState);

    console.log(`[Queue] Tổng số truy vấn: ${allQueries.length} truy vấn MỚI TINH tại 169 địa bàn tỉnh lân cận & miền Nam.`);

    let queryIndex = 0;
    const getNextQuery = () => {
        if (queryIndex < allQueries.length) {
            return allQueries[queryIndex++];
        }
        return null;
    };

    const CYCLE_DURATION_MS = 110000; // Chu kỳ ~2 phút (110 giây) tự động làm mới
    let cycleNumber = 1;

    while (queryIndex < allQueries.length) {
        console.log(`\n========================================================================`);
        console.log(`🚀 [CHU KỲ ${cycleNumber}] KHỞI ĐỘNG PHIÊN CHẠY 2 PHÚT MỚI (Bắt đầu từ truy vấn ${queryIndex + 1}/${allQueries.length})...`);
        console.log(`========================================================================`);

        let cycleNewPhones = 0;
        let cycleRunning = true;
        const cycleTimer = setTimeout(() => {
            cycleRunning = false;
        }, CYCLE_DURATION_MS);

        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1200,900'
            ]
        });

        const createWorkerPage = async () => {
            const page = await browser.newPage();
            await page.setViewport({ width: 1000, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.setRequestInterception(true);
            page.on('request', (req) => {
                try {
                    if (req.isInterceptResolutionHandled && req.isInterceptResolutionHandled()) return;
                    const resourceType = req.resourceType();
                    const reqUrl = req.url().toLowerCase();

                    if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                        return req.abort().catch(() => { });
                    }
                    const isTracker = TRACKER_DOMAINS.some(domain => reqUrl.includes(domain));
                    if (isTracker) {
                        return req.abort().catch(() => { });
                    }
                    req.continue().catch(() => { });
                } catch (e) { }
            });
            return page;
        };

        const runWorker = async (workerId) => {
            let page = await createWorkerPage();
            let queriesHandledByTab = 0;

            while (cycleRunning && queryIndex < allQueries.length) {
                const query = getNextQuery();
                if (!query) break;

                queriesHandledByTab++;
                if (queriesHandledByTab % 40 === 0) {
                    try { await page.close(); } catch (e) { }
                    page = await createWorkerPage();
                }

                const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
                console.log(`[Luồng ${workerId}] 🔍 (${queryIndex}/${allQueries.length}): "${query}"...`);

                try {
                    await Promise.race([
                        (async () => {
                            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                            await page.waitForSelector('.Nv2PK, [role="main"]', { timeout: 6000 }).catch(() => { });

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
                                    let lastH = 0;
                                    for (let i = 0; i < 4; i++) {
                                        if (container.scrollHeight === lastH) break;
                                        lastH = container.scrollHeight;
                                        container.scrollTop = container.scrollHeight;
                                        await new Promise(r => setTimeout(r, 250));
                                    }
                                } else {
                                    window.scrollBy(0, 800);
                                }
                            });

                            await delay(500);

                            const rawTextData = await page.evaluate(() => {
                                let text = document.body.innerText || '';
                                const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'))
                                    .map(a => a.getAttribute('href').replace('tel:', ''));
                                const ariaLabels = Array.from(document.querySelectorAll('[aria-label*="0"], [aria-label*="+84"]'))
                                    .map(el => el.getAttribute('aria-label'));
                                return text + ' ' + telLinks.join(' ') + ' ' + ariaLabels.join(' ');
                            });

                            const phoneRegex = /(?:\+84|0)[\d\s.\-()]{8,15}\d/g;
                            const matches = rawTextData.match(phoneRegex) || [];

                            const cleanPhones = [];
                            const mobilePrefixRegex = /^0(?:9|3|5|7|8)\d{8}$/;

                            for (const rawPhone of matches) {
                                let clean = rawPhone.replace(/[^\d+]/g, '');
                                if (clean.startsWith('+84')) {
                                    clean = '0' + clean.slice(3);
                                } else if (clean.startsWith('84') && clean.length === 11) {
                                    clean = '0' + clean.slice(2);
                                }

                                if (mobilePrefixRegex.test(clean) && !cleanPhones.includes(clean)) {
                                    cleanPhones.push(clean);
                                }
                            }

                            const newPhonesFound = [];
                            for (const clean of cleanPhones) {
                                if (!existingPhones.has(clean)) {
                                    if (existingPhones.size >= 150000) {
                                        const sampleList = Array.from(existingPhones).slice(50000);
                                        existingPhones.clear();
                                        sampleList.forEach(ph => existingPhones.add(ph));
                                    }
                                    existingPhones.add(clean);
                                    newPhonesFound.push(clean);
                                }
                            }

                            if (newPhonesFound.length > 0) {
                                appendPhones(newPhonesFound);
                                totalCollectedThisSession += newPhonesFound.length;
                                cycleNewPhones += newPhonesFound.length;

                                let ngoaithanhCount = 0;
                                if (fs.existsSync(OUTPUT_FILE)) {
                                    ngoaithanhCount = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n').filter(p => p.trim()).length;
                                }
                                console.log(`[Luồng ${workerId}] => ✅ +${newPhonesFound.length} SĐT MỚI (${cleanPhones.length} số trên Maps). Tổng ngoaithanh.txt: ${ngoaithanhCount} số.`);
                            } else if (cleanPhones.length > 0) {
                                console.log(`[Luồng ${workerId}] => 🔁 Đã có đủ ${cleanPhones.length} SĐT trong DB (địa bàn đã lưu trước đó).`);
                            } else {
                                console.log(`[Luồng ${workerId}] => ⚪ Maps không hiển thị SĐT nào cho từ khóa này.`);
                            }
                        })(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Hết thời gian chờ (timeout > 15s)')), 15000))
                    ]);

                    crawlState.completed[query] = true;
                    saveCrawlState(crawlState);

                    await delay(Math.floor(Math.random() * 400) + 350);

                } catch (err) {
                    console.error(`[Luồng ${workerId}] => ⚠️ Lỗi khi cào "${query}": ${err.message}`);
                    try {
                        await page.close();
                    } catch (e) { }
                    page = await createWorkerPage();
                    await delay(1000);
                }
            }

            try { await page.close(); } catch (e) { }
        };

        const workers = [];
        for (let i = 1; i <= CONCURRENCY; i++) {
            workers.push(runWorker(i));
            await delay(400);
        }

        await Promise.all(workers);
        clearTimeout(cycleTimer);

        try { await browser.close(); } catch (e) { }

        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(crawlState), 'utf-8');
        } catch (e) { }

        let currentTotalCount = 0;
        if (fs.existsSync(OUTPUT_FILE)) {
            currentTotalCount = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n').filter(p => p.trim()).length;
        }

        console.log(`\n========================================================================`);
        console.log(`🔄 [HOÀN TẤT CHU KỲ ${cycleNumber}] Đã cào được +${cycleNewPhones} SĐT mới trong chu kỳ này.`);
        console.log(`📱 Tổng số SĐT hiện có trong ${OUTPUT_FILE}: ${currentTotalCount} số.`);
        if (queryIndex < allQueries.length) {
            console.log(`⏳ Tự động nghỉ 3 giây làm mới hoàn toàn Chrome & Socket trước khi chạy chu kỳ kế tiếp...`);
            console.log(`========================================================================\n`);
            await delay(3000);
        } else {
            console.log(`========================================================================\n`);
        }

        cycleNumber++;
    }

    console.log(`\n🎉 HOÀN THÀNH CHIẾN DỊCH!`);
    console.log(`- Số SĐT mới thu được thiết lập này: ${totalCollectedThisSession}`);

    if (fs.existsSync(STATE_FILE) && queryIndex >= allQueries.length) {
        fs.unlinkSync(STATE_FILE);
    }
})();
