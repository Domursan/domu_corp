// Calculs partagés : comptabilité, plafond de facturation, répétitions d'agenda.
import { state } from './state.js';
import { toISODate, todayISO } from './ui.js';

const S = () => state.settings;
const num = (v) => Number(v || 0);

export const isBalanceOnly = (cat) => !!cat && (S().lists.balanceOnlyCategories || []).map(x => x.toLowerCase()).includes(String(cat).toLowerCase());

/** Totaux : les catégories « solde uniquement » ne comptent que dans le solde. */
export function totals(rows, opening = 0) {
  let inc = 0, exp = 0, bal = num(opening);
  for (const t of rows) {
    const a = num(t.amount);
    bal += t.kind === 'recette' ? a : -a;
    if (isBalanceOnly(t.category)) continue;
    if (t.kind === 'recette') inc += a; else exp += a;
  }
  return { inc, exp, result: inc - exp, balance: bal };
}

export function billingPeriod() {
  const b = S().billing;
  const days = Math.max(1, num(b.days) || 14);
  const today = new Date(todayISO() + 'T12:00:00');
  let start;
  if (b.mode === 'fixe' && b.start) {
    const s0 = new Date(b.start + 'T12:00:00');
    const k = Math.floor((today - s0) / 864e5 / days);
    start = new Date(s0.getTime() + k * days * 864e5);
  } else start = new Date(today.getTime() - (days - 1) * 864e5);
  const end = new Date(start.getTime() + (days - 1) * 864e5);
  return { start: toISODate(start), end: toISODate(end), days, mode: b.mode };
}
export function contactBilling(c, tx) {
  const cap = c.cap != null && c.cap !== '' ? num(c.cap) : num(S().billing.cap);
  if (!cap) return null;
  const p = billingPeriod();
  const done = tx.filter(t => t.kind === 'recette' && !isBalanceOnly(t.category) && t.contact_id === c.id && t.date >= p.start && t.date <= p.end)
    .reduce((a, t) => a + num(t.amount), 0);
  return { cap, done, pct: Math.min(100, (done / cap) * 100), over: done > cap, period: p };
}

export function expandOccurrences(ev, from, to) {
  const out = [];
  const start = new Date(ev.starts_at);
  const dur = ev.ends_at ? Math.max(0, new Date(ev.ends_at) - start) : 0;
  const until = ev.recurrence_until ? new Date(ev.recurrence_until + 'T23:59:59') : null;
  const at = (i) => {
    const x = new Date(start);
    if (ev.recurrence === 'weekly') x.setDate(x.getDate() + 7 * i);
    else if (ev.recurrence === 'biweekly') x.setDate(x.getDate() + 14 * i);
    else if (ev.recurrence === 'monthly') x.setMonth(x.getMonth() + i);
    else if (ev.recurrence === 'daily') x.setDate(x.getDate() + i);
    return x;
  };
  if (!ev.recurrence || ev.recurrence === 'none') {
    if (start < to && new Date(start.getTime() + dur) >= from) out.push({ start, end: new Date(start.getTime() + dur) });
    return out;
  }
  for (let i = 0; i < 2000; i++) {
    const s = at(i);
    if (s >= to || (until && s > until)) break;
    const e = new Date(s.getTime() + dur);
    if (e >= from) out.push({ start: s, end: e });
  }
  return out;
}
