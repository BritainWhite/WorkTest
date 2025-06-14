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
  localStorage.setItem(`${folder}/${filename}`, JSON.stringify(data, null, 2));
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
    if (!raw) continue;
    const data = JSON.parse(raw);
    const block = document.createElement("div");
    block.style.border = "1px solid #ccc";
    block.style.padding = "10px";
    block.style.marginBottom = "10px";
    block.innerHTML = `
      <strong>${folder}</strong><br/>
      Business Date: ${data.business_date}<br/>
      Trailers: ${data.trailer_count}<br/>
      Total Cases: ${data.totals.caseQuantity}<br/>
      Floor Qty: ${data.totals.floorCaseQuantity}<br/>
      Pallets: ${data.totals.palletQuantity}<br/>
      Breakpacks: ${data.totals.breakPackCount}
    `;
    container.appendChild(block);
  }
  document.body.appendChild(container);
}

document.addEventListener("DOMContentLoaded", updateStep);
