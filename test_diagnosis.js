const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://147.93.116.6:8090/diagnosis/image';

const filesToTest = [
    { name: 'Cassava 1', path: '/Users/user/Documents/BUAIR/mobileapp/images.jpeg' },
    { name: 'Cassava 2', path: '/Users/user/Documents/BUAIR/mobileapp/images-2.jpeg' },
    { name: 'Maize', path: '/Users/user/Documents/BUAIR/mobileapp/corn-rust-0814H2-2842_1_0.webp' },
    { name: 'Beans', path: '/Users/user/Documents/BUAIR/mobileapp/Soybean-rust.jpg' },
];

async function testDiagnosis() {
    for (const file of filesToTest) {
        console.log(`\n============================`);
        console.log(`Testing image: ${file.name}`);
        console.log(`Path: ${file.path}`);
        if (!fs.existsSync(file.path)) {
            console.error(`❌ File not found!`);
            continue;
        }

        try {
            const base64Data = fs.readFileSync(file.path, { encoding: 'base64' });
            
            console.log(`📤 Sending to diagnosis endpoint...`);
            const startTime = Date.now();
            const response = await axios.post(API_URL, {
                image_base64: base64Data,
                target_lang: 'English'
            }, {
                timeout: 300000, 
                // Don't send auth headers since we test natively (if it fails 401 we will create auth)
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
