const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = 'https://homedy.com/ban-nha-rieng-huyen-hoc-mon-tp-ho-chi-minh/1t1l-42m2-cho-nhi-xuanhoc-da-co-so-550-trieu-es3212436';

const PHONE_REGEX = /(?<!\d)(0[35789]\d{8})(?!\d)/g;
const BLACKLIST_PHONES = ['0909316890', '0313588502', '0287300123'];

const extractPhoneNumbers = (text) => {
    const cleanText = text.replace(/[\s\.\-]/g, '');
    const matches = cleanText.match(PHONE_REGEX);
    return matches ? matches : [];
};

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const elementInfos = await page.evaluate(() => {
            const results = [];
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const text = el.innerText || '';
                if (text.includes('Nhấn để hiện số')) {
                    results.push({
                        tagName: el.tagName,
                        className: el.className,
                        outerHTML: el.outerHTML.substring(0, 300),
                        parentTagName: el.parentElement ? el.parentElement.tagName : 'NONE',
                        parentClassName: el.parentElement ? el.parentElement.className : 'NONE',
                        parentOuterHTML: el.parentElement ? el.parentElement.outerHTML.substring(0, 300) : 'NONE'
                    });
                }
            });
            return results;
        });

        console.log("=== FOUND ELEMENTS AND PARENTS ===");
        console.log(JSON.stringify(elementInfos, null, 2));

        // Click cả phần tử chứa text và các cha của nó đến 3 cấp
        await page.evaluate(() => {
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const text = el.innerText || '';
                if (text.includes('Nhấn để hiện số')) {
                    try { el.click(); } catch(e) {}
                    let parent = el.parentElement;
                    for (let i = 0; parent && i < 3; i++) {
                        try { parent.click(); } catch(e) {}
                        parent = parent.parentElement;
                    }
                }
            });
        });

        // Chờ 3 giây để API/JS chạy
        await new Promise(r => setTimeout(r, 3000));

        const pageHTML = await page.evaluate(() => {
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
        
        console.log("=== RAW TEXT LENGTH ===", pageHTML.length);
        const phones = extractPhoneNumbers(pageHTML);
        console.log("=== EXTRACTED PHONES ===", phones);
        
        // Write to scratch directory
        const scratchDir = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\140360aa-54da-44bf-afcf-7f886fcda632\\scratch';
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }
        fs.writeFileSync(path.join(scratchDir, 'body_text.txt'), pageHTML, 'utf-8');
        console.log("Wrote body text to scratch/body_text.txt");
        
    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
