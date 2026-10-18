const puppeteer = require('puppeteer');

const targetKeywords = [
    'binh-chanh', 'binhchanh',
    'hoc-mon', 'hocmon',
    'nha-be', 'nhabe',
    'cu-chi', 'cuchi',
    'can-gio', 'cangio',
    'binh-hung', 'binhhung',
    'binh-loi', 'binhloi',
    'hung-long', 'hunglong',
    'tan-nhut', 'tannhut',
    'tan-vinh-loc', 'tanvinhloc',
    'vinh-loc', 'vinhloc',
    'ba-diem', 'badiem',
    'dong-thanh', 'dongthanh',
    'xuan-thoi-son', 'xuanthoison',
    'hiep-phuoc', 'hiepphuoc',
    'an-nhon-tay', 'annhontay',
    'binh-my', 'binhmy',
    'nhuan-duc', 'nhuanduc',
    'phu-hoa-dong', 'phuhoadong',
    'tan-an-hoi', 'tananhoi',
    'thai-my', 'thaimy',
    'an-thoi-dong', 'anthoidong',
    'binh-khanh', 'binhkhanh'
];

const isMatchTargetLocation = (urlStr) => {
    const urlLower = urlStr.toLowerCase();
    if (urlLower.includes('soi-quy-hoach') || urlLower.includes('kho-ban-do') || urlLower.includes('gia-dat') || urlLower.includes('ban-do-cho-thue') || urlLower.includes('/dac-diem/')) {
        return false;
    }
    if (urlLower.includes('binh-duong') || urlLower.includes('binhduong')) {
        return false;
    }
    return targetKeywords.some(kw => urlLower.includes(kw));
};

const isDetailPage = (href, domain) => {
    const hrefLower = href.toLowerCase();
    if (/-pr\d{5,}\.html/.test(hrefLower)) return true;
    if (/-p\d{5,}\.html/.test(hrefLower)) return true;
    if (domain === 'chothuephongtro.me' && /\/\d{5,}\.html/.test(hrefLower)) return true;
    if (domain === 'tromoi.com' && /id\d{5,}/.test(hrefLower)) return true;
    if (domain === 'guland.vn' && /\/post\/.*-\d{5,}/.test(hrefLower)) return true;
    if (hrefLower.match(/-pr\d+\.html/) || hrefLower.match(/\/\d+\.htm/) || hrefLower.match(/id\d+/) || hrefLower.match(/-\d{5,}\./)) {
        return true;
    }
    return false;
};

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = 'https://tromoi.com/tim-tro-tai-thanh-pho-ho-chi-minh/huyen-binh-chanh';
    console.log(`Loading ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
    });

    console.log(`Total raw links: ${hrefs.length}`);
    let matchedCount = 0;
    for (const href of hrefs) {
        if (href.startsWith('http') && href.includes('tromoi.com')) {
            const matchLoc = isMatchTargetLocation(href);
            const isDetail = isDetailPage(href, 'tromoi.com');
            if (matchLoc || isDetail) {
                console.log(`Link: ${href} | MatchLoc: ${matchLoc} | isDetail: ${isDetail}`);
                matchedCount++;
            }
        }
    }
    console.log(`Total matched links: ${matchedCount}`);
    await browser.close();
})();
