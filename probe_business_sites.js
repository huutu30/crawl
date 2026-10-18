const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching test browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const query = 'tạp hóa Quận 5';
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
    console.log(`Navigating to: ${url}`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Scroll 3 times
        console.log("Scrolling...");
        await page.evaluate(async () => {
            const getFeedContainer = () => {
                let container = document.querySelector('div[role="feed"]');
                if (!container) {
                    const divs = Array.from(document.querySelectorAll('div'));
                    container = divs.find(d => {
                        const style = window.getComputedStyle(d);
                        return (style.overflowY === 'scroll' || style.overflowY === 'auto') && d.scrollHeight > d.clientHeight;
                    });
                }
                return container;
            };
            const container = getFeedContainer();
            if (container) {
                for (let i = 0; i < 3; i++) {
                    container.scrollTop = container.scrollHeight;
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        });
        
        const pageText = await page.evaluate(() => document.body.innerText);
        
        const phoneRegex = /(?:\+84|0)(?:\s*\d){9,11}/g;
        const matches = pageText.match(phoneRegex) || [];
        console.log(`\n--- DIAGNOSTIC RESULTS FOR "${query}" ---`);
        console.log(`1. Matches found on page: ${matches.length}`);
        console.log("Raw matches:", matches);
        
        // Normalize
        const normalized = matches.map(rawPhone => {
            let clean = rawPhone.replace(/[.\s-]/g, '');
            if (clean.startsWith('+84')) {
                clean = '0' + clean.slice(3);
            } else if (clean.startsWith('84')) {
                clean = '0' + clean.slice(2);
            }
            return clean;
        });
        
        const mobilePrefixRegex = /^(?:84|0)(?:9|3|5|7|8)\d{8}$/;
        const mobiles = normalized.filter(p => mobilePrefixRegex.test(p));
        console.log(`2. Valid mobile numbers found: ${mobiles.length}`);
        console.log("Normalized mobiles:", [...new Set(mobiles)]);
        
    } catch (e) {
        console.error("Diagnostic error:", e.message);
    }
    
    await browser.close();
})();
