from fastapi import UploadFile
from app.services.model_client import send_audio_to_model_service


async def predict_emotion(audio: UploadFile) -> dict:
    return await send_audio_to_model_service(audio)