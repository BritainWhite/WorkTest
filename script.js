function getFormattedDate() {
  const input = document.getElementById("customDate").value.trim();
  const validFormat = /^\d{4}\/\d{2}\/\d{2}$/;

  if (input && validFormat.test(input)) {
    return input;
  }

  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function fetchJSON() {
  const date = getFormattedDate();
  const rawUrl = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${date}`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;

  // Update the visible URL and iframe
  const link = document.getElementById("init");
  link.href = rawUrl;
  link.innerText = rawUrl;

  document.getElementById("previewIframe").src = rawUrl;

  // Try fetching through proxy
  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      document.getElementById("output").textContent = JSON.stringify(data, null, 2);
    })
    .catch(err => {
      document.getElementById("output").textContent = `Error:\n${err}`;
    });
}
