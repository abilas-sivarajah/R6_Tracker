# Deployment – auf dem Handy nutzen

Ein Handy kann den Server nicht selbst hosten. Stattdessen deployst du die App
**einmal ins Web** und öffnest sie dann im Handy-Browser (von überall).

## Option A – Vercel (empfohlen, kostenlos)

Vercel ist von den Machern von Next.js und braucht keine Konfiguration.

1. **Repo auf GitHub bringen** (falls noch nicht): dieses Projekt liegt bereits
   auf dem Branch `claude/r6-siege-player-tracker-mblenf`. Merge ihn nach `main`
   oder deploye direkt den Branch.
2. **Vercel-Account** erstellen auf <https://vercel.com> (Login mit GitHub).
3. **New Project → Repo importieren** (`r6_tracker` auswählen).
4. **Environment Variables** setzen (im Import-Schritt oder unter
   *Settings → Environment Variables*) – **niemals im Code committen**:
   - `UBI_EMAIL` = E-Mail deines Ubisoft-Zweitaccounts
   - `UBI_PASSWORD` = Passwort dazu
   - *(optional)* `R6_HISTORY_MIN_SEASON`, `R6_HISTORY_MAX_SEASON`
5. **Deploy** klicken. Nach ~1 Minute bekommst du eine URL wie
   `https://r6-tracker-xyz.vercel.app`.
6. Diese URL auf dem **Handy** öffnen → fertig. Du kannst sie zum Homescreen
   hinzufügen, dann fühlt es sich wie eine App an.

> Bei Code-Änderungen, die du nach GitHub pushst, deployt Vercel automatisch neu.

## Option B – schnell im selben WLAN testen (ohne Deployment)

Wenn dein PC und Handy im gleichen WLAN sind:

```bash
npm run dev -- -H 0.0.0.0
```

Dann am PC die lokale IP herausfinden (z. B. `192.168.x.x`) und am Handy im
Browser `http://192.168.x.x:3000` öffnen. Nur erreichbar, solange der PC läuft.

## Sicherheitshinweis

Die deployte Seite ist **öffentlich** – jeder mit der URL kann darüber Spieler
abfragen (und nutzt dabei den API-Zugang deines Ubisoft-Accounts). Für den
privaten Gebrauch ist das ok. Wenn du sie absichern willst, sag Bescheid – ich
kann z. B. einen einfachen Passwort-Schutz oder eine Zugriffsbeschränkung
einbauen.
