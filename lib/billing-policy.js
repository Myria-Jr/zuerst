export const plans = {
    month: { cents: 100, interval: 'month', label: '1 € / Monat' },
    year: { cents: 500, interval: 'year', label: '5 € / Jahr' },
    lifetime: { cents: 1000, interval: null, label: '10 € einmalig' },
};
export const billingTermsVersion = '2026-11-05.1';
export const isPlan = (value) => typeof value === 'string' && Object.hasOwn(plans, value);
export function subscriptionAccess(status, paid, until, now = Date.now() / 1000) {
    return status === 'active' && paid && Number.isFinite(until) && until > now;
}
export function paymentAccess(status, amount, refunded, disputed) {
    return status === 'succeeded' && amount > 0 && refunded < amount && !disputed;
}
export function chooseEntitlement(entries, mode) {
    const scoped = entries.filter(entry => entry.mode === mode);
    return scoped.find(e => e.plus && e.plan === 'lifetime') ?? scoped.filter(e => e.plus).sort((a, b) => (b.until ?? 0) - (a.until ?? 0))[0] ?? scoped[0] ?? { plus: false, plan: null, status: 'free', until: null, cancelAtPeriodEnd: false, mode };
}
export function cancellationState(periodEnds, cancelAt, cancelAtPeriodEnd) {
    return { until: periodEnds.length ? Math.min(...periodEnds, cancelAt ?? Infinity) : 0, cancelAtPeriodEnd: cancelAtPeriodEnd || cancelAt !== null };
}
