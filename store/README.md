# addons.mozilla.org listing and releases

- Listing: <https://addons.mozilla.org/firefox/addon/fine-volume-for-youtube-music/>
- Add-on ID: `ytm-fine-volume@pothieug` (permanent, never change it)
- Developer Hub: <https://addons.mozilla.org/developers/addon/fine-volume-for-youtube-music/edit>

## Files in this folder

| File                             | Use                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `amo-metadata.json`              | Summary, description (English and French), category, license, release notes.           |
| `screenshots/1-popup.png`        | 1280×800 screenshot: the popup and the main features.                                   |
| `screenshots/2-volume-curve.png` | 1280×800 screenshot: output level with and without the extension.                      |
| `icon-128.png`                   | Listing icon, if the Developer Hub asks for one (the manifest's SVG is used otherwise). |

## Releasing a new version

1. Increase `version` in `extension/manifest.json` and `package.json`. A version number can only be uploaded once per add-on.
2. Add the changes to [CHANGELOG.md](../CHANGELOG.md), and to `version.release_notes` in `amo-metadata.json` if you submit from the command line.
3. Run `npm run lint`. The target is 0 errors and 0 warnings.
4. Test a temporary install (`about:debugging`) on music.youtube.com: the curve, the wheel, the arrow keys, and the popup in English and French.
5. Run `npm run build`. It produces `web-ext-artifacts/fine_volume_for_youtube_music-<version>.zip`, about 15 KB, with `manifest.json` at its root.
6. Upload it, by either of these routes:
   - **Website:** Developer Hub → **Manage Status & Versions** → **Upload a New Version**, then pick that zip. **Never zip the project folder yourself.** That brings in `node_modules/` and `.git/`, and AMO rejects it with "No manifest.json was found at the root of the extension" plus hundreds of warnings. Answer **No** to "Do you need to submit source code?": the code is neither minified nor bundled.
   - **Command line:** create API keys at <https://addons.mozilla.org/developers/addon/api/key/>, then run:

     ```bash
     npm run submit -- --api-key=<JWT issuer> --api-secret=<JWT secret>
     ```

7. Tag the release in git:

   ```bash
   git tag v<version>
   ```

   ```bash
   git push --tags
   ```

AMO validates and signs each version automatically. It reaches users through Firefox's automatic updates, usually within a day. A human review may follow later. Reviewers may ask about `world: "MAIN"` and the `HTMLMediaElement.prototype.volume` override. The short answer: YouTube Music only accepts whole percentages and stops at 1 % (−40 dB), so the extension bends the curve where the player writes the volume.

## Listing settings (for reference)

- **Category:** Photos, Music & Videos
- **License:** MIT
- **Compatibility:** Firefox desktop only, not Android (YouTube Music's mobile site is different and untested)
- **Homepage:** <https://github.com/PothieuG/ytm-fine-volume>
- **Support site:** <https://github.com/PothieuG/ytm-fine-volume/issues>
- **Privacy policy:** none needed, since no data is collected (`data_collection_permissions: none`)
- **Translations:** English (default) and French. To change the listing texts, edit `amo-metadata.json` first and copy the texts from there.
