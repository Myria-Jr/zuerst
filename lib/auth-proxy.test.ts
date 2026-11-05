import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import handler from '../api/auth.ts';

test('Auth-Proxy sperrt fremde Origins und begrenzt Weiterleitung und Sitzungscookies', async () => {
  const fetchOriginal = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://ep-rapid-tooth-')) {
      upstreamCalls++;
      const headers = options?.headers as Record<string,string>;
      assert.equal(headers.Origin, 'https://zuerst.vercel.app');
      assert.equal(headers.Cookie, '__Secure-neon-auth.session_token=fixture');
      assert.equal(headers.Host, undefined);
      return new Response('{"user":{"id":"fixture"}}', { headers: { 'Set-Cookie': '__Secure-neon-auth.session_token=fixture; Path=/; HttpOnly; Secure; SameSite=None' } });
    }
    return fetchOriginal(input, options);
  };
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/?path=`;
  try {
    const forbidden = await fetch(base+'sign-out', { method:'POST', headers: { Origin:'https://evil.example', 'Content-Type':'application/json' }, body:'{}' });
    assert.equal(forbidden.status,403); assert.equal(upstreamCalls,0);
    assert.equal((await fetch(base+'unrestricted-endpoint')).status,404);
    const response = await fetch(base+'get-session', { headers: { Cookie:'other=private; __Secure-neon-auth.session_token=fixture' } });
    assert.equal(response.status,200); assert.equal(upstreamCalls,1);
    assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.match(response.headers.get('set-cookie')!, /HttpOnly; Secure; SameSite=Lax/);
  } finally {
    globalThis.fetch = fetchOriginal;
    server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
