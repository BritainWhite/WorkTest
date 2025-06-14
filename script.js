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

function getFormattedDateForStep(stepIndex) {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + (stepIndex - 0)); // 0: Today, -1: Yesterday, +1: Tomorrow
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function updateIframeForStep(stepIndex) {
  const formattedDate = getFormattedDateForStep(stepIndex);
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${formattedDate}`;
  iframe.src = url;
  iframeLink.href = url;
  iframeLink.textContent = url;
}

async function saveToServer(path, json) {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder: path.split("/").slice(0, -1).join("/"),
        filename: path.split("/").slice(-1)[0],
        data: json
      })
    });
    console.log(`✅ Saved to server: ${path}`);
  } catch (e) {
    console.warn("⚠️ Server offline, skipping save for", path);
  }
}

submitBtn.addEventListener("click", async () => {
  const day = steps[currentStep];
  let parsed;
  try {
    parsed = JSON.parse(jsonInput.value.trim());
  } catch (e) {
    alert("Invalid JSON.");
    return;
  }

  // Save main.json
  const mainPath = `${day}/main.json`;
  localStorage.setItem(mainPath, JSON.stringify(parsed));
  await saveToServer(mainPath, parsed);
  submittedData[day] = parsed;

  // Clear server folder on first valid submit
  if (!cleared) {
    try {
      await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
      cleared = true;
      console.log("🧹 Server folder cleared");
    } catch (e) {
      console.warn("⚠️ Server unavailable for clear.");
    }
  }

  currentStep++;
  jsonInput.value = "";

  if (currentStep < steps.length) {
    stepLabel.textContent = `Submit ${steps[currentStep]}'s JSON`;
    updateIframeForStep(currentStep);
  } else {
    stepLabel.textContent = "Processing trailers...";
    await processTrailers();
    stepLabel.textContent = "Finished 😊";
  }
});

async function processTrailers() {
  for (const [index, day] of steps.entries()) {
    const main = submittedData[day];
    const trailers = main?.shipments?.data?.trailers?.payload ?? [];
    const businessDate = main?.schedule?.business_date ?? getFormattedDateForStep(index);

    for (let i = 0; i < trailers.length; i++) {
      const transLoadId = trailers[i].transLoadId;
      const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Shipments.ashx?func=getLoadSummaryAndDetailsFromAPI&storeNbr=5307&businessDate=${businessDate}&loadID=${transLoadId}&useDataSource=DB2`;
      iframe.src = url;
      iframeLink.href = url;
      iframeLink.textContent = url;

      console.log(`➡️ Paste JSON for trailer ${i + 1} of ${day}`);
      await waitForTrailerPaste(day, i + 1);
    }
  }
}

function waitForTrailerPaste(day, index) {
  return new Promise((resolve) => {
    const handler = async () => {
      submitBtn.removeEventListener("click", handler);
      let parsed;
      try {
        parsed = JSON.parse(jsonInput.value.trim());
      } catch {
        alert("Invalid trailer JSON. Please try again.");
        return resolve(await waitForTrailerPaste(day, index));
      }

      const path = `${day}/trailers/trailer${index}.json`;
      localStorage.setItem(path, JSON.stringify(parsed));
      await saveToServer(path, parsed);
      jsonInput.value = "";
      resolve();
    };
    submitBtn.addEventListener("click", handler);
  });
}

loadBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/loadAll");
    const all = await res.json();
    for (const [folder, files] of Object.entries(all)) {
      for (const [filename, content] of Object.entries(files)) {
        localStorage.setItem(`${folder}/${filename}`, JSON.stringify(content));
      }
    }
    alert("📦 Loaded all saved JSON.");
  } catch {
    alert("⚠️ Failed to load from server.");
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
    alert("🧹 Server folder cleared.");
  } catch {
    alert("⚠️ Server not reachable.");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  stepLabel.textContent = `Submit ${steps[currentStep]}'s JSON`;
  updateIframeForStep(currentStep);
});
