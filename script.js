import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/es6/luxon.min.js";

const submitBtn = document.getElementById("submitBtn");
const jsonInput = document.getElementById("jsonInput");
const stepLabel = document.getElementById("stepLabel");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

let steps = ["Today", "Yesterday", "Tomorrow"];
let currentStepIndex = 0;
let clearedServer = false;
let dayData = {};

stepLabel.textContent = `Paste ${steps[currentStepIndex]}'s JSON`;

resetBtn.onclick = async () => {
  await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
  alert("Server folder reset.");
};

loadBtn.onclick = async () => {
  const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/load");
  const files = await res.json();
  Object.entries(files).forEach(([path, content]) => {
    localStorage.setItem(path, content);
  });
  alert("Loaded saved files into localStorage.");
};

submitBtn.onclick = async () => {
  const raw = jsonInput.value.trim();
  if (!raw) return alert("Paste JSON first.");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return alert("Invalid JSON.");
  }

  const day = steps[currentStepIndex];
  const folder = `${day}/main.json`;

  if (!clearedServer) {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
    clearedServer = true;
  }

  localStorage.setItem(folder, JSON.stringify(parsed));
  await sendToServer(folder, parsed);

  dayData[day] = parsed;
  currentStepIndex++;

  jsonInput.value = "";

  if (currentStepIndex < steps.length) {
    stepLabel.textContent = `Paste ${steps[currentStepIndex]}'s JSON`;
  } else {
    stepLabel.textContent = "Processing trailers...";

    for (const day of steps) {
      const data = dayData[day];
      const trailers = data?.shipments?.data?.trailers?.payload || [];

      for (let i = 0; i < trailers.length; i++) {
        const transLoadId = trailers[i].transLoadId;
        const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Shipments.ashx?func=getLoadSummaryAndDetailsFromAPI&storeNbr=5307&businessDate=${data.schedule.business_date}&loadID=${transLoadId}&useDataSource=DB2`;

        try {
          const res = await fetch(url);
          const trailerJson = await res.json();
          const path = `${day}/trailers/trailer${i + 1}.json`;

          localStorage.setItem(path, JSON.stringify(trailerJson));
          await sendToServer(path, trailerJson);
        } catch (e) {
          console.warn(`Failed to fetch trailer ${transLoadId} for ${day}`, e);
        }
      }
    }

    stepLabel.textContent = "Finished 😊";
  }
};

async function sendToServer(path, json) {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, json }),
    });
  } catch (e) {
    console.warn("Server unavailable. Skipped upload.");
  }
}
