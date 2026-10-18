const puppeteer = require('puppeteer');

const candidates = [
    'https://sosanhnha.com/ban-nha-dat-huyen-binh-chanh-ho-chi-minh',
    'https://muaban.net/mua-ban-nha-dat-huyen-binh-chanh',
    'https://nhadat24h.net/ban-nha-dat-huyen-binh-chanh',
    'https://dothi.net/ban-nha-dat-huyen-binh-chanh',
    'https://meeyland.com/mua-ban-nha-dat/huyen-binh-chanh',
    'https://nhadat.cafeland.vn/nha-dat-ban-tai-huyen-binh-chanh/',
    'https://bannha.net/ban-nha-huyen-binh-chanh',
    'https://batdongsanso.vn/ban-nha-dat-huyen-binh-chanh',
    'https://nhadat.net/mua-ban/nha-dat/tp-ho-chi-minh/huyen-binh-chanh'
];

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log("=== Probing Candidates ===");
    for (const url of candidates) {
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const status = response.status();
            const finalUrl = page.url();
            console.log(`- ${url} -> Status: ${status} | Final URL: ${finalUrl}`);
        } catch (err) {
            console.log(`- ${url} -> Error: ${err.message}`);
        }
    }
    await browser.close();
})();
