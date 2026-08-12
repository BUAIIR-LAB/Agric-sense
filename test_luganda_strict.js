const axios = require('axios');
const CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';

async function testLugandaStrict() {
  const language = 'Luganda';
  const weatherData = {
    locationLabel: 'Kyotera, Uganda',
    currentConditionLabel: 'Partly cloudy',
    currentTemperature: 26.6,
    currentHumidity: 92
  };
  const userProfile = {
    area: 'Kyotera',
    crops_grown: ['Maize', 'Cassava', 'Beans', 'Coffee', 'Groundnuts', 'Bananas (Matooke)', 'Sweet Potatoes']
  };

  const weatherContext = `${weatherData.locationLabel}: ${weatherData.currentConditionLabel}, ${weatherData.currentTemperature}°C, ${weatherData.currentHumidity}% humidity.`;
  const cropsStr = userProfile.crops_grown.join(', ');

  const prompt = `CRITICAL: YOUR ENTIRE RESPONSE MUST BE IN THE LUGANDA LANGUAGE. DO NOT USE ENGLISH.

As an expert agricultural advisor in ${userProfile.area}, give a localized daily insight.
Weather context: ${weatherContext}
Crops: ${cropsStr}

Structure:
WEATHER SUMMARY: <One short sentence about weather in Luganda>
FARMING TIP: <One specific practical recommendation for today in Luganda>`;

  console.log('--- Strict Prompt ---');
  console.log(prompt);
  console.log('---------------------');

  try {
    const response = await axios.post(`${CHAT_API_URL}/ask`, {
      prompt: prompt,
      user_id: 'Aa0VvK1e65Sh1L3holnS',
      target_lang: 'lg',
      user_profile: {
        ...userProfile,
        preferred_language: 'Luganda'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    });

    const results = response.data.results.trim();
    console.log('\n--- Raw Response ---');
    console.log(results);
    
    console.log('\n--- Parsing Test ---');
    // Look for headers first
    const weatherIndex = results.toUpperCase().indexOf('WEATHER SUMMARY:');
    const tipIndex = results.toUpperCase().indexOf('FARMING TIP:');
    
    let summary = 'Obudde bulungi leero.';
    let tip = results;

    if (weatherIndex !== -1 && tipIndex !== -1) {
        summary = results.substring(weatherIndex + 'WEATHER SUMMARY:'.length, tipIndex).trim();
        tip = results.substring(tipIndex + 'FARMING TIP:'.length).trim();
    } else {
        const parts = results.split(/\n|(?:\[?\d\.\]?)/).filter(p => p.trim().length > 10);
        if (parts.length >= 2) {
            summary = parts[0].trim();
            tip = parts.slice(1).join(' ').trim();
        }
    }

    console.log('Section 1 (Summary):', summary);
    console.log('Section 2 (Tip):', tip);
    console.log('-------------------');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLugandaStrict();
