// Isolated-world half of the extension: page.js cannot use WebExtension APIs, so this script
// reads the settings from extension storage and hands them over through DOM events.
const EVENT_CONFIG = 'ytm-fine-volume:config';
const EVENT_HELLO = 'ytm-fine-volume:hello';

async function sendConfig() {
  const config = await browser.storage.local.get(YTM_FINE_VOLUME_DEFAULTS);
  // A string detail crosses the isolated/page boundary without Xray wrapping issues.
  window.dispatchEvent(new CustomEvent(EVENT_CONFIG, { detail: JSON.stringify(config) }));
}

// page.js says hello when it starts, in case it runs after our first send.
window.addEventListener(EVENT_HELLO, sendConfig);
browser.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') sendConfig();
});
sendConfig();
