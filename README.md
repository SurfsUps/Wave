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
| | `E` mot en brytende bølge | **Duck dive** (kort pause før du kan dykke igjen) |
| | `E` når en ridebar bølge kommer bakfra | **Drop in** |
| På bølgen | `A` / `D` | Carve. Hold inne for skarpere sving |
| | `W` / `S` | Pump for fart / brems (stall) |
| Triks | `Space` | Hopp (air) fra toppen av bølgen |
| | `A` / `D` i lufta | Spinn (180, 360, 540 …) |
| | `W` i lufta | Grab |
| | Hold `S` i lufta | Superman (slipp før du lander!) |
| | `F` | Snap. Rett i leppa der den brekker: re-entry |
| | Hold `Q` | Hang ten (gå ut på nesa) |
| Overalt | Dra med musa / hjul | Se rundt / zoom |
| | `H` / `M` | Hjelp / lyd av og på |

### Slik surfer du
1. Gå ut i vannet. Karakteren legger seg automatisk på brettet.
2. Padle ut mot revet. Når en bølge bryter foran deg, dukker en **timing-bar** opp. Trykk `E` når markøren er i det grønne feltet for å duck dive under bølgen. Nesa går ned først, så halen, og du kommer opp bak skummet. Etter et dykk må du hente pusten litt, og en liten ring på skjermen viser når du kan dykke igjen. Trykker du for sent eller ikke i det hele tatt, blir du dyttet bakover.
3. Ute i lineupen snur du deg mot land (`A`/`D`) og venter på et sett. Ligger du i ro en stund, setter surferen seg opp på brettet. Når en bølge kommer, legger hen seg ned igjen.
4. Når en ridebar bølge nærmer seg bakfra, padler du (`W`) og trykker `E` i det grønne feltet for å droppe inn.
5. Sving langs bølgeveggen, bort fra der den bryter. Nedover gir fart, oppover gir høyde, og skarpe svinger koster fart. Kjører du langs bølgen høyt oppe i veggen (trim), gir bølgen deg fart gratis. Blir du for lenge i curlen, tar den deg.
6. Gjør triks for ekstra surfepoeng. Flere triks på samme bølge gir combo. Lander du skjevt etter et hopp, blir det wipeout.

### Triks
Hvert triks krever riktig sted på bølgen. Poengene øker med fart, bølgestørrelse og combo, og triksnavnet vises nede til høyre.

| Triks | Hvordan |
|---|---|
| **Cutback** | Ute på skulderen (langt fra curlen): sving helt tilbake mot den brytende delen. En ekstra lang sving gir *roundhouse cutback*. |
| **Snap / re-entry** | Kjør opp mot leppa og trykk `F`. Rett i leppa der den kaster seg blir det en *re-entry*, og kjører du rett opp veggen blir det en *vertikal snap*. |
| **Floater** | Kjør opp på leppa der den brekker, mot curlen. Skummet bærer deg. Pek nesa ned mot land for å lande. Blir du for lenge, faller du. |
| **Tube** | Bare på store, bratte bølger. Brems (`S`) midt i veggen så leppa kaster seg over deg, og pump (`W`) deg ut før tuben lukker seg. |
| **Air** | `Space` fra toppen med god fart. Spinn med `A`/`D`, grab med `W`, superman med `S`. Fra leppa gir ekstra poeng. |
| **Hang ten** | Hold `Q` i rolig fart. Lange brett gir mer. |

### Bølgene
Bølgene kommer i sett som er små, mellomstore eller store, og skiltet øverst til høyre sier hvilket sett som kommer. Dønningen bygger seg opp over revet, blir brattere helt på slutten, og leppa kaster seg frem. Bølgen brekker gradvis bortover (peeling), med seksjoner som går raskere eller saktere. Helt inne ved land lukker den seg gradvis, og hvitvannet ruller inn mot stranden. Noen bølger deler seg i midten (A-ramme), andre peeler bare én vei. Den siste bølgen i et middels eller stort sett kan være en ekstra stor «bomb» på over fire meter, som bryter langt ute.

### Chicken Joe og Cody
Ved bålet sitter Chicken Joe (som steker mais) og Cody (som trommer takten med foten). Gå bort og trykk `E` for å prate. Hva de sier avhenger av hvor mange poeng du har, og de gir deg premier underveis:

| Poeng | Fra | Premie |
|---|---|---|
| 2000 | Chicken Joe | Maisbrettet (ekstra triks-poeng) |
| 3000 | Cody | Codys Isflak 6'2 (svinger knivskarpt) |
| 4000 | Chicken Joe | Blomsterkrans (hodeplagg) |
| 5000 | Cody | Bålkveld-rash (antrekk) |
| 7000 | Chicken Joe | Gullbølgen 6'8 (legendebrett) |
| 10000 | Cody | Korallbuktas legende (antrekk) |

Når du når en grense, får du beskjed om at noen har noe til deg ved bålet. Premiene finnes også i Bølgehytta etterpå. Surfepoeng og premier lagres i nettleseren. Premiene endres i `REWARDS` i `js/world/npcs.js`.

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
- **Bølgene:** settstørrelser (små, mellomstore og store), hvor ofte de kommer, bomb-sjanse og hvor gradvis bølgen peeler og lukker seg ligger i `WAVE_TUNE` i `js/player/tuning.js`. Pauser mellom bølgene står i `update()` i `js/world/waves.js`.
- **Timingvinduer:** `DUCK` og `DROP` øverst i `js/player/player.js`.
- **Surfefølelse:** alle parametere for styring, brettets lean/følging av vannet, kroppsposituren og balanse/wipeout ligger samlet og kommentert i `js/player/tuning.js`. Der finner du også:
  - `weight`: vektoverføring mellom føttene, og hvor mye skuldre og hode starter svingen før brettet
  - `paddle`: armtak, hvor tungt brettet flyter, nesa over småbølger, og når surferen setter seg opp og venter
  - `duck`: cooldown (1,75 s), hvor dypt og hvor bratt dykket går
  - `tricks`: krav og poeng for cutback, snap, re-entry, floater, tube og air
  
  Prøv `?feel=arcade` (kvikk og tilgivende) eller `?feel=sim` (tyngre, mer momentum, lettere å falle) bak adressen.

Valgt antrekk og brett lagres i nettleseren (localStorage).

## Krav
Nettleser med WebGL2: Chrome, Edge, Firefox og Safari 15 eller nyere. Spillet senker oppløsningen automatisk hvis maskinen sliter.
