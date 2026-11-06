import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import handler from '../api/billing.ts';
import webhook from '../api/stripe-webhook.ts';
import { configuration, userFromRequest } from './billing.ts';
import type { IncomingMessage } from 'node:http';

test('Billing-Endpunkte verweigern fremde Origins und unauthentifizierte Kontozugriffe', async () => {
  const server = createServer((request, response) => request.url?.startsWith('/webhook') ? webhook(request,response) : handler(request,response));
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const action of ['checkout','portal']) {
      const response = await fetch(`${base}/?action=${action}`, {method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,403);
      assert.deepEqual(Object.keys(await response.json()),['error']);
    }
    const entitlement = await fetch(base+'/?action=entitlement');
    assert.equal(entitlement.status,401);
    assert.match(entitlement.headers.get('cache-control')!,/no-store/);
    assert.equal((await fetch(base+'/?action=checkout',{method:'PUT'})).status,405);
    assert.equal((await fetch(base+'/?action=not-public')).status,404);
    assert.equal((await fetch(base+'/webhook',{method:'POST',body:'{}'})).status,400);
    assert.equal((await fetch(base+'/webhook')).status,405);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});

test('Neon-Identität stammt nur aus der bestätigten Sitzung; fremde Cookies werden nicht weitergeleitet',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async(input,options)=>{
      assert.match(String(input),/\/auth\/get-session$/);
      assert.equal((options?.headers as Record<string,string>).Cookie,'__Secure-neon-auth.session_token=fixture');
      return new Response(JSON.stringify({user:{id:'verified-user',email:'billing-fixture@example.invalid'}}));
    };
    const result=await userFromRequest({headers:{cookie:'secret=unrelated; __Secure-neon-auth.session_token=fixture'}} as IncomingMessage);
    assert.equal(result.id,'verified-user');
    globalThis.fetch=async()=>new Response('{}');
    await assert.rejects(()=>userFromRequest({headers:{cookie:'__Secure-neon-auth.session_token=fixture'}} as IncomingMessage),/erneut an/);
    globalThis.fetch=async()=>new Response('{}',{status:401});
    await assert.rejects(()=>userFromRequest({headers:{cookie:'__Secure-neon-auth.session_token=fixture'}} as IncomingMessage),/erneut an/);
  }finally{globalThis.fetch=original;}
});

test('Live-Konfiguration bleibt ohne ausdrückliches Readiness-Gate gesperrt',()=>{
  const saved={...process.env};
  try {
    process.env.STRIPE_MODE='live';
    process.env.STRIPE_LIVE_SECRET_KEY='rk_live_fixture';
    process.env.BILLING_DATABASE_URL='postgresql://fixture.invalid/db';
    process.env.STRIPE_LIVE_PRICE_MONTH='price_fixture_month';
    process.env.STRIPE_LIVE_PRICE_YEAR='price_fixture_year';
    process.env.STRIPE_LIVE_PRICE_LIFETIME='price_fixture_lifetime';
    process.env.STRIPE_LIVE_WEBHOOK_SECRET='whsec_fixture';
    process.env.STRIPE_LIVE_PORTAL_CONFIGURATION='bpc_fixture';
    delete process.env.BILLING_LIVE_APPROVED;
    assert.throws(configuration,/nicht freigegeben/);
    process.env.STRIPE_LIVE_SECRET_KEY='rk_test_wrong_environment';
    assert.throws(configuration,/Zahlungsumgebung/);
  }finally{
    for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
    Object.assign(process.env,saved);
  }
});

test('Checkout verlangt explizite Volljährigkeit und aktuelle Kaufbedingungen vor jedem Stripe-Zugriff',async()=>{
  const saved={...process.env};
  const original=globalThis.fetch;
  Object.assign(process.env,{STRIPE_MODE:'test',STRIPE_TEST_SECRET_KEY:'rk_test_fixture',BILLING_DATABASE_URL:'postgresql://fixture.invalid/db',STRIPE_TEST_PRICE_MONTH:'price_month',STRIPE_TEST_PRICE_YEAR:'price_year',STRIPE_TEST_PRICE_LIFETIME:'price_lifetime',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',STRIPE_TEST_PORTAL_CONFIGURATION:'bpc_fixture'});
  globalThis.fetch=async(input,options)=>String(input).endsWith('/auth/get-session')?new Response(JSON.stringify({user:{id:'fixture',email:'fixture@example.invalid'}})):original(input,options);
  const server=createServer(handler);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');
  const endpoint=`http://127.0.0.1:${address.port}/?action=checkout`;
  const headers={Origin:'https://zuerst.vercel.app','Content-Type':'application/json',Cookie:'__Secure-neon-auth.session_token=fixture'};
  const input={plan:'month',requestId:'11111111-1111-4111-8111-111111111111'};
  try{
    const withoutAdult=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({...input,termsVersion:'2026-11-05.1'})});
    assert.equal(withoutAdult.status,403);
    const oldTerms=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({...input,adultConfirmed:true,termsVersion:'old'})});
    assert.equal(oldTerms.status,400);
    const invalidPlan=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({...input,plan:'__proto__',adultConfirmed:true,termsVersion:'2026-11-05.1'})});
    assert.equal(invalidPlan.status,400);
  }finally{
    globalThis.fetch=original;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
    for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
    Object.assign(process.env,saved);
  }
});
