const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AUDIO_PATH = '/Users/user/Documents/BUAIR/mobileapp/LJ037-0171.wav';
const CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';
const TARGET_LANG = 'lg';

async function testVoiceQuery() {
    console.log(`🎤 Testing voice query with file: ${AUDIO_PATH}`);
    
    if (!fs.existsSync(AUDIO_PATH)) {
        console.error('❌ Audio file not found!');
        process.exit(1);
    }

    const formData = new FormData();
    formData.append('voice_note', fs.createReadStream(AUDIO_PATH), {
        filename: 'LJ037-0171.wav',
        contentType: 'audio/wav',
    });
    formData.append('user_id', 'tester-1234');
    formData.append('target_lang', TARGET_LANG);
    formData.append('language', TARGET_LANG);
    formData.append('user_profile', JSON.stringify({
        name: 'Tester',
        preferred_language: TARGET_LANG,
    }));

    try {
        console.log('📤 Sending request to /voicequestion...');
        const startTime = Date.now();
        const response = await axios.post(`${CHAT_API_URL}/voicequestion`, formData, {
            headers: {
                ...formData.getHeaders(),
                'ngrok-skip-browser-warning': 'true',
            },
            timeout: 300000, // 5 mins
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ Response received in ${duration.toFixed(2)}s:`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ API Error:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testVoiceQuery();
