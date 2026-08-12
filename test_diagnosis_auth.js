const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://147.93.116.6:8090';

const filesToTest = [
    { name: 'Cassava 1', path: '/Users/user/Documents/BUAIR/mobileapp/images.jpeg' },
    { name: 'Cassava 2', path: '/Users/user/Documents/BUAIR/mobileapp/images-2.jpeg' },
    { name: 'Maize', path: '/Users/user/Documents/BUAIR/mobileapp/corn-rust-0814H2-2842_1_0.webp' },
    { name: 'Beans', path: '/Users/user/Documents/BUAIR/mobileapp/Soybean-rust.jpg' },
];

async function testDiagnosis() {
    let token = '';
    try {
        console.log('Logging in to get token...');
        const resp = await axios.post(`${API_URL}/login`, {
            phone_number: 'tester-1234',
            password: 'password123'
        });
        token = resp.data.access_token;
    } catch(e) {
        if(e.response && (e.response.status === 401 || e.response.status === 404)) {
            console.log('User not found, registering...');
            await axios.post(`${API_URL}/register`, {
                name: "Tester",
                phone_number: "tester-1234",
                password: "password123",
                area: "Kampala"
            });
            const resp = await axios.post(`${API_URL}/login`, {
                 phone_number: 'tester-1234',
                 password: 'password123'
             });
             token = resp.data.access_token;
        } else {
            console.error('Auth error', e.message);
            return;
        }
    }
    
    console.log('Token acquired! Starting tests...');

    for (const file of filesToTest) {
        console.log(`\n============================`);
        console.log(`Testing image: ${file.name}`);
        if (!fs.existsSync(file.path)) {
            console.error(`❌ File not found!`);
            continue;
        }

        try {
            const base64Data = fs.readFileSync(file.path, { encoding: 'base64' });
            
            console.log(`📤 Sending to diagnosis endpoint...`);
            const startTime = Date.now();
            const response = await axios.post(`${API_URL}/diagnosis/image`, {
                image_base64: base64Data,
                target_lang: 'English'
            }, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 300000 
            });
            const elapsed = Date.now() - startTime;
            
            const data = response.data;
            console.log(`✅ Success in ${elapsed}ms!`);
            console.log(`   Top Issue: ${data.suspected_issues[0]}`);
            console.log(`   Confidence: ${data.confidence}`);
            console.log(`   Recommendations length: ${data.recommendations?.length}`);
            console.log(`   Summary: ${data.summary?.substring(0, 100)}...`);
            
        } catch (e) {
            console.error(`❌ Error testing ${file.name}:`, e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
        }
    }
}

testDiagnosis();
