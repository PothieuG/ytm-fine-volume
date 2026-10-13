# Fine Volume for YouTube Music

A Firefox extension that lets you set YouTube Music **below its minimum volume** and **to the exact percent**.

Not affiliated with, endorsed by or sponsored by Google or YouTube.

## The problem

Measured on music.youtube.com (October 2026):

- The volume slider (0–100) goes through a curve before reaching the "player volume", which only takes **whole numbers** from 0 to 100 %:

  | Slider position | 0–4 | 5   | 10  | 20  | 30  | 50   | 77   | 100   |
  | --------------- | --- | --- | --- | --- | --- | ---- | ---- | ----- |
  | Player volume   | 0 % | 1 % | 2 % | 5 % | 8 % | 20 % | 50 % | 100 % |

- The player then sets `video.volume = volume / 100 × loudness normalization factor` (≤ 1).

So the quietest audible level is 1 %, which is **−40 dB**, with nothing between it and silence. That is the sudden "pop" between slider positions 4 and 5.

## What the extension does

**A. Volume curve.** The volume actually sent to the `<video>` becomes `volume^k` (k = 2 by default), while the loudness normalization factor stays linear. The maximum is unchanged, and the bottom of the slider goes much further down:

| YouTube Music volume | Without the extension | With it (k = 2) |
| -------------------- | --------------------- | --------------- |
| 1 %                  | −40 dB                | −80 dB          |
| 3 %                  | −30 dB                | −61 dB          |
| 5 %                  | −26 dB                | −52 dB          |
| 10 %                 | −20 dB                | −40 dB          |
| 20 %                 | −14 dB                | −28 dB          |
| 50 %                 | −6 dB                 | −12 dB          |
| 100 %                | 0 dB                  | 0 dB            |

**B. Fine control.** The mouse wheel over the player bar and the ↑ / ↓ arrow keys change the volume 1 % at a time. That is finer than the slider, which skips values (positions 5 to 9 all give 1 %). The volume shows briefly on the page, for example "Volume 4% · −56 dB".

Arrow keys are ignored while typing in a text field (such as search). From mute, one step up starts again at 1 %.

**C. Toolbar popup.** The popup is styled like YouTube Music: dark theme and red accents.

- **Volume:** type an exact percentage (Enter to confirm), use the − / + buttons, or drag the slider. The actual output level in dB is shown below, curve and normalization included.
- **Active / Inactive badge:** when the extension can't act, the popup explains why and offers a one-click fix: **Reload the tab**, **Allow access** to music.youtube.com, or **Open YouTube Music**.
- **Settings:** a collapsible section, always open in `about:addons` → Fine Volume for YouTube Music → Options.
  - **Curve** (1 to 3): 1 restores YouTube Music's original behavior. The effect is shown below it, for example "1% → −80 dB".
  - **Step** of the mouse wheel and arrow keys (1 % by default).
  - Switches for the **mouse wheel**, the **arrow keys** and the **on-page volume display**.

The interface is in English and French, following Firefox's language.

The extension collects no data and makes no network requests. It only runs on music.youtube.com.

## Installation

Requires Firefox 142 or later.

### From addons.mozilla.org

Once published, install it from its addons.mozilla.org page.

### From this repository (until Firefox closes)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick `extension/manifest.json`.

Firefox **removes temporary add-ons when it closes**.

## Development

```bash
npm install
npm start       # launches a test Firefox with the extension on music.youtube.com
npm run lint
npm run build   # zip in web-ext-artifacts/
```

Layout:

- `extension/src/page.js` runs in the page's own context (`world: MAIN`) at `document_start`. It redefines `HTMLMediaElement.prototype.volume` (part A), and handles the mouse wheel, arrow keys, on-page display and popup commands through YouTube Music's player API, `#movie_player` (part B).
- `extension/src/bridge.js` reads the settings from `browser.storage` and passes them, along with the localized on-page texts, to `page.js` through DOM events, since the page context has no access to extension APIs. It also relays the popup's commands.
- `extension/options/` is the popup, also used as the options page.
- `extension/_locales/` holds the English (default) and French texts.
- `store/` holds the addons.mozilla.org listing texts, screenshots and the publishing checklist.

## Limitations

- The slider-to-volume mapping is a measured approximation. It is only used to place the slider knob after a wheel step or a value typed in the popup. The actual volume is always exact. If YouTube Music changes its curve, the knob may be a few positions off.
- The extension relies on YouTube Music internals (`#movie_player`, `ytmusic-player-bar`, `#volume-slider`). A site redesign could break part B and the popup controls. Part A only depends on the `<video>` element.

## License

[MIT](LICENSE)
