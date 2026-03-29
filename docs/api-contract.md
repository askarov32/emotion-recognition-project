# API Contract

## Frontend -> Backend

### POST /api/predict
Content-Type: multipart/form-data

Field:
- audio: audio file

Supported formats:
- wav
- mp3

Response:
```json
{
  "predicted_emotion": "happy",
  "confidence": 0.91,
  "probabilities": {
    "angry": 0.02,
    "happy": 0.91,
    "sad": 0.03,
    "neutral": 0.03,
    "fear": 0.01
  },
  "model_version": "cnn_bilstm_v1"
}