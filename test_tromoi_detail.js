const puppeteer = require('puppeteer');

const PHONE_REGEX = /(?<!\d)(0[35789]\d{8})(?!\d)/g;
const extractPhoneNumbers = (text) => {
    const cleanText = text.replace(/[\s\.\-]/g, '');
    const matches = cleanText.match(PHONE_REGEX);
    return matches ? matches : [];
};

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = 'https://tromoi.com/can-ho/studio-full-noi-that-tai-57-duong-d3-phong-phu-binh-chanh-ho-chi-minh';
    console.log(`Loading detail page: ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Log body text before click
    let bodyTextBefore = await page.evaluate(() => document.body.innerText);
    console.log(`Phones before click:`, extractPhoneNumbers(bodyTextBefore));
    
    // Log buttons on the page
    const buttonsInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"], a[href^="tel:"]')).map(el => ({
            tag: el.tagName,
            text: el.innerText || '',
            href: el.href || '',
            class: el.className || ''
        }));
    });
    console.log('Buttons/links found:', buttonsInfo);

    // Try clicking buttons
    await page.evaluate(async () => {
        const buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
        buttons.forEach(btn => {
            const text = btn.innerText ? btn.innerText.toLowerCase() : '';
            if (text.includes('hiện số') || text.includes('bấm để hiện') || /0[35789]\d{2,5}\*{3,}/.test(text)) {
                try { btn.click(); } catch (e) {}
            }
        });
    });

    await new Promise(r => setTimeout(r, 2000));

    let bodyTextAfter = await page.evaluate(() => {
        let text = document.body.innerText + " ";
        document.querySelectorAll('a[href^="tel:"]').forEach(a => text += a.href + " ");
        return text;
    });
    console.log(`Phones after click:`, extractPhoneNumbers(bodyTextAfter));

    await browser.close();
})();
