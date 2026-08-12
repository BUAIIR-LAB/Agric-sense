const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AUDIO_PATH = '/Users/user/Documents/BUAIR/mobileapp/LJ037-0171.wav';
const CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';
const TARGET_LANG = 'English';

async function testVoiceQuestion() {
    console.log(`🎤 Testing /voicequestion with file: ${AUDIO_PATH}`);
    
    if (!fs.existsSync(AUDIO_PATH)) {
        console.error('❌ Audio file not found!');
        return;
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
        const response = await axios.post(`${CHAT_API_URL}/voicequestion`, formData, {
            headers: {
                ...formData.getHeaders(),
                'ngrok-skip-browser-warning': 'true',
            },
            timeout: 300000,
        });

        console.log('✅ /voicequestion response received:');
        const data = response.data;
        if ('audio_content' in data) {
            const val = data.audio_content;
            console.log(`📡 Key 'audio_content' is present. Type: ${typeof val}, Value: ${val ? (val.substring(0, 50) + '...') : val}`);
            if (val) {
                console.log(`🔊 Found audio_content! Length: ${val.length} chars`);
            } else {
                console.warn('⚠️ audio_content is present but falsy.');
            }
        } else {
            console.warn('❌ Key "audio_content" is NOT present in response.');
        }
        console.log(JSON.stringify(data, (key, value) => key === 'audio_content' ? '[BASE64_DATA]' : value, 2));
    } catch (error) {
        console.error('❌ /voicequestion API Error:', error.message);
    }
}

async function testAsk() {
    console.log('💬 Testing /ask with text prompt...');
    
    const payload = {
        prompt: "How can I improve my maize yield?",
        user_id: "tester-1234",
        target_lang: "English",
        user_profile: {
            name: "Tester",
            preferred_language: "English",
        }
    };

    try {
        console.log('📤 Sending request to /ask...');
        const response = await axios.post(`${CHAT_API_URL}/ask`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            timeout: 60000,
        });

        console.log('✅ /ask response received:');
        const data = response.data;
        if ('audio_content' in data) {
            const val = data.audio_content;
            console.log(`📡 Key 'audio_content' is present. Type: ${typeof val}, Value: ${val ? (val.substring(0, 50) + '...') : val}`);
            if (val) {
                console.log(`🔊 Found audio_content! Length: ${val.length} chars`);
            } else {
                console.warn('⚠️ audio_content is present but falsy.');
            }
        } else {
            console.warn('❌ Key "audio_content" is NOT present in response.');
        }
        console.log(JSON.stringify(data, (key, value) => key === 'audio_content' ? '[BASE64_DATA]' : value, 2));
    } catch (error) {
        console.error('❌ /ask API Error:', error.message);
    }
}

async function runAllTests() {
    await testVoiceQuestion();
    console.log('\n' + '='.repeat(50) + '\n');
    await testAsk();
}

runAllTests();
