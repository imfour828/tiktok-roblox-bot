const { WebcastPushConnection } = require('tiktok-live-connector');
const axios = require('axios');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('TikTok Live Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));

// 1. Thay tên tài khoản TikTok của bạn vào đây (ví dụ: "ten_tiktok_cua_ban")
let tiktokUsername = "imfour828";
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

let tapCounter = 0;
const TARGET_TAPS = 100; // Mốc 100 tap
const REWARD_EXP = 1000; // Thưởng 1000 EXP

tiktokLiveConnection.connect().then(state => {
    console.log(`Đã kết nối thành công phòng Live: ${state.roomInfo.owner.uniqueId}`);
}).catch(err => console.error('Lỗi kết nối TikTok:', err));

// Bắt sự kiện người xem tap màn hình
tiktokLiveConnection.on('like', async data => {
    tapCounter += data.likeCount;
    console.log(`Nhận ${data.likeCount} tap. Tổng tích lũy: ${tapCounter}/${TARGET_TAPS}`);

    if (tapCounter >= TARGET_TAPS) {
        tapCounter = 0; 
        await sendExpToRoblox(REWARD_EXP);
    }
});

// Hàm gửi tín hiệu vào game Roblox
async function sendExpToRoblox(expAmount) {
    // 2. Thay Universe ID và API Key của bạn vào đây
    const universeId = "10762029519";
    const apiKey = "API_KEY_OPEN_CLOUD_CUA_BAN";
    const topic = "TikTokLiveEvent";

    try {
        await axios.post(
            `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/${topic}`,
            {
                message: JSON.stringify({ exp: expAmount })
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`Đã gửi ${expAmount} EXP vào Roblox thành công!`);
    } catch (error) {
        console.error('Lỗi gửi API Roblox:', error.response?.data || error.message);
    }
}
