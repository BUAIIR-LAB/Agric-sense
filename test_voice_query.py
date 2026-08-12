import requests

try:
    with open('./assets/images/favicon.png', 'rb') as f:
        # Just sending a dummy file that passes the form parser
        files = {'audio': ('dummy.wav', f, 'audio/wav')}
        data = {
            'user_id': 'test_user_from_script',
            'conversation_id': '',
            'target_lang': 'lg',
            'user_profile': '{"name":"Tester","area":"Kampala","preferred_language":"Luganda","crops_grown":["Maize"]}'
        }
        res = requests.post('http://127.0.0.1:8090/voicequestion', files=files, data=data, timeout=30)
        json_data = res.json()
        audio_content = json_data.get('audio_content')
        if audio_content:
            print(f"SUCCESS! audio_content received. Length: {len(audio_content)}")
        else:
            print("FAILED! No audio_content in response")
            print("Response:", json_data)
except Exception as e:
    print("Error:", e)
