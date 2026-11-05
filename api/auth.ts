import type { IncomingMessage, ServerResponse } from 'node:http';

type Request = IncomingMessage & { query?: Record<string, string | string[]>; body?: unknown };
const origin = 'https://zuerst.vercel.app';
const upstream = 'https://ep-rapid-tooth-bav9j8t9.neonauth.c-8.eu-central-1.aws.neon.tech/zuerst/auth';
const reads = new Set(['get-session', 'token']);
const writes = new Set(['sign-in/email', 'sign-up/email', 'sign-out', 'request-password-reset', 'reset-password']);

export default async function handler(request: Request, response: ServerResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Vary', 'Cookie, Origin');
  const url = new URL(request.url ?? '/', origin);
  const path = request.query?.path ?? url.searchParams.get('path');
  const post = request.method === 'POST';
  if (typeof path !== 'string' || !(post ? writes : reads).has(path) || !['GET', 'POST'].includes(request.method ?? '')) {
    response.statusCode = 404; response.end('{"code":"NOT_FOUND"}'); return;
  }
  if (post && (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json'))) {
    response.statusCode = 403; response.end('{"code":"FORBIDDEN"}'); return;
  }
  try {
    let body: string | undefined;
    if (post) {
      if (request.body !== undefined) body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      else {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += Buffer.byteLength(chunk); if (size > 16384) throw new Error('body-limit'); chunks.push(Buffer.from(chunk)); }
        body = Buffer.concat(chunks).toString('utf8');
      }
      if (!body || Buffer.byteLength(body) > 16384 || typeof JSON.parse(body) !== 'object') {
        response.statusCode = 400; response.end('{"code":"INVALID_BODY"}'); return;
      }
    }
    const cookie = request.headers.cookie?.split(';').map(c => c.trim()).filter(c => c.startsWith('__Secure-neon-auth.session_token=')).join('; ');
    const headers: Record<string, string> = { Origin: origin, Accept: 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (post) headers['Content-Type'] = 'application/json';
    const result = await fetch(`${upstream}/${path}`, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const cookies = result.headers.getSetCookie().filter(c => c.startsWith('__Secure-neon-auth.session_token='))
      .map(c => c.replace(/;\s*Domain=[^;]+/gi, '').replace(/SameSite=None/gi, 'SameSite=Lax'));
    if (cookies.length) response.setHeader('Set-Cookie', cookies);
    response.statusCode = result.status;
    response.end(await result.text());
  } catch {
    response.statusCode = 503; response.end('{"code":"SERVICE_UNAVAILABLE"}');
  }
}
