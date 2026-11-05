import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plans,isPlan,subscriptionAccess,paymentAccess,chooseEntitlement,cancellationState,type Entitlement} from './billing-policy.ts';
test('Plus-Preise werden ausschließlich serverseitig aus der erlaubten Tarifliste gewählt',()=>{
  assert.deepEqual(Object.values(plans).map(p=>p.cents),[100,500,1000]);
  for(const invalid of ['__proto__','constructor','price_custom',100,null])assert.equal(isPlan(invalid),false);
});
test('Unbezahlt, Zahlungsverzug und abgelaufene Perioden gewähren kein Abo',()=>{
  assert.equal(subscriptionAccess('active',true,200,100),true);
  assert.equal(subscriptionAccess('active',false,200,100),false);
  for(const status of ['past_due','canceled','unpaid','incomplete','trialing'])assert.equal(subscriptionAccess(status,true,200,100),false);
  assert.equal(subscriptionAccess('active',true,99,100),false);
});
test('Vollerstattung und offene Disputes widerrufen bezahlten Zugang',()=>{
  assert.equal(paymentAccess('succeeded',1000,0,false),true);
  assert.equal(paymentAccess('succeeded',1000,1000,false),false);
  assert.equal(paymentAccess('succeeded',1000,0,true),false);
  assert.equal(paymentAccess('processing',1000,0,false),false);
});
test('Lifetime bleibt unabhängig von einem später gekündigten Abo aktiv',()=>{
  const lifetime:Entitlement={plus:true,plan:'lifetime',status:'paid',until:null,cancelAtPeriodEnd:false,mode:'test'};
  assert.equal(chooseEntitlement([{...lifetime,plus:false,plan:'month',status:'canceled'},lifetime],'test'),lifetime);
});
test('Sandbox-Zahlungen können niemals Live-Zugang gewähren',()=>{
  const testAccess:Entitlement={plus:true,plan:'lifetime',status:'paid',until:null,cancelAtPeriodEnd:false,mode:'test'};
  assert.equal(chooseEntitlement([testAccess],'live').plus,false);
  assert.equal(chooseEntitlement([testAccess],'live').mode,'live');
});
test('Flexible-Billing-Kündigung über cancel_at behält Zugang nur bis zum effektiven Ende',()=>{
  const result=cancellationState([300],200,false);
  assert.deepEqual(result,{until:200,cancelAtPeriodEnd:true});
  assert.equal(subscriptionAccess('active',true,result.until,199),true);
  assert.equal(subscriptionAccess('active',true,result.until,200),false);
  assert.deepEqual(cancellationState([300],null,false),{until:300,cancelAtPeriodEnd:false});
});
