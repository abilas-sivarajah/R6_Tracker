import { NextResponse } from 'next/server';

import { BROWSER_UA, dataDomeCookie } from '@/lib/r6';

// Temporary diagnostic endpoint. Performs the Ubisoft login directly with
// Node's built-in fetch, including the configured browser User-Agent and the
// DataDome cookie (R6_DATADOME), and reports the raw response so we can see
// whether the DataDome cookie gets us past the 403.
//
// Open http://localhost:3000/api/diag and share the JSON.
// Remove this route before deploying publicly — it logs in with real creds.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOGIN_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions';
const APP_ID = '3587dcbb-7f81-457c-9781-0e3f29f6f56a'; // the valid one

export async function GET() {
  const email = process.env.UBI_EMAIL;
  const password = process.env.UBI_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing UBI_EMAIL / UBI_PASSWORD' });
  }

  const basic =
    'Basic ' + Buffer.from(`${email}:${password}`, 'utf8').toString('base64');
  const cookie = dataDomeCookie();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Ubi-AppId': APP_ID,
    'User-Agent': BROWSER_UA,
    Authorization: basic,
  };
  if (cookie) headers.Cookie = cookie;

  try {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rememberMe: true }),
    });
    const body = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* not JSON */
    }
    return NextResponse.json({
      usingUserAgent: BROWSER_UA,
      sentDataDomeCookie: !!cookie,
      status: res.status,
      statusText: res.statusText,
      server: res.headers.get('server'),
      cfRay: res.headers.get('cf-ray'),
      contentType: res.headers.get('content-type'),
      gotTicket: !!(parsed && (parsed as { ticket?: string }).ticket),
      bodySnippet: body.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
