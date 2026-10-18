const fs = require('fs');
const path = require('path');

const INPUT_FILE = 'ngoaithanh.txt';
const HISTORY_FILE = 'Lich_Su_Da_Xuat.txt';
const CHUNK_SIZE = 2000; // Mỗi file chứa tối đa 2000 SĐT

const oldPhoneNumbers = new Set();
const inputPhoneNumbers = new Set();

// 1. Đọc danh sách SĐT đã từng xuất ra từ trước đến nay để tránh xuất trùng
if (fs.existsSync(HISTORY_FILE)) {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const phones = data.split('\n').filter(p => p.trim());
        phones.forEach(phone => {
            const match = phone.match(/(?<!\d)(0[35789]\d{8})(?!\d)/);
            if (match) {
                oldPhoneNumbers.add(match[1]);
            }
        });
    } catch (e) {
        console.error(`Lỗi khi đọc file lịch sử ${HISTORY_FILE}:`, e.message);
    }
}

// 2. Đọc tệp dữ liệu tiểu thương ngoaithanh.txt
if (fs.existsSync(INPUT_FILE)) {
    try {
        const data = fs.readFileSync(INPUT_FILE, 'utf-8');
        const phones = data.split('\n').filter(p => p.trim());
        phones.forEach(phone => {
            const match = phone.match(/(?<!\d)(0[35789]\d{8})(?!\d)/);
            if (match) {
                inputPhoneNumbers.add(match[1]);
            }
        });
    } catch (e) {
        console.error(`Lỗi khi đọc file dữ liệu ${INPUT_FILE}:`, e.message);
        process.exit(1);
    }
} else {
    console.error(`❌ Không tìm thấy file dữ liệu đầu vào: ${INPUT_FILE}`);
    process.exit(1);
}

// 3. Lọc ra SĐT tiểu thương MỚI (chưa từng xuất)
const newPhoneNumbers = [];
const allInputPhones = Array.from(inputPhoneNumbers);

for (const phone of allInputPhones) {
    if (!oldPhoneNumbers.has(phone)) {
        newPhoneNumbers.push(phone);
        oldPhoneNumbers.add(phone); // Đưa vào lịch sử để lần sau không trùng
    }
}

// 4. Thực hiện chia nhỏ và xuất dữ liệu
if (newPhoneNumbers.length > 0) {
    // Tạo cấu trúc thư mục xuất
    const date = new Date();
    const folderName = `Export_TieuThuong_${date.getDate()}_${date.getMonth() + 1}_${date.getHours()}h${date.getMinutes()}m`;
    const exportDir = path.join(__dirname, 'compain', folderName);

    fs.mkdirSync(exportDir, { recursive: true });

    // Ghi file TỔNG của TẤT CẢ các số từ trước tới nay
    fs.writeFileSync(`DATA_KHACH_HANG_TONG_HOP.txt`, Array.from(oldPhoneNumbers).join('\n') + '\n', 'utf-8');

    // Lưu lịch sử xuất
    fs.writeFileSync(HISTORY_FILE, Array.from(oldPhoneNumbers).join('\n') + '\n', 'utf-8');

    // Chia tệp 2000 SĐT / file
    let totalParts = 0;
    for (let i = 0; i < newPhoneNumbers.length; i += CHUNK_SIZE) {
        const chunk = newPhoneNumbers.slice(i, i + CHUNK_SIZE);
        totalParts++;
        const filePath = path.join(exportDir, `Data_TieuThuong_Part_${totalParts}.txt`);
        fs.writeFileSync(filePath, chunk.join('\n') + '\n', 'utf-8');
    }

    console.log(`\n======================================================`);
    console.log(`✅ ĐÃ XUẤT DATA TIỂU THƯƠNG THÀNH CÔNG!`);
    console.log(`======================================================`);
    console.log(`📁 File dữ liệu gốc: ${INPUT_FILE} (${inputPhoneNumbers.size} số)`);
    console.log(`🔥 Tổng lịch sử cơ sở dữ liệu đã xuất: ${oldPhoneNumbers.size} SỐ`);
    console.log(`🎁 Đã lọc tìm thấy: ${newPhoneNumbers.length} SỐ MỚI CHƯA TỪNG XUẤT`);
    console.log(`📂 Đã chia làm ${totalParts} file (tối đa ${CHUNK_SIZE} số/file)`);
    console.log(`📍 Thư mục lưu trữ: "compain/${folderName}"`);
    console.log(`======================================================\n`);
} else {
    console.log(`\n======================================================`);
    console.log(`⚠️ KHÔNG CÓ DỮ LIỆU MỚI!`);
    console.log(`======================================================`);
    console.log(`Tất cả ${inputPhoneNumbers.size} số trong tệp ${INPUT_FILE} đã được xuất trước đó.`);
    console.log(`Tổng lịch sử cơ sở dữ liệu: ${oldPhoneNumbers.size} SỐ.`);
    console.log(`======================================================\n`);
}
