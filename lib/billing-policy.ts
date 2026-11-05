export const plans = {
  month: { cents: 100, interval: 'month', label: '1 € / Monat' },
  year: { cents: 500, interval: 'year', label: '5 € / Jahr' },
  lifetime: { cents: 1000, interval: null, label: '10 € einmalig' },
} as const;
export type Plan = keyof typeof plans;
export const billingTermsVersion = '2026-11-05.1';
export type Entitlement = { plus: boolean; plan: Plan | null; status: string; until: number | null; cancelAtPeriodEnd: boolean; mode: 'test' | 'live' };
export const isPlan = (value: unknown): value is Plan => typeof value === 'string' && Object.hasOwn(plans, value);
export function subscriptionAccess(status: string, paid: boolean, until: number, now = Date.now() / 1000): boolean {
  return status === 'active' && paid && Number.isFinite(until) && until > now;
}
export function paymentAccess(status: string, amount: number, refunded: number, disputed: boolean): boolean {
  return status === 'succeeded' && amount > 0 && refunded < amount && !disputed;
}
export function chooseEntitlement(entries: Entitlement[], mode: 'test' | 'live'): Entitlement {
  const scoped=entries.filter(entry=>entry.mode===mode);
  return scoped.find(e => e.plus && e.plan === 'lifetime') ?? scoped.filter(e => e.plus).sort((a,b)=>(b.until??0)-(a.until??0))[0] ?? scoped[0] ?? {plus:false,plan:null,status:'free',until:null,cancelAtPeriodEnd:false,mode};
}
export function cancellationState(periodEnds:number[],cancelAt:number|null,cancelAtPeriodEnd:boolean) {
  return {until:periodEnds.length?Math.min(...periodEnds,cancelAt??Infinity):0,cancelAtPeriodEnd:cancelAtPeriodEnd||cancelAt!==null};
}
