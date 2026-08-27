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

// Quản lý lưu trữ liên kết tài khoản (TikTok ID -> Roblox Username)
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

function saveLinkedUsers() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(linkedUsers, null, 2), 'utf8');
}

// Bộ đệm tích lũy lượt tap màn hình
const userTapBuffer = {};

// =============================================================
// 2. HÀM GỬI LỆNH LÊN ROBLOX OPEN CLOUD
// =============================================================
async function sendToRoblox(robloxUsername, expToAdd) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/${TOPIC_NAME}`;

    const payload = {
        message: JSON.stringify({
            input: robloxUsername,
            expToAdd: expToAdd
        })
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'x-api-key': ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log(`🚀 [ROBLOX OPEN CLOUD] +${expToAdd} EXP -> ${robloxUsername}`);
        }
    } catch (error) {
        console.error(`❌ [LỖI ROBLOX API]`, error.response ? error.response.data : error.message);
    }
}

// =============================================================
// 3. LẮNG NGHE SỰ KIỆN TIKTOK LIVE
// =============================================================
const tiktok = new WebcastPushConnection(TIKTOK_USERNAME);

// A. LỆNH LINK TÀI KHOẢN (!link <ten_roblox>)
tiktok.on('chat', data => {
    const comment = data.comment.trim();
    const tiktokId = data.uniqueId;

    if (comment.startsWith('!link ')) {
        const parts = comment.split(' ');
        if (parts.length >= 2) {
            const robloxUser = parts[1].trim();

            linkedUsers[tiktokId] = robloxUser;
            saveLinkedUsers();

            console.log(`🔗 [LINK THÀNH CÔNG] TikTok @${tiktokId} -> Roblox: ${robloxUser}`);

            // Gọi NPC xuất hiện lên sàn nhảy ngay lần đầu tiên liên kết (+150 EXP)
            sendToRoblox(robloxUser, 150);
        }
    }
});

// B. BẮT SỰ KIỆN TAP MÀN HÌNH (ĐỦ 100 TAPS MỚI CỘNG 1,000 EXP)
tiktok.on('like', data => {
    const tiktokId = data.uniqueId;
    const robloxUser = linkedUsers[tiktokId];

    if (!robloxUser) return;

    const tapCount = data.likeCount;
    userTapBuffer[tiktokId] = (userTapBuffer[tiktokId] || 0) + tapCount;

    if (userTapBuffer[tiktokId] >= 100) {
        const hundredCount = Math.floor(userTapBuffer[tiktokId] / 100);
        const expGained = hundredCount * 1000;

        console.log(`❤️ [TAP MÀN HÌNH] @${tiktokId} đạt ${hundredCount * 100} taps -> +${expGained} EXP cho ${robloxUser}`);

        sendToRoblox(robloxUser, expGained);
        userTapBuffer[tiktokId] %= 100; // Giữ lại số dư chưa đủ 100 tap cho đợt sau
    }
});

// C. BẮT SỰ KIỆN TẶNG QUÀ (GIFT)
tiktok.on('gift', data => {
    if (data.giftType === 1 && data.repeatEnd) {
        const tiktokId = data.uniqueId;
        const robloxUser = linkedUsers[tiktokId];

        if (!robloxUser) return;

        const giftName = data.giftName ? data.giftName.toLowerCase() : '';
        const count = data.repeatCount || 1;
        let totalExp = 0;

        // Quà đặc biệt "Tim đội TikTok" (1 xu -> +30,000 EXP)
        if (giftName.includes('tim đội') || giftName.includes('team heart') || data.giftId === 5656) {
            totalExp = 30000 * count;
            console.log(`🎁 [QUÀ ĐẶC BIỆT] @${tiktokId} tặng Tim Đội x${count} -> +${totalExp} EXP cho ${robloxUser}`);
        } else {
            // Quà thường (1 Xu = 2,000 EXP)
            const coinsPerGift = data.diamondCount || 1;
            totalExp = coinsPerGift * 2000 * count;
            console.log(`🎁 [QUÀ THƯỜNG] @${tiktokId} tặng ${data.giftName} (${coinsPerGift} xu) x${count} -> +${totalExp} EXP cho ${robloxUser}`);
        }

        if (totalExp > 0) {
            sendToRoblox(robloxUser, totalExp);
        }
    }
});

// =============================================================
// 4. KẾT NỐI PHÒNG LIVE
// =============================================================
tiktok.connect()
    .then(state => console.log(`✅ Kết nối thành công tới phòng Live ID: ${state.roomId}`))
    .catch(err => console.error('❌ Lỗi kết nối TikTok Live:', err));
