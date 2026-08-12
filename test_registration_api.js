const axios = require('axios');

async function testRegistrationAPI() {
    console.log("🚀 Starting Registration API Test on 147.93.116.6:8090\n");

    const payload = {
        name: "Afaayo Tester",
        phone_number: "0750371313",  // The number seen in user's logs
        password: "securepassword",
        area: "Kampala",
        preferred_language: "English",
        gender: "Prefer not to say",
        age_bracket: "25-34",
    };

    try {
        console.log(`📤 SENDING /register REQUEST:`);
        console.log(JSON.stringify(payload, null, 2));

        const response = await axios.post('http://147.93.116.6:8090/register', payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`\n✅ SUCCESS (Status Code: ${response.status}):`);
        console.log("Response Data:", response.data);
    } catch (error) {
        if (error.response) {
            console.log(`\n❌ ERROR RECEIVED (Status Code: ${error.response.status}):`);
            console.log("Error Detail:", JSON.stringify(error.response.data.detail, null, 2));
            console.log("\nIf this is 400 and 'Phone number already registered', the backend API is working correctly and correctly rejecting duplicate profiles.");
        } else {
            console.log(`\n❌ UNKNOWN ERROR:`, error.message);
        }
    }
}

testRegistrationAPI();
