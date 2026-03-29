const predictBtn = document.getElementById("predictBtn");
const audioFileInput = document.getElementById("audioFile");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const emotionEl = document.getElementById("emotion");
const confidenceEl = document.getElementById("confidence");
const probabilitiesEl = document.getElementById("probabilities");

const BACKEND_URL = "http://localhost:8000/api/predict";

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
  resultEl.classList.add("hidden");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    emotionEl.textContent = data.predicted_emotion;
    confidenceEl.textContent = `${(data.confidence * 100).toFixed(2)}%`;
    probabilitiesEl.textContent = JSON.stringify(data.probabilities, null, 2);

    statusEl.textContent = "Prediction completed.";
    resultEl.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Prediction failed. Check backend/model service.";
    resultEl.classList.add("hidden");
  }
});