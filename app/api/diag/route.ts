import { NextResponse } from 'next/server';

// Temporary diagnostic endpoint. Performs the Ubisoft login directly with
// Node's built-in fetch (undici) — which has a different TLS fingerprint than
// node-fetch — and reports the raw response so we can see WHY a 403 happens
// (Cloudflare bot-block vs. invalid Ubi-AppId vs. bad credentials).
//
// Open http://localhost:3000/api/diag in the browser and share the JSON.
// Remove this route once debugging is done — it must not ship publicly.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOGIN_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A few known Ubisoft application ids to compare.
const APP_IDS = [
  '3587dcbb-7f81-457c-9781-0e3f29f6f56a', // r6api.js default
  '685a3038-2b04-47ee-9c5a-6403eb4d5ea4', // Ubisoft Connect
  '39baebad-39e5-4552-8c25-2c9b919064e2', // alternative
];

export async function GET() {
  const email = process.env.UBI_EMAIL;
  const password = process.env.UBI_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing UBI_EMAIL / UBI_PASSWORD' });
  }

  const basic =
    'Basic ' + Buffer.from(`${email}:${password}`, 'utf8').toString('base64');

  const results = [];
  for (const appId of APP_IDS) {
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Ubi-AppId': appId,
          'User-Agent': BROWSER_UA,
          Authorization: basic,
        },
        body: JSON.stringify({ rememberMe: true }),
      });
      const body = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        /* not JSON */
      }
      results.push({
        appId,
        status: res.status,
        statusText: res.statusText,
        server: res.headers.get('server'),
        cfRay: res.headers.get('cf-ray'),
        contentType: res.headers.get('content-type'),
        gotTicket: !!(parsed && (parsed as { ticket?: string }).ticket),
        // Snippet only — avoids dumping the full ticket / HTML page.
        bodySnippet: body.slice(0, 400),
      });
    } catch (err) {
      results.push({
        appId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ loginUrl: LOGIN_URL, results }, { status: 200 });
}
