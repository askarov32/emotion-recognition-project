from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas.inference_response import InferenceResponse
from app.services.predictor import run_inference

router = APIRouter()


@router.post("/inference", response_model=InferenceResponse)
async def inference(audio: UploadFile = File(...)):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Audio file is required")

    return await run_inference(audio)