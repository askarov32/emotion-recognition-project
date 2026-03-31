import os
import json
import glob
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import librosa
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from torch.optim.lr_scheduler import ReduceLROnPlateau
import matplotlib.pyplot as plt
import seaborn as sns

# НАСТРОЙКИ
DATA_DIR = r"C:\Users\Telmurius\python_projects\emotion-recognition-project\data\Emotions"
WEIGHTS_DIR = r"C:\Users\Telmurius\python_projects\emotion-recognition-project\model_service\weights"
RESULTS_DIR = r"C:\Users\Telmurius\python_projects\emotion-recognition-project\model_service\results"
EPOCHS = 40
BATCH_SIZE = 16
LEARNING_RATE = 1e-3
N_SPLITS = 5
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

META = {
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

os.makedirs(WEIGHTS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# АРХИТЕКТУРА (CNN + LSTM)
class EmotionModel(nn.Module):
    def __init__(self, n_mels: int, n_classes: int):
        super().__init__()
        # CNN блок для извлечения признаков
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
        
        # LSTM блок для анализа последовательности (времени)
        # После MaxPool2d(2,1): Freq становится n_mels / 8 = 64/8 = 8.
        # Значит input_size LSTM = 64 (каналы) * 8 = 512
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

        x, (hn, cn) = self.lstm(x)
        x = x[:, -1, :]
        
        return self.classifier(x)

# ДАТАСЕТ И ЗАГРУЗКА
class EmotionDataset(Dataset):
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        feat = torch.load(self.file_paths[idx], map_location="cpu", weights_only=True)
        return feat, self.labels[idx]

def extract_log_mel(path, meta):
    y, _ = librosa.load(path, sr=meta["sample_rate"], duration=meta["duration"], mono=True)
    mel = librosa.feature.melspectrogram(y=y, sr=meta["sample_rate"], n_mels=meta["n_mels"])
    log_mel = librosa.power_to_db(mel, ref=np.max)
    
    max_len = meta["max_len"]
    if log_mel.shape[1] < max_len:
        pad = max_len - log_mel.shape[1]
        log_mel = np.pad(log_mel, ((0, 0), (0, pad)), mode="constant")
    else:
        log_mel = log_mel[:, :max_len]
        
    log_mel = (log_mel - log_mel.mean()) / (log_mel.std() + 1e-9)
    return torch.tensor(log_mel, dtype=torch.float32)

def load_data():
    file_paths = []
    labels = []
    for label_str, label_idx in META["label2idx"].items():
        folder = os.path.join(DATA_DIR, label_str)
        if not os.path.exists(folder):
            print(f"  {folder} не найдена!")
            continue
        
        files = glob.glob(os.path.join(folder, "*.wav"))
        for i, f in enumerate(files):
            pt_path = f.replace(".wav", ".pt")

            if not os.path.exists(pt_path):
                feat = extract_log_mel(f, META)
                torch.save(feat, pt_path)
                
            file_paths.append(pt_path)
            labels.append(torch.tensor(label_idx, dtype=torch.long))

    return file_paths, labels

# ГЛАВНАЙ ЦИКЛ ОБУЧЕНИЯ (CROSS-VALIDATION)
def main():
    print(f"Устройство для обучения: {DEVICE}")
    file_paths, labels = load_data()
    print(f"(тензоры .pt): {len(file_paths)}")
    
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=42)
    
    fold_results = []
    best_overall_acc = 0.0
    
    labels_np = [lbl.item() for lbl in labels]
    
    # K-Fold Cross Validation Loop
    for fold, (train_idx, val_idx) in enumerate(skf.split(file_paths, labels_np)):    
        train_features = [file_paths[i] for i in train_idx]
        train_labels = [labels[i] for i in train_idx]
        val_features = [file_paths[i] for i in val_idx]
        val_labels = [labels[i] for i in val_idx]
        
        train_ds = EmotionDataset(train_features, train_labels)
        val_ds = EmotionDataset(val_features, val_labels)
        
        train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)
        
        model = EmotionModel(n_mels=META["n_mels"], n_classes=len(META["labels"])).to(DEVICE)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
        scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=3)
        
        fold_best_acc = 0.0
        
        train_loss_history = []
        val_loss_history = []
        val_acc_history = []
        
        for epoch in range(1, EPOCHS + 1):
            # Training
            model.train()
            total_loss = 0
            for X, y in train_loader:
                X, y = X.to(DEVICE), y.to(DEVICE)
                optimizer.zero_grad()
                out = model(X)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
                
            train_loss_history.append(total_loss / len(train_loader))
                
            # Validation
            model.eval()
            all_preds, all_acts = [], []
            val_loss = 0
            with torch.no_grad():
                for X, y in val_loader:
                    X, y = X.to(DEVICE), y.to(DEVICE)
                    out = model(X)
                    val_loss += criterion(out, y).item()
                    preds = torch.argmax(out, dim=1)
                    all_preds.extend(preds.cpu().numpy())
                    all_acts.extend(y.cpu().numpy())
                    
            acc = accuracy_score(all_acts, all_preds)

            val_loss_history.append(val_loss / len(val_loader))
            val_acc_history.append(acc)
            
            print(f"Epoch {epoch:02d} | Train Loss: {train_loss_history[-1]:.4f} | Val Loss: {val_loss_history[-1]:.4f} | Val Acc: {acc:.4f}")
            
            scheduler.step(acc)
            
            if acc > fold_best_acc:
                fold_best_acc = acc
                if acc > best_overall_acc:
                    best_overall_acc = acc
                    torch.save(model.state_dict(), os.path.join(WEIGHTS_DIR, "model.pt"))
                    with open(os.path.join(WEIGHTS_DIR, "meta.json"), "w") as f:
                        meta_to_save = META.copy()
                        meta_to_save["best_cv_accuracy"] = float(acc)
                        json.dump(meta_to_save, f, indent=4)

                    plt.figure(figsize=(12, 5))
                    plt.subplot(1, 2, 1)
                    plt.plot(train_loss_history, label='Train Loss')
                    plt.plot(val_loss_history, label='Val Loss')
                    plt.title(f'Losses (Fold {fold + 1})')
                    plt.xlabel('Epochs')
                    plt.legend()
                    
                    plt.subplot(1, 2, 2)
                    plt.plot(val_acc_history, label='Val Accuracy')
                    plt.title(f'Validation Accuracy (Fold {fold + 1})')
                    plt.xlabel('Epochs')
                    plt.legend()
                    
                    plt.tight_layout()
                    plt.savefig(os.path.join(RESULTS_DIR, 'loss_acc_curve.png'))
                    plt.close()
                    
                    cm = confusion_matrix(all_acts, all_preds)
                    plt.figure(figsize=(8, 6))
                    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                                xticklabels=META["labels"],
                                yticklabels=META["labels"])
                    plt.title(f'Confusion Matrix (Fold {fold + 1}, Epoch {epoch})')
                    plt.xlabel('Predicted')
                    plt.ylabel('Actual')
                    plt.tight_layout()
                    plt.savefig(os.path.join(RESULTS_DIR, 'confusion_matrix.png'))
                    plt.close()
                    
                    class_report = classification_report(all_acts, all_preds, target_names=META["labels"])
                    with open(os.path.join(RESULTS_DIR, 'classification_report.txt'), 'w', encoding='utf-8') as f:
                        f.write(f"Fold: {fold + 1}, Epoch: {epoch}\n")
                        f.write(f"Validation Accuracy: {acc:.4f}\n\n")
                        f.write(class_report)
                        
        fold_results.append(fold_best_acc)
        print(f"Best Acc in Fold {fold + 1}: {fold_best_acc:.4f}")

    print(f"Результаты по каждому фолду: {fold_results}")
    print(f"Средняя точность: {np.mean(fold_results):.4f} ± {np.std(fold_results):.4f}")
    print(f"Максимальная точность: {best_overall_acc:.4f}")
    print(f"Лучшая модель сохранена в: {WEIGHTS_DIR}/model.pt")

if __name__ == "__main__":
    main()
