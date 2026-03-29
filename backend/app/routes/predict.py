from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas.predict_response import PredictResponse
from app.services.prediction_service import predict_emotion

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
async def predict(audio: UploadFile = File(...)):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Audio file is required")

    return await predict_emotion(audio)