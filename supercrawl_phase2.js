/**
 * SUPERCRAWL_PHASE2.JS - CHIẾN DỊCH THU THẬP SĐT QUY MÔ LỚN (GIAI ĐOẠN 2)
 * ------------------------------------------------------------------------------------
 * Định hướng chiến lược:
 *  1. Chiến lược 1: Bổ sung 80+ ngành hàng kinh doanh mới (Xây dựng, Vận tải, Vựa nông sản, Dịch vụ B2B, Thể thao giải trí)
 *  2. Chiến lược 2: Đào sâu vi mô theo hơn 100 tuyến đường thương mại lớn tại TP.HCM & các đô thị vệ tinh
 *  3. Phạm vi địa lý: Từ ĐÀ NẴNG trở vô NAM TRUNG BỘ, TÂY NGUYÊN, MIỀN NAM & MIỀN TÂY (100% loại bỏ Miền Bắc)
 *  4. Lọc trùng (Dedup) tuyệt đối: Tự động nạp toàn bộ hơn 100.000+ SĐT đã cào từ Phase 1 và các file cũ
 *  5. Tối ưu phần cứng & giải phóng RAM:
 *     - Concurrency: 6 luồng song song (an toàn cho IP nhà mạng)
 *     - Chu kỳ Browser: Tự động đóng/mở lại toàn bộ Chrome sau mỗi 150 truy vấn để xả 100% RAM rác
 *     - Trần V8 heap 512MB/tab + Tái tạo tab con mỗi 25 lượt chống rò rỉ bộ nhớ
 *     - Cooldown 25s hạ nhiệt khi gặp Google Rate Limit
 *  6. Xuất ra file riêng biệt Phase 2:
 *     - supercrawl_phase2.txt (File tổng hợp)
 *     - supercrawl_phase2_hcm.txt (Riêng TP.HCM)
 *     - supercrawl_phase2_tinh.txt (Riêng các Tỉnh)
 *     - supercrawl_phase2_state.json (Lưu tiến độ độc lập)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ===== CẤU HÌNH TỐI ƯU & CHỐNG CHẶN =====
const OUTPUT_FILE = 'supercrawl_phase2.txt';
const OUTPUT_FILE_HCM = 'supercrawl_phase2_hcm.txt';
const OUTPUT_FILE_TINH = 'supercrawl_phase2_tinh.txt';
const STATE_FILE = 'supercrawl_phase2_state.json';

const CONCURRENCY = 6;           // 6 luồng song song: điểm ngọt giữa tốc độ và độ bền chống block
const CYCLE_QUERIES = 150;       // Đóng/khởi động lại toàn bộ Browser sau mỗi 150 truy vấn để giải phóng 100% RAM rác
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

// ===== CHIẾN LƯỢC 1: 85 NGÀNH HÀNG MỚI B2B & HỘ KINH DOANH CHỌN LỌC =====
const KEYWORDS = [
    // 1. Xây dựng, Thi công & Vật tư hoàn thiện (Rất cần Internet & Camera cho công trình)
    'nhôm kính xingfa', 'cửa cuốn tự động', 'cửa sắt cơ khí', 'thợ hàn sắt',
    'trần thạch cao', 'sơn nhà chống thấm', 'vật tư điện nước', 'thi công điện nước',
    'đá hoa cương granite', 'vật tư quảng cáo', 'ép cọc bê tông', 'thi công nội thất',
    'cửa gỗ công nghiệp', 'thiết bị vệ sinh', 'gạch men ốp lát', 'mái xếp lượn sóng',

    // 2. Kho vận, Vận tải & Logistics (Thường trực nghe máy, cần WiFi văn phòng bãi xe)
    'chành xe gửi hàng', 'xe tải chở hàng', 'cho thuê xe cẩu', 'xe cứu hộ giao thông',
    'kho bãi bốc xếp', 'chuyển nhà trọn gói', 'bãi giữ xe ô tô', 'cho thuê xe du lịch',
    'cho thuê xe tự lái', 'dịch vụ bốc vác', 'xe ba gác chở hàng', 'vận tải hàng hóa',

    // 3. Doanh nghiệp & Dịch vụ B2B (Mặt bằng cố định, bắt buộc dùng mạng tốc độ cao)
    'văn phòng công chứng', 'văn phòng luật sư', 'dịch vụ kế toán thuế',
    'thiết kế in ấn quảng cáo', 'làm bảng hiệu hộp đèn', 'khắc dấu lấy liền',
    'công ty bảo vệ', 'văn phòng đo đạc nhà đất', 'cho thuê văn phòng ảo',
    'dịch vụ thành lập doanh nghiệp', 'văn phòng tour du lịch',

    // 4. Thể thao, Giải trí & Mặt bằng quy mô lớn
    'quán bida', 'clb bida', 'sân bóng đá cỏ nhân tạo', 'sân cầu lông',
    'phòng tập gym', 'phòng tập yoga', 'trung tâm thể hình', 'quán net cyber game',
    'karaoke gia đình', 'khu vui chơi trẻ em', 'hồ bơi',

    // 5. Nông nghiệp, Thủy sản & Vựa hàng (Thế mạnh Miền Tây & Tây Nguyên — Doanh số tiền mặt lớn)
    'vựa trái cây', 'vựa sầu riêng', 'vựa thanh long', 'vựa xoài', 'vựa chuối',
    'vựa hải sản tươi sống', 'vựa lúa gạo', 'cơ sở xay xát lúa gạo', 'vựa dừa',
    'đại lý phân bón', 'thuốc bảo vệ thực vật', 'đại lý thức ăn thủy sản',
    'trại tôm giống', 'trại cá giống', 'cây giống ăn trái', 'vựa rau củ quả',

    // 6. Ô tô, Xe tải & Cơ khí chuyên sâu
    'tiệm vá vỏ xe tải', 'gara sửa chữa ô tô', 'nâng cấp màn hình ô tô',
    'phụ tùng ô tô chính hãng', 'rửa xe bọt tuyết', 'tiệm dán phim cách nhiệt',
    'cứu hộ lốp ô tô', 'sửa xe máy lưu động', 'mua bán xe máy cũ',

    // 7. Dịch vụ sinh hoạt, Đời sống & Thú cưng
    'tiệm giặt hấp cao cấp', 'sửa máy giặt tủ lạnh', 'vệ sinh máy lạnh',
    'đại lý nước khoáng đóng bình', 'tiệm vàng bạc đá quý', 'cửa hàng thú cưng pet shop',
    'spa thú cưng chó mèo', 'phòng khám thú y 24h', 'trại giống thú cưng',
    'xưởng may gia công', 'cửa hàng rèm cửa màn sáo', 'cơ sở chế biến thực phẩm',
];

// ===== CHIẾN LƯỢC 2: ĐÀO SÂU THEO TUYẾN ĐƯỜNG THƯƠNG MẠI & ĐỊA BÀN VI MÔ =====

// 1. TP. HỒ CHÍ MINH: Trọn vẹn các trục đường thương mại huyết mạch & khu phố sầm uất
const LOCATIONS_HCM = [
    // Quận 1 & 3 & 4:
    'Đường Nguyễn Trãi Quận 1', 'Đường Hai Bà Trưng Quận 1', 'Đường Trần Hưng Đạo Quận 1', 'Đường Đinh Tiên Hoàng Quận 1', 'Đường Cống Quỳnh Quận 1',
    'Đường Cách Mạng Tháng 8 Quận 3', 'Đường Lê Văn Sỹ Quận 3', 'Đường Võ Văn Tần Quận 3', 'Đường Nguyễn Đình Chiểu Quận 3', 'Đường Nam Kỳ Khởi Nghĩa Quận 3', 'Đường Lý Chính Thắng Quận 3',
    'Đường Hoàng Diệu Quận 4', 'Đường Đoàn Văn Bơ Quận 4', 'Đường Khánh Hội Quận 4', 'Đường Tôn Đản Quận 4',

    // Quận 5 & 6 & 10 & 11:
    'Đường Nguyễn Trãi Quận 5', 'Đường Trần Hưng Đạo Quận 5', 'Đường An Dương Vương Quận 5', 'Đường Hùng Vương Quận 5', 'Đường Hải Thượng Lãn Ông Quận 5',
    'Đường Hậu Giang Quận 6', 'Đường Bà Hom Quận 6', 'Đường Minh Phụng Quận 6', 'Đường Kinh Dương Vương Quận 6', 'Đường Phạm Văn Chí Quận 6',
    'Đường Ba Tháng Hai Quận 10', 'Đường Lý Thường Kiệt Quận 10', 'Đường Thành Thái Quận 10', 'Đường Tô Hiến Thành Quận 10', 'Đường Sư Vạn Hạnh Quận 10', 'Đường Ngô Gia Tự Quận 10',
    'Đường Lạc Long Quân Quận 11', 'Đường Lê Đại Hành Quận 11', 'Đường Hòa Bình Quận 11', 'Đường Ông Ích Khiêm Quận 11',

    // Quận 7 & 8:
    'Đường Nguyễn Thị Thập Quận 7', 'Đường Huỳnh Tấn Phát Quận 7', 'Đường Nguyễn Văn Linh Quận 7', 'Đường Lâm Văn Bền Quận 7', 'Đường Lê Văn Lương Quận 7',
    'Đường Phạm Thế Hiển Quận 8', 'Đường Tạ Quang Bửu Quận 8', 'Đường Dương Bá Trạc Quận 8', 'Đường Ba Đình Quận 8',

    // Phú Nhuận, Bình Thạnh, Gò Vấp:
    'Đường Phan Xích Long Phú Nhuận', 'Đường Hoàng Văn Thụ Phú Nhuận', 'Đường Phan Đình Phùng Phú Nhuận', 'Đường Nguyễn Kiệm Phú Nhuận',
    'Đường Bạch Đằng Bình Thạnh', 'Đường Xô Viết Nghệ Tĩnh Bình Thạnh', 'Đường Nơ Trang Long Bình Thạnh', 'Đường Đinh Bộ Lĩnh Bình Thạnh', 'Đường Điện Biên Phủ Bình Thạnh', 'Đường Bùi Đình Túy Bình Thạnh',
    'Đường Quang Trung Gò Vấp', 'Đường Phan Văn Trị Gò Vấp', 'Đường Nguyễn Oanh Gò Vấp', 'Đường Lê Đức Thọ Gò Vấp', 'Đường Thống Nhất Gò Vấp', 'Đường Nguyễn Văn Lượng Gò Vấp', 'Đường Cây Trâm Gò Vấp',

    // Tân Bình, Tân Phú, Bình Tân:
    'Đường Cộng Hòa Tân Bình', 'Đường Trường Chinh Tân Bình', 'Đường Hoàng Hoa Thám Tân Bình', 'Đường Âu Cơ Tân Bình', 'Đường Phổ Quang Tân Bình',
    'Đường Lũy Bán Bích Tân Phú', 'Đường Thoại Ngọc Hầu Tân Phú', 'Đường Tân Hương Tân Phú', 'Đường Gò Dầu Tân Phú', 'Đường Tân Sơn Nhì Tân Phú', 'Đường Tây Thạnh Tân Phú',
    'Đường Tên Lửa Bình Tân', 'Đường Vành Đai Trong Bình Tân', 'Đường Kinh Dương Vương Bình Tân', 'Đường Tỉnh Lộ 10 Bình Tân', 'Đường Hương Lộ 2 Bình Tân', 'Đường Mã Lò Bình Tân', 'Đường Lê Văn Quới Bình Tân', 'Đường Bình Long Bình Tân',

    // Quận 12 & TP. Thủ Đức:
    'Đường Hà Huy Giáp Quận 12', 'Đường Nguyễn Ảnh Thủ Quận 12', 'Đường Lê Văn Khương Quận 12', 'Đường Tô Ký Quận 12', 'Đường Trường Chinh Quận 12',
    'Đường Võ Văn Ngân Thủ Đức', 'Đường Kha Vạn Cân Thủ Đức', 'Đường Đặng Văn Bi Thủ Đức', 'Đường Lê Văn Việt Thủ Đức', 'Đường Đỗ Xuân Hợp Thủ Đức', 'Đường Nguyễn Duy Trinh Thủ Đức', 'Đường Nguyễn Thị Định Thủ Đức', 'Đường Thảo Điền Thủ Đức', 'Đường Trần Não Thủ Đức', 'Đường Quốc Lộ 13 Thủ Đức',

    // Ngoại thành TP.HCM (Hóc Môn, Bình Chánh, Củ Chi, Nhà Bè, Cần Giờ):
    'Đường Phan Văn Hớn Hóc Môn', 'Đường Nguyễn Văn Bứa Hóc Môn', 'Đường Đặng Thúc Vịnh Hóc Môn', 'Đường Lê Thị Hà Hóc Môn', 'Đường Quang Trung Hóc Môn',
    'Đường Quốc Lộ 50 Bình Chánh', 'Đường Quốc Lộ 1A Bình Chánh', 'Đường Đinh Đức Thiện Bình Chánh', 'Đường Trần Văn Giàu Bình Chánh', 'Đường Nguyễn Văn Linh Bình Chánh', 'KDC Trung Sơn Bình Chánh',
    'Đường Tỉnh Lộ 8 Củ Chi', 'Đường Quốc Lộ 22 Củ Chi', 'Đường Tỉnh Lộ 15 Củ Chi', 'Đường Tỉnh Lộ 2 Củ Chi', 'Đường Tỉnh Lộ 7 Củ Chi',
    'Đường Huỳnh Tấn Phát Nhà Bè', 'Đường Nguyễn Hữu Thọ Nhà Bè', 'Đường Lê Văn Lương Nhà Bè',
    'Đường Rừng Sác Cần Giờ', 'Đường Duyên Hải Cần Giờ'
];

// 2. CÁC TỈNH THÀNH: TỪ ĐÀ NẴNG TRỞ VÔ MIỀN NAM & MIỀN TÂY
const LOCATIONS_PROVINCES = [
    // --- ĐÀ NẴNG & DUYÊN HẢI NAM TRUNG BỘ ---
    'Đường Nguyễn Văn Linh Đà Nẵng', 'Đường Điện Biên Phủ Đà Nẵng', 'Đường Lê Duẩn Đà Nẵng', 'Đường Hùng Vương Đà Nẵng', 'Quận Hải Châu Đà Nẵng', 'Quận Thanh Khê Đà Nẵng', 'Quận Sơn Trà Đà Nẵng', 'Quận Cẩm Lệ Đà Nẵng', 'Quận Liên Chiểu Đà Nẵng',
    'Thành phố Hội An Quảng Nam', 'Thành phố Tam Kỳ Quảng Nam', 'Thị xã Điện Bàn Quảng Nam', 'Huyện Núi Thành Quảng Nam',
    'Thành phố Quảng Ngãi Quảng Ngãi', 'Thị xã Đức Phổ Quảng Ngãi', 'Huyện Bình Sơn Quảng Ngãi',
    'Thành phố Quy Nhơn Bình Định', 'Thị xã An Nhơn Bình Định', 'Thị xã Hoài Nhơn Bình Định',
    'Thành phố Tuy Hòa Phú Yên', 'Thị xã Sông Cầu Phú Yên', 'Thị xã Đông Hòa Phú Yên',
    'Đường Trần Phú Nha Trang', 'Đường 23 Tháng 10 Nha Trang', 'Đường Lê Hồng Phong Nha Trang', 'Thành phố Cam Ranh Khánh Hòa', 'Thị xã Ninh Hòa Khánh Hòa',
    'Thành phố Phan Rang Ninh Thuận', 'Huyện Ninh Phước Ninh Thuận',
    'Thành phố Phan Thiết Bình Thuận', 'Thị xã La Gi Bình Thuận', 'Huyện Hàm Thuận Nam Bình Thuận',

    // --- TÂY NGUYÊN ---
    'Thành phố Buôn Ma Thuột Đắk Lắk', 'Thị xã Buôn Hồ Đắk Lắk', 'Huyện Cư M\'gar Đắk Lắk',
    'Thành phố Pleiku Gia Lai', 'Thị xã An Khê Gia Lai', 'Thị xã Ayun Pa Gia Lai',
    'Thành phố Kon Tum Kon Tum', 'Huyện Ngọc Hồi Kon Tum',
    'Thành phố Gia Nghĩa Đắk Nông', 'Huyện Đắk Mil Đắk Nông',
    'Thành phố Đà Lạt Lâm Đồng', 'Thành phố Bảo Lộc Lâm Đồng', 'Huyện Đức Trọng Lâm Đồng',

    // --- ĐÔNG NAM BỘ (Trọng điểm công nghiệp) ---
    'Đại lộ Bình Dương', 'Đường Quốc Lộ 13 Bình Dương', 'Đường ĐT743 Bình Dương', 'Thành phố Thủ Dầu Một Bình Dương', 'Thành phố Thuận An Bình Dương', 'Thành phố Dĩ An Bình Dương', 'Thành phố Tân Uyên Bình Dương', 'Thị xã Bến Cát Bình Dương', 'KCN VSIP Bình Dương',
    'Đường Phạm Văn Thuận Biên Hòa', 'Đường Đồng Khởi Biên Hòa', 'Thành phố Biên Hòa Đồng Nai', 'Thành phố Long Khánh Đồng Nai', 'Huyện Long Thành Đồng Nai', 'Huyện Nhơn Trạch Đồng Nai', 'Huyện Trảng Bom Đồng Nai',
    'Thành phố Vũng Tàu Bà Rịa Vũng Tàu', 'Thành phố Bà Rịa Bà Rịa Vũng Tàu', 'Thị xã Phú Mỹ Bà Rịa Vũng Tàu',
    'Thành phố Tây Ninh Tây Ninh', 'Thị xã Trảng Bàng Tây Ninh', 'Thị xã Hòa Thành Tây Ninh',
    'Thành phố Đồng Xoài Bình Phước', 'Thị xã Chơn Thành Bình Phước', 'Thị xã Bình Long Bình Phước',

    // --- MIỀN TÂY (ĐỒNG BẰNG SÔNG CỬU LONG) ---
    'Thành phố Tân An Long An', 'Huyện Bến Lức Long An', 'Huyện Cần Giuộc Long An', 'Huyện Đức Hòa Long An',
    'Thành phố Mỹ Tho Tiền Giang', 'Thị xã Gò Công Tiền Giang', 'Huyện Cái Bè Tiền Giang', 'Huyện Châu Thành Tiền Giang',
    'Thành phố Bến Tre Bến Tre', 'Huyện Ba Tri Bến Tre', 'Huyện Mỏ Cày Nam Bến Tre',
    'Thành phố Vĩnh Long Vĩnh Long', 'Thị xã Bình Minh Vĩnh Long',
    'Thành phố Cao Lãnh Đồng Tháp', 'Thành phố Sa Đéc Đồng Tháp', 'Thành phố Hồng Ngự Đồng Tháp',
    'Thành phố Long Xuyên An Giang', 'Thành phố Châu Đốc An Giang', 'Thị xã Tân Châu An Giang',
    'Đường 30 Tháng 4 Cần Thơ', 'Đường Ba Tháng Hai Cần Thơ', 'Đại lộ Hòa Bình Cần Thơ', 'Quận Ninh Kiều Cần Thơ', 'Quận Cái Răng Cần Thơ', 'Quận Bình Thủy Cần Thơ', 'Quận Ô Môn Cần Thơ',
    'Thành phố Vị Thanh Hậu Giang', 'Thành phố Ngã Bảy Hậu Giang',
    'Thành phố Sóc Trăng Sóc Trăng', 'Thị xã Vĩnh Châu Sóc Trăng',
    'Thành phố Bạc Liêu Bạc Liêu', 'Thị xã Giá Rai Bạc Liêu',
    'Thành phố Rạch Giá Kiên Giang', 'Thành phố Phú Quốc Kiên Giang', 'Thành phố Hà Tiên Kiên Giang',
    'Thành phố Trà Vinh Trà Vinh', 'Thị xã Duyên Hải Trà Vinh',
    'Thành phố Cà Mau Cà Mau', 'Huyện Năm Căn Cà Mau', 'Huyện Phú Tân Cà Mau'
];

// Gom toàn bộ địa bàn với cờ phân loại TP.HCM
const LOCATIONS = [
    ...LOCATIONS_HCM.map(loc => ({ loc, isHcm: true })),
    ...LOCATIONS_PROVINCES.map(loc => ({ loc, isHcm: false }))
];

// ===== TIỆN ÍCH =====
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err && err.message ? err.message : err);
});

// ===== DEDUP TOÀN DIỆN: NẠP TẤT CẢ SĐT CŨ TỪ PHASE 1 VÀ KHO DỮ LIỆU =====
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
                if (phones.size < 400000) phones.add(p);
            });
        } catch (e) { }
    }

    console.log(`[Dedup Phase 2] Đã quét ${scanned} file dữ liệu cũ, nạp ${phones.size.toLocaleString()} SĐT vào danh sách chặn trùng.`);
    return phones;
};

// ===== QUẢN LÝ TIẾN ĐỘ PHASE 2 =====
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

// ===== GHI SĐT RA FILE PHASE 2 (Phân loại riêng TP.HCM & Tỉnh) =====
const appendPhones = (phones, isHcm) => {
    if (!phones.length) return;
    try {
        const text = phones.join('\n') + '\n';
        // 1. Ghi vào file tổng Phase 2
        fs.appendFileSync(OUTPUT_FILE, text, 'utf-8');
        // 2. Phân loại theo vùng
        if (isHcm) {
            fs.appendFileSync(OUTPUT_FILE_HCM, text, 'utf-8');
        } else {
            fs.appendFileSync(OUTPUT_FILE_TINH, text, 'utf-8');
        }
    } catch (e) {
        console.error('[Lỗi ghi file]', e.message);
    }
};

// ===== SINH HÀNG ĐỢI ROUND-ROBIN TRỘN ĐỀU TỪ KHÓA =====
const buildQueue = (keywords, locations, state) => {
    const byKw = {};
    for (const kw of keywords) {
        byKw[kw] = locations
            .map(item => ({
                query: `${kw} ${item.loc}`,
                isHcm: item.isHcm,
            }))
            .filter(item => !state.completed[item.query]);
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
        console.log(`\n⚡ [Hệ thống] Hết 25s hạ nhiệt, tiếp tục chiến dịch Phase 2...`);
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
const crawlQuery = async (page, queryItem, existingPhones, workerId) => {
    const { query, isHcm } = queryItem;
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

        const tag = isHcm ? 'TP.HCM' : 'Tỉnh';
        if (newPhones.length > 0) {
            appendPhones(newPhones, isHcm);
            console.log(`[T${workerId}] ✅ +${newPhones.length} MỚI [${tag}] (${allCandidates.length} trên Maps) | "${query}"`);
        } else if (allCandidates.length > 0) {
            console.log(`[T${workerId}] 🔁 ${allCandidates.length} SĐT đều đã có trong DB [${tag}] | "${query}"`);
        } else {
            console.log(`[T${workerId}] ⚪ Không tìm thấy SĐT [${tag}] | "${query}"`);
        }

        return { count: newPhones.length, isHcm };

    } catch (err) {
        throw err;
    }
};

// ===== MAIN =====
(async () => {
    try {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║        🚀 SUPERCRAWL PHASE 2 - MỞ RỘNG B2B & TUYẾN ĐƯỜNG     ║');
        console.log('║        Đà Nẵng -> Miền Nam & Miền Tây | 100% Số Mới Tinh     ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');

        const existingPhones = loadExistingPhones();
        const state = loadState();

        const allQueries = buildQueue(KEYWORDS, LOCATIONS, state);
        const totalQueries = allQueries.length;

        if (totalQueries === 0) {
            console.log('✅ Tất cả truy vấn Phase 2 đã hoàn thành. Xóa supercrawl_phase2_state.json nếu muốn chạy lại từ đầu.');
            return;
        }

        console.log(`[Cấu hình] ${KEYWORDS.length} ngành hàng mới × ${LOCATIONS.length} tuyến đường & địa bàn (${LOCATIONS_HCM.length} TP.HCM, ${LOCATIONS_PROVINCES.length} Tỉnh)`);
        console.log(`[Queue] Còn ${totalQueries.toLocaleString()} truy vấn Phase 2 chưa xử lý`);
        console.log(`[Cơ chế] Chạy ${CONCURRENCY} luồng song song | Chu kỳ tái tạo Browser mỗi ${CYCLE_QUERIES} truy vấn để xả 100% RAM`);
        console.log(`[Output] Ghi vào: ${OUTPUT_FILE} (Tổng), ${OUTPUT_FILE_HCM} (HCM), ${OUTPUT_FILE_TINH} (Tỉnh)`);
        console.log('');

        let queryIndex = 0;
        let totalNew = 0;
        let totalNewHcm = 0;
        let totalNewTinh = 0;
        let cycleNumber = 0;
        const startTime = Date.now();

        while (queryIndex < allQueries.length) {
            cycleNumber++;
            const cycleTarget = Math.min(queryIndex + CYCLE_QUERIES, allQueries.length);
            const cycleRemaining = cycleTarget - queryIndex;

            console.log(`\n========================================================================`);
            console.log(`🚀 [CHU KỲ ${cycleNumber}] Khởi động Chrome mới (${CONCURRENCY} luồng) | Xử lý ${cycleRemaining} truy vấn (từ #${queryIndex + 1} -> #${cycleTarget}/${totalQueries})...`);
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

                    const queryItem = getNext();
                    if (!queryItem) break;

                    handled++;

                    if (handled > 1 && handled % TAB_RECYCLE_AFTER === 0) {
                        try { await page.close(); } catch (e) { }
                        page = await createPage(browser);
                        console.log(`[T${workerId}] ♻️  Tái tạo tab sau ${handled} truy vấn`);
                    }

                    try {
                        const res = await crawlQuery(page, queryItem, existingPhones, workerId);
                        const n = res ? res.count : 0;
                        totalNew += n;
                        if (queryItem.isHcm) {
                            totalNewHcm += n;
                        } else {
                            totalNewTinh += n;
                        }

                        if (queryIndex % 20 === 0) {
                            const elapsed = (Date.now() - startTime) / 1000 / 60;
                            const rate = elapsed > 0 ? Math.round(totalNew / elapsed) : 0;
                            console.log(`\n📊 [Phase 2] Tiến độ: ${queryIndex}/${totalQueries} (${Math.round(queryIndex / totalQueries * 100)}%) | +${totalNew} mới (+${totalNewHcm} HCM, +${totalNewTinh} Tỉnh) | ~${rate} số/phút\n`);
                        }

                        state.completed[queryItem.query] = true;
                        saveState(state);

                        await waitIfBlocked();
                        await delay(DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)));

                    } catch (err) {
                        const msg = err.message || '';
                        if (msg === 'BLOCKED') {
                            allQueries.push(queryItem);
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

        const finalTotal = countLines(OUTPUT_FILE);
        const finalHcm = countLines(OUTPUT_FILE_HCM);
        const finalTinh = countLines(OUTPUT_FILE_TINH);
        const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║               🎉 HOÀN THÀNH CHIẾN DỊCH PHASE 2              ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`  ⏱️   Thời gian chạy: ${elapsed} phút`);
        console.log(`  📱  SĐT mới thu được Phase 2: ${totalNew.toLocaleString()} (HCM: ${totalNewHcm.toLocaleString()} | Tỉnh: ${totalNewTinh.toLocaleString()})`);
        console.log(`  📄  Tổng tích lũy ${OUTPUT_FILE}: ${finalTotal.toLocaleString()}`);
        console.log(`  📍  Tổng tích lũy ${OUTPUT_FILE_HCM}: ${finalHcm.toLocaleString()}`);
        console.log(`  🌐  Tổng tích lũy ${OUTPUT_FILE_TINH}: ${finalTinh.toLocaleString()}`);
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
