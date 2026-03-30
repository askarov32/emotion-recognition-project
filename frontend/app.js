var predictBtn = document.getElementById("predictBtn");
var audioFileInput = document.getElementById("audioFile");
var statusEl = document.getElementById("status");
var resultEl = document.getElementById("result");
var emotionEl = document.getElementById("emotion");
var emotionTitleEl = document.getElementById("emotionTitle");
var confidenceEl = document.getElementById("confidence");
var probabilitiesListEl = document.getElementById("probabilitiesList");

var BACKEND_URL = "http://localhost:8000/api/predict";

function formatPercent(value) {
  return (value * 100).toFixed(2) + "%";
}

function safeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function clearProbabilities() {
  probabilitiesListEl.innerHTML = "";
}

function renderProbabilities(probabilities) {
  clearProbabilities();

  var items = [];
  var key;

  for (key in probabilities) {
    if (Object.prototype.hasOwnProperty.call(probabilities, key)) {
      items.push([key, probabilities[key]]);
    }
  }

  items.sort(function (a, b) {
    return b[1] - a[1];
  });

  for (var i = 0; i < items.length; i++) {
    var label = items[i][0];
    var value = items[i][1];

    var item = document.createElement("div");
    item.className = "probability-item";

    var top = document.createElement("div");
    top.className = "probability-top";

    var name = document.createElement("span");
    name.className = "probability-label";
    name.textContent = safeText(label);

    var percent = document.createElement("span");
    percent.className = "probability-value";
    percent.textContent = formatPercent(value);

    top.appendChild(name);
    top.appendChild(percent);

    var track = document.createElement("div");
    track.className = "progress-track";

    var bar = document.createElement("div");
    bar.className = "progress-bar";

    var widthValue = value * 100;
    if (widthValue < 0) {
      widthValue = 0;
    }
    if (widthValue > 100) {
      widthValue = 100;
    }

    bar.style.width = widthValue + "%";

    track.appendChild(bar);
    item.appendChild(top);
    item.appendChild(track);

    probabilitiesListEl.appendChild(item);
  }
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
  predictBtn.disabled = true;
  resultEl.classList.add("hidden");

  fetch(BACKEND_URL, {
    method: "POST",
    body: formData
  })
    .then(function (response) {
      return response
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          return {
            ok: response.ok,
            status: response.status,
            data: data
          };
        });
    })
    .then(function (result) {
      if (!result.ok) {
        var message = "Request failed with status " + result.status;

        if (
          result.data &&
          result.data.detail !== undefined &&
          result.data.detail !== null
        ) {
          message = String(result.data.detail);
        }

        throw new Error(message);
      }

      var data = result.data || {};

      emotionEl.textContent = safeText(data.predicted_emotion);
      emotionTitleEl.textContent = safeText(data.predicted_emotion);
      confidenceEl.textContent = formatPercent(Number(data.confidence || 0));

      renderProbabilities(data.probabilities || {});

      statusEl.textContent = "Prediction completed.";
      resultEl.classList.remove("hidden");
    })
    .catch(function (error) {
      console.error(error);

      if (error && error.message) {
        statusEl.textContent = error.message;
      } else {
        statusEl.textContent = "Prediction failed.";
      }

      resultEl.classList.add("hidden");
    })
    .finally(function () {
      predictBtn.disabled = false;
    });
});