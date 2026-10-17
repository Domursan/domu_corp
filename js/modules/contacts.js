import { list, insert, update, remove } from '../api.js';
import { state, L } from '../state.js';
import { esc, icon, money, fmtDate, formModal, confirmDialog, modal, toast, toastError, emptyState, linkButtons } from '../ui.js';
import { contactBilling, isBalanceOnly } from '../calc.js';
import { editTransaction } from './accounting.js';

const FIELDS = () => [
  { name: 'name', label: 'Nom', required: true },
  { name: 'status', label: 'Statut', type: 'select', options: () => L().contactStatuses.map(x => x.name) },
  { name: 'contact', label: 'Personne à contacter' },
  { name: 'phone', label: 'Téléphone', type: 'tel' },
  { name: 'company', label: 'Entreprise / organisation' },
  { name: 'email', label: 'Email / Discord' },
  { name: 'cap', label: 'Plafond de facturation', type: 'money', min: 0, help: `Vide = plafond général (${state.settings.billing.cap} sur ${state.settings.billing.days} jours). Actif seulement si la Comptabilité est activée.` },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true },
  { name: 'links', label: 'Liens', type: 'links' },
];
const badge = (st) => { if (!st) return ''; const c = L().contactStatuses.find(x => x.name === st)?.color; return `<span class="badge" style="${c ? `background:${c}26;color:${c}` : ''}">${esc(st)}</span>`; };
function capBar(b) {
  if (!b) return '';
  const lvl = b.done >= b.cap ? 'danger' : b.pct >= 75 ? 'warning' : 'success';
  return `<div class="cap"><div class="row between small"><span>Facturé <b>${money(b.done)}</b> / ${money(b.cap)}</span><b class="${lvl}">${Math.round((b.done / b.cap) * 100)} %</b></div>
    <div class="cap-bar"><span class="bg-${lvl}" style="width:${b.pct}%"></span></div>
    <small class="muted">${b.done >= b.cap ? 'Plafond atteint' : `Reste ${money(b.cap - b.done)}`} — ${b.period.mode === 'fixe' ? `du ${fmtDate(b.period.start)} au ${fmtDate(b.period.end)}` : `${b.period.days} derniers jours`}</small></div>`;
}

async function editContact(ctx, c) {
  const res = await formModal({ title: c ? `Modifier — ${c.name}` : 'Nouveau contact', fields: FIELDS(), size: 'lg', values: c || { status: L().contactStatuses[0]?.name, links: [] }, onDelete: !!c });
  if (!res) return false;
  try {
    if (res.__delete) { if (!(await confirmDialog(`Supprimer <b>${esc(c.name)}</b> ?`))) return false; await remove('d_contacts', c.id); toast('Contact supprimé'); }
    else if (c) await update('d_contacts', c.id, res);
    else await insert('d_contacts', { ...res, project_id: ctx.pid });
    return true;
  } catch (e) { toastError(e); return false; }
}

let query = '';

export default async function render(ctx) {
  const { el, pid, p } = ctx;
  const compta = (p.modules || []).includes('accounting');
  const [contacts, tx] = await Promise.all([
    list('d_contacts', { project_id: pid }, { order: 'name' }),
    compta ? list('d_transactions', { project_id: pid, kind: 'recette' }, { select: 'id,kind,category,contact_id,amount,label,date', order: 'date', asc: false }) : [],
  ]);
  const revenue = (c) => tx.filter(t => t.contact_id === c.id && !isBalanceOnly(t.category)).reduce((a, t) => a + Number(t.amount), 0);
  const q = query.toLowerCase();
  const shown = contacts.filter(c => !q || [c.name, c.company, c.contact, c.status, c.phone, c.email, c.notes].some(x => x?.toLowerCase().includes(q)));

  el.innerHTML = `
    <div class="toolbar"><h2 class="h-sec">${icon('contact')} Contacts <span class="count">${contacts.length}</span></h2>
      <div class="row gap-s"><input class="input input-sm" type="search" placeholder="Filtrer…" value="${esc(query)}" data-q><button class="btn btn-primary" data-add>${icon('user-plus')} Contact</button></div></div>
    ${shown.length ? `<div class="card-grid">${shown.map(c => `
      <article class="client-card" data-id="${c.id}" tabindex="0">
        <div class="row gap-s"><span class="avatar avatar-txt" style="width:42px;height:42px;font-size:15px">${esc(c.name[0].toUpperCase())}</span>
          <div class="grow"><h3>${esc(c.name)}</h3>${c.company ? `<small class="muted">${esc(c.company)}</small>` : ''}</div>${badge(c.status)}</div>
        <ul class="meta">${c.contact || c.phone ? `<li>${icon('phone')} ${esc([c.contact, c.phone].filter(Boolean).join(' — '))}</li>` : ''}${c.email ? `<li>${icon('at-sign')} ${esc(c.email)}</li>` : ''}</ul>
        ${compta ? capBar(contactBilling(c, tx)) : ''}
        ${(c.links || []).length ? `<div class="proj-links" data-stop>${linkButtons(c.links, true)}</div>` : ''}
        ${compta ? `<div class="struct-card-foot"><span class="muted">Chiffre d’affaires</span><span class="success">${money(revenue(c))}</span></div>` : ''}
      </article>`).join('')}</div>` : emptyState(contacts.length ? 'Aucun contact ne correspond' : 'Aucun contact', contacts.length ? '' : 'Clients, partenaires, personnes clés du projet.')}`;

  const again = () => render(ctx);
  el.querySelector('[data-add]').onclick = async () => { if (await editContact(ctx, null)) again(); };
  const qi = el.querySelector('[data-q]');
  qi.oninput = () => { query = qi.value; clearTimeout(qi._t); qi._t = setTimeout(async () => { await again(); const n = el.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
  el.querySelectorAll('.client-card').forEach(card => {
    const open = () => {
      const c = contacts.find(x => x.id === card.dataset.id);
      const ctTx = tx.filter(t => t.contact_id === c.id);
      const m = modal({
        title: c.name, size: 'lg',
        body: `<div class="row gap wrap mb">${badge(c.status)}${c.contact ? `<span>${icon('user')} ${esc(c.contact)}</span>` : ''}${c.phone ? `<span>${icon('phone')} ${esc(c.phone)}</span>` : ''}${c.email ? `<span>${icon('at-sign')} ${esc(c.email)}</span>` : ''}${c.company ? `<span>${icon('building')} ${esc(c.company)}</span>` : ''}</div>
          ${compta ? capBar(contactBilling(c, tx)) : ''}
          ${c.notes ? `<p class="prewrap mt">${esc(c.notes)}</p>` : ''}
          ${(c.links || []).length ? `<h3 class="h-sec mt">${icon('link')} Liens</h3><div class="row gap-s wrap">${linkButtons(c.links)}</div>` : ''}
          ${compta ? `<h3 class="h-sec mt">${icon('receipt')} Paiements reçus</h3>${ctTx.length ? `<ul class="list">${ctTx.map(t => `<li class="list-row"><span class="grow">${esc(t.label)}<small class="muted">${fmtDate(t.date)}</small></span><b class="success">+ ${money(t.amount)}</b></li>`).join('')}</ul>` : '<p class="muted">Aucun paiement.</p>'}` : ''}`,
        footer: `<button class="btn btn-ghost mr-auto" data-edit>${icon('pencil')} Modifier</button>${compta ? `<button class="btn btn-primary" data-pay>${icon('plus')} Paiement</button>` : '<button class="btn btn-ghost" data-close>Fermer</button>'}`,
      });
      m.el.querySelector('[data-edit]').onclick = async () => { m.close(); if (await editContact(ctx, c)) again(); };
      m.el.querySelector('[data-pay]')?.addEventListener('click', async () => { m.close(); if (await editTransaction(ctx, null, { kind: 'recette', contact_id: c.id, category: 'Prestation' })) again(); });
    };
    card.onclick = (e) => { if (!e.target.closest('[data-stop]')) open(); };
    card.onkeydown = (e) => { if (e.key === 'Enter') open(); };
  });
}
