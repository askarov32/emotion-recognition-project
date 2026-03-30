const predictBtn = document.getElementById("predictBtn");
const audioFileInput = document.getElementById("audioFile");
const dropzone = document.getElementById("dropzone");

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

const emotionEl = document.getElementById("emotion");
const emotionTitleEl = document.getElementById("emotionTitle");
const confidenceEl = document.getElementById("confidence");
const modelVersionEl = document.getElementById("modelVersion");
const topClassHintEl = document.getElementById("topClassHint");
const probabilitiesListEl = document.getElementById("probabilitiesList");

const fileCardEl = document.getElementById("fileCard");
const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");

const audioPreviewWrapEl = document.getElementById("audioPreviewWrap");
const audioPreviewEl = document.getElementById("audioPreview");

const BACKEND_URL = "http://localhost:8000/api/predict";

let currentAudioUrl = null;

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) {
    statusEl.classList.add(type);
  }
}

function prettifyLabel(label) {
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function updateFilePreview(file) {
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileCardEl.classList.remove("hidden");

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }

  currentAudioUrl = URL.createObjectURL(file);
  audioPreviewEl.src = currentAudioUrl;
  audioPreviewWrapEl.classList.remove("hidden");
}

function clearResults() {
  resultEl.classList.add("hidden");
  probabilitiesListEl.innerHTML = "";
  topClassHintEl.textContent = "";
}

function renderProbabilities(probabilities) {
  probabilitiesListEl.innerHTML = "";

  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);

  if (entries.length > 0) {
    topClassHintEl.textContent = `Top class: ${prettifyLabel(entries[0][0])}`;
  }

  entries.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "probability-item";

    const top = document.createElement("div");
    top.className = "probability-top";

    const name = document.createElement("span");
    name.className = "probability-label";
    name.textContent = prettifyLabel(label);

    const percent = document.createElement("span");
    percent.className = "probability-value";
    percent.textContent = formatPercent(value);

    const track = document.createElement("div");
    track.className = "progress-track";

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    track.appendChild(bar);
    top.appendChild(name);
    top.appendChild(percent);

    item.appendChild(top);
    item.appendChild(track);

    probabilitiesListEl.appendChild(item);

    requestAnimationFrame(() => {
      bar.style.width = `${Math.max(0, Math.min(value * 100, 100))}%`;
    });
  });
}

audioFileInput.addEventListener("change", () => {
  const file = audioFileInput.files[0];
  if (!file) return;

  updateFilePreview(file);
  clearResults();
  setStatus("Audio file selected.", "success");
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener("".concat(eventName), (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  audioFileInput.files = dataTransfer.files;

  updateFilePreview(file);
  clearResults();
  setStatus("Audio file selected.", "success");
});

predictBtn.addEventListener("click", async () => {
  const file = audioFileInput.files[0];

  if (!file) {
    setStatus("Please choose an audio file first.", "error");
    clearResults();
    return;
  }

  const formData = new FormData();
  formData.append("audio", file);

  predictBtn.disabled = true;
  clearResults();
  setStatus("Uploading audio and running prediction...", "loading");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.detail || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    const predictedEmotion = data.predicted_emotion || "unknown";
    const confidence = Number(data.confidence || 0);
    const probabilities = data.probabilities || {};
    const modelVersion = data.model_version || "unknown";

    emotionEl.textContent = prettifyLabel(predictedEmotion);
    emotionTitleEl.textContent = prettifyLabel(predictedEmotion);
    confidenceEl.textContent = formatPercent(confidence);
    modelVersionEl.textContent = modelVersion;

    renderProbabilities(probabilities);

    resultEl.classList.remove("hidden");
    setStatus("Prediction completed successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Prediction failed.", "error");
    clearResults();
  } finally {
    predictBtn.disabled = false;
  }
});