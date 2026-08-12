const axios = require('axios');
const CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';

async function testLugandaNative() {
  const language = 'Luganda';
  const weatherContext = 'Kyotera, Uganda: Partly cloudy, 26.6°C, 92% humidity.';
  const cropsStr = 'Maize, Cassava, Beans, Coffee, Groundnuts, Bananas (Matooke), Sweet Potatoes';

  // Try a much simpler prompt, letting the target_lang do the heavy lifting
  const prompt = `Weather: ${weatherContext}. Crops: ${cropsStr}. Give me a weather summary and a farming tip in ${language}.`;

  try {
    const response = await axios.post(`${CHAT_API_URL}/ask`, {
      prompt: prompt,
      user_id: 'Aa0VvK1e65Sh1L3holnS',
      target_lang: 'lg', // The API claims to support this
      user_profile: {
        name: 'Expert BUAIR Advisor',
        area: 'Kyotera Farmer Support',
        preferred_language: 'Luganda'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    });

    console.log('Results:', response.data.results);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLugandaNative();
