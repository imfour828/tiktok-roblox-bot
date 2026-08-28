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

// Khởi tạo kết nối với các tùy chọn giả lập trình duyệt để giảm tỷ lệ bị chặn IP cloud
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
    // Ví dụ: Nhắn "!link 123456" để liên kết tài khoản Roblox
    if (msg.startsWith('!link ')) {
        const robloxId = msg.split(' ')[1];
        linkedUsers[data.uniqueId] = robloxId;
        saveLinkedUsers();
        console.log(`🔗 Đã liên kết TikTok @${data.uniqueId} với Roblox ID: ${robloxId}`);
    }
});
            
