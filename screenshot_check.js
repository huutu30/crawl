const puppeteer = require('puppeteer');
const path = require('path');

const urls = [
    'https://bds123.vn/ban-nha-dat-huyen-cu-chi-ho-chi-minh.html',
    'https://bds.com.vn/ban-nha-dat-huyen-cu-chi-ho-chi-minh',
    'https://tromoi.com/cho-thue-phong-tro-huyen-cu-chi-ho-chi-minh',
    'https://chothuephongtro.me/cho-thue-phong-tro-huyen-cu-chi.html',
    'https://guland.vn/mua-ban-nha-dat/huyen-cu-chi',
    'https://thuecanho123.com/cho-thue-can-ho-chung-cu-huyen-cu-chi-ho-chi-minh.html'
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    // Set viewport and user agent to resemble crawl_binhchanh.js
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const domain = new URL(url).hostname;
        console.log(`Loading ${url}...`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const title = await page.title();
            const textLength = (await page.evaluate(() => document.body.innerText)).length;
            console.log(`Domain: ${domain} | Title: ${title} | Text Length: ${textLength}`);
            
            const screenshotPath = `C:\\Users\\hp\\.gemini\\antigravity\\brain\\bc0d06b1-8e56-42ee-b958-42d73c539652\\screenshot_${domain}.png`;
            await page.screenshot({ path: screenshotPath });
            console.log(`Saved screenshot to ${screenshotPath}`);
        } catch (e) {
            console.error(`Failed to load ${url}:`, e.message);
        }
    }
    await browser.close();
})();
