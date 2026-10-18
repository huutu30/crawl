const fs = require('fs');

const globalPhoneNumbers = new Set();
const oldPhoneNumbers = new Set();
const files = fs.readdirSync(__dirname);

// Đọc danh sách những số "Đã từng xuất ra cho Sale" ở những lần chạy trước
const HISTORY_FILE = 'Lich_Su_Da_Xuat.txt';
if (fs.existsSync(HISTORY_FILE)) {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const phones = data.split('\n').filter(p => p.trim());
    phones.forEach(phone => {
        if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) {
            oldPhoneNumbers.add(phone.trim());
        }
    });
}

// Đọc tất cả data hiện có
for (const file of files) {
    if (file.endsWith('.txt') && (file.startsWith('data_') || file.includes('khach_hang') || file.startsWith('bc_hm_nb'))) {
        const data = fs.readFileSync(file, 'utf-8');
        const phones = data.split('\n').filter(p => p.trim());
        phones.forEach(phone => {
            if (/(?<!\d)(0[35789]\d{8})(?!\d)/.test(phone)) {
                globalPhoneNumbers.add(phone.trim());
            }
        });
    }
}

// Bóc tách: Tìm ra MỚI TINH (Chưa từng xuất)
const newPhoneNumbers = [];
const allPhonesArray = Array.from(globalPhoneNumbers);

for (const phone of allPhonesArray) {
    if (!oldPhoneNumbers.has(phone)) {
        newPhoneNumbers.push(phone);
        oldPhoneNumbers.add(phone); // Đưa luôn vào lịch sử để lần sau không xuất lại
    }
}

// Tạo thư mục Export theo thời gian thực bên trong folder export_telesale
const date = new Date();
const folderName = `Export_Telesale_${date.getDate()}_${date.getMonth()+1}_${date.getHours()}h${date.getMinutes()}m`;
const exportDir = `./export_telesale/${folderName}`;

if (newPhoneNumbers.length > 0) {
    fs.mkdirSync(exportDir, { recursive: true });
    
    // Ghi file TỔNG của TẤT CẢ các số từ trước tới nay
    fs.writeFileSync(`DATA_KHACH_HANG_TONG_HOP.txt`, Array.from(oldPhoneNumbers).join('\n') + '\n', 'utf-8');
    
    // Lưu lịch sử để phục vụ cho ngày mai
    fs.writeFileSync(HISTORY_FILE, Array.from(oldPhoneNumbers).join('\n') + '\n', 'utf-8');

    // Chia nhỏ số MỚI ra cho Sale gọi
    const CHUNK_SIZE = 1000;
    let totalParts = 0;
    for (let i = 0; i < newPhoneNumbers.length; i += CHUNK_SIZE) {
        const chunk = newPhoneNumbers.slice(i, i + CHUNK_SIZE);
        totalParts++;
        fs.writeFileSync(`${exportDir}/Data_Moi_Part_${totalParts}.txt`, chunk.join('\n') + '\n', 'utf-8');
    }

    console.log(`\n======================================================`);
    console.log(`✅ ĐÃ XUẤT DATA THÀNH CÔNG!`);
    console.log(`======================================================`);
    console.log(`🔥 Tổng tài sản hiện có: ${oldPhoneNumbers.size} SỐ`);
    console.log(`🎁 Đã tìm thấy và tách riêng: ${newPhoneNumbers.length} SỐ MỚI TINH (So với lần xuất trước)`);
    console.log(`📁 File tổng hợp tất cả: DATA_KHACH_HANG_TONG_HOP.txt`);
    console.log(`📂 Các số mới đã được chia ra ${totalParts} file và cất vào thư mục: "${folderName}"`);
    console.log(`======================================================\n`);
} else {
    console.log(`\n======================================================`);
    console.log(`⚠️ KHÔNG CÓ DATA MỚI!`);
    console.log(`======================================================`);
    console.log(`Bạn đã xuất tất cả ${oldPhoneNumbers.size} số trước đó rồi. Hãy đợi bot cào thêm số mới nhé!`);
    console.log(`======================================================\n`);
}
