import requests
import glob
import os
import json


API_URL = "http://127.0.0.1:8001/inference"

test_audio_path = r"C:\Users\Telmurius\OneDrive\Desktop\Голос 260330_203613.wav"

if not os.path.exists(test_audio_path):
    print(f"Ошибка: Файл '{test_audio_path}' не найден!")
    exit(1)
print(f"Отправляем файл на проверку: {test_audio_path}\n")

with open(test_audio_path, "rb") as f:
    files = {"audio": (os.path.basename(test_audio_path), f, "audio/wav")}
    
    try:
        response = requests.post(API_URL, files=files)
        response.raise_for_status()
        
        result = response.json()
        print("ОТВЕТ СЕРВЕРА")
        print(json.dumps(result, indent=4, ensure_ascii=False))
        
    except requests.exceptions.ConnectionError:
        print("ОШИБКА")
    except Exception as e:
        print(f"Произошла ошибка: {e}")
