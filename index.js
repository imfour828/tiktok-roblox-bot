require('dotenv').config();
const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// =============================================================
// 1. CẤU HÌNH TRỰC TIẾP TRONG CODE
// =============================================================
const TIKTOK_USERNAME = 'https://www.tiktok.com/@thanh_langtuskibidi/live';
const ROBLOX_UNIVERSE_ID = '10762029519';
const ROBLOX_API_KEY = 'xXo6zmfg9EWVaq/wviK9j3Z7BCUUycnTx7+BAvJPpcUguKL3ZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW5oWWJ6WjZiV1puT1VWWFZtRnhMM2QyYVVzNWFqTmFOMEpEVlZWNVkyNVVlRGNyUWtGMlNsQndZMVZuZFV0TU15SXNJbTkzYm1WeVNXUWlPaUl4TVRVeU1EazFNak0xTlNJc0ltVjRjQ0k2TVRjNE56ZzNPRFk0Tnl3aWFXRjBJam94TnpnM09EYzFNRGczTENKdVltWWlPakUzT0RjNE56VXdPRGQ5LmNzU0ZFOHFMQkQ2MEdaT1pNdjhjVDBaMko3cUJqZkZwM092OG9HU0Y4a0Y1YkVtTmFCNWpSU3BtX3JybGxfYnRTY3NJVkJUM242VVdTY21SZHBFUGxPQmdHUjlmMzRuWkRzSTBBRGVrZkZUZk9HWWh6TjBvZVZDUW1FeDR4Uy15TkczbXNabzZvUW4tOTVmMnJIbFN0SEZRNFlQS3FBelc0YXJpOFdJdUw0d3hGOVA5X1JSUmo5UW05UW94TVhoaXk2d2c2cmctUlhwVHZsM1pwU0YwZndIaWk4TWFuYzB2VEV4bjJhQngzNlhQZUZLWmhzODRlZ0pRSXdCWktpWVJ2SkZRczRKbWJOYmtDNTM1RkRYM00zUmxiOFFtSDdYc01NZUJGd2lrb24zOWZuUjNsOGRiM3BtelE2YnQ4eEMtWUxSZ2E5LUlqWUdCZ3BhYU1lNVVDZw==';
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

if (rawTarget.includes('tiktok.com/')) {
    const match = rawTarget.match(/@([^/?]+)/);
    if (match) {
        rawTarget = match[1];
    }
}

console.log(`🎯 Đang chuẩn bị kết nối tới kênh TikTok: @${rawTarget}`);

// Khởi tạo kết nối với cấu hình né lỗi Signature
const tiktokLiveConnection = new WebcastPushConnection(rawTarget, {
    requestOptions: {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    },
    clientParams: {
        app_language: 'vi-VN',
        device_platform: 'web'
    },
    // Thêm các tùy chọn này để bypass cơ chế kiểm tra chữ ký gắt gao của thư viện
    processInitialData: true,
    enableExtendedGiftInfo: true
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
    console.error('❌ Lỗi kết nối TikTok Live:', err.message || err);
});

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

tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) {
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

tiktokLiveConnection.on('chat', data => {
    const msg = data.comment.trim();
    if (msg.startsWith('!link ')) {
        const robloxId = msg.split(' ')[1];
        linkedUsers[data.uniqueId] = robloxId;
        saveLinkedUsers();
        console.log(`🔗 Đã liên kết TikTok @${data.uniqueId} với Roblox ID: ${robloxId}`);
    }
});
