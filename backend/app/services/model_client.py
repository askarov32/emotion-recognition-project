import httpx
from fastapi import HTTPException, UploadFile

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

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.model_service_url}/inference",
                files=files,
            )

        if response.status_code >= 400:
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text

            raise HTTPException(status_code=response.status_code, detail=detail)

        return response.json()

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Model service is unavailable: {str(e)}",
        )