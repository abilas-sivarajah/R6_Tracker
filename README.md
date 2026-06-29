# R6 Tracker

Ein Rainbow Six Siege Spieler-Tracker im Stil von stats.cc: Nutzernamen eingeben
und Ränge, den Saison-Rangverlauf ("frühere Ränge") sowie Statistiken abrufen.

Gebaut mit **Next.js 16** (App Router, React 19) und der inoffiziellen Ubisoft-API
über [`r6api.js`](https://github.com/danielwerg/r6api.js).

## Features

- 🔎 **Spielersuche** nach Nutzername und Plattform (PC / PlayStation / Xbox)
- 🏅 **Aktuelle Ränge** für Ranked & Casual (Rang-Icon, MMR, Höchstrang, W/L, Winrate, K/D)
- 📜 **Rangverlauf** über vergangene Saisons (die "früheren Ränge")
- 📊 **Allgemeine PvP-Statistiken** (K/D, Winrate, Kills, Headshot-%, Spielzeit)
- 🎮 **Meistgespielte Operator**
- 🧩 **Match-Verlauf**: Datenstruktur vorbereitet (siehe Hinweis unten)

## Wichtiger Hinweis zur Datenquelle

Rainbow Six Siege hat **keine offizielle öffentliche API**. Dieses Projekt nutzt
die *inoffizielle* Ubisoft-API über `r6api.js`. Daraus ergeben sich zwei Dinge:

1. **Ubisoft-Account nötig.** Für die Authentifizierung werden E-Mail und Passwort
   eines Ubisoft-Accounts benötigt. Nutze am besten einen **Zweit-/Wegwerf-Account**,
   nicht deinen Hauptaccount — der Zugriff kann gegen Ubisofts Nutzungsbedingungen
   verstoßen.
2. **Keine Match-für-Match-Historie.** Die Ubisoft-API liefert keine vollständige
   Liste einzelner Matches (das speichert stats.cc selbst über die Zeit). Aktueller
   Rang, MMR, Level, Saison-Rangverlauf und aggregierte Stats sind aber verfügbar.
   Der `matches`-Slot in der Datenstruktur ist vorbereitet, um später eine eigene
   Match-Quelle anzubinden.

## Setup

Voraussetzung: Node.js 18+ (entwickelt mit Node 22).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Zugangsdaten anlegen
cp .env.example .env.local
# .env.local öffnen und UBI_EMAIL / UBI_PASSWORD eintragen

# 3. Dev-Server starten
npm run dev
# -> http://localhost:3000
```

### Environment-Variablen

| Variable                 | Pflicht | Beschreibung                                              |
| ------------------------ | ------- | -------------------------------------------------------- |
| `UBI_EMAIL`              | ja      | E-Mail des Ubisoft-Accounts                              |
| `UBI_PASSWORD`           | ja      | Passwort des Ubisoft-Accounts                            |
| `R6_HISTORY_MIN_SEASON`  | nein    | Erste Saison-ID für den Rangverlauf (Standard `16`)     |
| `R6_HISTORY_MAX_SEASON`  | nein    | Letzte Saison-ID für den Rangverlauf (Standard `60`)    |

> Der Rangverlauf fragt die Saisons `MIN..MAX` ab. Eine kleinere Spanne =
> weniger API-Aufrufe = schnellere Antworten. `r6api.js` kennt Saison-*Namen*
> nur bis Saison 27; neuere Saisons werden als „Season N" angezeigt, die
> Live-Daten kommen aber weiterhin von der Ubisoft-API.

## Scripts

| Script              | Zweck                                |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Entwicklungsserver                   |
| `npm run build`     | Produktions-Build (inkl. Typecheck)  |
| `npm run start`     | Produktionsserver (nach `build`)     |
| `npm run typecheck` | Nur TypeScript prüfen                 |

## Architektur

```
app/
  page.tsx              Such-UI (Client) + Ergebnis-Rendering
  layout.tsx            Root-Layout / Metadaten
  globals.css           Styling (dunkles Theme)
  api/player/route.ts   API-Route: GET /api/player?username=&platform=
components/
  PlayerProfile.tsx     Profil-, Rang-, Stats-, Operator- & Verlaufs-Anzeige
lib/
  r6.ts                 r6api.js-Client + Normalisierung der Ubisoft-Daten
  types.ts              Serialisierbare Typen (geteilt zwischen Client & Server)
```

Der Datenfluss: Die Such-UI ruft `GET /api/player` auf. Die API-Route lädt über
`lib/r6.ts` Profil, Progression, Ränge (aktuell + Verlauf) und Stats von Ubisoft,
normalisiert alles in die `PlayerData`-Struktur aus `lib/types.ts` und gibt sie als
JSON zurück.

## Deployment

Deploybar auf jeder Node.js-Plattform (z. B. Vercel). `UBI_EMAIL` und
`UBI_PASSWORD` als (geheime) Environment-Variablen hinterlegen — niemals committen.
Die `.env*`-Dateien sind bereits in `.gitignore`.
