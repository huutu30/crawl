const puppeteer = require('puppeteer');

const variations = [
    // chothuephongtro.me variations
    'https://chothuephongtro.me/tinh-thanh/ho-chi-minh/huyen-binh-chanh',
    'https://chothuephongtro.me/cho-thue-phong-tro-huyen-binh-chanh',
    'https://chothuephongtro.me/cho-thue-phong-tro/ho-chi-minh/huyen-binh-chanh',
    
    // bds.com.vn variations
    'https://bds.com.vn/cho-thue-nha-dat-huyen-binh-chanh',
    'https://bds.com.vn/cho-thue-nha-dat-binh-chanh',
    'https://bds.com.vn/cho-thue-nha-dat-huyen-binh-chanh-tp-hcm',
    
    // tromoi.com variations
    'https://tromoi.com/cho-thue-phong-tro-ho-chi-minh',
    'https://tromoi.com/cho-thue-phong-tro-huyen-binh-chanh',
    'https://tromoi.com/cho-thue-phong-tro-tp-ho-chi-minh',
    
    // bds123.vn variations
    'https://bds123.vn/cho-thue-nha-huyen-binh-chanh-ho-chi-minh.html',
    'https://bds123.vn/cho-thue-phong-tro-huyen-binh-chanh-ho-chi-minh.html',
    'https://bds123.vn/ban-nha-huyen-binh-chanh-ho-chi-minh.html',
    'https://bds123.vn/ban-dat-huyen-binh-chanh-ho-chi-minh.html'
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log("Starting URL variations test...\n");
    for (const url of variations) {
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const status = response.status();
            const finalUrl = page.url();
            console.log(`URL: ${url}`);
            console.log(`  -> Status: ${status}`);
            if (url !== finalUrl) {
                console.log(`  -> Final URL: ${finalUrl}`);
            }
        } catch (e) {
            console.log(`URL: ${url} -> ERROR: ${e.message}`);
        }
    }
    await browser.close();
})();
