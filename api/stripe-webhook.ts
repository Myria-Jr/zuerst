import type { IncomingMessage, ServerResponse } from 'node:http';
import { BillingError, configuration, stripeClient, processEvent } from '../server/billing.js';
export const config={api:{bodyParser:false}};
export default async function handler(request:IncomingMessage,response:ServerResponse) {
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST'){response.statusCode=405;response.end();return;}
  const signature=request.headers['stripe-signature'];
  if(typeof signature!=='string'){response.statusCode=400;response.end();return;}
  try {
    const settings=configuration();
    if(!settings.webhook)throw new BillingError(503,'Webhook nicht eingerichtet.');
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size>1024*1024)throw new BillingError(413,'Payload zu groß.');chunks.push(Buffer.from(chunk));}
    let event;
    try{event=stripeClient().webhooks.constructEvent(Buffer.concat(chunks),signature,settings.webhook);}catch{throw new BillingError(400,'Ungültige Signatur.');}
    await processEvent(event);
    response.statusCode=200;response.end('{"received":true}');
  } catch(error) {response.statusCode=error instanceof BillingError?error.status:503;response.end('{"received":false}');}
}
