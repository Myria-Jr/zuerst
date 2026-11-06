import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createServer } from 'node:http';
import webhookHandler from '../api/stripe-webhook.ts';
import { checkout, configuration, refresh, stripeClient, transaction, processEvent } from './billing.ts';
import { isPlan, billingTermsVersion } from '../lib/billing-policy.ts';

// Test harness: configuration arrives over stdin and is never written to disk.
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const input=createInterface({input:process.stdin,terminal:false});
console.log('{"waitingForSandboxConfiguration":true}');
const users=new Map<string,{id:string;email:string}>();
let configured=false;
for await(const line of input){
  try {
    const command=JSON.parse(line) as Record<string,unknown>;
    if(!configured){
      if(command.mode!=='test'||typeof command.key!=='string'||!new RegExp('^[sr]k_test_').test(command.key)||typeof command.database!=='string'||typeof command.webhook!=='string')throw new Error('Sandbox configuration required');
      Object.assign(process.env,{STRIPE_MODE:'test',STRIPE_TEST_SECRET_KEY:command.key,BILLING_DATABASE_URL:command.database,STRIPE_TEST_WEBHOOK_SECRET:command.webhook,STRIPE_TEST_PORTAL_CONFIGURATION:'bpc_1UYTMZGSP0oME5o8U1BImheI',STRIPE_TEST_PRICE_MONTH:'price_1UYTK1GSP0oME5o8Y9YWUrRr',STRIPE_TEST_PRICE_YEAR:'price_1UYTKeGSP0oME5o8OkzSjmrS',STRIPE_TEST_PRICE_LIFETIME:'price_1UYTL1GSP0oME5o8RfIcvQsy'});
      configured=true;console.log(JSON.stringify({ready:true,mode:configuration().mode}));continue;
    }
    const name=typeof command.user==='string'?command.user:'default';
    if(typeof command.userId==='string' && command.userId.startsWith('zuerst-sandbox-qa-'))users.set(name,{id:command.userId,email:'zuerst-sandbox-qa@example.invalid'});
    if(!users.has(name))users.set(name,{id:'zuerst-sandbox-qa-'+randomUUID(),email:'zuerst-sandbox-qa@example.invalid'});
    const user=users.get(name)!;
    if(command.op==='checkout'){
      if(!isPlan(command.plan))throw new Error('Invalid plan');
      const result=await checkout(user,command.plan,typeof command.requestId==='string'?command.requestId:randomUUID(),billingTermsVersion);
      console.log(JSON.stringify({user:name,userId:user.id,...result}));
    }else if(command.op==='verify'){
      const result=await transaction('test:'+user.id,client=>refresh(client,stripeClient(),user.id));
      console.log(JSON.stringify({user:name,...result}));
    }else if(command.op==='webhook-tests'){
      if(typeof command.sessionId!=='string'||!command.sessionId.startsWith('cs_test_'))throw new Error('Test session required');
      const stripe=stripeClient();
      const events=await stripe.events.list({type:'checkout.session.completed',limit:100});
      const event=events.data.find(e=>(e.data.object as {id:string}).id===command.sessionId);
      if(!event)throw new Error('Matching real sandbox event not found');
      const payload=JSON.stringify(event),secret=process.env.STRIPE_TEST_WEBHOOK_SECRET!;
      const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
      const server=createServer(webhookHandler);
      await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
      const address=server.address();if(!address||typeof address!=='object')throw new Error('No local server');
      const endpoint=`http://127.0.0.1:${address.port}`;
      try{
        const send=(body:string,header:string)=>fetch(endpoint,{method:'POST',headers:{'stripe-signature':header,'Content-Type':'application/json'},body});
        const responses=await Promise.all([send(payload,signature),send(payload,signature)]);
        const invalid=await send(payload+' ',signature);
        const wrongMode=JSON.stringify({...event,livemode:true});
        const mismatch=await send(wrongMode,stripe.webhooks.generateTestHeaderString({payload:wrongMode,secret}));
        const count=await transaction('test:'+user.id,client=>client.query('SELECT count(*)::int AS count FROM billing.events WHERE mode=$1 AND event_id=$2',['test',event.id]));
        console.log(JSON.stringify({eventId:event.id,duplicateStatuses:responses.map(r=>r.status),deduplicatedRows:count.rows[0].count,tamperedStatus:invalid.status,wrongModeStatus:mismatch.status}));
      }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
    }else if(command.op==='signature'){
      const payload=JSON.stringify({id:'evt_fixture_'+randomUUID(),object:'event',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_fixture',object:'checkout.session',customer:null}}});
      const stripe=stripeClient();const secret=process.env.STRIPE_TEST_WEBHOOK_SECRET!;
      const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
      const event=stripe.webhooks.constructEvent(payload,signature,secret);
      await processEvent(event);
      let rejected=false;try{stripe.webhooks.constructEvent(payload+' ',signature,secret);}catch{rejected=true;}
      console.log(JSON.stringify({validSignatureAccepted:true,tamperedSignatureRejected:rejected}));
    }else if(command.op==='exit'){console.log('{"stopped":true}');process.exit(0);}
    else throw new Error('Unsupported sandbox command');
  }catch(error){
    console.log(JSON.stringify({error:error instanceof Stripe.errors.StripeError?{type:error.type,code:error.code,param:error.param,message:error.message.replace(/[sr]k_(test|live)_[A-Za-z\d]+|whsec_[A-Za-z\d]+/g,'[REDACTED]')}:error instanceof Error?{type:error.name,message:error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED]')}:{type:'unknown'}}));
  }
}
