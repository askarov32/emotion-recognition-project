var predictBtn = document.getElementById("predictBtn");
var audioFileInput = document.getElementById("audioFile");
var statusEl = document.getElementById("status");
var resultEl = document.getElementById("result");
var emotionEl = document.getElementById("emotion");
var confidenceEl = document.getElementById("confidence");
var probabilitiesEl = document.getElementById("probabilities");

var BACKEND_URL = "http://localhost:8000/api/predict";

function formatPercent(value) {
  return (value * 100).toFixed(2) + "%";
}

predictBtn.addEventListener("click", function () {
  var file = audioFileInput.files[0];

  if (!file) {
    statusEl.textContent = "Please choose an audio file first.";
    resultEl.classList.add("hidden");
    return;
  }

  var formData = new FormData();
  formData.append("audio", file);

  statusEl.textContent = "Uploading and predicting...";
  resultEl.classList.add("hidden");

  fetch(BACKEND_URL, {
    method: "POST",
    body: formData
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      emotionEl.textContent = data.predicted_emotion;
      confidenceEl.textContent = formatPercent(data.confidence);
      probabilitiesEl.textContent = JSON.stringify(data.probabilities, null, 2);
      statusEl.textContent = "Prediction completed.";
      resultEl.classList.remove("hidden");
    })
    .catch(function (error) {
      console.error(error);
      statusEl.textContent = "Prediction failed. Check backend/model service.";
      resultEl.classList.add("hidden");
    });
});