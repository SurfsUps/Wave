# Korallbukta Surf 🌊

Et stilisert surfespill i tredjeperson, satt i en varm, tropisk bukt. Du kan gå rundt på stranden, bytte brett og antrekk i surfehytta, padle ut, dykke under bølger og surfe dem.

Spillet er laget i ren JavaScript med WebGL2. Det har ingen avhengigheter og trenger ikke byggesteg. Alt (3D-motor, bølger, modeller, teksturer og lyd) lages i koden.

## Kjør spillet

### På GitHub Pages (anbefalt)
1. Lag et nytt repo på GitHub og last opp **alle filene og mappene** i denne mappen, med samme struktur.
2. Gå til **Settings → Pages**.
3. Under *Build and deployment* velger du **Deploy from a branch**, branch `main` og mappe `/ (root)`. Trykk **Save**.
4. Etter et minutt eller to ligger spillet på `https://<brukernavn>.github.io/<repo-navn>/`.

### Lokalt
Spillet bruker ES-moduler, så det må serveres over HTTP. Å dobbeltklikke på `index.html` fungerer ikke.

```bash
# i prosjektmappen
python3 -m http.server 8000
# åpne http://localhost:8000
```

Du kan også bruke `npx serve` eller «Live Server» i VS Code.

## Kontroller

| Hvor | Tast | Handling |
|---|---|---|
| Stranden | `W A S D` | Gå (kamera-relativt) |
| | `Shift` | Løp |
| | `E` | Åpne surfebutikken (ved disken) / snakk med Chicken Joe og Cody ved bålet |
| Vannet | `W` / `S` | Padle frem / bakover (bakover er merkbart saktere) |
| | `A` / `D` | Snu brettet |
| | `E` mot en brytende bølge | **Duck dive** |
| | `E` når en ridebar bølge kommer bakfra | **Drop in** |
| På bølgen | `A` / `D` | Carve. Hold inne for skarpere sving |
| | `W` / `S` | Pump for fart / brems |
| Triks | `Space` | Hopp (air) fra toppen av bølgen |
| | `A` / `D` i lufta | Spinn (180, 360, 540 …) |
| | `W` i lufta | Grab |
| | `F` | Snap på leppa |
| | Hold `Q` | Hang ten (gå ut på nesa) |
| Overalt | Dra med musa / hjul | Se rundt / zoom |
| | `H` / `M` | Hjelp / lyd av og på |

### Slik surfer du
1. Gå ut i vannet. Karakteren legger seg automatisk på brettet.
2. Padle ut mot revet. Når en bølge bryter foran deg, dukker en **timing-bar** opp. Trykk `E` når markøren er i det grønne feltet for å duck dive under bølgen. Trykker du for sent eller ikke i det hele tatt, blir du dyttet bakover.
3. Ute i lineupen snur du deg mot land (`A`/`D`) og venter på et sett.
4. Når en ridebar bølge nærmer seg bakfra, padler du (`W`) og trykker `E` i det grønne feltet for å droppe inn.
5. Sving langs bølgeveggen, bort fra der den bryter. Nedover gir fart, oppover gir høyde, og skarpe svinger koster fart. Blir du for lenge i curlen, tar den deg.
6. Gjør triks for ekstra surfepoeng. Flere triks på samme bølge gir combo. Lander du skjevt etter et hopp, blir det wipeout.

### Bølgene
Bølgene kommer i sett. Noen deler seg i midten (A-ramme), andre peeler bare til venstre eller høyre over bukta. Den siste bølgen i et sett er ofte en ekstra stor «bomb» som bryter lenger ute.

### Chicken Joe og Cody
Ved bålet sitter Chicken Joe og Cody. Gå bort og trykk `E` for å prate. Cody gir tips, og når du har 2000 surfepoeng gir Chicken Joe deg maisbrettet sitt. Surfepoeng og opplåste brett lagres i nettleseren.

## Filstruktur

```
index.html            Inngangsside og HUD-markup
css/style.css         Grensesnittet
js/main.js            Oppstart og hovedløkke
js/engine/            WebGL2-renderer, matte og geometribyggere
js/world/terrain.js   Bukta: sand, rev, odder og koller
js/world/waves.js     Bølgesystemet (sett, oppbygging, bryting, peeling)
js/world/water.js     Vann-shader, curl/leppe og skum
js/world/props.js     Palmer, surfehytte, bål, jungel, klipper, fjellstabler, dyr …
js/world/npcs.js      Chicken Joe og Cody ved bålet, med replikker
js/player/            Spiller-logikk, karakter, antrekk og brett
js/game/              Kamera, input, HUD/butikk, partikler og lyd
js/textures.js        Prosedyretegnede mønstre
```

## Tilpasning
- **Flere brett:** legg til et objekt i `BOARDS` i `js/player/boards.js`. Form, finner, rocker, maling og egenskaper styres der.
- **Flere antrekk:** legg til i `OUTFITS` i `js/player/outfits.js` og eventuelt et nytt mønster i `PRINTS` i `js/textures.js`.
- **Bølgene:** størrelse, settlengde og pauser justeres i `spawn()` og `update()` i `js/world/waves.js`.
- **Timingvinduer:** `DUCK` og `DROP` øverst i `js/player/player.js`.
- **Surfefølelse:** alle parametere for styring, brettets lean/følging av vannet, kroppsposituren og balanse/wipeout ligger samlet og kommentert i `js/player/tuning.js`. Prøv `?feel=arcade` (kvikk og tilgivende) eller `?feel=sim` (tyngre, mer momentum, lettere å falle) bak adressen.

Valgt antrekk og brett lagres i nettleseren (localStorage).

## Krav
Nettleser med WebGL2: Chrome, Edge, Firefox og Safari 15 eller nyere. Spillet senker oppløsningen automatisk hvis maskinen sliter.
