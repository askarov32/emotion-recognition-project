const predictBtn = document.getElementById("predictBtn");
const audioFileInput = document.getElementById("audioFile");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const emotionEl = document.getElementById("emotion");
const emotionTitleEl = document.getElementById("emotionTitle");
const confidenceEl = document.getElementById("confidence");
const probabilitiesListEl = document.getElementById("probabilitiesList");

const BACKEND_URL = "http://localhost:8000/api/predict";

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function renderProbabilities(probabilities) {
  probabilitiesListEl.innerHTML = "";

  const items = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);

  items.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "probability-item";

    const top = document.createElement("div");
    top.className = "probability-top";

    const name = document.createElement("span");
    name.className = "probability-label";
    name.textContent = label;

    const percent = document.createElement("span");
    percent.className = "probability-value";
    percent.textContent = formatPercent(value);

    top.appendChild(name);
    top.appendChild(percent);

    const track = document.createElement("div");
    track.className = "progress-track";

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.style.width = `${Math.max(0, Math.min(value * 100, 100))}%`;

    track.appendChild(bar);
    item.appendChild(top);
    item.appendChild(track);

    probabilitiesListEl.appendChild(item);
  });
}

predictBtn.addEventListener("click", async () => {
  const file = audioFileInput.files[0];

  if (!file) {
    statusEl.textContent = "Please choose an audio file first.";
    resultEl.classList.add("hidden");
    return;
  }

  const formData = new FormData();
  formData.append("audio", file);

  statusEl.textContent = "Uploading and predicting...";
  predictBtn.disabled = true;
  resultEl.classList.add("hidden");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data?.detail || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    emotionEl.textContent = data.predicted_emotion;
    emotionTitleEl.textContent = data.predicted_emotion;
    confidenceEl.textContent = formatPercent(data.confidence);

    renderProbabilities(data.probabilities);

    statusEl.textContent = "Prediction completed.";
    resultEl.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Prediction failed.";
    resultEl.classList.add("hidden");
  } finally {
    predictBtn.disabled = false;
  }
});