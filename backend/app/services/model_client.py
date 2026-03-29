import httpx
from fastapi import UploadFile
from app.core.config import settings


async def send_audio_to_model_service(audio: UploadFile) -> dict:
    content = await audio.read()

    files = {
        "audio": (
            audio.filename,
            content,
            audio.content_type or "application/octet-stream",
        )
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.model_service_url}/inference",
            files=files,
        )
        response.raise_for_status()
        return response.json()