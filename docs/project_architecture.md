USER
  │
  │  opens website
  ▼
FRONTEND (static site, port 8080)
  │
  │  JS reads selected audio file
  │  POST http://localhost:8000/api/predict
  │  multipart/form-data: field "audio"
  ▼
BACKEND (FastAPI, port 8000)
  │
  │  route: POST /api/predict
  │  validates that audio.filename exists
  │
  │  calls prediction_service.predict_emotion(audio)
  ▼
BACKEND prediction_service
  │
  │  just forwards call to model_client.send_audio_to_model_service(audio)
  ▼
BACKEND model_client
  │
  │  reads uploaded file bytes
  │  builds multipart/form-data again
  │  POST http://model_service:8001/inference
  │
  │  if model_service returns error:
  │     backend forwards HTTP error/detail back to frontend
  │  else:
  │     backend returns JSON to frontend
  ▼
MODEL_SERVICE (FastAPI, port 8001)
  │
  │  on startup:
  │     _load_model()
  │     loads meta.json and model.pt from /app/weights
  │
  │  route: POST /inference
  │  validates that audio.filename exists
  │  calls run_inference(audio)
  ▼
PREDICTOR / INFERENCE LOGIC
  │
  │  1. reads uploaded audio bytes
  │  2. writes bytes to temp file
  │  3. librosa.load(..., sr=16000, duration=3.0, mono=True)
  │  4. builds mel-spectrogram
  │  5. converts to log-mel
  │  6. pads or truncates to max_len=95
  │  7. normalizes features
  │  8. converts to torch tensor
  │  9. runs CNN + BiLSTM model
  │ 10. softmax -> probabilities
  │ 11. selects top emotion
  ▼
JSON RESPONSE
  {
    "predicted_emotion": "...",
    "confidence": ...,
    "probabilities": {...},
    "model_version": "cnn_lstm_cv_v1"
  }
  │
  ▼
FRONTEND
  │
  │  shows:
  │  - emotion
  │  - confidence
  │  - probabilities as raw JSON
  ▼
USER