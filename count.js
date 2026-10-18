const fs = require('fs');

const globalPhoneNumbers = new Set();
const files = fs.readdirSync(__dirname);

let totalFiles = 0;
const domainStats = {};

for (const file of files) {
    if (file.endsWith('.txt') && (file.startsWith('data_') || file.includes('khach_hang'))) {
        totalFiles++;
        
        // Trích xuất tên miền từ tên file (ví dụ: data_guland_vn_part_1.txt -> guland.vn)
        let domainName = "Data cũ (Khởi điểm)";
        if (file.startsWith('data_') && !file.startsWith('data_khach_hang')) {
            const parts = file.split('_part_');
            if (parts.length > 0) {
                let rawName = parts[0].replace('data_', '');
                domainName = rawName.replace(/_/g, '.');
            }
        }

        if (!domainStats[domainName]) {
            domainStats[domainName] = 0;
        }

        const data = fs.readFileSync(file, 'utf-8');
        const phones = data.split('\n').filter(p => p.trim());
        phones.forEach(phone => {
            if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) {
                const cleanPhone = phone.trim();
                // Chỉ đếm số này cho domain đầu tiên tìm thấy nó (không tính trùng)
                if (!globalPhoneNumbers.has(cleanPhone)) {
                    globalPhoneNumbers.add(cleanPhone);
                    domainStats[domainName]++;
                }
            }
        });
    }
}

console.log(`\n======================================================`);
console.log(`📊 BẢNG XẾP HẠNG HIỆU SUẤT CÁC TÊN MIỀN`);
console.log(`======================================================`);

// Sắp xếp giảm dần theo số lượng
const sortedStats = Object.entries(domainStats).sort((a, b) => b[1] - a[1]);

sortedStats.forEach(([domain, count], index) => {
    let icon = "🔹";
    if (index === 0) icon = "🥇";
    else if (index === 1) icon = "🥈";
    else if (index === 2) icon = "🥉";
    else if (count === 0) icon = "❌";
    
    console.log(`${icon} ${domain.padEnd(25, ' ')} : ${count.toString().padStart(4, ' ')} số`);
});

console.log(`------------------------------------------------------`);
console.log(`🔥 TỔNG KHÁCH HÀNG THỰC TẾ: ${globalPhoneNumbers.size} số`);
console.log(`======================================================\n`);
console.log(`💡 CHIẾN LƯỢC: \n- Hãy tập trung vào Top 3 web đầu tiên (🥇🥈🥉).\n- Các web có dấu ❌ hoặc ít hơn 5 số là các web có tường lửa chặn bot rất mạnh hoặc đã đổi cấu trúc HTML.\n- Lời khuyên: Bạn nên mở file index.js, xóa các web kém này đi và bổ sung tên miền khác vào!\n`);
