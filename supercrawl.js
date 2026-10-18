/**
 * SUPERCRAWL.JS - Trình thu thập SĐT hộ kinh doanh qua Google Maps (Phiên bản tối ưu)
 * ------------------------------------------------------------------------------------
 * Cải tiến so với crawl_tieu_thuong.js:
 *  1. Trình duyệt chỉ khởi động MỘT LẦN, không đóng/mở lại theo chu kỳ
 *  2. Tăng concurrency lên 10 tab song song
 *  3. Chặn hình ảnh, CSS, font, media để giảm băng thông và tăng tốc độ render
 *  4. Intercept XHR/Fetch responses từ Maps để bắt thêm số điện thoại
 *  5. Phạm vi địa bàn: Từ ĐÀ NẴNG trở vô NAM TRUNG BỘ, TÂY NGUYÊN, MIỀN NAM & MIỀN TÂY (loại bỏ hoàn toàn Miền Bắc & Bắc Trung Bộ)
 *  6. 30 từ khóa ngành hàng
 *  7. Dedup đầy đủ với toàn bộ dữ liệu sẵn có (88.000+ số)
 *  8. Xuất ra supercrawl.txt, lưu tiến độ supercrawl_state.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ===== CẤU HÌNH TỐI ƯU & CHỐNG CHẶN =====
const OUTPUT_FILE = 'supercrawl.txt';
const STATE_FILE = 'supercrawl_state.json';
const CONCURRENCY = 6;           // 6 tab song song: điểm ngọt giữa tốc độ và độ bền chống block
const PAGE_TIMEOUT_MS = 12000;   // 12s timeout mỗi truy vấn
const TAB_RECYCLE_AFTER = 40;    // Tái tạo tab sau mỗi 40 truy vấn
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

// ===== CÁC DOMAIN/LOẠI TÀI NGUYÊN CẦN CHẶN =====
const BLOCK_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);
const BLOCK_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.com',
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
    'criteo.com', 'hotjar.com',
];

// ===== TỪ KHÓA NGÀNH HÀNG =====
const KEYWORDS = [
    // Ẩm thực
    'quán ăn', 'nhà hàng', 'quán cafe', 'quán nhậu', 'tiệm trà sữa',
    'tiệm bánh ngọt', 'bún bò', 'cơm tấm',
    // Làm đẹp & sức khỏe
    'tiệm cắt tóc', 'salon tóc', 'tiệm nail', 'spa làm đẹp',
    'thẩm mỹ viện', 'phòng khám nha khoa', 'phòng khám đa khoa',
    // Dịch vụ đời sống
    'tiệm giặt ủi', 'in ấn photocopy', 'đại lý gas', 'đại lý gạo',
    'dịch vụ chuyển nhà', 'sửa xe máy',
    // Buôn bán & bán lẻ
    'tạp hóa', 'shop quần áo', 'cửa hàng mỹ phẩm', 'cửa hàng điện thoại',
    'vật liệu xây dựng', 'tiệm vàng', 'siêu thị mini',
    'đại lý bia nước ngọt', 'cửa hàng đồ gia dụng',
    // Sản xuất & thu mua
    'thu mua phế liệu', 'sửa điện lạnh',
    // Trang trí & nội thất
    'cửa hàng nhôm kính', 'tiệm decal', 'nội thất decor',
    // Ô tô & xe cộ
    'gara ô tô', 'rửa xe ô tô', 'phụ tùng ô tô', 'cửa hàng xe máy',
    'tiệm dán phim xe', 'nâng cấp âm thanh xe hơi',
    // Xây dựng & nội thất bổ sung
    'đại lý sơn', 'cửa hàng gạch men', 'cửa hàng cửa sắt',
    'cửa hàng đèn chiếu sáng', 'lắp đặt camera an ninh',
    // Giáo dục & trẻ em
    'trung tâm tiếng Anh', 'trường mầm non tư thục', 'nhà trẻ',
    'trung tâm dạy nghề', 'lớp học vẽ',
    // Nông nghiệp & chăn nuôi
    'đại lý phân bón', 'cửa hàng thuốc trừ sâu',
    'cửa hàng thức ăn chăn nuôi', 'cửa hàng hải sản tươi sống',
    'vựa trái cây', 'cửa hàng cây giống',
    // Thú cưng & y tế
    'phòng khám thú y', 'cửa hàng thú cưng', 'nhà thuốc tây',
    'phòng khám tư nhân',
    // Lưu trú
    'nhà nghỉ', 'khách sạn mini', 'homestay',
    // May mặc & thời trang
    'tiệm may đo', 'xưởng may gia công', 'cửa hàng vải',
];

// ===== ĐỊA BÀN MỤC TIÊU: TỪ ĐÀ NẴNG TRỞ VÔ MIỀN NAM & MIỀN TÂY =====
// (Đã loại bỏ hoàn toàn Miền Bắc & Bắc Trung Bộ theo yêu cầu)
const LOCATIONS = [

    // =====================================================================
    // 1. ĐÀ NẴNG (Thành phố trực thuộc TW)
    // =====================================================================
    'Hải Châu Đà Nẵng', 'Thanh Khê Đà Nẵng', 'Sơn Trà Đà Nẵng',
    'Ngũ Hành Sơn Đà Nẵng', 'Liên Chiểu Đà Nẵng', 'Cẩm Lệ Đà Nẵng',
    'Hòa Vang Đà Nẵng',

    // =====================================================================
    // 2. DUYÊN HẢI NAM TRUNG BỘ
    // =====================================================================
    // Quảng Nam
    'Thành phố Hội An Quảng Nam', 'Thành phố Tam Kỳ Quảng Nam',
    'Điện Bàn Quảng Nam', 'Đại Lộc Quảng Nam', 'Duy Xuyên Quảng Nam',
    'Núi Thành Quảng Nam', 'Thăng Bình Quảng Nam', 'Phú Ninh Quảng Nam',
    'Quế Sơn Quảng Nam',
    // Quảng Ngãi
    'Thành phố Quảng Ngãi Quảng Ngãi', 'Thị xã Đức Phổ Quảng Ngãi',
    'Tư Nghĩa Quảng Ngãi', 'Sơn Tịnh Quảng Ngãi', 'Bình Sơn Quảng Ngãi',
    'Mộ Đức Quảng Ngãi', 'Nghĩa Hành Quảng Ngãi',
    // Bình Định
    'Thành phố Quy Nhơn Bình Định', 'Thị xã An Nhơn Bình Định',
    'Thị xã Hoài Nhơn Bình Định', 'Tuy Phước Bình Định', 'Phù Mỹ Bình Định',
    'Phù Cát Bình Định', 'Tây Sơn Bình Định',
    // Phú Yên
    'Thành phố Tuy Hòa Phú Yên', 'Thị xã Sông Cầu Phú Yên',
    'Thị xã Đông Hòa Phú Yên', 'Tuy An Phú Yên', 'Tây Hòa Phú Yên',
    'Phú Hòa Phú Yên',
    // Khánh Hòa
    'Thành phố Nha Trang Khánh Hòa', 'Thành phố Cam Ranh Khánh Hòa',
    'Thị xã Ninh Hòa Khánh Hòa', 'Diên Khánh Khánh Hòa',
    'Cam Lâm Khánh Hòa', 'Vạn Ninh Khánh Hòa',
    // Ninh Thuận
    'Thành phố Phan Rang Ninh Thuận', 'Ninh Hải Ninh Thuận',
    'Ninh Phước Ninh Thuận', 'Ninh Sơn Ninh Thuận',
    'Thuận Bắc Ninh Thuận', 'Thuận Nam Ninh Thuận',
    // Bình Thuận
    'Thành phố Phan Thiết Bình Thuận', 'Thị xã La Gi Bình Thuận',
    'Hàm Thuận Nam Bình Thuận', 'Hàm Thuận Bắc Bình Thuận',
    'Bắc Bình Bình Thuận', 'Tuy Phong Bình Thuận',
    'Đức Linh Bình Thuận', 'Tánh Linh Bình Thuận', 'Hàm Tân Bình Thuận',

    // =====================================================================
    // 3. TÂY NGUYÊN
    // =====================================================================
    // Kon Tum
    'Thành phố Kon Tum Kon Tum', 'Ngọc Hồi Kon Tum', 'Đắk Hà Kon Tum', 'Đắk Tô Kon Tum',
    // Gia Lai
    'Thành phố Pleiku Gia Lai', 'Thị xã An Khê Gia Lai',
    'Thị xã Ayun Pa Gia Lai', 'Chư Sê Gia Lai', 'Chư Prông Gia Lai',
    'Đức Cơ Gia Lai', 'Ia Grai Gia Lai', 'Đak Đoa Gia Lai',
    // Đắk Lắk
    'Thành phố Buôn Ma Thuột Đắk Lắk', 'Thị xã Buôn Hồ Đắk Lắk',
    'Cư M\'gar Đắk Lắk', 'Krông Búk Đắk Lắk', 'Ea H\'leo Đắk Lắk',
    'Krông Pắc Đắk Lắk', 'Cư Kuin Đắk Lắk', 'Krông Năng Đắk Lắk',
    // Đắk Nông
    'Thành phố Gia Nghĩa Đắk Nông', 'Đắk Mil Đắk Nông',
    'Đắk R\'lấp Đắk Nông', 'Đắk Song Đắk Nông', 'Cư Jút Đắk Nông',
    // Lâm Đồng
    'Thành phố Đà Lạt Lâm Đồng', 'Thành phố Bảo Lộc Lâm Đồng',
    'Đức Trọng Lâm Đồng', 'Di Linh Lâm Đồng', 'Bảo Lâm Lâm Đồng',
    'Đơn Dương Lâm Đồng', 'Lâm Hà Lâm Đồng', 'Đam Rông Lâm Đồng',

    // =====================================================================
    // 4. MIỀN NAM - TP. HỒ CHÍ MINH (Nội thành & Ngoại thành)
    // =====================================================================
    // Quận 1, 3, 4, 5, 6, 7, 8, 10, 11, 12
    'Phường Bến Nghé Quận 1', 'Phường Bến Thành Quận 1', 'Phường Đa Kao Quận 1', 'Phường Tân Định Quận 1', 'Phường Cầu Ông Lãnh Quận 1', 'Phường Cô Giang Quận 1', 'Phường Cầu Kho Quận 1',
    'Phường Võ Thị Sáu Quận 3', 'Phường 1 Quận 3', 'Phường 3 Quận 3', 'Phường 5 Quận 3', 'Phường 14 Quận 3', 'Cách Mạng Tháng 8 Quận 3', 'Lê Văn Sỹ Quận 3',
    'Phường 1 Quận 4', 'Phường 4 Quận 4', 'Phường 9 Quận 4', 'Phường 13 Quận 4', 'Phường 16 Quận 4', 'Hoàng Diệu Quận 4', 'Đoàn Văn Bơ Quận 4',
    'Phường 1 Quận 5', 'Phường 5 Quận 5', 'Phường 9 Quận 5', 'Phường 11 Quận 5', 'Phường 14 Quận 5', 'Chợ Lớn Quận 5', 'Trần Hưng Đạo Quận 5',
    'Phường 1 Quận 6', 'Phường 6 Quận 6', 'Phường 10 Quận 6', 'Phường 11 Quận 6', 'Phường 12 Quận 6', 'Phường 13 Quận 6', 'Phường 14 Quận 6', 'Hậu Giang Quận 6', 'Bà Hom Quận 6',
    'Tân Thuận Đông Quận 7', 'Tân Thuận Tây Quận 7', 'Tân Kiểng Quận 7', 'Tân Hưng Quận 7', 'Bình Thuận Quận 7', 'Tân Quy Quận 7', 'Phú Thuận Quận 7', 'Tân Phong Quận 7', 'Phú Mỹ Quận 7', 'Huỳnh Tấn Phát Quận 7', 'Nguyễn Thị Thập Quận 7',
    'Phường 1 Quận 8', 'Phường 2 Quận 8', 'Phường 4 Quận 8', 'Phường 5 Quận 8', 'Phường 6 Quận 8', 'Phường 7 Quận 8', 'Phường 10 Quận 8', 'Phường 14 Quận 8', 'Phường 15 Quận 8', 'Phường 16 Quận 8', 'Phạm Thế Hiển Quận 8',
    'Phường 1 Quận 10', 'Phường 6 Quận 10', 'Phường 10 Quận 10', 'Phường 12 Quận 10', 'Phường 14 Quận 10', 'Phường 15 Quận 10', 'Tô Hiến Thành Quận 10', 'Lý Thường Kiệt Quận 10', 'Thành Thái Quận 10',
    'Phường 1 Quận 11', 'Phường 5 Quận 11', 'Phường 8 Quận 11', 'Phường 11 Quận 11', 'Phường 14 Quận 11', 'Phường 15 Quận 11', 'Lạc Long Quân Quận 11', 'Lê Đại Hành Quận 11',
    'Thạnh Xuân Quận 12', 'Thạnh Lộc Quận 12', 'An Phú Đông Quận 12', 'Thới An Quận 12', 'Hiệp Thành Quận 12', 'Tân Chánh Hiệp Quận 12', 'Tân Thới Hiệp Quận 12', 'Đông Hưng Thuận Quận 12', 'Tân Thới Nhất Quận 12', 'Tân Hưng Thuận Quận 12', 'Trung Mỹ Tây Quận 12', 'Hà Huy Giáp Quận 12', 'Nguyễn Ảnh Thủ Quận 12', 'Lê Văn Khương Quận 12', 'Tô Ký Quận 12',
    // TP. Thủ Đức
    'Linh Xuân Thủ Đức', 'Hiệp Bình Phước Thủ Đức', 'Hiệp Bình Chánh Thủ Đức', 'Tam Bình Thủ Đức', 'Tam Phú Thủ Đức', 'Bình Chiểu Thủ Đức', 'Linh Trung Thủ Đức', 'Linh Tây Thủ Đức', 'Linh Đông Thủ Đức', 'Linh Chiểu Thủ Đức', 'Bình Thọ Thủ Đức', 'Trường Thọ Thủ Đức', 'Võ Văn Ngân Thủ Đức', 'Kha Vạn Cân Thủ Đức', 'Đặng Văn Bi Thủ Đức', 'Long Trường Thủ Đức', 'Trường Thạnh Thủ Đức', 'Long Phước Thủ Đức', 'Long Bình Thủ Đức', 'Long Thạnh Mỹ Thủ Đức', 'Phú Hữu Thủ Đức', 'Tăng Nhơn Phú A Thủ Đức', 'Tăng Nhơn Phú B Thủ Đức', 'Phước Long A Thủ Đức', 'Phước Long B Thủ Đức', 'Hiệp Phú Thủ Đức', 'Tân Phú Thủ Đức', 'Lê Văn Việt Thủ Đức', 'Đỗ Xuân Hợp Thủ Đức', 'Nguyễn Duy Trinh Thủ Đức', 'An Phú Thủ Đức', 'An Khánh Thủ Đức', 'Thảo Điền Thủ Đức', 'Bình Trưng Đông Thủ Đức', 'Bình Trưng Tây Thủ Đức', 'Cát Lái Thủ Đức', 'Thạnh Mỹ Lợi Thủ Đức', 'Nguyễn Thị Định Thủ Đức',
    // Bình Thạnh, Phú Nhuận, Gò Vấp, Tân Bình, Tân Phú, Bình Tân
    'Phường 1 Bình Thạnh', 'Phường 2 Bình Thạnh', 'Phường 3 Bình Thạnh', 'Phường 6 Bình Thạnh', 'Phường 7 Bình Thạnh', 'Phường 11 Bình Thạnh', 'Phường 12 Bình Thạnh', 'Phường 13 Bình Thạnh', 'Phường 14 Bình Thạnh', 'Phường 17 Bình Thạnh', 'Phường 19 Bình Thạnh', 'Phường 24 Bình Thạnh', 'Phường 25 Bình Thạnh', 'Phường 26 Bình Thạnh', 'Phường 27 Bình Thạnh', 'Phường 28 Bình Thạnh', 'Nơ Trang Long Bình Thạnh', 'Bạch Đằng Bình Thạnh', 'Xô Viết Nghệ Tĩnh Bình Thạnh', 'Đinh Bộ Lĩnh Bình Thạnh',
    'Phường 1 Phú Nhuận', 'Phường 2 Phú Nhuận', 'Phường 4 Phú Nhuận', 'Phường 6 Phú Nhuận', 'Phường 7 Phú Nhuận', 'Phường 8 Phú Nhuận', 'Phường 9 Phú Nhuận', 'Phường 10 Phú Nhuận', 'Phường 15 Phú Nhuận', 'Phường 17 Phú Nhuận', 'Phan Xích Long Phú Nhuận', 'Hoàng Văn Thụ Phú Nhuận',
    'Phường 1 Gò Vấp', 'Phường 3 Gò Vấp', 'Phường 4 Gò Vấp', 'Phường 5 Gò Vấp', 'Phường 6 Gò Vấp', 'Phường 7 Gò Vấp', 'Phường 8 Gò Vấp', 'Phường 9 Gò Vấp', 'Phường 10 Gò Vấp', 'Phường 11 Gò Vấp', 'Phường 12 Gò Vấp', 'Phường 13 Gò Vấp', 'Phường 14 Gò Vấp', 'Phường 15 Gò Vấp', 'Phường 16 Gò Vấp', 'Phường 17 Gò Vấp', 'Quang Trung Gò Vấp', 'Phan Văn Trị Gò Vấp', 'Lê Đức Thọ Gò Vấp', 'Nguyễn Oanh Gò Vấp', 'Thống Nhất Gò Vấp', 'Cây Trâm Gò Vấp',
    'Phường 1 Tân Bình', 'Phường 2 Tân Bình', 'Phường 3 Tân Bình', 'Phường 4 Tân Bình', 'Phường 5 Tân Bình', 'Phường 6 Tân Bình', 'Phường 7 Tân Bình', 'Phường 8 Tân Bình', 'Phường 9 Tân Bình', 'Phường 10 Tân Bình', 'Phường 11 Tân Bình', 'Phường 12 Tân Bình', 'Phường 13 Tân Bình', 'Phường 15 Tân Bình', 'Cộng Hòa Tân Bình', 'Trường Chinh Tân Bình', 'Hoàng Hoa Thám Tân Bình',
    'Phường 1 Tân Phú', 'Phường 2 Tân Phú', 'Phường 4 Tân Phú', 'Phường 6 Tân Phú', 'Phường 7 Tân Phú', 'Phường 8 Tân Phú', 'Tân Sơn Nhì Tân Phú', 'Tây Thạnh Tân Phú', 'Sơn Kỳ Tân Phú', 'Tân Quý Tân Phú', 'Tân Thành Tân Phú', 'Phú Thọ Hòa Tân Phú', 'Phú Thạnh Tân Phú', 'Phú Trung Tân Phú', 'Hòa Thạnh Tân Phú', 'Hiệp Tân Tân Phú', 'Tân Thới Hòa Tân Phú', 'Lũy Bán Bích Tân Phú', 'Thoại Ngọc Hầu Tân Phú',
    'Bình Hưng Hòa Bình Tân', 'Bình Hưng Hòa A Bình Tân', 'Bình Hưng Hòa B Bình Tân', 'Bình Trị Đông Bình Tân', 'Bình Trị Đông A Bình Tân', 'Bình Trị Đông B Bình Tân', 'Tân Tạo Bình Tân', 'Tân Tạo A Bình Tân', 'An Lạc Bình Tân', 'An Lạc A Bình Tân', 'Khu Tên Lửa Bình Tân', 'Mã Lò Bình Tân', 'Hương Lộ 2 Bình Tân', 'Kinh Dương Vương Bình Tân',
    // Ngoại thành TP.HCM: Hóc Môn, Bình Chánh, Củ Chi, Nhà Bè, Cần Giờ
    'Thị trấn Hóc Môn', 'Bà Điểm Hóc Môn', 'Xuân Thới Thượng Hóc Môn', 'Xuân Thới Đông Hóc Môn', 'Xuân Thới Sơn Hóc Môn', 'Đông Thạnh Hóc Môn', 'Nhị Bình Hóc Môn', 'Tân Thới Nhì Hóc Môn', 'Tân Hiệp Hóc Môn', 'Thới Tam Thôn Hóc Môn', 'Trung Chánh Hóc Môn', 'Tân Xuân Hóc Môn', 'Phan Văn Hớn Hóc Môn', 'Nguyễn Văn Bứa Hóc Môn', 'Đặng Thúc Vịnh Hóc Môn', 'Lê Thị Hà Hóc Môn',
    'Thị trấn Tân Túc Bình Chánh', 'Vĩnh Lộc A Bình Chánh', 'Vĩnh Lộc B Bình Chánh', 'Tân Kiên Bình Chánh', 'Tân Nhựt Bình Chánh', 'Bình Hưng Bình Chánh', 'Phong Phú Bình Chánh', 'Đa Phước Bình Chánh', 'An Phú Tây Bình Chánh', 'Hưng Long Bình Chánh', 'Quy Đức Bình Chánh', 'Tân Quý Tây Bình Chánh', 'Bình Chánh Bình Chánh', 'Lê Minh Xuân Bình Chánh', 'Phạm Văn Hai Bình Chánh', 'Quốc lộ 50 Bình Chánh', 'Quốc lộ 1A Bình Chánh', 'Đinh Đức Thiện Bình Chánh', 'Trần Văn Giàu Bình Chánh', 'Nguyễn Văn Linh Bình Chánh',
    'Thị trấn Củ Chi', 'Tân Phú Trung Củ Chi', 'Tân Thạnh Đông Củ Chi', 'Tân Thạnh Tây Củ Chi', 'Trung An Củ Chi', 'Phú Hòa Đông Củ Chi', 'Bình Mỹ Củ Chi', 'An Nhơn Tây Củ Chi', 'Nhuận Đức Củ Chi', 'Phạm Văn Cội Củ Chi', 'Thái Mỹ Củ Chi', 'Phước Vĩnh An Củ Chi', 'Phước Hiệp Củ Chi', 'Phước Thạnh Củ Chi', 'Tân Thông Hội Củ Chi', 'Trung Lập Hạ Củ Chi', 'Trung Lập Thượng Củ Chi', 'Phú Mỹ Hưng Củ Chi', 'An Phú Củ Chi', 'Tân An Hội Củ Chi', 'Tỉnh lộ 8 Củ Chi', 'Tỉnh lộ 15 Củ Chi', 'Tỉnh lộ 2 Củ Chi', 'Quốc lộ 22 Củ Chi',
    'Thị trấn Nhà Bè', 'Phước Kiển Nhà Bè', 'Phước Lộc Nhà Bè', 'Nhơn Đức Nhà Bè', 'Phú Xuân Nhà Bè', 'Long Thới Nhà Bè', 'Hiệp Phước Nhà Bè', 'Huỳnh Tấn Phát Nhà Bè', 'Nguyễn Hữu Thọ Nhà Bè', 'Lê Văn Lương Nhà Bè',
    'Thị trấn Cần Thạnh Cần Giờ', 'Long Hòa Cần Giờ', 'Bình Khánh Cần Giờ', 'An Thới Đông Cần Giờ', 'Tam Thôn Hiệp Cần Giờ', 'Lý Nhơn Cần Giờ', 'Thạnh An Cần Giờ', 'Duyên Hải Cần Giờ', 'Rừng Sác Cần Giờ',

    // =====================================================================
    // 5. MIỀN NAM - CÁC TỈNH ĐÔNG NAM BỘ
    // =====================================================================
    // Bình Dương
    'Thành phố Thủ Dầu Một Bình Dương', 'Thành phố Thuận An Bình Dương', 'Thành phố Dĩ An Bình Dương',
    'Thành phố Tân Uyên Bình Dương', 'Thị xã Bến Cát Bình Dương', 'Huyện Bàu Bàng Bình Dương',
    'Huyện Bắc Tân Uyên Bình Dương', 'Huyện Dầu Tiếng Bình Dương', 'Huyện Phú Giáo Bình Dương',
    // Đồng Nai
    'Thành phố Biên Hòa Đồng Nai', 'Thành phố Long Khánh Đồng Nai', 'Huyện Long Thành Đồng Nai',
    'Huyện Nhơn Trạch Đồng Nai', 'Huyện Trảng Bom Đồng Nai', 'Huyện Thống Nhất Đồng Nai',
    'Huyện Vĩnh Cửu Đồng Nai', 'Huyện Cẩm Mỹ Đồng Nai', 'Huyện Xuân Lộc Đồng Nai',
    'Huyện Định Quán Đồng Nai', 'Huyện Tân Phú Đồng Nai',
    // Bà Rịa - Vũng Tàu
    'Thành phố Vũng Tàu Bà Rịa Vũng Tàu', 'Thành phố Bà Rịa Bà Rịa Vũng Tàu', 'Thị xã Phú Mỹ Bà Rịa Vũng Tàu',
    'Huyện Châu Đức Bà Rịa Vũng Tàu', 'Huyện Long Điền Bà Rịa Vũng Tàu', 'Huyện Đất Đỏ Bà Rịa Vũng Tàu',
    'Huyện Xuyên Mộc Bà Rịa Vũng Tàu',
    // Tây Ninh
    'Thành phố Tây Ninh Tây Ninh', 'Thị xã Trảng Bàng Tây Ninh', 'Thị xã Hòa Thành Tây Ninh',
    'Huyện Bến Cầu Tây Ninh', 'Huyện Châu Thành Tây Ninh', 'Huyện Dương Minh Châu Tây Ninh',
    'Huyện Gò Dầu Tây Ninh', 'Huyện Tân Biên Tây Ninh', 'Huyện Tân Châu Tây Ninh',
    // Bình Phước
    'Thành phố Đồng Xoài Bình Phước', 'Thị xã Chơn Thành Bình Phước', 'Thị xã Bình Long Bình Phước',
    'Thị xã Phước Long Bình Phước', 'Huyện Đồng Phú Bình Phước', 'Huyện Hớn Quản Bình Phước',
    'Huyện Lộc Ninh Bình Phước', 'Huyện Bù Đăng Bình Phước', 'Huyện Bù Đốp Bình Phước',

    // =====================================================================
    // 6. MIỀN TÂY (13 TỈNH THÀNH ĐỒNG BẰNG SÔNG CỬU LONG)
    // =====================================================================
    // Cần Thơ
    'Ninh Kiều Cần Thơ', 'Cái Khế Ninh Kiều Cần Thơ', 'Xuân Khánh Ninh Kiều Cần Thơ', 'An Khánh Ninh Kiều Cần Thơ',
    'Cái Răng Cần Thơ', 'Lê Bình Cái Răng Cần Thơ', 'Hưng Phú Cái Răng Cần Thơ',
    'Bình Thủy Cần Thơ', 'Trà Nóc Bình Thủy Cần Thơ', 'Long Hòa Bình Thủy Cần Thơ',
    'Ô Môn Cần Thơ', 'Thốt Nốt Cần Thơ', 'Phong Điền Cần Thơ', 'Thới Lai Cần Thơ', 'Cờ Đỏ Cần Thơ',
    // Long An
    'Thành phố Tân An Long An', 'Bến Lức Long An', 'Đức Hòa Long An', 'Cần Giuộc Long An', 'Cần Đước Long An',
    'Hậu Nghĩa Long An', 'Thủ Thừa Long An', 'Tân Thạnh Long An', 'Thạnh Hóa Long An', 'Châu Thành Long An',
    'Tân Trụ Long An', 'Kiến Tường Long An', 'Mộc Hóa Long An', 'Vĩnh Hưng Long An', 'Tân Hưng Long An', 'Đức Huệ Long An',
    // Tiền Giang
    'Thành phố Mỹ Tho Tiền Giang', 'Thị xã Gò Công Tiền Giang', 'Thị xã Cai Lậy Tiền Giang', 'Châu Thành Tiền Giang',
    'Cái Bè Tiền Giang', 'Chợ Gạo Tiền Giang', 'Tân Phước Tiền Giang', 'Gò Công Đông Tiền Giang',
    'Gò Công Tây Tiền Giang', 'Tân Phú Đông Tiền Giang',
    // Bến Tre
    'Thành phố Bến Tre Bến Tre', 'Mỏ Cày Nam Bến Tre', 'Mỏ Cày Bắc Bến Tre', 'Ba Tri Bến Tre',
    'Châu Thành Bến Tre', 'Bình Đại Bến Tre', 'Giồng Trôm Bến Tre', 'Thạnh Phú Bến Tre', 'Chợ Lách Bến Tre',
    // Vĩnh Long
    'Thành phố Vĩnh Long Vĩnh Long', 'Thị xã Bình Minh Vĩnh Long', 'Long Hồ Vĩnh Long', 'Mang Thít Vĩnh Long',
    'Tam Bình Vĩnh Long', 'Trà Ôn Vĩnh Long', 'Vũng Liêm Vĩnh Long', 'Bình Tân Vĩnh Long',
    // Đồng Tháp
    'Thành phố Cao Lãnh Đồng Tháp', 'Thành phố Sa Đéc Đồng Tháp', 'Thành phố Hồng Ngự Đồng Tháp',
    'Huyện Lấp Vò Đồng Tháp', 'Huyện Lai Vung Đồng Tháp', 'Huyện Châu Thành Đồng Tháp',
    'Huyện Tam Nông Đồng Tháp', 'Huyện Tân Hồng Đồng Tháp', 'Huyện Thanh Bình Đồng Tháp', 'Huyện Tháp Mười Đồng Tháp',
    // An Giang
    'Thành phố Long Xuyên An Giang', 'Thành phố Châu Đốc An Giang', 'Thị xã Tân Châu An Giang',
    'Chợ Mới An Giang', 'Thoại Sơn An Giang', 'Tri Tôn An Giang', 'Tịnh Biên An Giang',
    'Châu Phú An Giang', 'Châu Thành An Giang', 'Phú Tân An Giang', 'An Phú An Giang',
    // Kiên Giang
    'Thành phố Rạch Giá Kiên Giang', 'Thành phố Phú Quốc Kiên Giang', 'Thành phố Hà Tiên Kiên Giang',
    'Huyện Kiên Lương Kiên Giang', 'Huyện Hòn Đất Kiên Giang', 'Huyện Tân Hiệp Kiên Giang',
    'Huyện Châu Thành Kiên Giang', 'Huyện Giồng Riềng Kiên Giang', 'Huyện Gò Quao Kiên Giang',
    'Huyện An Biên Kiên Giang', 'Huyện Vĩnh Thuận Kiên Giang',
    // Hậu Giang
    'Thành phố Vị Thanh Hậu Giang', 'Thành phố Ngã Bảy Hậu Giang', 'Thị xã Long Mỹ Hậu Giang',
    'Huyện Phụng Hiệp Hậu Giang', 'Huyện Châu Thành Hậu Giang', 'Huyện Châu Thành A Hậu Giang', 'Huyện Vị Thủy Hậu Giang',
    // Trà Vinh
    'Thành phố Trà Vinh Trà Vinh', 'Huyện Càng Long Trà Vinh', 'Huyện Cầu Kè Trà Vinh',
    'Huyện Tiểu Cần Trà Vinh', 'Huyện Châu Thành Trà Vinh', 'Huyện Cầu Ngang Trà Vinh',
    'Huyện Trà Cú Trà Vinh', 'Thị xã Duyên Hải Trà Vinh',
    // Sóc Trăng
    'Thành phố Sóc Trăng Sóc Trăng', 'Thị xã Ngã Năm Sóc Trăng', 'Thị xã Vĩnh Châu Sóc Trăng',
    'Huyện Kế Sách Sóc Trăng', 'Huyện Mỹ Tú Sóc Trăng', 'Huyện Thạnh Trị Sóc Trăng',
    'Huyện Châu Thành Sóc Trăng', 'Huyện Mỹ Xuyên Sóc Trăng', 'Huyện Trần Đề Sóc Trăng',
    // Bạc Liêu
    'Thành phố Bạc Liêu Bạc Liêu', 'Thị xã Giá Rai Bạc Liêu', 'Huyện Hồng Dân Bạc Liêu',
    'Huyện Phước Long Bạc Liêu', 'Huyện Vĩnh Lợi Bạc Liêu', 'Huyện Đông Hải Bạc Liêu', 'Huyện Hòa Bình Bạc Liêu',
    // Cà Mau
    'Thành phố Cà Mau Cà Mau', 'Huyện Đầm Dơi Cà Mau', 'Huyện Cái Nước Cà Mau',
    'Huyện Trần Văn Thời Cà Mau', 'Huyện Thới Bình Cà Mau', 'Huyện Năm Căn Cà Mau',
    'Huyện Phú Tân Cà Mau', 'Huyện U Minh Cà Mau'
];

// ===== TIỆN ÍCH =====
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Tránh crash toàn bộ process do unhandled rejection hoặc uncaught exception
process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err && err.message ? err.message : err);
});

// ===== DEDUP: NẠP TẤT CẢ SĐT HIỆN CÓ =====
const loadExistingPhones = () => {
    const phones = new Set();
    const targetFiles = [
        'ngoaithanh.txt', 'DATA_KHACH_HANG_TONG_HOP.txt',
        'Lich_Su_Da_Xuat.txt',
    ];

    let scanned = 0;
    const allFiles = fs.readdirSync(__dirname);
    for (const file of allFiles) {
        const lower = file.toLowerCase();
        if (!lower.endsWith('.txt')) continue;
        if (
            targetFiles.includes(file) ||
            file.startsWith('data_khach_hang') ||
            file.startsWith('supercrawl')
        ) {
            scanned++;
            try {
                const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g) || [];
                matches.forEach(p => {
                    if (phones.size < 200000) phones.add(p);
                });
            } catch (e) { /* bỏ qua file lỗi */ }
        }
    }
    console.log(`[Dedup] Đã quét ${scanned} file, nạp ${phones.size.toLocaleString()} SĐT vào danh sách chặn trùng.`);
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

// ===== GHI SĐT RA FILE =====
const appendPhones = (phones) => {
    if (!phones.length) return;
    try {
        fs.appendFileSync(OUTPUT_FILE, phones.join('\n') + '\n', 'utf-8');
    } catch (e) {
        console.error('[Lỗi ghi file]', e.message);
    }
};

// ===== SINH HÀNG ĐỢI ROUND-ROBIN (trộn đều từ khóa) =====
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
    page.on('error', () => { }); // Tránh Node sập khi tab bị terminate
    await page.setViewport({ width: 1200, height: 900 });

    // Xoay vòng User-Agent ngẫu nhiên tránh nhận diện 1 thiết bị cố định
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);

    // Stealth: Xóa cờ navigator.webdriver và giả lập trình duyệt thật
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {}, loadTimes: () => { }, csi: () => { }, app: {} };
    });

    // Chặn tài nguyên không cần thiết
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
const COOLDOWN_DURATION_MS = 25000; // Rút ngắn cố định xuống 25 giây (thay vì 150s)
let cooldownResolver = null;
let cooldownPromise = null;

const notifyBlock = async (workerId) => {
    if (isBlocked) {
        return cooldownPromise;
    }
    isBlocked = true;

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║ 🛡️  [T${workerId}] GOOGLE RATE-LIMIT: Tự động hạ nhiệt ${COOLDOWN_DURATION_MS / 1000}s...      ║`);
    console.log(`║    (Đã giảm từ 150s xuống 25s. Tự động khôi phục chạy tiếp)   ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    cooldownPromise = new Promise((resolve) => {
        cooldownResolver = resolve;
    });

    setTimeout(() => {
        console.log(`\n⚡ [Hệ thống] Hết 25s hạ nhiệt, tự động khôi phục toàn bộ luồng...`);
        isBlocked = false;
        if (cooldownResolver) cooldownResolver();
    }, COOLDOWN_DURATION_MS);

    return cooldownPromise;
};

const waitIfBlocked = async () => {
    if (isBlocked && cooldownPromise) {
        await cooldownPromise;
    }
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
    // Luân phiên 2 endpoint Maps để phân tán tải
    const searchUrl = Math.random() > 0.5
        ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/`
        : `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=vi`;

    try {
        await Promise.race([
            (async () => {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

                // Kiểm tra bị block / CAPTCHA
                const currentUrl = page.url();
                const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
                if (isBlockedPage(currentUrl, bodyText.toLowerCase())) {
                    // Xóa cookie & cache theo dõi của Google
                    try {
                        const client = await page.target().createCDPSession();
                        await client.send('Network.clearBrowserCookies');
                        await client.send('Network.clearBrowserCache');
                    } catch (e) { }

                    await notifyBlock(workerId);
                    throw new Error('BLOCKED');
                }

                // Chờ panel kết quả xuất hiện (rút ngắn còn 2.5s)
                await page.waitForSelector('.Nv2PK, [role="main"]', { timeout: 2500 }).catch(() => { });

                // Cuộn 2 lần nhanh để tải thêm kết quả
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

        // Trích xuất từ DOM: tel: links + aria-label + innerText
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

        // Nếu list view không có SĐT (Google Maps ẩn SĐT), click lướt nhanh tối đa 2 kết quả đầu (chỉ 200ms)
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
            console.log(`[T${workerId}] ✅ +${newPhones.length} mới (${allCandidates.length} trên Maps) | "${query}"`);
        } else if (allCandidates.length > 0) {
            console.log(`[T${workerId}] 🔁 ${allCandidates.length} SĐT đều đã có | "${query}"`);
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
    console.log('║         🚀 SUPERCRAWL - THU THẬP SĐT HỘ KINH DOANH         ║');
    console.log('║        Google Maps | Đà Nẵng -> Miền Nam & Miền Tây         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    const existingPhones = loadExistingPhones();
    const state = loadState();

    const allQueries = buildQueue(KEYWORDS, LOCATIONS, state);
    const totalQueries = allQueries.length;

    if (totalQueries === 0) {
        console.log('✅ Tất cả truy vấn đã hoàn thành. Xóa supercrawl_state.json để chạy lại từ đầu.');
        return;
    }

    console.log(`[Cấu hình] ${KEYWORDS.length} từ khóa × ${LOCATIONS.length} địa bàn`);
    console.log(`[Queue] Còn ${totalQueries.toLocaleString()} truy vấn chưa xử lý`);
    console.log(`[Chrome] Khởi động 1 browser, ${CONCURRENCY} tab song song...`);
    console.log('');

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
        ]
    });

    let queryIndex = 0;
    let totalNew = 0;
    const startTime = Date.now();

    const getNext = () => queryIndex < allQueries.length ? allQueries[queryIndex++] : null;

    // Worker: mỗi worker quản lý 1 tab suốt vòng đời
    const runWorker = async (workerId) => {
        let page = await createPage(browser);
        let handled = 0;

        while (true) {
            // Chờ nếu hệ thống đang hạ nhiệt block
            await waitIfBlocked();

            const query = getNext();
            if (!query) break;

            handled++;

            // Tái tạo tab định kỳ để tránh rò rỉ bộ nhớ
            if (handled > 1 && handled % TAB_RECYCLE_AFTER === 0) {
                try { await page.close(); } catch (e) { }
                page = await createPage(browser);
                console.log(`[T${workerId}] ♻️  Tái tạo tab sau ${handled} truy vấn`);
            }

            try {
                const n = await crawlQuery(page, query, existingPhones, workerId);
                totalNew += n;

                // Log tiến độ tổng thể mỗi 20 truy vấn
                if (queryIndex % 20 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000 / 60;
                    const rate = elapsed > 0 ? Math.round(totalNew / elapsed) : 0;
                    console.log(`\n📊 Tiến độ: ${queryIndex}/${totalQueries} (${Math.round(queryIndex / totalQueries * 100)}%) | +${totalNew} SĐT mới | ~${rate} số/phút\n`);
                }

                state.completed[query] = true;
                saveState(state);

                // Chờ nếu đang trong trạng thái bị block
                await waitIfBlocked();

                // Delay ngẫu nhiên tự nhiên
                await delay(DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)));

            } catch (err) {
                const msg = err.message || '';
                if (msg === 'BLOCKED') {
                    // Đưa lại query vào cuối hàng đợi để cào lại
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

    // Khởi động N workers song song, trễ nhẹ để tránh tất cả cùng khởi động 1 lúc
    const workers = [];
    for (let i = 1; i <= CONCURRENCY; i++) {
        workers.push(runWorker(i));
        await delay(500);
    }

    await Promise.all(workers);

    try { await browser.close(); } catch (e) { }

    // Đọc số dòng cuối
    let finalCount = 0;
    if (fs.existsSync(OUTPUT_FILE)) {
        finalCount = fs.readFileSync(OUTPUT_FILE, 'utf-8')
            .split('\n').filter(l => l.trim()).length;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                   🎉 HOÀN THÀNH CHIẾN DỊCH                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  ⏱️  Thời gian: ${elapsed} phút`);
    console.log(`  📱 SĐT mới thu được: ${totalNew.toLocaleString()}`);
    console.log(`  📄 Tổng trong ${OUTPUT_FILE}: ${finalCount.toLocaleString()}`);
    console.log('');

    // Xóa state khi hoàn thành toàn bộ
    if (queryIndex >= allQueries.length && fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
        console.log(`[State] Đã xóa ${STATE_FILE} (hoàn thành toàn bộ).`);
    }
    } catch (fatalErr) {
        console.error('[FATAL]', fatalErr.message || fatalErr);
        process.exit(1);
    }
})();
