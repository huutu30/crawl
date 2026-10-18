const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const urls = [
        'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-binh-chanh',
        'https://thuecanho123.com/cho-thue-can-ho-chung-cu-huyen-binh-chanh-ho-chi-minh.html'
    ];

    for (const url of urls) {
        console.log(`Testing URL: ${url}`);
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`Status: ${response.status()}`);
            const title = await page.title();
            console.log(`Title: ${title}`);
            const html = await page.content();
            console.log(`HTML Length: ${html.length}`);
            const linksCount = await page.evaluate(() => document.querySelectorAll('a[href]').length);
            console.log(`Found a[href] links: ${linksCount}`);
        } catch (e) {
            console.log(`Error testing ${url}: ${e.message}`);
        }
    }

    await browser.close();
})();
