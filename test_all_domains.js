const puppeteer = require('puppeteer');

const seeds = [
    // phongtro123.com
    'https://phongtro123.com/tinh-thanh/ho-chi-minh/huyen-binh-chanh',
    'https://phongtro123.com/cho-thue-nha-nguyen-can/ho-chi-minh/huyen-binh-chanh',
    'https://phongtro123.com/cho-thue-can-ho/ho-chi-minh/huyen-binh-chanh',
    'https://phongtro123.com/cho-thue-mat-bang/ho-chi-minh/huyen-binh-chanh',
    
    // bds123.vn
    'https://bds123.vn/ban-nha-dat-huyen-binh-chanh-ho-chi-minh.html',
    'https://bds123.vn/ban-nha-huyen-cu-chi-ho-chi-minh.html',
    'https://bds123.vn/ban-dat-huyen-cu-chi-ho-chi-minh.html',
    'https://bds123.vn/cho-thue-nha-dat-huyen-cu-chi-ho-chi-minh.html',
    
    // tromoi.com
    'https://tromoi.com/cho-thue-phong-tro-huyen-binh-chanh-ho-chi-minh',
    
    // guland.vn
    'https://guland.vn/mua-ban-nha-dat/huyen-binh-chanh',
    'https://guland.vn/mua-ban-nha-dat/huyen-cu-chi',
    
    // bds.com.vn
    'https://bds.com.vn/ban-nha-dat-huyen-binh-chanh-ho-chi-minh',
    'https://bds.com.vn/ban-nha-dat-huyen-cu-chi-ho-chi-minh',
    'https://bds.com.vn/cho-thue-nha-dat-huyen-cu-chi-ho-chi-minh',
    
    // chothuephongtro.me
    'https://chothuephongtro.me/cho-thue-phong-tro-huyen-binh-chanh.html',
    'https://chothuephongtro.me/cho-thue-phong-tro-huyen-cu-chi.html'
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log("Starting seed URL HTTP status test...\n");
    for (const url of seeds) {
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            const status = response.status();
            const finalUrl = page.url();
            console.log(`URL: ${url}`);
            console.log(`  -> Status: ${status}`);
            if (url !== finalUrl) {
                console.log(`  -> Redirected to: ${finalUrl}`);
            }
        } catch (e) {
            console.log(`URL: ${url} -> ERROR: ${e.message}`);
        }
    }
    await browser.close();
})();
