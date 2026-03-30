import json
import os
import io
import pathlib
import numpy as np
import torch
import torch.nn as nn
import librosa
from fastapi import UploadFile, HTTPException
import traceback

# НАСТРОЙКИ
_WEIGHTS_DIR = pathlib.Path(__file__).parents[2] / "weights"
_MODEL_PATH = _WEIGHTS_DIR / "model.pt"
_META_PATH = _WEIGHTS_DIR / "meta.json"

_DEFAULT_META = {
    "labels": ["Angry", "Disgusted", "Fearful", "Happy", "Neutral", "Sad", "Suprised"],
    "label2idx": {
        "Angry": 0, "Disgusted": 1, "Fearful": 2, "Happy": 3, 
        "Neutral": 4, "Sad": 5, "Suprised": 6
    },
    "n_mels": 64,
    "max_len": 95,
    "sample_rate": 16000,
    "duration": 3.0,
    "model_version": "cnn_lstm_cv_v1"
}

_device = "cuda" if torch.cuda.is_available() else "cpu"
_model = None
_meta = None

# АРХИТЕКТУРА (CNN + LSTM)
class EmotionModel(nn.Module):
    def __init__(self, n_mels: int, n_classes: int):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d((2, 1)),
        )
        
        lstm_input_size = 64 * (n_mels // 8)
        self.lstm = nn.LSTM(
            input_size=lstm_input_size,
            hidden_size=128,
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )
        
        self.classifier = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(256, n_classes)  # 128 * 2 для Bidirectional LSTM
        )

    def forward(self, x):
        x = x.unsqueeze(1)
        x = self.cnn(x)
        
        B, C, F, T = x.shape
        x = x.permute(0, 3, 1, 2).reshape(B, T, C * F)
        
        x, _ = self.lstm(x)
        x = x[:, -1, :]
        return self.classifier(x)

def _load_model() -> tuple[EmotionModel, dict]:
    global _model, _meta
    if _model is not None:
        return _model, _meta

    if _META_PATH.exists():
        with open(_META_PATH) as f:
            _meta = json.load(f)
    else:
        _meta = _DEFAULT_META

    n_classes = len(_meta["labels"])
    _model = EmotionModel(n_mels=_meta["n_mels"], n_classes=n_classes)

    if _MODEL_PATH.exists():
        state = torch.load(_MODEL_PATH, map_location=_device, weights_only=True)
        _model.load_state_dict(state)
        print(f"[predictor] Обученные веса загружены из {_MODEL_PATH}")
    else:
        print("[predictor] ВНИМАНИЕ: Файл model.pt отсутствует. Модель не обучена!")

    _model.to(_device)
    _model.eval()
    return _model, _meta

def _extract_features(audio_bytes: bytes, meta: dict, original_filename: str) -> np.ndarray:
    sr = meta["sample_rate"]
    dur = meta["duration"]
    n_mels = meta["n_mels"]
    max_len = meta["max_len"]

    import tempfile
    
    ext = os.path.splitext(original_filename)[1] if original_filename else ".wav"
    if not ext:
        ext = ".wav"
        
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, _ = librosa.load(tmp_path, sr=sr, duration=dur, mono=True)
    except Exception as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Не удалось обработать формат {ext}. Установите FFmpeg в систему или используйте формат .wav. Детали: {str(e)}"
        )
    finally:
        os.unlink(tmp_path)

    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels)
    log_mel = librosa.power_to_db(mel, ref=np.max)
    
    if log_mel.shape[1] < max_len:
        pad = max_len - log_mel.shape[1]
        log_mel = np.pad(log_mel, ((0, 0), (0, pad)), mode="constant")
    else:
        log_mel = log_mel[:, :max_len]
        
    log_mel = (log_mel - log_mel.mean()) / (log_mel.std() + 1e-9)
    return log_mel.astype(np.float32)

async def run_inference(audio: UploadFile) -> dict:
    model, meta = _load_model()
    audio_bytes = await audio.read()
    
    features = _extract_features(audio_bytes, meta, getattr(audio, "filename", ".wav"))
    tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(_device)
    
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
        
    labels = meta["labels"]
    pred_idx = int(probs.argmax())
    
    probabilities_dict = {label.lower(): float(p) for label, p in zip(labels, probs)}
    
    return {
        "predicted_emotion": labels[pred_idx].lower(),
        "confidence": float(probs[pred_idx]),
        "probabilities": probabilities_dict,
        "model_version": meta.get("model_version", "cnn_lstm_cv_v1"),
    }