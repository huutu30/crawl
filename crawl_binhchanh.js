const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Cấu hình
const TARGET_COUNT = 20000;
const OUTPUT_FILE = 'ctrcamera.txt';
const MAX_PAGE_DEPTH = 15; // Độ sâu trang danh mục tối đa (ví dụ: Page 15) để tìm tin đăng cũ hơn

// DANH SÁCH TÊN MIỀN VỚI SEED URLS TẬP TRUNG VÀO BÌNH CHÁNH, HÓC MÔN, NHÀ BÈ (CHỈ GIỮ LẠI TOP 7 HIỆU QUẢ CAO)
const DOMAINS_CONFIG = [
    {
        domain: 'nha.chotot.com',
        seeds: [
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-binh-chanh/cho-thue-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-binh-chanh/mua-ban-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-hoc-mon/cho-thue-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-hoc-mon/mua-ban-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-nha-be/cho-thue-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-nha-be/mua-ban-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-cu-chi/cho-thue-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-cu-chi/mua-ban-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-can-gio/cho-thue-bat-dong-san',
            'https://nha.chotot.com/tp-ho-chi-minh/huyen-can-gio/mua-ban-bat-dong-san'
        ]
    },
    {
        domain: 'phongtro123.com',
        seeds: [
            'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-binh-chanh',
            'https://phongtro123.com/cho-thue-nha-nguyen-can-huyen-binh-chanh',
            'https://phongtro123.com/cho-thue-can-ho-huyen-binh-chanh',
            'https://phongtro123.com/cho-thue-mat-bang-huyen-binh-chanh',
            'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-hoc-mon',
            'https://phongtro123.com/cho-thue-nha-nguyen-can-huyen-hoc-mon',
            'https://phongtro123.com/cho-thue-can-ho-huyen-hoc-mon',
            'https://phongtro123.com/cho-thue-mat-bang-huyen-hoc-mon',
            'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-nha-be',
            'https://phongtro123.com/cho-thue-nha-nguyen-can-huyen-nha-be',
            'https://phongtro123.com/cho-thue-can-ho-huyen-nha-be',
            'https://phongtro123.com/cho-thue-mat-bang-huyen-nha-be',
            'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-cu-chi',
            'https://phongtro123.com/cho-thue-nha-nguyen-can-huyen-cu-chi',
            'https://phongtro123.com/cho-thue-can-ho-huyen-cu-chi',
            'https://phongtro123.com/cho-thue-mat-bang-huyen-cu-chi',
            'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-can-gio',
            'https://phongtro123.com/cho-thue-nha-nguyen-can-huyen-can-gio',
            'https://phongtro123.com/cho-thue-can-ho-huyen-can-gio',
            'https://phongtro123.com/cho-thue-mat-bang-huyen-can-gio'
        ]
    },
    {
        domain: 'bds123.vn',
        seeds: [
            'https://bds123.vn/ban-nha-huyen-binh-chanh-ho-chi-minh.html',
            'https://bds123.vn/ban-dat-huyen-binh-chanh-ho-chi-minh.html',
            'https://bds123.vn/cho-thue-nha-huyen-binh-chanh-ho-chi-minh.html',
            'https://bds123.vn/ban-nha-huyen-hoc-mon-ho-chi-minh.html',
            'https://bds123.vn/ban-dat-huyen-hoc-mon-ho-chi-minh.html',
            'https://bds123.vn/cho-thue-nha-huyen-hoc-mon-ho-chi-minh.html',
            'https://bds123.vn/ban-nha-huyen-nha-be-ho-chi-minh.html',
            'https://bds123.vn/ban-dat-huyen-nha-be-ho-chi-minh.html',
            'https://bds123.vn/cho-thue-nha-huyen-nha-be-ho-chi-minh.html',
            'https://bds123.vn/ban-nha-huyen-cu-chi-ho-chi-minh.html',
            'https://bds123.vn/ban-dat-huyen-cu-chi-ho-chi-minh.html',
            'https://bds123.vn/cho-thue-nha-huyen-cu-chi-ho-chi-minh.html',
            'https://bds123.vn/ban-nha-huyen-can-gio-ho-chi-minh.html',
            'https://bds123.vn/ban-dat-huyen-can-gio-ho-chi-minh.html',
            'https://bds123.vn/cho-thue-nha-huyen-can-gio-ho-chi-minh.html'
        ]
    },
    {
        domain: 'tromoi.com',
        seeds: [
            'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-binh-chanh',
            'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-hoc-mon',
            'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-nha-be',
            'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-cu-chi',
            'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-can-gio'
        ]
    },
    {
        domain: 'guland.vn',
        seeds: [
            'https://guland.vn/mua-ban-bat-dong-san-nha-dat/huyen-binh-chanh',
            'https://guland.vn/cho-thue-nha-dat/huyen-binh-chanh',
            'https://guland.vn/mua-ban-bat-dong-san-nha-dat/huyen-hoc-mon',
            'https://guland.vn/cho-thue-nha-dat/huyen-hoc-mon',
            'https://guland.vn/mua-ban-bat-dong-san-nha-dat/huyen-nha-be',
            'https://guland.vn/cho-thue-nha-dat/huyen-nha-be',
            'https://guland.vn/mua-ban-bat-dong-san-nha-dat/huyen-cu-chi',
            'https://guland.vn/cho-thue-nha-dat/huyen-cu-chi',
            'https://guland.vn/mua-ban-bat-dong-san-nha-dat/huyen-can-gio',
            'https://guland.vn/cho-thue-nha-dat/huyen-can-gio'
        ]
    },
    {
        domain: 'thuecanho123.com',
        seeds: [
            'https://thuecanho123.com/cho-thue-can-ho-chung-cu-binh-chanh.html',
            'https://thuecanho123.com/cho-thue-can-ho-chung-cu-hoc-mon.html',
            'https://thuecanho123.com/cho-thue-can-ho-chung-cu-nha-be.html'
        ]
    },
    {
        domain: 'alonhadat.com.vn',
        seeds: [
            'https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/huyen-binh-chanh.html',
            'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/hcm/huyen-binh-chanh.html',
            'https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/huyen-hoc-mon.html',
            'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/hcm/huyen-hoc-mon.html',
            'https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/huyen-nha-be.html',
            'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/hcm/huyen-nha-be.html',
            'https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/huyen-cu-chi.html',
            'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/hcm/huyen-cu-chi.html',
            'https://alonhadat.com.vn/nha-dat/cho-thue/nha-dat/hcm/huyen-can-gio.html',
            'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/hcm/huyen-can-gio.html'
        ]
    },
    {
        domain: 'homedy.com',
        seeds: [
            'https://homedy.com/cho-thue-nha-dat-huyen-binh-chanh-tp-ho-chi-minh',
            'https://homedy.com/ban-nha-dat-huyen-binh-chanh-tp-ho-chi-minh',
            'https://homedy.com/cho-thue-nha-dat-huyen-hoc-mon-tp-ho-chi-minh',
            'https://homedy.com/ban-nha-dat-huyen-hoc-mon-tp-ho-chi-minh',
            'https://homedy.com/cho-thue-nha-dat-huyen-nha-be-tp-ho-chi-minh',
            'https://homedy.com/ban-nha-dat-huyen-nha-be-tp-ho-chi-minh',
            'https://homedy.com/cho-thue-nha-dat-huyen-cu-chi-tp-ho-chi-minh',
            'https://homedy.com/ban-nha-dat-huyen-cu-chi-tp-ho-chi-minh',
            'https://homedy.com/cho-thue-nha-dat-huyen-can-gio-tp-ho-chi-minh',
            'https://homedy.com/ban-nha-dat-huyen-can-gio-tp-ho-chi-minh'
        ]
    },
    {
        domain: 'chothuenha.com.vn',
        seeds: [
            'https://chothuenha.com.vn/cho-thue-nha-huyen-binh-chanh-ho-chi-minh',
            'https://chothuenha.com.vn/cho-thue-nha-huyen-hoc-mon-ho-chi-minh',
            'https://chothuenha.com.vn/cho-thue-nha-huyen-nha-be-ho-chi-minh',
            'https://chothuenha.com.vn/cho-thue-nha-huyen-cu-chi-ho-chi-minh',
            'https://chothuenha.com.vn/cho-thue-nha-huyen-can-gio-ho-chi-minh'
        ]
    },
    {
        domain: 'bds.com.vn',
        seeds: [
            'https://bds.com.vn/cho-thue-nha-dat-huyen-binh-chanh',
            'https://bds.com.vn/ban-nha-dat-huyen-binh-chanh',
            'https://bds.com.vn/cho-thue-nha-dat-huyen-hoc-mon',
            'https://bds.com.vn/ban-nha-dat-huyen-hoc-mon',
            'https://bds.com.vn/cho-thue-nha-dat-huyen-nha-be',
            'https://bds.com.vn/ban-nha-dat-huyen-nha-be',
            'https://bds.com.vn/cho-thue-nha-dat-huyen-cu-chi',
            'https://bds.com.vn/ban-nha-dat-huyen-cu-chi',
            'https://bds.com.vn/cho-thue-nha-dat-huyen-can-gio',
            'https://bds.com.vn/ban-nha-dat-huyen-can-gio'
        ]
    },
    {
        domain: 'chothuephongtro.me',
        seeds: [
            'https://chothuephongtro.me/ho-chi-minh/huyen-binh-chanh.html',
            'https://chothuephongtro.me/ho-chi-minh/huyen-hoc-mon.html',
            'https://chothuephongtro.me/ho-chi-minh/huyen-nha-be.html',
            'https://chothuephongtro.me/ho-chi-minh/huyen-cu-chi.html',
            'https://chothuephongtro.me/ho-chi-minh/huyen-can-gio.html'
        ]
    },
    {
        domain: 'i-batdongsan.com',
        seeds: [
            'https://i-batdongsan.com/cho-thue-nha-dat-huyen-binh-chanh.htm',
            'https://i-batdongsan.com/ban-nha-dat-huyen-binh-chanh.htm',
            'https://i-batdongsan.com/cho-thue-nha-dat-huyen-hoc-mon.htm',
            'https://i-batdongsan.com/ban-nha-dat-huyen-hoc-mon.htm',
            'https://i-batdongsan.com/cho-thue-nha-dat-huyen-nha-be.htm',
            'https://i-batdongsan.com/ban-nha-dat-huyen-nha-be.htm',
            'https://i-batdongsan.com/cho-thue-nha-dat-huyen-cu-chi.htm',
            'https://i-batdongsan.com/ban-nha-dat-huyen-cu-chi.htm',
            'https://i-batdongsan.com/cho-thue-nha-dat-huyen-can-gio.htm',
            'https://i-batdongsan.com/ban-nha-dat-huyen-can-gio.htm'
        ]
    },
    {
        domain: 'phongtromoi.com',
        seeds: [
            'https://phongtromoi.com/cho-thue-phong-tro-huyen-binh-chanh',
            'https://phongtromoi.com/cho-thue-phong-tro-huyen-hoc-mon',
            'https://phongtromoi.com/cho-thue-phong-tro-huyen-nha-be',
            'https://phongtromoi.com/cho-thue-phong-tro-huyen-cu-chi',
            'https://phongtromoi.com/cho-thue-phong-tro-huyen-can-gio'
        ]
    },
    {
        domain: 'cafeland.vn',
        seeds: [
            'https://nhadat.cafeland.vn/nha-dat-ban-tai-binh-chanh-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-cho-thue-tai-binh-chanh-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-ban-tai-hoc-mon-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-cho-thue-tai-hoc-mon-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-ban-tai-nha-be-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-cho-thue-tai-nha-be-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-ban-tai-cu-chi-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-cho-thue-tai-cu-chi-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-ban-tai-can-gio-tp-ho-chi-minh/',
            'https://nhadat.cafeland.vn/nha-dat-cho-thue-tai-can-gio-tp-ho-chi-minh/'
        ]
    }
];


const delay = (min, max) => {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, time));
};

const PHONE_REGEX = /(?<!\d)(0[35789]\d{8})(?!\d)/g;

const BLACKLIST_PHONES = [
    // phongtro123.com & thuecanho123.com & chothuephongtro.me
    '0909316890', '0313588502', '0287300123', '0903007123', '0902657123',
    // bds123.vn
    '0839202123', '0903642123',
    // guland.vn
    '0983284379',
    // tromoi.com
    '0911067111', '0962545484',
    // alonhadat.com.vn
    '0857001001', '0857002002', '0857003003', '0762003003', '0937636062',
    // homedy.com
    '0768283968',
    // chothuenha.com.vn
    '0769969928',
    // meeyland.com & dothi.net
    '0869092929', '0349208325', '0904509709',
    // cafeland.vn & nhadat.net
    '0942825711', '0903762768', '0907772638'
];

// Danh sách các URL quảng cáo/tracker cần chặn để tăng tốc cực độ
const TRACKER_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr', 
    'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 
    'criteo.com', 'hotjar.com', 'zalo.me'
];
const extractPhoneNumbers = (text) => {
    const regex = /(?<!\d)(?:0|(?:\+?84))[\s\.\-]*([35789][\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d[\s\.\-]*\d)(?!\d)/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        const clean = '0' + m[1].replace(/[\s\.\-]/g, '');
        matches.push(clean);
    }
    return matches;
};

// Hàm chuẩn hóa URL để tránh phình to hàng đợi
const normalizeUrl = (urlStr) => {
    try {
        const urlObj = new URL(urlStr);
        // Loại bỏ hash fragment
        urlObj.hash = '';
        
        // Chỉ giữ lại tham số phân trang 'page' (chuẩn hóa từ page, p, pn)
        const newParams = new URLSearchParams();
        const pageVal = urlObj.searchParams.get('page') || urlObj.searchParams.get('p') || urlObj.searchParams.get('pn');
        if (pageVal) {
            newParams.set('page', pageVal);
        }
        urlObj.search = newParams.toString();
        
        return urlObj.toString();
    } catch (e) {
        return urlStr;
    }
};

// Hàm kiểm tra trang phân trang có quá sâu không (> MAX_PAGE_DEPTH)
const isDeepPage = (urlStr) => {
    try {
        const urlObj = new URL(urlStr);
        
        // 1. Kiểm tra query parameters
        const pageVal = urlObj.searchParams.get('page') || urlObj.searchParams.get('p') || urlObj.searchParams.get('pn');
        if (pageVal) {
            const pageNum = parseInt(pageVal, 10);
            if (!isNaN(pageNum) && pageNum > MAX_PAGE_DEPTH) {
                return true;
            }
        }
        
        // 2. Kiểm tra đường dẫn URL dạng path (như -page11, /page/11, /page-11)
        const pathLower = urlObj.pathname.toLowerCase();
        const pageMatch = pathLower.match(/(?:-page|page-|\/page\/)(\d+)/);
        if (pageMatch) {
            const pageNum = parseInt(pageMatch[1], 10);
            if (!isNaN(pageNum) && pageNum > MAX_PAGE_DEPTH) {
                return true;
            }
        }
    } catch (e) {}
    return false;
};

// Hàm kiểm tra URL có thuộc các huyện hoặc xã mục tiêu hay không
const isMatchTargetLocation = (urlStr) => {
    const urlLower = urlStr.toLowerCase();
    
    // Không cào các trang phân trang quá sâu (tránh tin cũ đã cào)
    if (isDeepPage(urlStr)) {
        return false;
    }
    
    // Bỏ qua các đường dẫn tra cứu thông tin bản đồ/quy hoạch/giá đất/đặc điểm lọc không chứa thông tin liên hệ
    if (urlLower.includes('soi-quy-hoach') || urlLower.includes('kho-ban-do') || urlLower.includes('gia-dat') || urlLower.includes('ban-do-cho-thue') || urlLower.includes('/dac-diem/')) {
        return false;
    }
    
    // Với Guland, bỏ qua các trang danh mục đường phố (chỉ giữ lại trang post hoặc trang quận/huyện chính)
    if (urlLower.includes('guland.vn') && !urlLower.includes('/post/')) {
        if (urlLower.includes('duong') || urlLower.includes('/duong-') || urlLower.includes('-duong-')) {
            return false;
        }
    }
    
    // Loại trừ Bình Dương để tránh nhận diện sai các từ khóa "binh"
    if (urlLower.includes('binh-duong') || urlLower.includes('binhduong')) {
        return false;
    }
    
    // Danh sách từ khóa địa bàn mục tiêu trong URL (huyện + 23 xã cụ thể)
    const targetKeywords = [
        // Huyện
        'binh-chanh', 'binhchanh',
        'hoc-mon', 'hocmon',
        'nha-be', 'nhabe',
        'cu-chi', 'cuchi',
        'can-gio', 'cangio',
        // Xã của Bình Chánh
        'binh-hung', 'binhhung',
        'binh-loi', 'binhloi',
        'hung-long', 'hunglong',
        'tan-nhut', 'tannhut',
        'tan-vinh-loc', 'tanvinhloc',
        'vinh-loc', 'vinhloc',
        // Xã của Hóc Môn
        'ba-diem', 'badiem',
        'dong-thanh', 'dongthanh',
        'xuan-thoi-son', 'xuanthoison',
        // Xã của Nhà Bè
        'hiep-phuoc', 'hiepphuoc',
        // Xã của Củ Chi
        'an-nhon-tay', 'annhontay',
        'binh-my', 'binhmy',
        'nhuan-duc', 'nhuanduc',
        'phu-hoa-dong', 'phuhoadong',
        'tan-an-hoi', 'tananhoi',
        'thai-my', 'thaimy',
        // Xã của Cần Giờ
        'an-thoi-dong', 'anthoidong',
        'binh-khanh', 'binhkhanh'
    ];
    
    return targetKeywords.some(kw => urlLower.includes(kw));
};

// Hàm kiểm tra xem một URL danh mục có phải là phân trang hợp lệ của các seed URL ban đầu hay không
// Tránh việc đi lan man vào các trang danh mục con theo đường/phường/giá/diện tích gây lặp vô tận.
const isValidListUrl = (url, seeds) => {
    try {
        const urlObj = new URL(url);
        const urlClean = (urlObj.origin + urlObj.pathname).toLowerCase().replace(/\/$/, '');
        
        for (const seed of seeds) {
            try {
                const seedObj = new URL(seed);
                const seedClean = (seedObj.origin + seedObj.pathname).toLowerCase().replace(/\/$/, '');
                
                // 1. Khớp chính xác seed URL
                if (urlClean === seedClean) return true;
                
                // 2. Khớp các trang phân trang của seed URL đó
                if (url.toLowerCase().startsWith(seedClean)) {
                    const suffix = url.toLowerCase().substring(seedClean.length);
                    // Dạng query params: ?page=2, ?p=2, ?pg=2, ?pn=2...
                    if (suffix.startsWith('?') && (suffix.includes('page=') || suffix.includes('p=') || suffix.includes('pg=') || suffix.includes('pn='))) {
                        return true;
                    }
                    // Dạng path: /trang-2, /page/2, /p-2, /p2, -page2, ...
                    if (/^\/(trang-|page\/|p-)?\d+\/?$/.test(suffix) || /^\/\d+\/?$/.test(suffix) || /^-\d+\.html/.test(suffix) || /^[\/\?]\d+$/.test(suffix)) {
                        return true;
                    }
                }
            } catch (err) {}
        }
    } catch (e) {}
    return false;
};

// Hàm nhận diện trang chi tiết tối ưu cho từng tên miền
const isDetailPage = (href, domain) => {
    const hrefLower = href.toLowerCase();
    
    // phongtro123.com - Tất cả trang chi tiết đều kết thúc bằng .html, còn trang danh mục thì không.
    if (domain === 'phongtro123.com' && hrefLower.endsWith('.html')) return true;
    
    // bds123.vn, thuecanho123.com
    if ((domain === 'bds123.vn' || domain === 'thuecanho123.com') && /-pr\d+\.html/.test(hrefLower)) return true;
    
    // bds.com.vn
    if (domain === 'bds.com.vn' && /-p\d+\.html/.test(hrefLower)) return true;
    
    // chothuephongtro.me
    if (domain === 'chothuephongtro.me' && /\/\d+\.html/.test(hrefLower)) return true;
    
    // alonhadat.com.vn
    if (domain === 'alonhadat.com.vn' && /-\d+\.html/.test(hrefLower)) return true;

    // homedy.com
    if (domain === 'homedy.com' && /-es\d+/.test(hrefLower)) return true;

    // chothuenha.com.vn
    if (domain === 'chothuenha.com.vn' && /-\d+$/.test(hrefLower)) return true;

    // i-batdongsan.com
    if (domain === 'i-batdongsan.com' && /\/\d+\.htm/.test(hrefLower)) return true;

    // phongtromoi.com
    if (domain === 'phongtromoi.com' && /-\d+$/.test(hrefLower)) return true;

    // nha.chotot.com
    if (domain === 'nha.chotot.com' && /-\d+\.htm/.test(hrefLower)) return true;

    // tromoi.com
    if (domain === 'tromoi.com' && (hrefLower.includes('/phong-tro/') || hrefLower.includes('/can-ho/') || hrefLower.includes('/nha-nguyen-can/') || hrefLower.includes('/tim-nguoi-o-ghep/') || hrefLower.includes('/ky-tuc-xa/') || /id\d+/.test(hrefLower))) return true;
    
    // guland.vn - Hỗ trợ cả /post/ và /tin-da-dang-
    if (domain === 'guland.vn' && (/\/post\/.*-\d+/.test(hrefLower) || /\/tin-da-dang-\d+/.test(hrefLower))) return true;
    
    // sosanhnha.com
    if (domain === 'sosanhnha.com' && /-cla[a-z0-9]+$/i.test(hrefLower)) return true;

    // muaban.net
    if (domain === 'muaban.net' && /-id\d+$/i.test(hrefLower)) return true;

    // nhadat24h.net
    if (domain === 'nhadat24h.net' && /\/\d+$/.test(hrefLower)) return true;

    // dothi.net
    if (domain === 'dothi.net' && /-pr\d+\.htm/i.test(hrefLower)) return true;

    // meeyland.com
    if (domain === 'meeyland.com' && /-i\d+$/i.test(hrefLower)) return true;

    // cafeland.vn
    if (domain === 'cafeland.vn' && /-\d+\.html/.test(hrefLower)) return true;

    // bannha.net
    if (domain === 'bannha.net' && /-pr\d+\.html/.test(hrefLower)) return true;

    // batdongsanso.vn
    if (domain === 'batdongsanso.vn' && /-r\d+\.html/.test(hrefLower)) return true;

    // nhadat.net
    if (domain === 'nhadat.net' && /-\d+\.html/.test(hrefLower)) return true;

    // Khớp mẫu chung dự phòng
    if (hrefLower.match(/-pr\d+\.html/) || hrefLower.match(/\/\d+\.htm/) || hrefLower.match(/id\d+/) || hrefLower.match(/-\d+\./) || hrefLower.match(/-cla[a-z0-9]+/i) || hrefLower.match(/-r\d+\.html/)) {
        return true;
    }
    
    return false;
};

// Hàm dùng chung để load tất cả số điện thoại đã lưu ở các file khác để chặn trùng lặp chéo giữa các quận/huyện
const loadAllOtherPhones = () => {
    const otherPhones = new Set();
    const files = fs.readdirSync(__dirname);
    for (const file of files) {
        const fileLower = file.toLowerCase();
        // Đọc tất cả các file .txt khác ngoài file OUTPUT_FILE hiện tại
        if (fileLower.endsWith('.txt') && file !== OUTPUT_FILE) {
            try {
                const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const phones = data.split('\n').filter(p => p.trim());
                phones.forEach(phone => {
                    if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) otherPhones.add(phone.trim());
                });
            } catch (err) {}
        }
    }
    return otherPhones;
};

// Hàm ghi file thông minh: đọc file thực tế từ đĩa để đồng bộ các thay đổi thủ công, lọc trùng và ghi lại theo thứ tự thời gian (chronological)
const saveNewPhones = (newPhones) => {
    const currentPhones = new Set();
    const currentPhonesList = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const data = fs.readFileSync(OUTPUT_FILE, 'utf-8');
            data.split('\n').filter(p => p.trim()).forEach(phone => {
                const clean = phone.trim();
                if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(clean) && !currentPhones.has(clean)) {
                    currentPhones.add(clean);
                    currentPhonesList.push(clean);
                }
            });
        } catch (e) {
            console.error(`Lỗi đọc file ${OUTPUT_FILE}:`, e);
        }
    }

    let addedCount = 0;
    const PHONE_REGEX_VALID = /^(0[35789]\d{8})$/;
    newPhones.forEach(phone => {
        const cleanPhone = phone.trim();
        if (PHONE_REGEX_VALID.test(cleanPhone) && !currentPhones.has(cleanPhone)) {
            currentPhones.add(cleanPhone);
            currentPhonesList.push(cleanPhone);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        try {
            // Ghi lại file bảo toàn thứ tự thời gian cào (không sort alphabetically)
            fs.writeFileSync(OUTPUT_FILE, currentPhonesList.join('\n') + '\n', 'utf-8');
        } catch (e) {
            console.error(`Lỗi ghi file ${OUTPUT_FILE}:`, e);
        }
    }

    return {
        addedCount,
        totalCount: currentPhones.size,
        currentPhonesSet: currentPhones
    };
};


(async () => {
    console.log(`🚀 Khởi động Deep Crawler - CHIẾN DỊCH BÌNH CHÁNH + HÓC MÔN + NHÀ BÈ...`);
    
    // Tải dữ liệu cũ của chính file này để không trùng và không mất dữ liệu cũ
    const globalPhoneNumbers = new Set();
    if (fs.existsSync(OUTPUT_FILE)) {
        const data = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        data.split('\n').filter(p => p.trim()).forEach(phone => {
            if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) globalPhoneNumbers.add(phone.trim());
        });
    }

    // Tải dữ liệu từ các file khác để chặn trùng chéo (loại trừ các file không liên quan)
    const blockerPhoneNumbers = loadAllOtherPhones();
    console.log(`Đã tải: ${globalPhoneNumbers.size} số cũ ở file ${OUTPUT_FILE}. Chặn trùng thêm ${blockerPhoneNumbers.size} số từ các quận khác.`);

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--blink-settings=imagesEnabled=false'
        ]
    });

    let isFinished = false;

    const runWorker = async (config) => {
        const domain = config.domain;
        // Sử dụng file state gộp chung cho cả 3 huyện để đồng bộ hàng đợi
        const STATE_FILE = `state_ctrcamera_${domain}.json`;
        const OLD_STATE_FILES = [
            `state_bc_hm_nb_${domain}.json`,
            `state_binhchanh_${domain}.json`,
            `state_binhtan_${domain}.json`
        ];
        
        let queue = [...config.seeds].map(normalizeUrl).filter(isMatchTargetLocation);
        let visited = new Set();
        let sessionVisited = new Set();

        const allStateFiles = [STATE_FILE, ...OLD_STATE_FILES];

        // 1. Tải visited từ tất cả các file state để khôi phục toàn bộ trí nhớ
        for (const file of allStateFiles) {
            if (fs.existsSync(file)) {
                try {
                    const stateData = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    if (stateData.visited) {
                        stateData.visited.forEach(url => {
                            const normUrl = normalizeUrl(url);
                            if (isDetailPage(normUrl, domain)) {
                                visited.add(normUrl);
                            }
                        });
                    }
                } catch (e) {}
            }
        }

        // 2. Khôi phục hàng đợi (queue) từ file STATE_FILE hiện tại hoặc các file cũ nếu hiện tại trống
        for (const file of allStateFiles) {
            if (fs.existsSync(file)) {
                try {
                    const stateData = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    if (stateData.queue && stateData.queue.length > 0) {
                        const restoredQueue = stateData.queue.map(normalizeUrl).filter(isMatchTargetLocation);
                        if (restoredQueue.length > 0) {
                            queue = restoredQueue;
                            break; 
                        }
                    }
                } catch (e) {}
            }
        }

        console.log(`[TargetArea - ${domain}] Đã khôi phục bộ nhớ tổng hợp: ${visited.size} link đã quét, ${queue.length} link đang chờ.`);

        // Luôn đẩy các seed URL vào lại hàng đợi lên đầu để quét lại tin mới ngay lập tức
        for (const seed of config.seeds) {
            const normSeed = normalizeUrl(seed);
            const idx = queue.indexOf(normSeed);
            if (idx > -1) {
                queue.splice(idx, 1);
            }
            queue.unshift(normSeed);
        }

        let queueSet = new Set(queue);

        let page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        const setupInterception = async (p) => {
            try {
                await p.setRequestInterception(true);
                p.on('request', (req) => {
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
            } catch (e) {}
        };

        await setupInterception(page);

        let pageCount = 0;

        while (queue.length > 0 && globalPhoneNumbers.size < TARGET_COUNT && !isFinished) {
            if (pageCount > 0 && pageCount % 30 === 0) {
                console.log(`[TargetArea - ${domain}] 🔄 Đang khởi tạo lại tab trình duyệt để giải phóng bộ nhớ RAM...`);
                try {
                    await page.close();
                } catch (e) {}
                try {
                    page = await browser.newPage();
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    await setupInterception(page);
                } catch (e) {
                    console.error(`[TargetArea - ${domain}] Lỗi tạo tab trình duyệt mới:`, e);
                }
            }

            const url = queue.shift();
            queueSet.delete(url);
            
            const isDetail = isDetailPage(url, domain);
            if (isDetail) {
                if (visited.has(url)) continue;
                visited.add(url);
            } else {
                if (sessionVisited.has(url)) continue;
                sessionVisited.add(url);
            }

            console.log(`[TargetArea - ${domain}] ⚡ Quét: ${url} | Đã gom: ${globalPhoneNumbers.size}`);
            
            try {
                // Ép xung: Giảm timeout chờ trang từ 30s xuống 10s
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                // Ép xung: Giảm thời gian chờ tải ban đầu
                await delay(200, 500);

                let pageHTML = "";

                if (isDetail) {
                    await page.evaluate(async () => {
                        const elements = document.querySelectorAll('button, [role="button"], a, span, i, div');
                        elements.forEach(el => {
                            const text = el.innerText ? el.innerText.toLowerCase() : '';
                            if (text.includes('hiện số') || text.includes('bấm để hiện') || text.includes('nhấn để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                                try { el.click(); } catch (e) {}
                            }
                        });
                        
                        // Cuộn trang để kích hoạt load lazy-loaded elements
                        let totalHeight = 0;
                        let distance = 1000;
                        while (totalHeight < document.body.scrollHeight && totalHeight < 6000) {
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            await new Promise(r => setTimeout(r, 50)); 
                        }
                    });

                    // Chờ phản hồi từ nút click
                    await delay(1000, 1500);

                    pageHTML = await page.evaluate(() => {
                        let text = document.body.innerText + " ";
                        document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                        
                        // Trích xuất từ tất cả thuộc tính data-, href hoặc value của mọi phần tử
                        document.querySelectorAll('*').forEach(el => {
                            if (el.attributes) {
                                for (let i = 0; i < el.attributes.length; i++) {
                                    const attr = el.attributes[i];
                                    if (attr.name.startsWith('data-') || attr.name === 'href' || attr.name === 'value') {
                                        text += attr.value + " ";
                                    }
                                }
                            }
                        });
                        return text;
                    });
                } else {
                    // Nếu là trang danh mục, đọc nhanh HTML luôn để trích xuất link và số trực tiếp
                    pageHTML = await page.evaluate(() => {
                        let text = document.body.innerText + " ";
                        document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
                        return text;
                    });
                }

                // Lọc lấy ở các huyện hoặc xã mục tiêu: URL hoặc nội dung trang chứa từ khóa địa bàn
                const lowerText = pageHTML.toLowerCase();
                
                // Kiểm tra loại trừ Bình Dương qua URL trước
                const isBinhDuong = url.toLowerCase().includes('binh-duong') || url.toLowerCase().includes('binhduong');
                                    
                const targetAreaKeywords = [
                    // Huyện
                    'binh-chanh', 'bình chánh', 'binh chanh',
                    'hoc-mon', 'hóc môn', 'hoc mon',
                    'nha-be', 'nhà bè', 'nha be',
                    'cu-chi', 'củ chi', 'cu chi',
                    'can-gio', 'cần giờ', 'can gio',
                    // Xã của Bình Chánh
                    'binh-hung', 'bình hưng', 'binh hung',
                    'binh-loi', 'bình lợi', 'binh loi',
                    'hung-long', 'hưng long', 'hung long',
                    'tan-nhut', 'tân nhựt', 'tan nhut',
                    'tan-vinh-loc', 'tân vĩnh lộc', 'tan vinh loc',
                    'vinh-loc', 'vĩnh lộc', 'vinh loc',
                    // Xã của Hóc Môn
                    'ba-diem', 'bà điểm', 'ba diem',
                    'dong-thanh', 'đông thạnh', 'dong thanh',
                    'xuan-thoi-son', 'xuân thới sơn', 'xuan thoi son',
                    // Xã của Nhà Bè
                    'hiep-phuoc', 'hiệp phước', 'hiep phuoc',
                    // Xã của Củ Chi
                    'an-nhon-tay', 'an nhơn tây', 'an nhon tay',
                    'binh-my', 'bình mỹ', 'binh my',
                    'nhuan-duc', 'nhuận đức', 'nhuan duc',
                    'phu-hoa-dong', 'phú hòa đông', 'phu hoa dong',
                    'tan-an-hoi', 'tân an hội', 'tan an hoi',
                    'thai-my', 'thái mỹ', 'thai my',
                    // Xã của Cần Giờ
                    'an-thoi-dong', 'an thới đông', 'an thoi dong',
                    'binh-khanh', 'bình khánh', 'binh khanh'
                ];
                
                const isTargetArea = (() => {
                    if (isBinhDuong) return false;
                    
                    // 1. Kiểm tra khớp từ khóa địa bàn
                    const matchesKeyword = targetAreaKeywords.some(kw => url.toLowerCase().includes(kw) || lowerText.includes(kw));
                    if (!matchesKeyword) return false;
                    
                    // 2. Tránh các trường hợp khớp nhầm (như 'viet-hung-long-bien' khớp 'hung-long'),
                    // yêu cầu nội dung hoặc URL phải chứa ít nhất 1 trong 5 huyện mục tiêu chính:
                    const districtKeywords = [
                        'binh chanh', 'bình chánh', 'binh-chanh',
                        'hoc mon', 'hóc môn', 'hoc-mon',
                        'nha be', 'nhà bè', 'nha-be',
                        'cu chi', 'củ chi', 'cu-chi',
                        'can gio', 'cần giờ', 'can-gio'
                    ];
                    return districtKeywords.some(dkw => url.toLowerCase().includes(dkw) || lowerText.includes(dkw));
                })();

                if (isDetail && isTargetArea) {
                    const foundPhones = extractPhoneNumbers(pageHTML);
                    let newPhonesCount = 0;

                    if (foundPhones.length > 0) {
                        const result = saveNewPhones(foundPhones.filter(phone => 
                            !BLACKLIST_PHONES.includes(phone) && !blockerPhoneNumbers.has(phone)
                        ));
                        
                        // Đồng bộ lại globalPhoneNumbers trong bộ nhớ từ file đã cập nhật
                        globalPhoneNumbers.clear();
                        result.currentPhonesSet.forEach(p => globalPhoneNumbers.add(p));

                        if (result.addedCount > 0) {
                            console.log(`[TargetArea - ${domain}] => 🎯 TÌM THẤY ${result.addedCount} SỐ MỚI. Tổng file: ${result.totalCount}`);
                        } else {
                            console.log(`[TargetArea - ${domain}] => ℹ️ Tìm thấy ${foundPhones.length} số nhưng đều bị trùng lặp.`);
                        }
                    } else {
                        console.log(`[TargetArea - ${domain}] => ℹ️ Không tìm thấy số điện thoại nào trên trang này.`);
                    }
                } else if (!isDetail) {
                    // Nếu là trang danh mục, chỉ log quét bình thường để tìm tin mới
                } else {
                    console.log(`[TargetArea - ${domain}] => ❌ Bỏ qua (Tin đăng không thuộc khu vực mục tiêu)`);
                }

                if (globalPhoneNumbers.size >= TARGET_COUNT) {
                    isFinished = true;
                    console.log(`\n[THÀNH CÔNG] Đã đạt giới hạn tối đa.`);
                    break;
                }

                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
                });

                const extractedDetails = [];
                const extractedLists = [];

                for (const href of hrefs) {
                    if (href.startsWith('http')) {
                        try {
                            const urlObj = new URL(href);
                            if (urlObj.hostname.includes(domain)) {
                                const normHref = normalizeUrl(href);
                                if (isMatchTargetLocation(normHref)) {
                                    if (isDetailPage(normHref, domain)) {
                                        if (!extractedDetails.includes(normHref)) {
                                            extractedDetails.push(normHref);
                                        }
                                    } else {
                                        if (!extractedLists.includes(normHref)) {
                                            extractedLists.push(normHref);
                                        }
                                    }
                                }
                            }
                        } catch (e) {}
                    }
                }

                // Đưa các trang chi tiết mới lên đầu hàng đợi
                for (const normHref of extractedDetails) {
                    if (!visited.has(normHref) && !queueSet.has(normHref)) {
                        queue.unshift(normHref);
                        queueSet.add(normHref);
                    }
                }

                // Đưa các trang danh mục mới vào cuối hàng đợi (chỉ khi là phân trang hợp lệ của seeds)
                for (const normHref of extractedLists) {
                    if (isValidListUrl(normHref, config.seeds)) {
                        if (!queueSet.has(normHref) && !sessionVisited.has(normHref)) {
                            queue.push(normHref);
                            queueSet.add(normHref);
                        }
                    }
                }

            } catch (error) {}

            pageCount++;
            if (pageCount % 50 === 0 || queue.length === 0 || globalPhoneNumbers.size >= TARGET_COUNT || isFinished) {
                try {
                    fs.writeFileSync(STATE_FILE, JSON.stringify({
                        queue: queue,
                        visited: Array.from(visited)
                    }), 'utf-8');
                } catch(e) {}
            }
        }
        
        // Đảm bảo lưu trạng thái cuối cùng trước khi đóng worker
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                queue: queue,
                visited: Array.from(visited)
            }), 'utf-8');
        } catch(e) {}
        
        try {
            await page.close();
        } catch (e) {}
    };

    // Ưu tiên chạy các trang web mới/chưa cào trước để có ngay số điện thoại mới
    const getVisitedSize = (domain) => {
        const STATE_FILE = `state_ctrcamera_${domain}.json`;
        const OLD_STATE_FILES = [
            `state_bc_hm_nb_${domain}.json`,
            `state_binhchanh_${domain}.json`,
            `state_binhtan_${domain}.json`
        ];
        const allFiles = [STATE_FILE, ...OLD_STATE_FILES];
        let count = 0;
        for (const file of allFiles) {
            if (fs.existsSync(file)) {
                try {
                    const stateData = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    if (stateData.visited) {
                        count += stateData.visited.length;
                    }
                } catch (e) {}
            }
        }
        return count;
    };

    DOMAINS_CONFIG.sort((a, b) => getVisitedSize(a.domain) - getVisitedSize(b.domain));
    console.log(`\n📋 Thứ tự ưu tiên cào các trang web (Trang mới/chưa quét lên đầu):`);
    DOMAINS_CONFIG.forEach((cfg, i) => {
        console.log(`   ${i + 1}. ${cfg.domain} (Lịch sử: ${getVisitedSize(cfg.domain)} links)`);
    });
    console.log(`\n`);

    // Giới hạn số lượng domain chạy song song tối đa là 3 để tránh quá tải CPU/RAM/Băng thông của máy
    const CONCURRENCY_LIMIT = 3;
    const activeWorkers = [];
    
    for (const config of DOMAINS_CONFIG) {
        if (activeWorkers.length >= CONCURRENCY_LIMIT) {
            await Promise.race(activeWorkers);
        }
        
        const promise = runWorker(config).then(() => {
            activeWorkers.splice(activeWorkers.indexOf(promise), 1);
        });
        
        activeWorkers.push(promise);
        await delay(1000, 2000); // Tạo khoảng nghỉ giãn cách khi bật worker mới
    }
    
    await Promise.all(activeWorkers);

    if (browser) {
        await browser.close();
    }
    console.log(`\n🎉 KẾT THÚC CHIẾN DỊCH BÌNH CHÁNH + HÓC MÔN + NHÀ BÈ! Tổng cộng cả hệ thống đã có: ${globalPhoneNumbers.size} số.`);
})();
