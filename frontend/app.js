const BACKEND_URL = "http://localhost:8000/api/predict";

const themeToggle = document.getElementById("themeToggle");
const dropzone = document.getElementById("dropzone");
const audioFileInput = document.getElementById("audioFile");
const predictBtn = document.getElementById("predictBtn");
const predictBtnText = document.getElementById("predictBtnText");
const predictBtnSpinner = document.getElementById("predictBtnSpinner");
const clearFileBtn = document.getElementById("clearFileBtn");

const fileCard = document.getElementById("fileCard");
const fileNameEl = document.getElementById("fileName");
const fileInfoEl = document.getElementById("fileInfo");

const statusCard = document.getElementById("statusCard");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");

const errorCard = document.getElementById("errorCard");
const errorText = document.getElementById("errorText");

const emptyState = document.getElementById("emptyState");
const skeletonPanel = document.getElementById("skeletonPanel");
const resultPanel = document.getElementById("resultPanel");

const heroResultCard = document.getElementById("heroResultCard");
const emotionBadge = document.getElementById("emotionBadge");
const emotionName = document.getElementById("emotionName");
const emotionDescription = document.getElementById("emotionDescription");
const confidenceValue = document.getElementById("confidenceValue");
const confidenceBar = document.getElementById("confidenceBar");
const probabilitiesList = document.getElementById("probabilitiesList");

const THEME_KEY = "emotion-app-theme";

const emotionMeta = {
  happy: {
    label: "Happy",
    className: "emotion-happy",
    color: "var(--happy)",
    description: "Positive and upbeat vocal tone with higher emotional energy."
  },
  sad: {
    label: "Sad",
    className: "emotion-sad",
    color: "var(--sad)",
    description: "Lower emotional energy with a subdued or downcast vocal tone."
  },
  angry: {
    label: "Angry",
    className: "emotion-angry",
    color: "var(--angry)",
    description: "High-intensity tone with strong emotional tension."
  },
  neutral: {
    label: "Neutral",
    className: "emotion-neutral",
    color: "var(--neutral)",
    description: "Balanced tone with low emotional intensity."
  },
  fear: {
    label: "Fear",
    className: "emotion-fear",
    color: "var(--fear)",
    description: "Tense or uncertain tone often linked with stress or anxiety."
  },
  disgust: {
    label: "Disgust",
    className: "emotion-disgust",
    color: "var(--disgust)",
    description: "Tone suggesting aversion, rejection, or discomfort."
  },
  surprise: {
    label: "Surprise",
    className: "emotion-surprise",
    color: "var(--surprise)",
    description: "Elevated, reactive tone often linked with sudden emotional change."
  }
};

let currentFile = null;
let isLoading = false;

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    setTheme(savedTheme);
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeProbability(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric > 1 && numeric <= 100) {
    return clamp(numeric / 100, 0, 1);
  }

  return clamp(numeric, 0, 1);
}

function formatPercent(value) {
  return `${(normalizeProbability(value) * 100).toFixed(2)}%`;
}

function toTitleCase(value) {
  return String(value)
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeEmotionKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (emotionMeta[normalized]) {
    return normalized;
  }

  if (normalized.includes("happy")) return "happy";
  if (normalized.includes("sad")) return "sad";
  if (normalized.includes("angry")) return "angry";
  if (normalized.includes("neutral")) return "neutral";
  if (normalized.includes("fear")) return "fear";
  if (normalized.includes("disgust")) return "disgust";
  if (normalized.includes("surprise")) return "surprise";

  return "neutral";
}

function isValidWavFile(file) {
  if (!file) {
    return false;
  }

  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();

  return name.endsWith(".wav") || type === "audio/wav" || type === "audio/x-wav";
}

function getStatusIcon(type) {
  if (type === "uploading" || type === "processing") {
    return `<span class="status-spinner" aria-hidden="true"></span>`;
  }

  if (type === "success") {
    return `
      <svg viewBox="0 0 24 24" class="icon">
        <path
          d="M20 7 9 18l-5-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  if (type === "error") {
    return `
      <svg viewBox="0 0 24 24" class="icon">
        <path
          d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" class="icon">
      <path
        d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function setStatus(type, title, message) {
  statusCard.className = `status-card status-${type}`;
  statusIcon.innerHTML = getStatusIcon(type);
  statusTitle.textContent = title;
  statusText.textContent = message;
}

function showError(message) {
  errorText.textContent = message;
  errorCard.classList.remove("hidden");
}

function hideError() {
  errorText.textContent = "";
  errorCard.classList.add("hidden");
}

function setLoadingState(loading) {
  isLoading = loading;
  predictBtn.disabled = loading || !currentFile;
  predictBtnSpinner.classList.toggle("hidden", !loading);
  predictBtnText.textContent = loading ? "Analyzing..." : "Analyze emotion";
}

function showSkeleton() {
  skeletonPanel.classList.remove("hidden");
  emptyState.classList.add("hidden");
  resultPanel.classList.add("hidden");
}

function hideSkeleton() {
  skeletonPanel.classList.add("hidden");
}

function showEmptyState() {
  emptyState.classList.remove("hidden");
  resultPanel.classList.add("hidden");
}

function hideEmptyState() {
  emptyState.classList.add("hidden");
}

function resetResults() {
  probabilitiesList.innerHTML = "";
  confidenceValue.textContent = "0.00%";
  confidenceBar.style.width = "0%";
  heroResultCard.className = "panel result-hero emotion-neutral";
  emotionBadge.textContent = "Neutral";
  emotionName.textContent = "Neutral";
  emotionDescription.textContent = "Balanced tone with low emotional intensity.";
}

function updateFileUI(file) {
  const hasFile = Boolean(file);

  fileCard.classList.toggle("hidden", !hasFile);
  dropzone.classList.toggle("has-file", hasFile);
  predictBtn.disabled = !hasFile || isLoading;

  if (!hasFile) {
    fileNameEl.textContent = "No file selected";
    fileInfoEl.textContent = "WAV audio";
    return;
  }

  fileNameEl.textContent = file.name || "audio.wav";
  fileInfoEl.textContent = `${bytesToSize(file.size)} • WAV audio`;
}

function clearFile() {
  currentFile = null;
  audioFileInput.value = "";
  updateFileUI(null);
  hideError();
  resetResults();
  hideSkeleton();
  showEmptyState();
  setStatus("idle", "Ready", "Select a WAV file to begin.");
}

function handleSelectedFile(file) {
  hideError();

  if (!file) {
    clearFile();
    return;
  }

  if (!isValidWavFile(file)) {
    clearFile();
    setStatus("error", "Invalid file", "Please upload a WAV audio file.");
    showError("Unsupported format. Use a file with the .wav extension.");
    return;
  }

  currentFile = file;
  updateFileUI(file);
  setStatus("idle", "File ready", `${file.name} is ready for analysis.`);
}

function parseReadableError(error, responsePayload, statusCode) {
  if (responsePayload && typeof responsePayload.detail === "string" && responsePayload.detail.trim()) {
    return responsePayload.detail.trim();
  }

  if (error && error.name === "AbortError") {
    return "The request was interrupted. Please try again.";
  }

  if (statusCode === 413) {
    return "The audio file is too large. Try a smaller WAV file.";
  }

  if (statusCode === 415) {
    return "Unsupported file type. Please upload a WAV file.";
  }

  if (statusCode >= 500) {
    return "The server could not process the request. Please try again in a moment.";
  }

  if (error instanceof TypeError) {
    return "Could not connect to the backend. Check that the API is running on localhost:8000.";
  }

  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "Something went wrong during analysis. Please try again.";
}

function renderHeroResult(predictedEmotion, confidence) {
  const emotionKey = normalizeEmotionKey(predictedEmotion);
  const meta = emotionMeta[emotionKey] || emotionMeta.neutral;
  const title = predictedEmotion ? toTitleCase(predictedEmotion) : meta.label;
  const confidenceNormalized = normalizeProbability(confidence);

  heroResultCard.className = `panel result-hero ${meta.className}`;
  emotionBadge.textContent = meta.label;
  emotionName.textContent = title;
  emotionDescription.textContent = meta.description;
  confidenceValue.textContent = `${(confidenceNormalized * 100).toFixed(2)}%`;

  requestAnimationFrame(() => {
    confidenceBar.style.width = `${confidenceNormalized * 100}%`;
  });
}

function createProbabilityItem(label, value) {
  const emotionKey = normalizeEmotionKey(label);
  const meta = emotionMeta[emotionKey] || emotionMeta.neutral;
  const normalizedValue = normalizeProbability(value);

  const item = document.createElement("div");
  item.className = "probability-item";
  item.style.setProperty("--probability-color", meta.color);

  const top = document.createElement("div");
  top.className = "probability-top";

  const labelWrap = document.createElement("div");
  labelWrap.className = "probability-label-wrap";

  const dot = document.createElement("span");
  dot.className = "probability-dot";
  dot.setAttribute("aria-hidden", "true");

  const labelEl = document.createElement("span");
  labelEl.className = "probability-label";
  labelEl.textContent = toTitleCase(label);

  const valueEl = document.createElement("span");
  valueEl.className = "probability-value";
  valueEl.textContent = `${(normalizedValue * 100).toFixed(2)}%`;

  labelWrap.appendChild(dot);
  labelWrap.appendChild(labelEl);
  top.appendChild(labelWrap);
  top.appendChild(valueEl);

  const track = document.createElement("div");
  track.className = "progress-track";

  const bar = document.createElement("div");
  bar.className = "progress-bar";
  track.appendChild(bar);

  item.appendChild(top);
  item.appendChild(track);

  requestAnimationFrame(() => {
    bar.style.width = `${normalizedValue * 100}%`;
  });

  return item;
}

function renderProbabilities(probabilities) {
  probabilitiesList.innerHTML = "";

  const entries = Object.entries(probabilities || {})
    .map(([label, value]) => [label, normalizeProbability(value)])
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "panel-subtitle";
    empty.textContent = "No probability data was returned by the backend.";
    probabilitiesList.appendChild(empty);
    return;
  }

  entries.forEach(([label, value]) => {
    probabilitiesList.appendChild(createProbabilityItem(label, value));
  });
}

async function analyzeAudio() {
  if (!currentFile || isLoading) {
    return;
  }

  hideError();
  resultPanel.classList.add("hidden");
  showSkeleton();

  setLoadingState(true);
  setStatus("uploading", "Uploading", "Sending your audio file to the backend.");

  const formData = new FormData();
  formData.append("audio", currentFile);

  let response;
  let data = null;

  try {
    response = await fetch(BACKEND_URL, {
      method: "POST",
      body: formData
    });

    setStatus("processing", "Processing", "The model is analyzing the audio signal.");

    try {
      data = await response.json();
    } catch (jsonError) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(parseReadableError(null, data, response.status));
    }

    const predictedEmotion = data && data.predicted_emotion ? data.predicted_emotion : "neutral";
    const confidence = data && data.confidence !== undefined ? data.confidence : 0;
    const probabilities = data && data.probabilities ? data.probabilities : {};

    hideSkeleton();
    hideEmptyState();
    resultPanel.classList.remove("hidden");

    resetResults();
    renderHeroResult(predictedEmotion, confidence);
    renderProbabilities(probabilities);

    setStatus(
      "success",
      "Success",
      `Prediction completed for ${currentFile.name}.`
    );
  } catch (error) {
    const readableError = parseReadableError(error, data, response ? response.status : 0);

    hideSkeleton();
    showEmptyState();
    resultPanel.classList.add("hidden");

    setStatus("error", "Error", readableError);
    showError(readableError);
  } finally {
    setLoadingState(false);
  }
}

function onDropzoneClick() {
  if (isLoading) {
    return;
  }
  audioFileInput.click();
}

function onDropzoneKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onDropzoneClick();
  }
}

function onFileInputChange(event) {
  const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
  handleSelectedFile(file);
}

function onDragOver(event) {
  event.preventDefault();
  if (isLoading) {
    return;
  }
  dropzone.classList.add("drag-over");
}

function onDragLeave(event) {
  event.preventDefault();
  if (!dropzone.contains(event.relatedTarget)) {
    dropzone.classList.remove("drag-over");
  }
}

function onDrop(event) {
  event.preventDefault();
  dropzone.classList.remove("drag-over");

  if (isLoading) {
    return;
  }

  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    ? event.dataTransfer.files[0]
    : null;

  handleSelectedFile(file);
}

function bindEvents() {
  themeToggle.addEventListener("click", toggleTheme);

  dropzone.addEventListener("click", onDropzoneClick);
  dropzone.addEventListener("keydown", onDropzoneKeydown);
  dropzone.addEventListener("dragover", onDragOver);
  dropzone.addEventListener("dragleave", onDragLeave);
  dropzone.addEventListener("drop", onDrop);

  audioFileInput.addEventListener("change", onFileInputChange);
  clearFileBtn.addEventListener("click", clearFile);
  predictBtn.addEventListener("click", analyzeAudio);
}

function init() {
  initTheme();
  bindEvents();
  resetResults();
  updateFileUI(null);
  setLoadingState(false);
  setStatus("idle", "Ready", "Select a WAV file to begin.");
  showEmptyState();
}

init();