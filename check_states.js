const fs = require('fs');
const path = require('path');

const domains = [
    'phongtro123.com',
    'bds123.vn',
    'tromoi.com',
    'guland.vn',
    'thuecanho123.com',
    'bds.com.vn',
    'chothuephongtro.me'
];

console.log('--- ANALYZING CRAWLER STATES ---');
domains.forEach(domain => {
    const stateFile = `state_ctrcamera_${domain}.json`;
    if (fs.existsSync(stateFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            const queueLen = data.queue ? data.queue.length : 0;
            const visitedLen = data.visited ? data.visited.length : 0;
            console.log(`Domain: ${domain.padEnd(25)} | Queue: ${queueLen.toString().padStart(6)} | Visited: ${visitedLen.toString().padStart(6)}`);
        } catch (e) {
            console.log(`Domain: ${domain.padEnd(25)} | Error reading state file: ${e.message}`);
        }
    } else {
        console.log(`Domain: ${domain.padEnd(25)} | State file does not exist`);
    }
});
