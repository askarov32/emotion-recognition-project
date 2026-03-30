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
const fileSelectedBadge = document.getElementById("fileSelectedBadge");

const startRecordingBtn = document.getElementById("startRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");
const clearRecordingBtn = document.getElementById("clearRecordingBtn");
const recordingTimer = document.getElementById("recordingTimer");
const recordingStateText = document.getElementById("recordingStateText");
const recordingHint = document.getElementById("recordingHint");
const recordingPulse = document.getElementById("recordingPulse");
const recordingPreviewCard = document.getElementById("recordingPreviewCard");
const recordingPreview = document.getElementById("recordingPreview");
const recordingFileName = document.getElementById("recordingFileName");
const recordingMeta = document.getElementById("recordingMeta");
const recordingSelectedBadge = document.getElementById("recordingSelectedBadge");

const sourceSummaryValue = document.getElementById("sourceSummaryValue");

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

let uploadedFile = null;
let recordedFile = null;
let activeSource = null; // "file" | "recording" | null
let isLoading = false;
let isRecording = false;

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let gainNode = null;
let pcmChunks = [];
let recordingStartMs = 0;
let recordingInterval = null;
let recordedSampleRate = 44100;
let currentRecordingUrl = null;

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

  if (emotionMeta[normalized]) return normalized;
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
  if (!file) return false;

  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();

  return name.endsWith(".wav") || type === "audio/wav" || type === "audio/x-wav";
}

function getStatusIcon(type) {
  if (type === "uploading" || type === "processing") {
    return `<span class="status-spinner" aria-hidden="true"></span>`;
  }

  if (type === "recording") {
    return `
      <svg viewBox="0 0 24 24" class="icon">
        <path
          d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm0 0v4m-4-1h8M19 11a7 7 0 0 1-14 0"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
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

function getActiveAudioFile() {
  if (activeSource === "file" && uploadedFile) return uploadedFile;
  if (activeSource === "recording" && recordedFile) return recordedFile;
  return uploadedFile || recordedFile || null;
}

function updateAnalyzeButton() {
  predictBtn.disabled = isLoading || isRecording || !getActiveAudioFile();
}

function setLoadingState(loading) {
  isLoading = loading;
  updateAnalyzeButton();
  predictBtnSpinner.classList.toggle("hidden", !loading);
  predictBtnText.textContent = loading ? "Analyzing..." : "Analyze emotion";

  startRecordingBtn.disabled = loading || isRecording;
  stopRecordingBtn.disabled = loading || !isRecording;
  audioFileInput.disabled = loading || isRecording;
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

function updateSourceSummary() {
  if (activeSource === "file" && uploadedFile) {
    sourceSummaryValue.textContent = `Uploaded file • ${uploadedFile.name}`;
    fileSelectedBadge.classList.remove("hidden");
    recordingSelectedBadge.classList.add("hidden");
    return;
  }

  if (activeSource === "recording" && recordedFile) {
    sourceSummaryValue.textContent = `Microphone recording • ${recordedFile.name}`;
    recordingSelectedBadge.classList.remove("hidden");
    fileSelectedBadge.classList.add("hidden");
    return;
  }

  sourceSummaryValue.textContent = "None selected";
  fileSelectedBadge.classList.add("hidden");
  recordingSelectedBadge.classList.add("hidden");
}

function updateFileUI() {
  const hasFile = Boolean(uploadedFile);

  fileCard.classList.toggle("hidden", !hasFile);
  dropzone.classList.toggle("has-file", hasFile);

  if (!hasFile) {
    fileNameEl.textContent = "No file selected";
    fileInfoEl.textContent = "WAV audio";
    updateSourceSummary();
    updateAnalyzeButton();
    return;
  }

  fileNameEl.textContent = uploadedFile.name || "audio.wav";
  fileInfoEl.textContent = `${bytesToSize(uploadedFile.size)} • WAV audio`;
  updateSourceSummary();
  updateAnalyzeButton();
}

function updateRecordingUI() {
  const hasRecording = Boolean(recordedFile);

  recordingPreviewCard.classList.toggle("hidden", !hasRecording);

  if (!hasRecording) {
    recordingFileName.textContent = "recording.wav";
    recordingMeta.textContent = "Recorded audio";
    recordingPreview.removeAttribute("src");
    recordingPreview.load();
    updateSourceSummary();
    updateAnalyzeButton();
    return;
  }

  recordingFileName.textContent = recordedFile.name;
  recordingMeta.textContent = `${bytesToSize(recordedFile.size)} • WAV recording`;
  updateSourceSummary();
  updateAnalyzeButton();
}

function clearFile() {
  uploadedFile = null;
  if (activeSource === "file") activeSource = recordedFile ? "recording" : null;
  audioFileInput.value = "";
  updateFileUI();

  if (!recordedFile) {
    resetResults();
    hideSkeleton();
    showEmptyState();
    setStatus("idle", "Ready", "Select a WAV file or record audio to begin.");
  } else {
    setStatus("idle", "Recording ready", "Your microphone recording is selected.");
  }
}

function clearRecording() {
  recordedFile = null;
  if (currentRecordingUrl) {
    URL.revokeObjectURL(currentRecordingUrl);
    currentRecordingUrl = null;
  }

  if (activeSource === "recording") activeSource = uploadedFile ? "file" : null;

  updateRecordingUI();

  if (!uploadedFile) {
    resetResults();
    hideSkeleton();
    showEmptyState();
    setStatus("idle", "Ready", "Select a WAV file or record audio to begin.");
  } else {
    setStatus("idle", "File ready", `${uploadedFile.name} is selected for analysis.`);
  }
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

  uploadedFile = file;
  activeSource = "file";
  updateFileUI();
  setStatus("idle", "File ready", `${file.name} is selected for analysis.`);
}

function getTimestampFileName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  const fileName = `recording-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.wav`;
  return fileName;
}

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  recordingStartMs = Date.now();
  recordingTimer.textContent = "00:00";
  recordingInterval = window.setInterval(() => {
    recordingTimer.textContent = formatTimer(Date.now() - recordingStartMs);
  }, 200);
}

function stopTimer() {
  if (recordingInterval) {
    window.clearInterval(recordingInterval);
    recordingInterval = null;
  }
}

function setRecordingState(recording) {
  isRecording = recording;

  recordingPulse.classList.toggle("hidden", !recording);
  recordingStateText.textContent = recording ? "Recording..." : "Not recording";

  startRecordingBtn.disabled = recording || isLoading;
  stopRecordingBtn.disabled = !recording || isLoading;
  audioFileInput.disabled = recording || isLoading;
  updateAnalyzeButton();
}

function flattenFloat32Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function cleanupRecordingNodes() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }

  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    try {
      await audioContext.close();
    } catch (error) {
      // noop
    }
    audioContext = null;
  }
}

function buildReadableMicError(error) {
  const name = error && error.name ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied. Allow microphone permission and try again.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found on this device.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is already in use by another application.";
  }

  return "Could not start microphone recording. Use localhost or HTTPS and check browser permissions.";
}

async function startRecording() {
  if (isRecording || isLoading) return;

  hideError();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("error", "Microphone unavailable", "This browser does not support microphone recording.");
    showError("Microphone recording is not supported in this browser.");
    return;
  }

  try {
    pcmChunks = [];
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    recordedSampleRate = audioContext.sampleRate;

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    processorNode.onaudioprocess = (event) => {
      if (!isRecording) return;

      const input = event.inputBuffer.getChannelData(0);
      pcmChunks.push(new Float32Array(input));
    };

    sourceNode.connect(processorNode);
    processorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    setRecordingState(true);
    startTimer();
    recordingHint.textContent = "Recording from microphone. Speak clearly, then press Stop.";
    setStatus("recording", "Recording", "Microphone recording is in progress.");
  } catch (error) {
    await cleanupRecordingNodes();
    setRecordingState(false);
    stopTimer();
    recordingTimer.textContent = "00:00";

    const readableError = buildReadableMicError(error);
    setStatus("error", "Recording failed", readableError);
    showError(readableError);
  }
}

async function stopRecording() {
  if (!isRecording) return;

  setRecordingState(false);
  stopTimer();

  try {
    const samples = flattenFloat32Arrays(pcmChunks);
    const wavBlob = encodeWav(samples, recordedSampleRate);
    const fileName = getTimestampFileName();

    recordedFile = new File([wavBlob], fileName, {
      type: "audio/wav",
      lastModified: Date.now()
    });

    activeSource = "recording";

    if (currentRecordingUrl) {
      URL.revokeObjectURL(currentRecordingUrl);
    }

    currentRecordingUrl = URL.createObjectURL(wavBlob);
    recordingPreview.src = currentRecordingUrl;
    recordingPreview.load();

    updateRecordingUI();
    setStatus("idle", "Recording ready", `${recordedFile.name} is selected for analysis.`);
    recordingHint.textContent = "Preview your recording below or analyze it directly.";
  } catch (error) {
    recordedFile = null;
    updateRecordingUI();

    setStatus("error", "Recording failed", "Could not finalize the recording.");
    showError("Could not convert the microphone input to WAV.");
  } finally {
    pcmChunks = [];
    await cleanupRecordingNodes();
  }
}

function parseReadableError(error, responsePayload, statusCode) {
  if (responsePayload && typeof responsePayload.detail === "string" && responsePayload.detail.trim()) {
    return responsePayload.detail.trim();
  }

  if (error && error.name === "AbortError") {
    return "The request was interrupted. Please try again.";
  }

  if (statusCode === 413) {
    return "The audio file is too large. Try a shorter recording or a smaller WAV file.";
  }

  if (statusCode === 415) {
    return "Unsupported file type. Please upload or record WAV audio.";
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
  const activeFile = getActiveAudioFile();

  if (!activeFile || isLoading || isRecording) return;

  hideError();
  resultPanel.classList.add("hidden");
  showSkeleton();

  setLoadingState(true);
  setStatus("uploading", "Uploading", "Sending your audio to the backend.");

  const formData = new FormData();
  formData.append("audio", activeFile);

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

    setStatus("success", "Success", `Prediction completed for ${activeFile.name}.`);
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
  if (isLoading || isRecording) return;
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
  if (isLoading || isRecording) return;
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

  if (isLoading || isRecording) return;

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

  startRecordingBtn.addEventListener("click", startRecording);
  stopRecordingBtn.addEventListener("click", stopRecording);
  clearRecordingBtn.addEventListener("click", clearRecording);

  recordingPreview.addEventListener("play", () => {
    if (recordedFile) {
      activeSource = "recording";
      updateRecordingUI();
      updateFileUI();
      setStatus("idle", "Recording ready", `${recordedFile.name} is selected for analysis.`);
    }
  });

  predictBtn.addEventListener("click", analyzeAudio);
}

function init() {
  initTheme();
  bindEvents();
  resetResults();
  updateFileUI();
  updateRecordingUI();
  setLoadingState(false);
  setRecordingState(false);
  recordingTimer.textContent = "00:00";
  recordingHint.textContent = "Browser microphone access is required. Recording works on localhost or HTTPS.";
  setStatus("idle", "Ready", "Select a WAV file or record audio to begin.");
  showEmptyState();
}

window.addEventListener("beforeunload", () => {
  if (currentRecordingUrl) {
    URL.revokeObjectURL(currentRecordingUrl);
  }
});

init();