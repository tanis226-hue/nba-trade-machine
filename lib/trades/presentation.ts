/** Explicit locale keeps saved and server-rendered summaries consistent. */
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export const exactMoney = (amount: number) => currency.format(amount).replace(/\.00$/, '');
export const compactMoney = (amount: number) => Math.abs(amount) < 100_000 ? exactMoney(amount) : `$${(amount / 1_000_000).toFixed(1)}M`;
export const signedMoney = (amount: number) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${compactMoney(Math.abs(amount))}`;
export const signedExactMoney = (amount: number) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${exactMoney(Math.abs(amount))}`;
export const distanceToLine = (room: number, exact = false) => room === 0 ? 'At the line' : `${(exact ? exactMoney : compactMoney)(Math.abs(room))} ${room < 0 ? 'over' : 'under'}`;
