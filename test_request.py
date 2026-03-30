import requests
import glob
import os
import json

# URL нашего развернутого сервиса
API_URL = "http://127.0.0.1:8001/inference"

# УКАЖИТЕ ПУТЬ К ВАШЕМУ АУДИО ФАЙЛУ ЗДЕСЬ (например: r"C:\Мои_звуки\голос.wav")
test_audio_path = r"C:\Users\Telmurius\OneDrive\Desktop\Голос 260330_203613.wav"

if not os.path.exists(test_audio_path):
    print(f"Ошибка: Файл '{test_audio_path}' не найден!")
    exit(1)
print(f"Отправляем файл на проверку: {test_audio_path}\n")

# Отправляем POST запрос с файлом
with open(test_audio_path, "rb") as f:
    files = {"audio": (os.path.basename(test_audio_path), f, "audio/wav")}
    
    try:
        response = requests.post(API_URL, files=files)
        response.raise_for_status() # Проверка на ошибки сервера
        
        # Красиво выводим ответ нейросети
        result = response.json()
        print("====== ОТВЕТ СЕРВЕРА (ПРЕДСКАЗАНИЕ) ======")
        print(json.dumps(result, indent=4, ensure_ascii=False))
        
    except requests.exceptions.ConnectionError:
        print("ОШИБКА: Сервер недоступен! Вы забыли запустить uvicorn или запустили его на другом порту.")
    except Exception as e:
        print(f"Произошла ошибка: {e}")
