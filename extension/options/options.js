const PREVIEW_LEVELS = [1, 2, 3, 5, 10, 20, 50, 100];

const fields = {
  exponent: document.getElementById('exponent'),
  step: document.getElementById('step'),
  wheel: document.getElementById('wheel'),
  arrows: document.getElementById('arrows'),
  osd: document.getElementById('osd'),
};

const formatDb = (gain) => `${Math.round(20 * Math.log10(gain))} dB`;

function renderPreview(exponent) {
  document.getElementById('exponent-value').textContent = exponent.toFixed(1);
  const rows = PREVIEW_LEVELS.map((level) => {
    const row = document.createElement('tr');
    for (const text of [`${level} %`, formatDb(level / 100), formatDb((level / 100) ** exponent)]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    return row;
  });
  document.getElementById('preview').replaceChildren(...rows);
}

function readField(name) {
  const input = fields[name];
  return input.type === 'checkbox' ? input.checked : Number(input.value);
}

async function init() {
  const config = await browser.storage.local.get(YTM_FINE_VOLUME_DEFAULTS);
  for (const [name, input] of Object.entries(fields)) {
    if (input.type === 'checkbox') input.checked = config[name];
    else input.value = config[name];
    input.addEventListener('input', () => {
      const value = readField(name);
      if (input.type === 'number' && !(value >= Number(input.min) && value <= Number(input.max))) return;
      if (name === 'exponent') renderPreview(value);
      browser.storage.local.set({ [name]: value });
    });
  }
  renderPreview(config.exponent);
}

init();
