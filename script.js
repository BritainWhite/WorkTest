import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.3/build/es6/luxon.min.js";

const initIframe = document.getElementById("previewIframe");
const input = document.getElementById("jsonInput");
const submitBtn = document.getElementById("submitBtn");
const stepLabel = document.getElementById("stepLabel");
const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

let steps = ["Today", "Yesterday", "Tomorrow"];
let currentStep = 0;
let clearedServerAlready = false;
const storage = window.localStorage;
const folderMap = { 0: "Today", 1: "Yesterday", 2: "Tomorrow" };

updateStep();

loadBtn.onclick = async () => {
  try {
    const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/load");
    const data = await res.json();
    for (const [key, value] of Object.entries(data)) {
      storage.setItem(key, value);
    }
    alert("✅ Loaded saved data.");
    location.reload();
  } catch (err) {
    alert("❌ Failed to load saved data.");
  }
};

resetBtn.onclick = async () => {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
    alert("🧹 Server reset.");
    location.reload();
  } catch (err) {
    alert("❌ Failed to reset server.");
  }
};

submitBtn.onclick = async () => {
  const jsonRaw = input.value.trim();
  if (!jsonRaw) return;

  if (!clearedServerAlready) {
    try {
      await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", { method: "POST" });
      clearedServerAlready = true;
    } catch (e) {
      console.warn("Could not clear server (skipped):", e);
    }
  }

  const label = steps[currentStep];
  const folder = folderMap[currentStep];
  storage.setItem(`${folder}/main.json`, jsonRaw);

  await sendToServer(`${folder}/main.json`, jsonRaw);
  await generateSchedules(folder, JSON.parse(jsonRaw));

  currentStep++;

  if (currentStep < steps.length) {
    updateStep();
  } else {
    await processAllTrailers();
    stepLabel.innerText = "Finished 😊";
  }

  input.value = "";
};

function updateStep() {
  const label = steps[currentStep];
  const today = DateTime.now();
  const date = today.plus({ days: currentStep - 1 });
  const formatted = date.toFormat("yyyy/LL/dd");
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${formatted}`;
  stepLabel.innerText = `Submit ${label}'s JSON`;
  initIframe.src = url;
}

async function sendToServer(path, content) {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content })
    });
  } catch (err) {
    console.warn(`⚠️ Could not save ${path}:`, err);
  }
}

async function generateSchedules(folder, data) {
  const associates = data.schedule?.scheduled_associates ?? [];
  const jobs = {};

  for (const assoc of associates) {
    const job = (assoc.shift1_job_desc || "Unknown").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    if (!jobs[job]) jobs[job] = [];
    jobs[job].push(assoc);
  }

  for (const [jobKey, list] of Object.entries(jobs)) {
    const json = JSON.stringify(list, null, 2);
    const path = `${folder}/schedules/${jobKey}.json`;
    storage.setItem(path, json);
    await sendToServer(path, json);
  }
}

async function processAllTrailers() {
  const days = ["Today", "Yesterday", "Tomorrow"];
  const baseUrl = "https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Shipments.ashx?func=getLoadSummaryAndDetailsFromAPI&storeNbr=5307&businessDate={DATE}&loadID={ID}&useDataSource=DB2";
  const today = DateTime.now();

  for (let i = 0; i < 3; i++) {
    const folder = days[i];
    const date = today.plus({ days: i - 1 }).toFormat("yyyy/LL/dd");
    const raw = storage.getItem(`${folder}/main.json`);
    if (!raw) continue;

    const json = JSON.parse(raw);
    const trailers = json?.shipments?.data?.trailers?.payload ?? [];

    for (const trailer of trailers) {
      const transLoadId = trailer.transLoadId;
      if (!transLoadId) continue;

      const trailerUrl = baseUrl
        .replace("{DATE}", date)
        .replace("{ID}", transLoadId);

      // just updating the iframe to trigger manual copy if needed
      initIframe.src = trailerUrl;

      // optionally you can log progress:
      console.log(`➡️  Loading trailer ${transLoadId} for ${folder}`);
      await new Promise(res => setTimeout(res, 400)); // delay to let iframe load (or skip)
    }
  }
}
