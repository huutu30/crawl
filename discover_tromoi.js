const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
        console.log("Loading tromoi.com homepage...");
        await page.goto('https://tromoi.com', { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Extract all links containing 'binh-chanh', 'hoc-mon', 'nha-be', 'phong-tro', 'ho-chi-minh'
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(item => {
                    const h = item.href.toLowerCase();
                    return h.includes('binh') || h.includes('hoc') || h.includes('nha-be') || h.includes('ho-chi-minh');
                });
        });
        
        console.log("Found links:");
        console.log(JSON.stringify(links, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
    
    await browser.close();
})();
