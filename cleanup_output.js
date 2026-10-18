const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'bc_hm_nb.txt');

if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const validPhones = new Set();
    
    const PHONE_REGEX = /^(0[35789]\d{8})$/;
    
    lines.forEach(line => {
        const clean = line.trim().replace(/[\s\.\-]/g, '');
        if (PHONE_REGEX.test(clean)) {
            validPhones.add(clean);
        }
    });
    
    const sorted = Array.from(validPhones).sort();
    fs.writeFileSync(file, sorted.join('\n') + '\n', 'utf-8');
    console.log(`Successfully cleaned up bc_hm_nb.txt: original lines: ${lines.length}, cleaned valid unique numbers: ${sorted.length}`);
} else {
    console.log("bc_hm_nb.txt does not exist.");
}
