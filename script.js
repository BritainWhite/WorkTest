const iframe = document.getElementById("previewIframe");
const iframeLink = document.getElementById("iframeLink");
const jsonInput = document.getElementById("jsonInput");
const submitBtn = document.getElementById("submitBtn");
const stepLabel = document.getElementById("stepLabel");

const loadBtn = document.getElementById("loadBtn");
const resetBtn = document.getElementById("resetBtn");

const dayOrder = ["Today", "Yesterday", "Tomorrow"];
let currentStep = 0;

const updateURL = () => {
  const day = dayOrder[currentStep];
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  if (day === "Yesterday") now.setDate(now.getDate() - 1);
  if (day === "Tomorrow") now.setDate(now.getDate() + 1);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const formattedDate = `${yyyy}/${mm}/${dd}`;
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${formattedDate}`;
  iframe.src = url;
  iframeLink.href = url;
  iframeLink.textContent = url;
};

const clearWebpageFolder = async () => {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/clear", {
      method: "POST"
    });
  } catch (err) {
    console.warn("Server unavailable for clear.");
  }
};

const saveJSONToServer = async (folder, filename, data) => {
  try {
    await fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ folder, filename, data })
    });
  } catch (err) {
    console.warn("Server unavailable for save.");
  }
};

const handleStep = async () => {
  const day = dayOrder[currentStep];
  const parsed = JSON.parse(jsonInput.value.trim());

  // Save main.json to correct folder
  await saveJSONToServer(day, "main.json", parsed);

  // Generate trailers.json
  const trailerSummary = generateTrailerSummary(parsed);
  await saveJSONToServer(`${day}`, "trailers.json", trailerSummary);

  // Generate schedules
  const schedules = parsed.schedule?.scheduled_associates ?? [];
  const grouped = {};
  for (const associate of schedules) {
    const key = (associate.shift1_job_desc || "Unknown").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(associate);
  }
  for (const [title, list] of Object.entries(grouped)) {
    await saveJSONToServer(`${day}/schedules`, `${title}.json`, list);
  }

  currentStep++;

  if (currentStep < dayOrder.length) {
    stepLabel.textContent = `Submit ${dayOrder[currentStep]}'s JSON`;
    updateURL();
    if (currentStep === 1) await clearWebpageFolder(); // clear only on first step
    jsonInput.value = "";
  } else {
    stepLabel.textContent = `Processing trailers...`;
    await processAllTrailers();
    stepLabel.textContent = "Finished 😊";
  }
};

const processAllTrailers = async () => {
  for (const day of dayOrder) {
    const res = await fetch(`https://valid-grossly-gibbon.ngrok-free.app/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ folder: day, filename: "main.json" })
    });
    const main = await res.json();
    const trailers = main?.shipments?.data?.trailers?.payload ?? [];
    const businessDate = main?.schedule?.business_date;
    let count = 1;

    for (const trailer of trailers) {
      const transLoadId = trailer.transLoadId;
      const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Shipments.ashx?func=getLoadSummaryAndDetailsFromAPI&storeNbr=5307&businessDate=${businessDate}&loadID=${transLoadId}&useDataSource=DB2`;

      iframe.src = url;
      iframeLink.href = url;
      iframeLink.textContent = url;

      // Wait until user pastes the trailer JSON into the box and hits Submit
      await waitForManualTrailerInput(day, count++);
    }
  }
};

const waitForManualTrailerInput = (day, index) => {
  return new Promise((resolve) => {
    submitBtn.onclick = async () => {
      const parsed = JSON.parse(jsonInput.value.trim());
      await saveJSONToServer(`${day}/trailers`, `trailer${index}.json`, parsed);
      jsonInput.value = "";
      resolve();
    };
  });
};

submitBtn.addEventListener("click", handleStep);
loadBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("https://valid-grossly-gibbon.ngrok-free.app/loadAll");
    const json = await res.json();
    for (const [folder, files] of Object.entries(json)) {
      for (const [filename, data] of Object.entries(files)) {
        localStorage.setItem(`${folder}/${filename}`, JSON.stringify(data));
      }
    }
    alert("Loaded saved data from server!");
  } catch {
    alert("Failed to load data from server.");
  }
});
resetBtn.addEventListener("click", async () => {
  await clearWebpageFolder();
  alert("Server reset complete.");
});

window.addEventListener("DOMContentLoaded", async () => {
  currentStep = 0;
  stepLabel.textContent = `Submit ${dayOrder[currentStep]}'s JSON`;
  updateURL();
});
