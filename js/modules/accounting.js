import { list, insert, update, remove } from '../api.js';
import { L } from '../state.js';
import { esc, icon, money, fmtDate, formModal, confirmDialog, toast, toastError, emptyState, todayISO, downloadCSV } from '../ui.js';
import { totals, isBalanceOnly } from '../calc.js';

/** Formulaire d'écriture (aussi utilisé depuis les contacts). */
export async function editTransaction(ctx, t, defaults = {}) {
  const contacts = (ctx.p.modules || []).includes('contacts') ? await list('d_contacts', { project_id: ctx.pid }, { select: 'id,name', order: 'name' }) : [];
  const kind = t?.kind || defaults.kind || 'depense';
  const res = await formModal({
    title: t ? 'Modifier l’écriture' : kind === 'recette' ? 'Nouvelle recette' : 'Nouvelle dépense',
    values: t || { date: todayISO(), ...defaults, kind }, onDelete: !!t,
    fields: [
      { name: 'kind', label: 'Type', type: 'select', empty: false, options: [{ value: 'depense', label: '− Dépense' }, { value: 'recette', label: '+ Recette' }] },
      { name: 'amount', label: 'Montant', type: 'money', required: true, min: 0 },
      { name: 'label', label: 'Libellé', required: true, full: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'category', label: 'Catégorie', type: 'combo', options: () => [...new Set([...L().incomeCategories, ...L().expenseCategories])], help: `« Solde uniquement » : ${(L().balanceOnlyCategories || []).join(', ') || 'aucune'}` },
      contacts.length ? { name: 'contact_id', label: 'Contact / client', type: 'select', options: contacts.map(c => ({ value: c.id, label: c.name })) } : null,
      { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
    ].filter(Boolean),
  });
  if (!res) return false;
  try {
    if (res.__delete) { if (!(await confirmDialog(`Supprimer <b>${esc(t.label)}</b> (${money(t.amount)}) ?`))) return false; await remove('d_transactions', t.id); toast('Écriture supprimée'); }
    else if (t) await update('d_transactions', t.id, res);
    else await insert('d_transactions', { ...res, project_id: ctx.pid });
    return true;
  } catch (e) { toastError(e); return false; }
}

let period = 'month';
let cursor = todayISO().slice(0, 7);
let kindFilter = '';
let catFilter = '';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default async function render(ctx) {
  const { el, pid } = ctx;
  const [tx, contacts] = await Promise.all([
    list('d_transactions', { project_id: pid }, { order: 'date', asc: false }),
    list('d_contacts', { project_id: pid }, { select: 'id,name', order: null }),
  ]);
  const cName = (id) => contacts.find(c => c.id === id)?.name;
  const signed = (t) => (t.kind === 'recette' ? 1 : -1) * Number(t.amount);
  const balance = totals(tx).balance;
  const [y, m] = cursor.split('-').map(Number);
  const inPeriod = (t) => period === 'all' || (period === 'year' ? t.date.startsWith(String(y)) : t.date.startsWith(cursor));
  const pTx = tx.filter(inPeriod);
  const shown = pTx.filter(t => (!kindFilter || t.kind === kindFilter) && (!catFilter || t.category === catFilter));
  const { inc, exp } = totals(pTx);
  const solo = pTx.filter(t => isBalanceOnly(t.category)).reduce((a, t) => a + signed(t), 0);
  const cats = [...new Set(tx.map(t => t.category).filter(Boolean))].sort();
  const label = period === 'all' ? 'Depuis le début' : period === 'year' ? String(y) : `${MONTHS[m - 1]} ${y}`;
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const t = totals(tx.filter(r => r.date.startsWith(key)));
    return { label: MONTHS[d.getMonth()], inc: t.inc, exp: t.exp };
  });
  const max = Math.max(1, ...months.flatMap(x => [x.inc, x.exp]));
  const byCat = Object.entries(pTx.filter(t => t.kind === 'depense' && !isBalanceOnly(t.category)).reduce((a, t) => ((a[t.category || 'Sans catégorie'] = (a[t.category || 'Sans catégorie'] || 0) + Number(t.amount)), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);

  el.innerHTML = `
    <div class="toolbar">
      <div class="row gap-s wrap">
        <div class="seg">${[['month', 'Mois'], ['year', 'Année'], ['all', 'Tout']].map(([k, l]) => `<button class="${period === k ? 'on' : ''}" data-period="${k}">${l}</button>`).join('')}</div>
        ${period !== 'all' ? `<div class="pager"><button class="btn-icon" data-prev>${icon('chevron-left')}</button><b>${label}</b><button class="btn-icon" data-next>${icon('chevron-right')}</button></div>` : ''}
      </div>
      <div class="row gap-s wrap">
        <button class="btn btn-ghost" data-csv>${icon('download')} CSV</button>
        <button class="btn btn-ghost" data-new="depense">${icon('minus')} Dépense</button><button class="btn btn-primary" data-new="recette">${icon('plus')} Recette</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat">${icon('wallet')}<div><span class="stat-v ${balance < 0 ? 'danger' : ''}">${money(balance)}</span><span class="stat-l">Solde actuel</span></div></div>
      <div class="stat">${icon('trending-up')}<div><span class="stat-v success">${money(inc)}</span><span class="stat-l">Recettes · ${label}</span></div></div>
      <div class="stat">${icon('trending-down')}<div><span class="stat-v danger">${money(exp)}</span><span class="stat-l">Dépenses · ${label}</span></div></div>
      <div class="stat">${icon('scale')}<div><span class="stat-v ${inc - exp < 0 ? 'danger' : 'success'}">${money(inc - exp)}</span><span class="stat-l">Résultat · ${label}</span>${solo ? `<span class="stat-sub">solde uniquement : ${money(solo)}</span>` : ''}</div></div>
    </div>
    <div class="dash-grid">
      <section class="panel"><div class="panel-head"><h2>${icon('chart-column')} 6 derniers mois</h2><span class="legend"><i class="lg-inc"></i>Recettes <i class="lg-exp"></i>Dépenses</span></div>
        <div class="bars">${months.map(x => `<div class="bar-col" title="${x.label} — ${money(x.inc)} / ${money(x.exp)}"><div class="bar-pair"><span class="bar inc" style="height:${(x.inc / max) * 100}%"></span><span class="bar exp" style="height:${(x.exp / max) * 100}%"></span></div><small>${x.label}</small></div>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><h2>${icon('chart-pie')} Dépenses par catégorie</h2></div>
        ${byCat.length ? `<ul class="hbars">${byCat.map(([c, v]) => `<li><span class="hb-l">${esc(c)}</span><span class="hb-track"><span style="width:${(v / byCat[0][1]) * 100}%"></span></span><b>${money(v)}</b></li>`).join('')}</ul>` : '<p class="muted pad">Aucune dépense sur la période.</p>'}</section>
    </div>
    <div class="toolbar"><h2 class="h-sec">Écritures <span class="count">${shown.length}</span></h2>
      <div class="row gap-s">
        <select class="input input-sm" data-kind><option value="">Recettes et dépenses</option><option value="recette" ${kindFilter === 'recette' ? 'selected' : ''}>Recettes</option><option value="depense" ${kindFilter === 'depense' ? 'selected' : ''}>Dépenses</option></select>
        <select class="input input-sm" data-cat><option value="">Toutes catégories</option>${cats.map(c => `<option ${c === catFilter ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div></div>
    ${shown.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Contact</th><th class="right">Montant</th></tr></thead><tbody>
      ${shown.map(t => `<tr class="clickable" data-id="${t.id}"><td class="nowrap">${fmtDate(t.date)}</td><td><b>${esc(t.label)}</b>${t.notes ? `<div class="muted small">${esc(t.notes)}</div>` : ''}</td>
        <td>${t.category ? `<span class="badge">${esc(t.category)}</span>` : ''}${isBalanceOnly(t.category) ? ' <span class="badge badge-info">solde</span>' : ''}</td>
        <td>${esc(cName(t.contact_id) || '')}</td>
        <td class="right nowrap ${t.kind === 'recette' ? 'success' : 'danger'}"><b>${t.kind === 'recette' ? '+' : '−'} ${money(t.amount)}</b></td></tr>`).join('')}</tbody></table></div>`
      : emptyState('Aucune écriture', tx.length ? 'Rien sur cette période.' : 'Ajoute ta première recette ou dépense.')}`;

  const again = () => render(ctx);
  el.querySelectorAll('[data-period]').forEach(b => b.onclick = () => { period = b.dataset.period; again(); });
  const shift = (d) => { if (period === 'year') cursor = `${y + d}-${String(m).padStart(2, '0')}`; else { const x = new Date(y, m - 1 + d, 1); cursor = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; } again(); };
  el.querySelector('[data-prev]')?.addEventListener('click', () => shift(-1));
  el.querySelector('[data-next]')?.addEventListener('click', () => shift(1));
  el.querySelector('[data-kind]').onchange = (e) => { kindFilter = e.target.value; again(); };
  el.querySelector('[data-cat]').onchange = (e) => { catFilter = e.target.value; again(); };
  el.querySelectorAll('[data-new]').forEach(b => b.onclick = async () => { if (await editTransaction(ctx, null, { kind: b.dataset.new })) again(); });
  el.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = async () => { if (await editTransaction(ctx, tx.find(t => t.id === tr.dataset.id))) again(); });
  el.querySelector('[data-csv]').onclick = () => downloadCSV(`compta-${ctx.p.name}-${label}.csv`.replace(/\s+/g, '_'), shown, [
    { label: 'Date', get: t => t.date }, { label: 'Type', get: t => t.kind }, { label: 'Libellé', get: t => t.label },
    { label: 'Catégorie', get: t => t.category }, { label: 'Montant', get: t => signed(t) }, { label: 'Contact', get: t => cName(t.contact_id) }, { label: 'Notes', get: t => t.notes },
  ]);
}
