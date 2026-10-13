# YTM Fine Volume

Extension Firefox qui permet de régler YouTube Music **sous son volume minimum** et **au pour-cent près**.

## Le problème

Mesures sur music.youtube.com (octobre 2026) :

- Le slider de volume (0 à 100) passe par une courbe avant d'arriver au « volume du lecteur », qui ne prend que des **entiers** de 0 à 100 % :

  | Position du slider | 0–4 | 5 | 10 | 20 | 30 | 50 | 77 | 100 |
  | ------------------ | --- | --- | --- | --- | --- | --- | --- | --- |
  | Volume du lecteur  | 0 % | 1 % | 2 % | 5 % | 8 % | 20 % | 50 % | 100 % |

- Le lecteur règle ensuite `video.volume = volume / 100 × facteur de normalisation` (≤ 1).

Le niveau audible le plus bas est donc 1 %, soit **−40 dB**. Rien n'existe entre ce niveau et le silence, d'où le « pop » entre les positions 4 et 5.

## Ce que fait l'extension

**A. Courbe de volume.** Le volume réellement envoyé au `<video>` devient `volume^k` (k = 2 par défaut). Le facteur de normalisation reste linéaire. Le maximum ne change pas, mais tout le bas du slider descend beaucoup plus loin :

| Volume YTM | Sans l'extension | Avec (k = 2) |
| ---------- | ---------------- | ------------ |
| 1 %        | −40 dB           | −80 dB       |
| 3 %        | −30 dB           | −61 dB       |
| 5 %        | −26 dB           | −52 dB       |
| 10 %       | −20 dB           | −40 dB       |
| 20 %       | −14 dB           | −28 dB       |
| 50 %       | −6 dB            | −12 dB       |
| 100 %      | 0 dB             | 0 dB         |

**B. Réglage fin.** La molette sur la barre du lecteur et les flèches ↑ / ↓ changent le volume de 1 % à la fois. C'est plus précis que le slider, qui saute des valeurs (les positions 5 à 9 donnent toutes 1 %). Le volume s'affiche brièvement à l'écran, par exemple « Volume 4 % · −56 dB ».

Les flèches sont ignorées quand le curseur est dans un champ de texte (la recherche, par exemple). Depuis le mode muet, un cran vers le haut repart de 1 %.

## Installation

Il faut Firefox 140 ou plus récent.

### Pour essayer (jusqu'au prochain redémarrage de Firefox)

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module complémentaire temporaire…**.
3. Choisir `extension/manifest.json`.

### Installation permanente

Firefox (version normale) n'installe que les extensions signées par Mozilla. La signature « non listée » est gratuite et automatique, et elle ne publie rien sur le catalogue :

1. Créer des clés d'API sur <https://addons.mozilla.org/developers/addon/api/key/>.
2. Lancer la signature :

   ```bash
   npm install
   npm run sign -- --api-key=<clé JWT issuer> --api-secret=<secret JWT>
   ```

3. Glisser le `.xpi` obtenu (dans `web-ext-artifacts/`) sur une fenêtre Firefox.

Autre solution : Firefox Developer Edition ou Nightly avec `xpinstall.signatures.required` à `false` dans `about:config`, puis `npm run build`.

## Réglages

Dans `about:addons` → YTM Fine Volume → **Options** :

- **Exposant** (de 1 à 3) : 1 rétablit la courbe d'origine. Un tableau montre l'effet en dB.
- **Molette**, **flèches** et **affichage à l'écran** : chacun peut être activé ou désactivé.
- **Pas** : nombre de pour-cent par cran (1 par défaut).

## Développement

```bash
npm install
npm start       # lance un Firefox de test avec l'extension sur music.youtube.com
npm run lint
npm run build   # zip dans web-ext-artifacts/
```

Structure :

- `extension/src/page.js` : s'exécute dans le contexte de la page (`world: MAIN`) dès `document_start`. Il redéfinit `HTMLMediaElement.prototype.volume` (option A) et gère la molette, les flèches et l'affichage (option B) via l'API du lecteur `#movie_player`.
- `extension/src/bridge.js` : lit les réglages dans `browser.storage` et les transmet à `page.js` par des événements DOM, car le contexte de la page n'a pas accès aux API d'extension.
- `extension/options/` : page de réglages.

## Limites

- La correspondance entre position du slider et volume est une approximation mesurée. Elle sert uniquement à placer le curseur du slider après un cran de molette, et le volume réel est toujours exact. Si YouTube Music change sa courbe, le curseur peut être décalé de quelques positions.
- L'extension s'appuie sur des éléments internes de YouTube Music (`#movie_player`, `ytmusic-player-bar`, `#volume-slider`). Une refonte du site pourrait casser l'option B, alors que l'option A ne dépend que du `<video>`.
