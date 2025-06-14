import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.4.3/+esm";

let step = 0;
const steps = ["Today", "Yesterday", "Tomorrow"];

function getDateOffset(offset) {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + offset);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function updateStep() {
  const label = document.getElementById("stepLabel");
  const iframe = document.getElementById("previewIframe");
  const stepName = steps[step];
  const dateOffset = step === 0 ? 0 : (step === 1 ? -1 : 1);
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${getDateOffset(dateOffset)}`;

  label.textContent = `Step ${step + 1}: Submit ${stepName} JSON`;
  iframe.src = url;
}

function saveToFolder(folder, filename, data) {
  const fullPath = `${folder}/${filename}`;
  const json = JSON.stringify(data, null, 2);

  // Save to localStorage
  localStorage.setItem(fullPath, json);

  // Also send to backend server
  fetch("https://valid-grossly-gibbon.ngrok-free.app/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: fullPath,
      content: json
    })
  }).catch(err => console.error("Failed to upload to server:", err));
}

function cleanFileName(name) {
  return name.replace(/[<>:"\/\\|?*\u0000-\u001F]/g, '').replace(/\s+/g, "_").trim();
}

function submitJSON() {
  const textarea = document.getElementById("jsonInput");
  let content = textarea.value.trim();

  try {
    const parsed = JSON.parse(content);
    const folder = steps[step];
    saveToFolder(folder, "main.json", parsed);

    const trailersJson = generateTrailerSummary(parsed);
    saveToFolder(folder, "trailers.json", trailersJson);

    const assocGroups = {};
    const associates = parsed.schedule?.scheduled_associates ?? [];
    for (const assoc of associates) {
      const title = assoc.shift1_job_desc?.trim() || "Unknown";
      const cleaned = cleanFileName(title);
      if (!assocGroups[cleaned]) assocGroups[cleaned] = [];
      assocGroups[cleaned].push(assoc);
    }

    for (const [cleanedTitle, group] of Object.entries(assocGroups)) {
      saveToFolder(`${folder}/schedules`, `${cleanedTitle}.json`, group);
    }

  } catch (e) {
    alert("Invalid JSON. Please make sure you copied it correctly.");
    return;
  }

  textarea.value = "";
  step++;
  if (step < steps.length) {
    updateStep();
  } else {
    showSummary();
  }
}

function generateTrailerSummary(data) {
  const businessDate = DateTime.fromISO(data.schedule?.business_date ?? "");
  const movedShipments = data.shipments_moved ?? [];
  const trailers = data.shipments?.data?.trailers?.payload ?? [];
  const sdlEntries = data.sdl ?? [];
  const results = [];

  let totalBreakPackCount = 0;
  let totalCaseQty = 0;
  let totalFloorQty = 0;
  let totalPalletQty = 0;

  for (const trailer of trailers) {
    const stop = trailer.stops?.[0];
    if (!stop || !stop.arrivalStatus?.ts) continue;

    const moved = movedShipments.find(m => String(m.load_id) === String(trailer.transLoadId));
    if (moved?.unload_date) {
      const unloadDate = DateTime.fromISO(moved.unload_date);
      if (unloadDate > businessDate) continue;
    }

    const arrivalTs = DateTime.fromISO(stop.arrivalStatus.ts, { zone: "utc" });
    const arrivalETATs = stop.arrivalETATs ? DateTime.fromISO(stop.arrivalETATs, { zone: "utc" }) : null;
    const shipment = stop.actualShipments?.[0] ?? {};
    const planned = stop.plannedShipments?.[0] ?? {};

    const actualCaseQuantity = shipment.caseQuantity ?? null;
    const actualFloorCaseQuantity = shipment.floorCaseQuantity ?? null;
    const actualPalletQuantity = shipment.palletQuantity ?? null;

    const plannedCaseQuantity = planned.caseQuantity ?? null;
    const plannedFloorCaseQuantity = planned.floorCaseQuantity ?? null;
    const plannedPalletQuantity = planned.palletQuantity ?? null;

    const sdlMatch = sdlEntries.find(entry =>
      String(entry.load_id) === String(trailer.transLoadId)
    );

    const breakpack_boxes = sdlMatch?.breakpack_boxes ?? null;
    const groc_cases = sdlMatch?.groc_cases ?? null;
    const gm_cases = sdlMatch?.gm_cases ?? null;
    const total_cases = sdlMatch?.total_cases ?? null;

    const breakPackCount = trailer.caseSummary?.breakPackCount ?? null;
    if (breakPackCount) totalBreakPackCount += breakPackCount;

    totalCaseQty += actualCaseQuantity ?? plannedCaseQuantity ?? 0;
    totalFloorQty += actualFloorCaseQuantity ?? plannedFloorCaseQuantity ?? 0;
    totalPalletQty += actualPalletQuantity ?? plannedPalletQuantity ?? 0;

    results.push({
      transLoadId: trailer.transLoadId,
      carrierTrailerId: trailer.trailerDetails?.carrierTrailerId ?? null,
      arrivalStatus: stop.arrivalStatus?.code ?? null,
      commodityType: stop.commodityTypes?.[0] ?? null,
      stopStatus: stop.stopStatus ?? null,
      arrivalStatusTs: arrivalTs.toISO(),
      arrivalETATs: arrivalETATs?.toISO() ?? null,
      localArrivalStatusTs: arrivalTs.setZone("America/Chicago").toISO(),
      localArrivalETATs: arrivalETATs?.setZone("America/Chicago").toISO() ?? null,
      loadStatus: trailer.loadStatus ?? null,
      breakPackCount,
      actualCaseQuantity,
      actualFloorCaseQuantity,
      actualPalletQuantity,
      plannedCaseQuantity,
      plannedPalletQuantity,
      plannedFloorCaseQuantity,
      breakpack_boxes,
      groc_cases,
      gm_cases,
      total_cases
    });
  }

  return {
    business_date: data.schedule?.business_date ?? null,
    trailer_count: results.length,
    trailer_transLoadId_list: results.map(r => Number(r.transLoadId)),
    trailer_trailerId_list: results.map(r => Number(r.carrierTrailerId)),
    totals: {
      breakPackCount: totalBreakPackCount,
      caseQuantity: totalCaseQty,
      floorCaseQuantity: totalFloorQty,
      palletQuantity: totalPalletQty
    },
    trailers: results
  };
}

function showSummary() {
  document.getElementById("inputPanel").style.display = "none";

  const container = document.createElement("div");
  container.innerHTML = `<h3>Trailer Summary</h3>`;

  for (const folder of steps) {
    const raw = localStorage.getItem(`${folder}/trailers.json`);
    const jobStats = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`${folder}/schedules/`) && key.endsWith(".json")) {
        const group = JSON.parse(localStorage.getItem(key));
        const jobName = key.replace(`${folder}/schedules/`, "").replace(/\.json$/, "").replace(/_/g, " ");
        jobStats[jobName] = group.length;
      }
    }

    const jobBlock = Object.entries(jobStats)
      .map(([job, count]) => `${job}: ${count}`)
      .join("<br/>");

    const block = document.createElement("div");
    block.className = "summary-block";
    block.innerHTML = `
      <strong>${folder}</strong><br/>
      ${raw ? `Trailers: ${JSON.parse(raw).trailer_count}<br/>` : ""}
      <div class="scroll-frame">${jobBlock || "No schedule data."}</div>
    `;
    container.appendChild(block);
  }

  document.body.appendChild(container);
}

document.addEventListener("DOMContentLoaded", () => {
  updateStep();
  document.getElementById("submitBtn").addEventListener("click", submitJSON);
});
