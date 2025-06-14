const iframe = document.getElementById("previewIframe");
const iframeLink = document.getElementById("iframeLink");
const jsonInput = document.getElementById("jsonInput");
const submitBtn = document.getElementById("submitBtn");
const stepLabel = document.getElementById("stepLabel");

const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

const steps = ["Today", "Yesterday", "Tomorrow"];
let currentStep = 0;
let cleared = false;
let submittedData = {};

function getFormattedDate(stepIndex) {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + (stepIndex - 0));
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
}

function updateIframe(stepIndex) {
  const date = getFormattedDate(stepIndex);
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${date}`;
  iframe.src = url;
  iframeLink.href = url;
  iframeLink.textContent = url;
}

async function saveToServer(folder, filename, data) {
  try {
    const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, filename, data })
    });
    console.log(`📤 ${folder}/${filename}`, res.ok ? "✅" : "❌", res.status);
  } catch (e) {
    console.warn(`⚠️ Save failed: ${folder}/${filename}`);
  }
}

submitBtn.addEventListener("click", async () => {
  const day = steps[currentStep];
  let parsed;
  try {
    parsed = JSON.parse(jsonInput.value.trim());
  } catch {
    alert("Invalid JSON.");
    return;
  }

  localStorage.setItem(`${day}/main.json`, JSON.stringify(parsed));
  await saveToServer(day, "main.json", parsed);
  submittedData[day] = parsed;

  if (!cleared) {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" }).catch(() => {});
    cleared = true;
  }

  currentStep++;
  jsonInput.value = "";

  if (currentStep < steps.length) {
    stepLabel.textContent = `Submit ${steps[currentStep]}'s JSON`;
    updateIframe(currentStep);
  } else {
    stepLabel.textContent = "Processing trailers...";
    await processTrailers();
    stepLabel.textContent = "Finished 😊";
  }
});

async function processTrailers() {
  for (let i = 0; i < steps.length; i++) {
    const day = steps[i];
    const main = submittedData[day];
    const trailers = main?.shipments?.data?.trailers?.payload || [];
    const date = main?.schedule?.business_date || getFormattedDate(i);

    for (let j = 0; j < trailers.length; j++) {
      const transLoadId = trailers[j].transLoadId;
      const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Shipments.ashx?func=getLoadSummaryAndDetailsFromAPI&storeNbr=5307&businessDate=${date}&loadID=${transLoadId}&useDataSource=DB2`;

      iframe.src = url;
      iframeLink.href = url;
      iframeLink.textContent = url;

      await waitForTrailerPaste(day, j + 1);
    }
  }
}

function waitForTrailerPaste(day, index) {
  return new Promise((resolve) => {
    const handler = async () => {
      let parsed;
      try {
        parsed = JSON.parse(jsonInput.value.trim());
      } catch {
        alert("Invalid trailer JSON.");
        return;
      }

      submitBtn.removeEventListener("click", handler);
      const folder = `${day}/trailers`;
      const filename = `trailer${index}.json`;
      localStorage.setItem(`${folder}/${filename}`, JSON.stringify(parsed));
      await saveToServer(folder, filename, parsed);
      jsonInput.value = "";
      resolve();
    };

    submitBtn.addEventListener("click", handler, { once: true });
  });
}

loadBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/loadAll", { method: "POST" });
    const data = await res.json();
    for (const [folder, files] of Object.entries(data)) {
      for (const [file, json] of Object.entries(files)) {
        localStorage.setItem(`${folder}/${file}`, JSON.stringify(json));
      }
    }
    alert("📦 Loaded saved files.");
  } catch {
    alert("⚠️ Load failed.");
  }
});

resetBtn.addEventListener("click", async () => {
  await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" }).catch(() => {});
  alert("🧹 Server reset.");
});

window.addEventListener("DOMContentLoaded", () => {
  stepLabel.textContent = `Submit ${steps[currentStep]}'s JSON`;
  updateIframe(currentStep);
});
