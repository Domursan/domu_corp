import { list, insert, update, remove } from '../api.js';
import { esc, icon, fmtTime, fmtDate, toISODate, todayISO, formModal, confirmDialog, toast, toastError } from '../ui.js';
import { expandOccurrences } from '../calc.js';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const REC = [{ value: 'none', label: 'Une seule fois' }, { value: 'daily', label: 'Tous les jours' }, { value: 'weekly', label: 'Chaque semaine' }, { value: 'biweekly', label: 'Toutes les 2 semaines' }, { value: 'monthly', label: 'Chaque mois' }];

const FIELDS = [
  { name: 'title', label: 'Titre', required: true, full: true },
  { name: 'starts_at', label: 'Début', type: 'datetime', required: true },
  { name: 'ends_at', label: 'Fin (plusieurs jours possible)', type: 'datetime' },
  { name: 'recurrence', label: 'Répétition', type: 'select', empty: false, options: REC },
  { name: 'recurrence_until', label: 'Jusqu’au (optionnel)', type: 'date' },
  { name: 'location', label: 'Lieu' },
  { name: 'color', label: 'Couleur', type: 'color', default: '#3b82f6' },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true },
];

let mode = 'month';
let cursor = new Date();

const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default async function render(ctx) {
  const { el, pid } = ctx;
  let from, to;
  if (mode === 'month') { from = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); to = addDays(from, 42); }
  else { from = startOfWeek(cursor); to = addDays(from, 7); }

  const mine = await list('d_events', { project_id: pid }, { order: 'starts_at' });
  const items = [];
  const push = (date, it) => items.push({ date, ...it });
  for (const e of mine) for (const o of expandOccurrences(e, from, new Date(Math.max(to, Date.now() + 15 * 864e5)))) {
    const s = new Date(o.start); s.setHours(0, 0, 0, 0);
    const end = new Date(o.end); end.setHours(0, 0, 0, 0);
    for (let d = new Date(s), i = 0; d <= end && i < 40; d = addDays(d, 1), i++) push(toISODate(d), { kind: 'mine', e, first: i === 0, time: o.start });
  }
  const byDay = items.reduce((m, it) => ((m[it.date] ??= []).push(it), m), {});

  const chip = (it) => {
    if (it.kind === 'mine') return `<button class="cal-ev" style="--ec:${esc(it.e.color || 'var(--accent)')}" data-mine="${it.e.id}" title="${esc(it.e.title)}">${it.first && !it.e.all_day ? `<span class="t">${fmtTime(it.time)}</span>` : it.first ? '' : '↳ '}${esc(it.e.title)}${it.e.recurrence !== 'none' ? ' ↻' : ''}</button>`;
    return '';
  };

  const today = todayISO();
  const days = Array.from({ length: mode === 'month' ? 42 : 7 }, (_, i) => addDays(from, i));
  const title = mode === 'month' ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semaine du ${from.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}`;

  // Prochains éléments (14 jours)
  const lim = toISODate(addDays(new Date(), 14));
  const soon = items.filter(it => it.date >= today && it.date <= lim && it.first).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  el.innerHTML = `
    <div class="toolbar">
      <div><h2 class="h-sec">${icon('calendar-days')} Agenda du projet</h2></div>
      <div class="actions"><button class="btn btn-primary" data-new>${icon('plus')} Rendez-vous</button></div>
    </div>
    <div class="toolbar">
      <div class="row gap-s wrap">
        <div class="pager"><button class="btn-icon" data-prev>${icon('chevron-left')}</button><b class="cal-title">${title}</b><button class="btn-icon" data-next>${icon('chevron-right')}</button></div>
        <button class="btn btn-sm btn-ghost" data-today>Aujourd’hui</button>
      </div>
      <div class="seg"><button class="${mode === 'month' ? 'on' : ''}" data-mode="month">Mois</button><button class="${mode === 'week' ? 'on' : ''}" data-mode="week">Semaine</button></div>
    </div>
    <div class="cal-layout">
      <div class="cal ${mode}">
        ${DAYS.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${days.map(d => {
          const key = toISODate(d); const its = byDay[key] || [];
          return `<div class="cal-day ${mode === 'month' && d.getMonth() !== cursor.getMonth() ? 'out' : ''} ${key === today ? 'today' : ''}" data-day="${key}">
            <span class="cal-num">${mode === 'week' ? `${DAYS[(d.getDay() + 6) % 7]} ` : ''}${d.getDate()}</span>
            <div class="cal-items">${its.slice(0, mode === 'month' ? 3 : 30).map(chip).join('')}${mode === 'month' && its.length > 3 ? `<span class="cal-more">+${its.length - 3}</span>` : ''}</div></div>`;
        }).join('')}
      </div>
      <aside class="panel cal-side">
        <div class="panel-head"><h2>${icon('list')} 14 prochains jours</h2></div>
        ${soon.length ? `<ul class="list">${soon.map(it => `<li class="list-row"><span class="date-pill"><b>${+it.date.slice(8)}</b>${new Date(it.date + 'T12:00').toLocaleDateString('fr-CH', { month: 'short' })}</span><span class="grow">${chip(it)}</span></li>`).join('')}</ul>` : '<p class="muted pad">Rien de prévu.</p>'}
      </aside>
    </div>
    <p class="muted small mt">Clique sur un jour pour ajouter un rendez-vous. ↻ = rendez-vous récurrent.</p>`;

  const again = () => render(ctx);
  const edit = async (ev, defaults = {}) => {
    const res = await formModal({ title: ev ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', fields: FIELDS, values: ev || { recurrence: 'none', color: '#3b82f6', ...defaults }, onDelete: !!ev });
    if (!res) return;
    try {
      if (res.__delete) { if (!(await confirmDialog(`Supprimer <b>${esc(ev.title)}</b>${ev.recurrence !== 'none' ? ' (toutes les répétitions)' : ''} ?`))) return; await remove('d_events', ev.id); toast('Rendez-vous supprimé'); }
      else if (ev) { await update('d_events', ev.id, res); toast('Rendez-vous mis à jour'); }
      else { await insert('d_events', { ...res, project_id: pid }); toast('Rendez-vous ajouté'); }
      again();
    } catch (e) { toastError(e); }
  };
  el.querySelector('[data-new]').onclick = () => edit(null, { starts_at: new Date().toISOString() });
  el.querySelector('[data-prev]').onclick = () => { cursor = mode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1) : addDays(cursor, -7); again(); };
  el.querySelector('[data-next]').onclick = () => { cursor = mode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : addDays(cursor, 7); again(); };
  el.querySelector('[data-today]').onclick = () => { cursor = new Date(); again(); };
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; again(); });
  el.querySelector('.cal').addEventListener('click', (e) => {
        const m = e.target.closest('[data-mine]');
    if (m) return edit(mine.find(x => x.id === m.dataset.mine));
    const more = e.target.closest('.cal-more'); const day = e.target.closest('[data-day]');
    if (more && day) { cursor = new Date(day.dataset.day + 'T12:00:00'); mode = 'week'; return again(); }
    if (day) edit(null, { starts_at: new Date(`${day.dataset.day}T20:00:00`).toISOString() });
  });
  el.querySelector('.cal-side').addEventListener('click', (e) => { const m = e.target.closest('[data-mine]'); if (m) edit(mine.find(x => x.id === m.dataset.mine)); });
}
