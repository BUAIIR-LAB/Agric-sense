const axios = require('axios');
const CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';

async function testLugandaInsight() {
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

  const prompt = `Act as an expert agricultural advisor for a farmer in ${userProfile.area}.
Based on the following weather and the crops grown (${cropsStr}), provide a helpful daily insight.

Weather: ${weatherContext}

Structure your response clearly with:
1. A very brief weather summary.
2. A practical agricultural tip for today.

The entire response MUST be in ${language}.`;

  console.log('--- Prompt ---');
  console.log(prompt);
  console.log('--------------');

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
    const parts = results.split(/\n|(?:\[?\d\.\]?)/).filter(p => p.trim().length > 10);
    
    let summary = 'Weather looks good for farming today.';
    let tip = results;

    if (parts.length >= 2) {
        summary = parts[0].trim();
        tip = parts.slice(1).join(' ').trim();
    } else if (parts.length === 1) {
        const firstPeriod = results.indexOf('.');
        if (firstPeriod > 20 && firstPeriod < results.length - 20) {
            summary = results.substring(0, firstPeriod + 1).trim();
            tip = results.substring(firstPeriod + 1).trim();
        }
    }

    console.log('Section 1 (Summary):', summary);
    console.log('Section 2 (Tip):', tip);
    console.log('-------------------');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testLugandaInsight();
