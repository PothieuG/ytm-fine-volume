const YTM_URL = 'https://music.youtube.com/';
const YTM_PATTERN = 'https://music.youtube.com/*';
const PREVIEW_LEVELS = [1, 10, 50];

const $ = (id) => document.getElementById(id);
const t = (key, ...substitutions) => browser.i18n.getMessage(key, substitutions);
const formatDb = (gain) => `${Math.round(20 * Math.log10(gain))} dB`.replace('-', '−');

function localize() {
  document.documentElement.lang = t('messagesLanguage');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    const label = t(el.dataset.i18nLabel);
    el.setAttribute('aria-label', label);
    if (el.localName === 'button') el.title = label;
  }
}

// ---- Live control of the YouTube Music tab ----------------------------------------------------

async function findYtmTab() {
  const tabs = await browser.tabs.query({ url: YTM_PATTERN });
  return tabs.find((tab) => tab.active) ?? tabs.find((tab) => tab.audible) ?? tabs[0];
}

async function sendCommand(command) {
  if (!(await browser.permissions.contains({ origins: [YTM_PATTERN] }))) return { problem: 'permission' };
  const tab = await findYtmTab();
  if (!tab) return { problem: 'no-tab' };
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type: 'command', command });
    if (!status?.pageScript) return { problem: 'not-injected', tabId: tab.id };
    return status.player ? status : { problem: 'no-player' };
  } catch {
    return { problem: 'not-injected', tabId: tab.id }; // no content script in that tab
  }
}

const PROBLEMS = {
  permission: {
    text: 'problemPermission',
    action: 'actionPermission',
    run: () => browser.permissions.request({ origins: [YTM_PATTERN] }),
  },
  'no-tab': {
    text: 'problemNoTab',
    action: 'actionNoTab',
    run: () => browser.tabs.create({ url: YTM_URL }),
  },
  'not-injected': {
    text: 'problemNotInjected',
    action: 'actionNotInjected',
    run: (status) => browser.tabs.reload(status.tabId),
  },
  'no-player': {
    text: 'problemNoPlayer',
  },
};

const volumeInput = $('volume');
const volumeRange = $('volume-range');
let draggingRange = false;
let lastStatus = {};

async function render(status) {
  lastStatus = status;
  const problem = PROBLEMS[status.problem];
  const active = !problem || status.problem === 'no-player';
  $('badge').hidden = false;
  $('badge').textContent = t(active ? 'badgeActive' : 'badgeInactive');
  $('badge').classList.toggle('ok', active);
  $('player').hidden = Boolean(problem);
  $('problem').hidden = !problem;
  if (problem) {
    $('problem-text').textContent = t(problem.text);
    $('problem-hint').hidden =
      status.problem !== 'no-tab' || (await browser.extension.isAllowedIncognitoAccess());
    $('problem-action').hidden = !problem.action;
    $('problem-action').textContent = problem.action ? t(problem.action) : '';
    return;
  }
  // Don't fight the user while they type a value or drag the slider.
  if (document.activeElement !== volumeInput) volumeInput.value = status.volume;
  if (!draggingRange) volumeRange.value = status.volume;
  $('output').textContent = status.muted
    ? t('outputMuted')
    : status.output > 0
      ? t('outputLevel', formatDb(status.output))
      : t('outputOff');
}

const run = async (command = { type: 'status' }) => render(await sendCommand(command));
const setVolume = (value) => run({ type: 'set', volume: Math.round(Math.min(100, Math.max(0, value))) });

$('down').addEventListener('click', () => run({ type: 'step', direction: -1 }));
$('up').addEventListener('click', () => run({ type: 'step', direction: 1 }));

volumeInput.addEventListener('focus', () => volumeInput.select());
volumeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') volumeInput.blur();
});
volumeInput.addEventListener('change', () => {
  if (volumeInput.value !== '' && Number.isFinite(Number(volumeInput.value))) setVolume(Number(volumeInput.value));
});

volumeRange.addEventListener('pointerdown', () => (draggingRange = true));
volumeRange.addEventListener('pointerup', () => (draggingRange = false));
volumeRange.addEventListener('input', () => {
  volumeInput.value = volumeRange.value;
  setVolume(Number(volumeRange.value));
});

// Called synchronously from the click so permissions.request keeps its user gesture.
$('problem-action').addEventListener('click', () => {
  PROBLEMS[lastStatus.problem]?.run?.(lastStatus);
  setTimeout(run, 1000);
});

// ---- Settings ---------------------------------------------------------------------------------

const fields = {
  exponent: $('exponent'),
  step: $('step'),
  wheel: $('wheel'),
  arrows: $('arrows'),
  osd: $('osd'),
};

function renderPreview(exponent) {
  $('exponent-value').textContent = exponent.toFixed(1);
  $('preview').textContent = PREVIEW_LEVELS.map((level) =>
    t('previewItem', String(level), formatDb((level / 100) ** exponent)),
  ).join(' · ');
}

function readField(input) {
  return input.type === 'checkbox' ? input.checked : Number(input.value);
}

function restoreSettingsPanel() {
  const settings = $('settings');
  // Always open in about:addons (where the page is framed), remembered in the toolbar popup.
  const inAddonsManager = window.self !== window.top;
  try {
    settings.open = inAddonsManager || localStorage.getItem('settingsOpen') === '1';
    settings.addEventListener('toggle', () => localStorage.setItem('settingsOpen', settings.open ? '1' : '0'));
  } catch {
    settings.open = inAddonsManager;
  }
}

async function init() {
  localize();
  restoreSettingsPanel();
  const config = await browser.storage.local.get(YTM_FINE_VOLUME_DEFAULTS);
  for (const [name, input] of Object.entries(fields)) {
    if (input.type === 'checkbox') input.checked = config[name];
    else input.value = config[name];
    input.addEventListener('input', () => {
      const value = readField(input);
      if (input.type === 'number' && !(value >= Number(input.min) && value <= Number(input.max))) return;
      if (name === 'exponent') renderPreview(value);
      browser.storage.local.set({ [name]: value });
    });
  }
  renderPreview(config.exponent);
  run();
  setInterval(run, 1000); // follows changes made from YouTube Music itself
}

init();
