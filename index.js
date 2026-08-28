require('dotenv').config();
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// =============================================================
// 1. CẤU HÌNH BIẾN MÔI TRƯỜNG & KHỞI TẠO
// =============================================================
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'ten_kenh_tiktok_cua_ban';
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID || 'UNIVERSE_ID_CUA_BAN';
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'API_KEY_CUA_BAN';
const TOPIC_NAME = 'TikTokLiveEvent';

const DATA_FILE = path.join(__dirname, 'linked_users.json');
let linkedUsers = {};

if (fs.existsSync(DATA_FILE)) {
    try {
        linkedUsers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log(`📁 Đã nạp ${Object.keys(linkedUsers).length} tài khoản liên kết từ file.`);
    } catch (e) {
        linkedUsers = {};
    }
}

// Ghi file bất đồng bộ để tránh nghẽn thread
function saveLinkedUsers() {
    fs.writeFile(DATA_FILE, JSON.stringify(linkedUsers, null, 2), 'utf8', (err) => {
        if (err) console.error('❌ Lỗi ghi file linked_users:', err);
    });
}

// =============================================================
// 2. XỬ LÝ URL / USERNAME TIKTOK
// =============================================================
let rawTarget = TIKTOK_USERNAME;

// Nếu người dùng nhập dạng URL đầy đủ, tự động trích xuất username ở giữa
if (rawTarget.includes('tiktok.com/')) {
    const match = rawTarget.match(/@([^/?]+)/);
    if (match) {
        rawTarget = match[1];
    }
}

console.log(`🎯 Đang chuẩn bị kết nối tới kênh TikTok: @${rawTarget}`);

// Khởi tạo kết nối với các tùy chọn giả lập trình duyệt
const tiktokLiveConnection = new WebcastPushConnection(rawTarget, {
    requestOptions: {
        timeout: 10000,
    },
    clientParams: {
        app_language: 'vi-VN',
        device_platform: 'web'
    }
});

// =============================================================
// 3. GỬI SỰ KIỆN SANG ROBLOX MESSAGING SERVICE
// =============================================================
async function sendToRoblox(eventData) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/${TOPIC_NAME}`;
    
    try {
        await axios.post(url, {
            message: JSON.stringify(eventData)
        }, {
            headers: {
                'x-api-key': ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('❌ Lỗi gửi Open Cloud Roblox:', error.response?.data || error.message);
    }
}

// =============================================================
// 4. LẮNG NGHE SỰ KIỆN TIKTOK LIVE (LIKE, GIFT, CHAT...)
// =============================================================
tiktokLiveConnection.connect().then(state => {
    console.info(`✅ Đã kết nối thành công tới phòng Livestream ID: ${state.roomId}`);
}).catch(err => {
    console.error('❌ Lỗi kết nối TikTok Live:', err);
});

// Xử lý sự kiện Thích (Like)
tiktokLiveConnection.on('like', data => {
    const eventData = {
        type: 'like',
        username: data.uniqueId,
        nickname: data.nickname,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount
    };
    sendToRoblox(eventData);
});

// Xử lý sự kiện Tặng Quà (Gift)
tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) {
        // Quà chuỗi đang diễn ra
        return;
    }
    const eventData = {
        type: 'gift',
        username: data.uniqueId,
        nickname: data.nickname,
        giftName: data.giftName,
        diamondCount: data.diamondCount * data.repeatCount,
        repeatCount: data.repeatCount
    };
    sendToRoblox(eventData);
});

// Xử lý sự kiện Bình luận (Chat) để liên kết tài khoản nếu cần
tiktokLiveConnection.on('chat', data => {
    const msg = data.comment.trim();
    if (msg.startsWith('!link ')) {
        const robloxId = msg.split(' ')[1];
        linkedUsers[data.uniqueId] = robloxId;
        saveLinkedUsers();
        console.log(`🔗 Đã liên kết TikTok @${data.uniqueId} với Roblox ID: ${robloxId}`);
    }
});
    
