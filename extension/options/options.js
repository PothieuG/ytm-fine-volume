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

// ---- Live status of the YouTube Music tab -----------------------------------------------------

const YTM_ORIGIN = 'https://music.youtube.com/*';
const statusLine = document.getElementById('status');
const controls = document.getElementById('controls');
const grantButton = document.getElementById('grant');

function showStatus(text, kind) {
  statusLine.textContent = text;
  statusLine.className = `status ${kind}`;
}

async function findYtmTab() {
  const tabs = await browser.tabs.query({ url: YTM_ORIGIN });
  return tabs.find((tab) => tab.active) ?? tabs.find((tab) => tab.audible) ?? tabs[0];
}

async function sendCommand(command) {
  if (!(await browser.permissions.contains({ origins: [YTM_ORIGIN] }))) return { problem: 'permission' };
  const tab = await findYtmTab();
  if (!tab) return { problem: 'no-tab' };
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type: 'command', command });
    return status?.pageScript ? status : { problem: 'not-injected' };
  } catch {
    return { problem: 'not-injected' }; // no content script in that tab
  }
}

async function refresh(command = { type: 'status' }) {
  const status = await sendCommand(command);
  grantButton.hidden = status.problem !== 'permission';
  controls.hidden = !status.player;
  if (status.problem === 'permission') {
    showStatus("L'extension n'a pas l'autorisation d'accéder à music.youtube.com.", 'problem');
  } else if (status.problem === 'no-tab') {
    const privateHint = (await browser.extension.isAllowedIncognitoAccess())
      ? ''
      : " (En navigation privée, l'extension doit être autorisée dans about:addons.)";
    showStatus(`Aucun onglet YouTube Music ouvert.${privateHint}`, 'problem');
  } else if (status.problem === 'not-injected') {
    showStatus("L'extension n'est pas active dans l'onglet YouTube Music : recharge-le (F5).", 'problem');
  } else if (!status.player) {
    showStatus('Active. Lance un morceau pour régler le volume.', 'ok');
  } else {
    showStatus('Active sur YouTube Music.', 'ok');
    document.getElementById('volume').textContent = status.muted ? 'Muet' : `${status.volume} %`;
    document.getElementById('output').textContent =
      status.output > 0 ? `sortie ${formatDb(status.output)}` : 'sortie coupée';
  }
}

grantButton.addEventListener('click', async () => {
  await browser.permissions.request({ origins: [YTM_ORIGIN] });
  refresh();
});
document.getElementById('down').addEventListener('click', () => refresh({ type: 'step', direction: -1 }));
document.getElementById('up').addEventListener('click', () => refresh({ type: 'step', direction: 1 }));

// ---- Settings ---------------------------------------------------------------------------------

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
  refresh();
  setInterval(refresh, 1000); // follows changes made from YouTube Music itself
}

init();
