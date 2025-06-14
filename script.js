let step = 0;
const steps = ['today', 'yesterday', 'tomorrow'];

function getDateOffset(offset) {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  now.setDate(now.getDate() + offset);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function updateStep() {
  const label = document.getElementById('stepLabel');
  const iframe = document.getElementById('previewIframe');
  const stepName = steps[step];
  const dateOffset = step === 0 ? 0 : (step === 1 ? -1 : 1);
  const url = `https://radapps3.wal-mart.com/Protected/CaseVisibility/ashx/Main.ashx?func=init&storeNbr=5307&businessDate=${getDateOffset(dateOffset)}`;

  label.textContent = `Step ${step + 1}: Submit ${stepName.charAt(0).toUpperCase() + stepName.slice(1)} JSON`;
  iframe.src = url;
}

function submitJSON() {
  const textarea = document.getElementById('jsonInput');
  let content = textarea.value.trim();

  try {
    const parsed = JSON.parse(content);
    localStorage.setItem(`${steps[step]}.json`, JSON.stringify(parsed, null, 2));
  } catch (e) {
    alert('Invalid JSON. Please make sure you copied it correctly.');
    return;
  }

  textarea.value = '';

  step++;
  if (step < steps.length) {
    updateStep();
  } else {
    showFinalView();
  }
}

function showFinalView() {
  document.getElementById('inputPanel').style.display = 'none';
  document.getElementById('viewPanel').style.display = 'block';

  const viewFrame = (id, key) => {
    const data = localStorage.getItem(`${key}.json`);
    return `<pre>${data ? escapeHTML(data) : 'No data'}</pre>`;
  };

  const iframes = document.querySelectorAll('.json-view iframe');
  ['today', 'yesterday', 'tomorrow'].forEach((key, index) => {
    iframes[index].srcdoc = viewFrame(key, key);
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag]));
}

// Initialize on load
document.addEventListener('DOMContentLoaded', updateStep);
