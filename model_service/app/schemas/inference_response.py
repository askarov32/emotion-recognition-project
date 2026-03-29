from typing import Dict
from pydantic import BaseModel


class InferenceResponse(BaseModel):
    predicted_emotion: str
    confidence: float
    probabilities: Dict[str, float]
    model_version: str