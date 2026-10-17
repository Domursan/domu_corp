import { sb, list } from '../api.js';
import { L } from '../state.js';
import { esc, icon, fmtDate, fmtDateTime, linkButtons, money, emptyState } from '../ui.js';
import { projectPath } from '../app.js';
import { expandOccurrences, totals } from '../calc.js';
import { featureCard, showFeature } from '../pages/features.js';

export default async function render(ctx) {
  const { el, p, pid } = ctx;
  const on = (k) => (p.modules || []).includes(k);
  const q = (t, extra = {}, opts = {}) => list(t, { project_id: pid, ...extra }, opts);
  const [links, tasks, changes, events, bugs, tx, notes, featsRes] = await Promise.all([
    on('links') ? q('d_links', {}, { order: 'position' }) : [],
    on('tasks') ? q('d_tasks', {}, { order: 'due_date' }) : [],
    on('changelog') ? q('d_changelog', {}, { order: 'date', asc: false }) : [],
    on('agenda') ? q('d_events', {}, { order: 'starts_at' }) : [],
    on('bugs') ? q('d_bugs', {}, { order: 'created_at', asc: false }) : [],
    on('accounting') ? q('d_transactions', {}, { select: 'kind,amount,category', order: null }) : [],
    on('notes') ? q('d_notes', {}, { order: 'updated_at', asc: false }) : [],
    sb.from('d_features').select('*').contains('project_ids', [pid]).order('name'),
  ]);
  const feats = featsRes.data || [];
  const done = L().taskStatuses.at(-1);
  const openTasks = tasks.filter(t => t.status !== done);
  const pct = tasks.length ? Math.round(((tasks.length - openTasks.length) / tasks.length) * 100) : 0;
  const now = new Date(); const in30 = new Date(Date.now() + 30 * 864e5);
  const upcoming = events.flatMap(e => expandOccurrences(e, now, in30).map(o => ({ e, start: o.start }))).sort((a, b) => a.start - b.start).slice(0, 5);
  const dueSoon = openTasks.filter(t => t.due_date).slice(0, 5);
  const openBugs = bugs.filter(b => !['Corrigé', 'Abandonné'].includes(b.status));
  const tab = (k) => projectPath(pid, k);
  const panel = (title, ic, k, body) => `<section class="panel"><div class="panel-head"><h2>${icon(ic)} ${title}</h2>${k ? `<a class="btn btn-sm btn-ghost" href="${tab(k)}">Ouvrir</a>` : ''}</div>${body}</section>`;

  const blocks = [];
  blocks.push(panel('Description', 'info', null, `<div class="pad">${p.description ? `<p class="prewrap">${esc(p.description)}</p>` : '<p class="muted">Pas de description. <a href="#" data-edit-desc>Ajouter</a></p>'}</div>`));
  if (on('links')) blocks.push(panel('Liens rapides', 'link', 'links', links.length ? `<div class="pad row gap-s wrap">${linkButtons(links)}</div>` : '<p class="muted pad">Aucun lien.</p>'));
  if (on('tasks')) blocks.push(panel('Tâches', 'list-checks', 'tasks', `<div class="pad">
      <div class="row between small"><span>${tasks.length - openTasks.length} / ${tasks.length} terminées</span><b>${pct} %</b></div>
      <div class="progress mt-s"><span style="width:${pct}%"></span></div>
      ${dueSoon.length ? `<ul class="list">${dueSoon.map(t => `<li class="list-row"><span class="grow">${esc(t.title)}</span><small class="${t.due_date < now.toISOString().slice(0, 10) ? 'danger' : 'muted'}">${fmtDate(t.due_date)}</small></li>`).join('')}</ul>` : ''}
    </div>`));
  if (on('agenda')) blocks.push(panel('À venir (30 jours)', 'calendar-days', 'agenda', upcoming.length ? `<ul class="list">${upcoming.map(u => `<li class="list-row"><span class="date-pill"><b>${u.start.getDate()}</b>${u.start.toLocaleDateString('fr-CH', { month: 'short' })}</span><span class="grow"><b>${esc(u.e.title)}</b><small class="muted">${fmtDateTime(u.start)}</small></span></li>`).join('')}</ul>` : '<p class="muted pad">Rien de prévu.</p>'));
  if (on('changelog')) blocks.push(panel('Derniers changements', 'history', 'changelog', changes.length ? `<ul class="list">${changes.slice(0, 4).map(c => `<li class="list-row">${c.version ? `<span class="badge badge-info">${esc(c.version)}</span>` : ''}<span class="grow">${esc(c.title)}</span><small class="muted">${fmtDate(c.date)}</small></li>`).join('')}</ul>` : '<p class="muted pad">Aucune entrée.</p>'));
  if (on('bugs')) blocks.push(panel('Bugs & idées ouverts', 'bug', 'bugs', openBugs.length ? `<ul class="list">${openBugs.slice(0, 5).map(b => `<li class="list-row"><span class="badge">${esc(b.kind)}</span><span class="grow">${esc(b.title)}</span>${b.priority ? `<small class="muted">${esc(b.priority)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted pad">Rien d’ouvert.</p>'));
  if (on('accounting')) { const t = totals(tx); blocks.push(panel('Comptabilité', 'wallet', 'accounting', `<div class="pad row gap wrap"><span>Solde <b class="${t.balance < 0 ? 'danger' : ''}">${money(t.balance)}</b></span><span class="success">+ ${money(t.inc)}</span><span class="danger">− ${money(t.exp)}</span></div>`)); }
  if (on('notes')) blocks.push(panel('Notes récentes', 'notebook-pen', 'notes', notes.length ? `<ul class="list">${notes.slice(0, 4).map(n => `<li class="list-row">${n.pinned ? icon('pin', 'ic-xs') : ''}<span class="grow">${esc(n.title)}</span><small class="muted">${fmtDate(n.updated_at)}</small></li>`).join('')}</ul>` : '<p class="muted pad">Aucune note.</p>'));
  if (on('tech') && Object.values(p.tech || {}).some(v => (Array.isArray(v) ? v.length : v))) {
    const t = p.tech;
    blocks.push(panel('Fiche technique', 'cpu', 'tech', `<dl class="dl">${t.stack ? `<dt>Stack</dt><dd>${esc(t.stack)}</dd>` : ''}${t.hosting ? `<dt>Hébergement</dt><dd>${esc(t.hosting)}</dd>` : ''}${t.prod_url ? `<dt>Production</dt><dd><a href="${esc(t.prod_url)}" target="_blank" rel="noopener">${esc(t.prod_url)}</a></dd>` : ''}${t.version ? `<dt>Version</dt><dd>${esc(t.version)}</dd>` : ''}</dl>`));
  }

  el.innerHTML = `
    <div class="dash-grid">${blocks.join('')}</div>
    <section class="zone">
      <div class="zone-head"><h2>${icon('blocks')} Features de ce projet <span class="count">${feats.length}</span></h2><a class="btn btn-sm btn-ghost" href="#/features">Catalogue</a></div>
      ${feats.length ? `<div class="feature-grid">${feats.map(featureCard).join('')}</div>` : emptyState('Aucune feature liée', 'Dans le catalogue Features, coche ce projet sur les cartes concernées.')}
    </section>`;

  el.querySelector('[data-edit-desc]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { editProject } = await import('../pages/project.js');
    if (await editProject(p)) ctx.reload();
  });
  el.querySelectorAll('.feature-card').forEach(c => c.addEventListener('click', (e) => { if (!e.target.closest('[data-stop]')) showFeature(feats.find(f => f.id === c.dataset.id), () => render(ctx)); }));
}
