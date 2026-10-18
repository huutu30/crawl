const fs = require('fs');
const path = require('path');

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

const isDetailPage = (href, domain) => {
    const hrefLower = href.toLowerCase();
    if (domain === 'phongtro123.com' && hrefLower.endsWith('.html')) return true;
    if ((domain === 'bds123.vn' || domain === 'thuecanho123.com') && /-pr\d+\.html/.test(hrefLower)) return true;
    if (domain === 'bds.com.vn' && /-p\d+\.html/.test(hrefLower)) return true;
    if (domain === 'chothuephongtro.me' && /\/\d+\.html/.test(hrefLower)) return true;
    if (domain === 'alonhadat.com.vn' && /-\d+\.html/.test(hrefLower)) return true;
    if (domain === 'homedy.com' && /-es\d+/.test(hrefLower)) return true;
    if (domain === 'chothuenha.com.vn' && /-\d+$/.test(hrefLower)) return true;
    if (domain === 'i-batdongsan.com' && /\/\d+\.htm/.test(hrefLower)) return true;
    if (domain === 'phongtromoi.com' && /-\d+$/.test(hrefLower)) return true;
    if (domain === 'nha.chotot.com' && /-\d+\.htm/.test(hrefLower)) return true;
    if (domain === 'tromoi.com' && (hrefLower.includes('/phong-tro/') || hrefLower.includes('/can-ho/') || hrefLower.includes('/nha-nguyen-can/') || hrefLower.includes('/tim-nguoi-o-ghep/') || hrefLower.includes('/ky-tuc-xa/') || /id\d+/.test(hrefLower))) return true;
    if (domain === 'guland.vn' && (/\/post\/.*-\d+/.test(hrefLower) || /\/tin-da-dang-\d+/.test(hrefLower))) return true;
    if (domain === 'cafeland.vn' && /-\d+\.html/.test(hrefLower)) return true;
    if (hrefLower.match(/-pr\d+\.html/) || hrefLower.match(/\/\d+\.htm/) || hrefLower.match(/id\d+/) || hrefLower.match(/-\d+\./) || hrefLower.match(/-r\d+\.html/)) {
        return true;
    }
    return false;
};

const isValidListUrl = (url, seeds) => {
    try {
        const urlObj = new URL(url);
        const urlClean = (urlObj.origin + urlObj.pathname).toLowerCase().replace(/\/$/, '');
        for (const seed of seeds) {
            try {
                const seedObj = new URL(seed);
                const seedClean = (seedObj.origin + seedObj.pathname).toLowerCase().replace(/\/$/, '');
                if (urlClean === seedClean) return true;
                if (url.toLowerCase().startsWith(seedClean)) {
                    const suffix = url.toLowerCase().substring(seedClean.length);
                    if (suffix.startsWith('?') && (suffix.includes('page=') || suffix.includes('p=') || suffix.includes('pg=') || suffix.includes('pn='))) {
                        return true;
                    }
                    if (/^\/(trang-|page\/|p-)?\d+\/?$/.test(suffix) || /^\/\d+\/?$/.test(suffix) || /^-\d+\.html/.test(suffix) || /^[\/\?]\d+$/.test(suffix)) {
                        return true;
                    }
                }
            } catch (err) {}
        }
    } catch (e) {}
    return false;
};

const files = fs.readdirSync(__dirname);
for (const file of files) {
    if (file.startsWith('state_') && file.endsWith('.json')) {
        const stateFile = path.join(__dirname, file);
        // Find which domain config matches this state file
        const matchedConfig = DOMAINS_CONFIG.find(config => file.includes(config.domain));
        if (!matchedConfig) continue;

        try {
            const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            const oldQueueSize = data.queue ? data.queue.length : 0;
            if (data.queue && Array.isArray(data.queue)) {
                // Filter the queue to remove invalid list URLs
                data.queue = data.queue.filter(url => {
                    const isDetail = isDetailPage(url, matchedConfig.domain);
                    if (isDetail) return true;
                    
                    // If it is a category/list URL, it must be a valid pagination URL of seeds
                    return isValidListUrl(url, matchedConfig.seeds);
                });
                
                fs.writeFileSync(stateFile, JSON.stringify(data), 'utf-8');
                if (oldQueueSize !== data.queue.length) {
                    console.log(`Cleaned ${file}: Queue size reduced from ${oldQueueSize} to ${data.queue.length}`);
                }
            }
        } catch (e) {
            console.error(`Error cleaning state for ${file}:`, e);
        }
    }
}
console.log('Finished cleaning all states!');
