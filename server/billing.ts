import Stripe from 'stripe';
import pg from 'pg';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { plans, billingTermsVersion, subscriptionAccess, paymentAccess, chooseEntitlement, cancellationState, type Entitlement, type Plan } from '../lib/billing-policy.ts';

export const appOrigin = 'https://zuerst.vercel.app';
const authOrigin = 'https://ep-rapid-tooth-bav9j8t9.neonauth.c-8.eu-central-1.aws.neon.tech/zuerst/auth';
export class BillingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function configuration() {
  const mode = process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
  const prefix = mode === 'live' ? 'STRIPE_LIVE_' : 'STRIPE_TEST_';
  const key = process.env[prefix + 'SECRET_KEY'];
  const database = process.env.BILLING_DATABASE_URL;
  if (!key || !database) throw new BillingError(503, 'Die Zahlungsanbindung wird eingerichtet. Deine Gratisversion bleibt verfügbar.');
  if (!new RegExp(`^[sr]k_${mode}_`).test(key)) throw new BillingError(503, 'Die Zahlungsumgebung ist nicht bereit.');
  const prices = { month: process.env[prefix+'PRICE_MONTH'], year: process.env[prefix+'PRICE_YEAR'], lifetime: process.env[prefix+'PRICE_LIFETIME'] };
  if (Object.values(prices).some(p=>!p) || !process.env[prefix+'WEBHOOK_SECRET'] || !process.env[prefix+'PORTAL_CONFIGURATION']) throw new BillingError(503, 'Die Zahlungsanbindung ist noch nicht vollständig eingerichtet.');
  if (mode === 'live' && process.env.BILLING_LIVE_APPROVED !== 'true') throw new BillingError(503, 'Plus-Käufe sind noch nicht freigegeben.');
  return { mode, prefix, key, database, prices, webhook:process.env[prefix+'WEBHOOK_SECRET'], portal:process.env[prefix+'PORTAL_CONFIGURATION'] } as const;
}
export function stripeClient() {
  const config = configuration();
  return new Stripe(config.key, { maxNetworkRetries: 2, timeout: 15000 });
}
let pool: pg.Pool | undefined;
function database() {
  const url = new URL(configuration().database);
  url.searchParams.set('sslmode','verify-full');
  return pool ??= new pg.Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
}
export async function userFromRequest(request: IncomingMessage): Promise<{id:string;email:string}> {
  const cookie = request.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('__Secure-neon-auth.session_token='));
  if (!cookie) throw new BillingError(401, 'Melde dich für Plus in deinem Zuerst-Konto an.');
  const response = await fetch(authOrigin+'/get-session', {headers:{Cookie:cookie,Origin:appOrigin,Accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!response.ok) throw new BillingError(response.status >= 500 ? 503 : 401, 'Deine Sitzung konnte nicht bestätigt werden. Bitte melde dich erneut an.');
  const data = await response.json() as {user?:{id?:unknown;email?:unknown}};
  if (typeof data.user?.id !== 'string' || typeof data.user?.email !== 'string') throw new BillingError(401, 'Bitte melde dich erneut an.');
  return {id:data.user.id,email:data.user.email};
}
export async function transaction<T>(identity: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('statement_timeout','30000',true)");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[identity]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function paymentPaid(stripe: Stripe, paymentId: string | null): Promise<boolean> {
  if (!paymentId) return false;
  const payment = await stripe.paymentIntents.retrieve(paymentId,{expand:['latest_charge']});
  const charge = typeof payment.latest_charge === 'object' ? payment.latest_charge : null;
  if (!charge) return false;
  const disputes = await stripe.disputes.list({payment_intent:paymentId,limit:100});
  const disputed = disputes.data.some(d=>d.status !== 'won' && d.status !== 'warning_closed');
  return paymentAccess(payment.status,charge.amount,charge.amount_refunded,disputed);
}
const objectId = (value: string | {id:string} | null) => typeof value === 'string' ? value : value?.id ?? null;
export async function refresh(client: pg.PoolClient, stripe: Stripe, userId: string): Promise<Entitlement> {
  const {mode,prices} = configuration();
  const rows = await client.query<{session_id:string;plan:Plan}>('SELECT session_id,plan FROM billing.checkouts WHERE mode=$1 AND user_id=$2 ORDER BY created_at DESC',[mode,userId]);
  const entries: Entitlement[] = [];
  for (const row of rows.rows) {
    const session = await stripe.checkout.sessions.retrieve(row.session_id);
    if (session.livemode !== (mode === 'live')) throw new BillingError(503,'Falsche Zahlungsumgebung.');
    if (session.status !== 'complete') continue;
    const items = await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
    if (items.data.length !== 1 || items.data[0].price?.id !== prices[row.plan] || items.data[0].quantity !== 1) continue;
    if (row.plan === 'lifetime') {
      const paid = session.payment_status === 'paid' && await paymentPaid(stripe,objectId(session.payment_intent));
      entries.push({plus:paid,plan:'lifetime',status:paid?'paid':'unpaid_or_refunded',until:null,cancelAtPeriodEnd:false,mode});
    } else if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(objectId(session.subscription)!,{expand:['latest_invoice']});
      const matching = subscription.items.data.filter(item=>Object.values(prices).includes(item.price.id));
      const cancellation = cancellationState(matching.map(item=>item.current_period_end),subscription.cancel_at,subscription.cancel_at_period_end);
      const until = cancellation.until;
      const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
      let paid = false;
      if (invoice?.status === 'paid' && invoice.amount_remaining === 0 && invoice.amount_due === 0 && invoice.amount_paid === 0) paid = true;
      if (invoice?.status === 'paid' && invoice.amount_remaining === 0 && invoice.amount_paid > 0) {
        const payments = await stripe.invoicePayments.list({invoice:invoice.id,limit:100});
        for (const entry of payments.data) if (entry.status === 'paid' && entry.payment.type === 'payment_intent') paid ||= await paymentPaid(stripe,objectId(entry.payment.payment_intent ?? null));
      }
      const plan = matching[0]?.price.id === prices.year ? 'year' : 'month';
      entries.push({plus:subscriptionAccess(subscription.status,paid,until),plan,status:subscription.status,until,cancelAtPeriodEnd:cancellation.cancelAtPeriodEnd,mode});
    }
  }
  const result = chooseEntitlement(entries,mode);
  await client.query('UPDATE billing.accounts SET entitlement=$3::jsonb,updated_at=now() WHERE mode=$1 AND user_id=$2',[mode,userId,JSON.stringify(result)]);
  return result;
}
export async function customer(client: pg.PoolClient, stripe: Stripe, user: {id:string;email:string}): Promise<string> {
  const {mode} = configuration();
  const saved = await client.query<{customer_id:string}>('SELECT customer_id FROM billing.accounts WHERE mode=$1 AND user_id=$2',[mode,user.id]);
  if (saved.rows[0]) return saved.rows[0].customer_id;
  const key = createHash('sha256').update(mode+':'+user.id).digest('hex');
  const created = await stripe.customers.create({email:user.email,metadata:{app:'zuerst',user_id:user.id}},{idempotencyKey:'zuerst-customer-'+key});
  await client.query('INSERT INTO billing.accounts(mode,user_id,customer_id) VALUES($1,$2,$3)',[mode,user.id,created.id]);
  return created.id;
}
export async function checkout(user: {id:string;email:string}, plan: Plan, requestId: string, termsVersion: string) {
  if (termsVersion !== billingTermsVersion) throw new BillingError(400,'Bitte bestätige die aktuellen Kaufbedingungen.');
  const config = configuration();
  const stripe = stripeClient();
  return transaction(config.mode+':'+user.id, async client=>{
    const customerId = await customer(client,stripe,user);
    const entitlement = await refresh(client,stripe,user.id);
    if (entitlement.plus) throw new BillingError(409,'Du hast bereits Plus. Verwalte deinen Tarif im Kundenportal.');
    const attempt = await client.query<{session_id:string;plan:Plan}>('SELECT session_id,plan FROM billing.checkouts WHERE mode=$1 AND user_id=$2 AND request_id=$3',[config.mode,user.id,requestId]);
    if (attempt.rows[0]) {
      if (attempt.rows[0].plan !== plan) throw new BillingError(409,'Dieser Zahlungsversuch gehört zu einem anderen Tarif. Starte eine neue Auswahl.');
      const session = await stripe.checkout.sessions.retrieve(attempt.rows[0].session_id);
      if (session.status === 'open' && session.url) return {url:session.url,mode:config.mode};
      throw new BillingError(409,session.status === 'expired' ? 'Dieser Zahlungsversuch ist abgelaufen. Wähle den Tarif erneut.' : 'Dieser Zahlungsversuch wurde bereits abgeschlossen. Aktualisiere deinen Zahlungsstatus.');
    }
    const pending = await client.query<{session_id:string;plan:Plan}>('SELECT session_id,plan FROM billing.checkouts WHERE mode=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10',[config.mode,user.id]);
    for (const row of pending.rows) {
      const session = await stripe.checkout.sessions.retrieve(row.session_id);
      if (session.status === 'open' && session.url) {
        if (row.plan === plan) return {url:session.url,mode:config.mode};
        await stripe.checkout.sessions.expire(session.id);
      }
      if (session.status === 'complete' && session.payment_status === 'unpaid') {
        const payment = session.payment_intent ? await stripe.paymentIntents.retrieve(objectId(session.payment_intent)!) : null;
        const subscription = session.subscription ? await stripe.subscriptions.retrieve(objectId(session.subscription)!) : null;
        if (payment?.status === 'processing' || payment?.status === 'requires_action' || subscription?.status === 'incomplete') throw new BillingError(409,'Deine Zahlung wird noch verarbeitet oder benötigt eine Bestätigung. Prüfe den Zahlungsstatus oder das Kundenportal.');
      }
    }
    const priceId = config.prices[plan]!;
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.livemode !== (config.mode==='live') || price.currency !== 'eur' || price.unit_amount !== plans[plan].cents || (price.recurring?.interval??null) !== plans[plan].interval || (price.recurring?.interval_count??1) !== 1 || price.tax_behavior !== 'inclusive') throw new BillingError(503,'Der Preis konnte nicht bestätigt werden.');
    const key = createHash('sha256').update(config.mode+':'+user.id+':'+requestId).digest('hex');
    const session = await stripe.checkout.sessions.create({
      mode:plan === 'lifetime' ? 'payment' : 'subscription',customer:customerId,
      managed_payments:{enabled:false},
      line_items:[{price:priceId,quantity:1}],client_reference_id:user.id,
      metadata:{app:'zuerst',plan,user_id:user.id},
      ...(plan === 'lifetime' ? {payment_intent_data:{metadata:{app:'zuerst',plan,user_id:user.id}}} : {subscription_data:{billing_mode:{type:'flexible' as const},metadata:{app:'zuerst',user_id:user.id}}}),
      integration_identifier:'zuerst-hosted-qmtnvcrs',
      success_url:appOrigin+'/?tab=plus&checkout=returned',cancel_url:appOrigin+'/?tab=plus&checkout=canceled',
    },{idempotencyKey:'zuerst-checkout-'+key});
    await client.query('INSERT INTO billing.checkouts(mode,user_id,session_id,request_id,plan,terms_version,adult_confirmed_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT DO NOTHING',[config.mode,user.id,session.id,requestId,plan,termsVersion]);
    return {url:session.url,mode:config.mode};
  });
}
export async function processEvent(event: Stripe.Event) {
  const config=configuration();
  if (event.livemode !== (config.mode==='live')) throw new BillingError(400,'Falsche Zahlungsumgebung.');
  const stripe=stripeClient();
  const object=event.data.object as unknown as {customer?:string|{id:string};payment_intent?:string;id:string;object:string;charge?:string};
  let customerId=objectId(object.customer??null);
  if (!customerId && object.payment_intent) customerId=objectId((await stripe.paymentIntents.retrieve(object.payment_intent)).customer);
  if (!customerId && object.object==='dispute' && object.charge) customerId=objectId((await stripe.charges.retrieve(object.charge)).customer);
  if (!customerId) return;
  const mapping=await database().query<{user_id:string}>('SELECT user_id FROM billing.accounts WHERE mode=$1 AND customer_id=$2',[config.mode,customerId]);
  const userId=mapping.rows[0]?.user_id;
  if (!userId) return;
  await transaction(config.mode+':'+userId,async client=>{
    const existing=await client.query('SELECT 1 FROM billing.events WHERE mode=$1 AND event_id=$2',[config.mode,event.id]);
    if (existing.rowCount) return;
    await refresh(client,stripe,userId);
    await client.query('INSERT INTO billing.events(mode,event_id) VALUES($1,$2)',[config.mode,event.id]);
  });
}
