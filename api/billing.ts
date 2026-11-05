import type { IncomingMessage, ServerResponse } from 'node:http';
import { isPlan, billingTermsVersion } from '../lib/billing-policy.ts';
import { appOrigin, BillingError, configuration, userFromRequest, transaction, refresh, checkout, stripeClient } from '../server/billing.ts';
type Request=IncomingMessage & {body?:unknown;query?:Record<string,string|string[]>};
export default async function handler(request:Request,response:ServerResponse) {
  response.setHeader('Content-Type','application/json; charset=utf-8');response.setHeader('Cache-Control','private, no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Vary','Cookie, Origin');
  try {
    const action=request.query?.action ?? new URL(request.url??'/',appOrigin).searchParams.get('action');
    if (!['GET','POST'].includes(request.method??'')) throw new BillingError(405,'Methode nicht erlaubt.');
    if (request.method==='POST' && (request.headers.origin!==appOrigin || !request.headers['content-type']?.startsWith('application/json'))) throw new BillingError(403,'Anfrage nicht erlaubt.');
    if (action==='status' && request.method==='GET') {
      try {const config=configuration();response.end(JSON.stringify({ready:true,mode:config.mode,termsVersion:billingTermsVersion}));} catch {response.end(JSON.stringify({ready:false,mode:process.env.STRIPE_MODE==='live'?'live':'test',termsVersion:billingTermsVersion}));} return;
    }
    if (action!=='entitlement' && action!=='checkout' && action!=='portal') throw new BillingError(404,'Nicht gefunden.');
    const user=await userFromRequest(request);
    const config=configuration();
    if (action==='entitlement' && request.method==='GET') {
      const result=await transaction(config.mode+':'+user.id,async client=>{
        const mapping=await client.query('SELECT 1 FROM billing.accounts WHERE mode=$1 AND user_id=$2',[config.mode,user.id]);
        return mapping.rowCount ? refresh(client,stripeClient(),user.id) : {plus:false,plan:null,status:'free',until:null,cancelAtPeriodEnd:false,mode:config.mode};
      });
      response.end(JSON.stringify(result));return;
    }
    if (request.method!=='POST') throw new BillingError(405,'Methode nicht erlaubt.');
    let body:unknown=request.body;
    if (body===undefined) {const chunks:Buffer[]=[];let size=0;for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size>2048)throw new BillingError(413,'Anfrage zu groß.');chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks).toString('utf8');}
    if(typeof body==='string'){if(Buffer.byteLength(body)>2048)throw new BillingError(413,'Anfrage zu groß.');try{body=JSON.parse(body);}catch{throw new BillingError(400,'Ungültige Anfrage.');}}
    if(body && Buffer.byteLength(JSON.stringify(body))>2048)throw new BillingError(413,'Anfrage zu groß.');
    if(action==='checkout') {
      const input=body as {plan?:unknown;requestId?:unknown;adultConfirmed?:unknown;termsVersion?:unknown};
      if(!input||!isPlan(input.plan)||typeof input.requestId!=='string'||!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(input.requestId))throw new BillingError(400,'Bitte wähle einen gültigen Tarif.');
      if(input.adultConfirmed!==true)throw new BillingError(403,'Plus-Käufe sind ab 18 Jahren möglich. Bitte bestätige deine Volljährigkeit.');
      if(input.termsVersion!==billingTermsVersion)throw new BillingError(400,'Bitte bestätige die aktuellen Kaufbedingungen.');
      response.end(JSON.stringify(await checkout(user,input.plan,input.requestId,input.termsVersion)));return;
    }
    const stripe=stripeClient();
    const result=await transaction(config.mode+':'+user.id,async client=>{
      const saved=await client.query<{customer_id:string}>('SELECT customer_id FROM billing.accounts WHERE mode=$1 AND user_id=$2',[config.mode,user.id]);
      if(!saved.rows[0])throw new BillingError(409,'Für dein Konto gibt es noch keinen Plus-Kauf.');
      return stripe.billingPortal.sessions.create({customer:saved.rows[0].customer_id,configuration:config.portal,return_url:appOrigin+'/?tab=plus'});
    });
    response.end(JSON.stringify({url:result.url}));
  } catch(error) {
    response.statusCode=error instanceof BillingError?error.status:503;
    response.end(JSON.stringify({error:error instanceof BillingError?error.message:'Die Zahlungsanbindung ist gerade nicht erreichbar. Versuche es später erneut.'}));
  }
}
