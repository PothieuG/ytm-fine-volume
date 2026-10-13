# Publishing on addons.mozilla.org

Everything the listing needs is in this folder:

| File                             | Use                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `amo-metadata.json`              | Summary, description (English and French), category, license, release notes. |
| `screenshots/1-popup.png`        | 1280×800 screenshot: the popup and the main features.                         |
| `screenshots/2-volume-curve.png` | 1280×800 screenshot: output level with and without the extension.            |
| `icon-128.png`                   | Listing icon, if the Developer Hub asks for one (the manifest's SVG is used otherwise). |

## Before each submission

1. Increase `version` in `extension/manifest.json`. A version number can only be uploaded once per add-on, and that includes versions signed for self-distribution.
2. `npm run lint`: 0 errors, 0 warnings.
3. Test a temporary install (`about:debugging`) on music.youtube.com: the curve, the wheel, the arrow keys, and the popup in both languages.
4. `npm run build`: the zip is in `web-ext-artifacts/`.

## First submission

### Through the website

1. Sign in at <https://addons.mozilla.org/developers/addon/submit/distribution>.
2. Choose **On this site** (public listing).
3. Upload `web-ext-artifacts/fine_volume_for_youtube_music-<version>.zip`, the file made by `npm run build`, about 15 KB with `manifest.json` at its root. **Don't zip the project folder yourself.** That brings in `node_modules/` and `.git/`, and AMO rejects it with "No manifest.json was found at the root of the extension" plus hundreds of warnings. Compatibility: Firefox only (not Android).
4. Answer **No** to "Do you need to submit source code?". The code is neither minified nor bundled.
5. Fill in the listing:
   - **Name:** taken from the manifest ("Fine Volume for YouTube Music").
   - **Summary** and **Description:** copy the `en-US` texts from `amo-metadata.json`. Add the French translation (`fr`) through the language selector on the listing page.
   - **Category:** Photos, Music & Videos.
   - **License:** MIT.
   - **Support:** an email address or URL of your choice, for example the GitHub issues page if the repository is public.
   - **Privacy policy:** none needed, since no data is collected (`data_collection_permissions: none`).
6. Add the two screenshots from `screenshots/` on the listing's **Images** page.

### Or from the command line

With API keys from <https://addons.mozilla.org/developers/addon/api/key/>:

```bash
npm run submit -- --api-key=<JWT issuer> --api-secret=<JWT secret>
```

This creates the listing from `amo-metadata.json` and uploads the version. The screenshots still have to be added on the website.

## After submission

AMO validates the extension automatically and signs it. The listing goes public once that validation passes, usually within minutes, and a human review may follow later. Reviewers may ask about `world: "MAIN"` and the `HTMLMediaElement.prototype.volume` override. The short answer: YouTube Music only accepts whole percentages and stops at 1 % (−40 dB), so the extension bends the curve where the player writes the volume.

## Later versions

Bump the version, then either upload the new zip under **Manage Status & Versions**, or run `npm run submit` again. For later versions, `amo-metadata.json` only updates the release notes.
