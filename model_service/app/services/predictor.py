from fastapi import UploadFile


async def run_inference(audio: UploadFile) -> dict:
    return {
        "predicted_emotion": "neutral",
        "confidence": 0.78,
        "probabilities": {
            "angry": 0.04,
            "happy": 0.06,
            "sad": 0.07,
            "neutral": 0.78,
            "fear": 0.05,
        },
        "model_version": "mock_v1",
    }