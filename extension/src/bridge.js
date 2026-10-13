// Isolated-world half of the extension: page.js cannot use WebExtension APIs, so this script
// reads the settings from extension storage and hands them over through DOM events, and relays
// the toolbar popup's commands.
const EVENT_CONFIG = 'ytm-fine-volume:config';
const EVENT_HELLO = 'ytm-fine-volume:hello';
const EVENT_COMMAND = 'ytm-fine-volume:command';
const EVENT_STATUS = 'ytm-fine-volume:status';

// On-page display texts, localised here since page.js has no i18n API ({volume} / {gain} are
// filled in by page.js).
const OSD_STRINGS = {
  volume: browser.i18n.getMessage('osdVolume', ['{volume}', '{gain}']),
  muted: browser.i18n.getMessage('osdMuted'),
};

async function sendConfig() {
  const config = await browser.storage.local.get(YTM_FINE_VOLUME_DEFAULTS);
  // A string detail crosses the isolated/page boundary without Xray wrapping issues.
  const detail = JSON.stringify({ ...config, strings: OSD_STRINGS });
  window.dispatchEvent(new CustomEvent(EVENT_CONFIG, { detail }));
}

// page.js says hello when it starts, in case it runs after our first send.
window.addEventListener(EVENT_HELLO, sendConfig);
browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') sendConfig();
});
sendConfig();

// Popup → page.js. page.js answers synchronously; the timeout covers it not running at all.
browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'command') return undefined;
  return new Promise((resolve) => {
    const onStatus = (event) => {
      clearTimeout(timer);
      resolve({ pageScript: true, ...JSON.parse(event.detail) });
    };
    const timer = setTimeout(() => {
      window.removeEventListener(EVENT_STATUS, onStatus);
      resolve({ pageScript: false });
    }, 500);
    window.addEventListener(EVENT_STATUS, onStatus, { once: true });
    window.dispatchEvent(new CustomEvent(EVENT_COMMAND, { detail: JSON.stringify(message.command) }));
  });
});
