const fs = require('fs');
const path = require('path');

const loadExistingPhones = () => {
    const currentPhones = new Set();
    const files = fs.readdirSync(__dirname);
    console.log(`Scanning ${files.length} items in directory...`);
    
    for (const file of files) {
        if (file.toLowerCase().endsWith('.txt')) {
            try {
                const data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
                const matches = data.match(/(?<!\d)(0[35789]\d{8})(?!\d)/g);
                const prevSize = currentPhones.size;
                if (matches) {
                    matches.forEach(phone => currentPhones.add(phone));
                }
                const added = currentPhones.size - prevSize;
                console.log(`  - Loaded ${matches ? matches.length : 0} matches (${added} unique new) from: ${file}`);
            } catch (e) {
                console.error(`Error reading ${file}:`, e.message);
            }
        }
    }
    return currentPhones;
};

const phones = loadExistingPhones();
console.log(`\nTotal Unique Phone Numbers loaded: ${phones.size}`);
