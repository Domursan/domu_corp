import { update, insert } from '../api.js';
import { L } from '../state.js';
import { esc, icon, fmtDate, toast, toastError, todayISO, confirmDialog } from '../ui.js';
import { refreshProjects } from '../app.js';

export default async function render(ctx) {
  const { el, p } = ctx;
  const d = { checklist: L().deployChecklist.map(text => ({ text, done: false })), history: [], ...(p.deploy || {}) };
  const allDone = d.checklist.length && d.checklist.every(c => c.done);

  el.innerHTML = `
    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head"><h2>${icon('list-checks')} Checklist de mise en ligne</h2><button class="btn btn-sm btn-ghost" data-reset>${icon('rotate-ccw')} Tout décocher</button></div>
        <div class="pad deploy-list">${d.checklist.map((c, i) => `<div class="task-row" data-i="${i}"><input type="checkbox" ${c.done ? 'checked' : ''} data-done>
          <input class="input input-sm" value="${esc(c.text)}" data-text><button class="btn-icon sm" data-del title="Retirer">${icon('x')}</button></div>`).join('')}
          <button class="btn btn-sm btn-ghost mt-s" data-add>${icon('plus')} Ajouter une étape</button></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>${icon('rocket')} Déployer une version</h2></div>
        <div class="pad stack">
          <label class="field"><span>Version</span><input class="input" data-version value="${esc(p.tech?.version || '')}" placeholder="ex. 2.7.2"></label>
          <label class="field"><span>Ce qui change</span><textarea class="input" rows="3" data-notes placeholder="Une ligne par changement (ira aussi dans le Journal si activé)"></textarea></label>
          <button class="btn ${allDone ? 'btn-primary' : 'btn-ghost'}" data-deploy>${icon('rocket')} Marquer comme déployée</button>
          ${!allDone ? '<small class="muted">Astuce : coche la checklist avant de déployer.</small>' : ''}
        </div>
      </section>
      <section class="panel span-2">
        <div class="panel-head"><h2>${icon('history')} Déploiements</h2></div>
        ${d.history.length ? `<ul class="list">${d.history.slice().reverse().map(h => `<li class="list-row"><span class="badge badge-info">V ${esc(h.version || '?')}</span><span class="grow">${esc(h.notes || '')}</span><small class="muted">${fmtDate(h.date)}</small></li>`).join('')}</ul>` : '<p class="muted pad">Aucun déploiement noté.</p>'}
      </section>
      <section class="panel span-2">
        <div class="panel-head"><h2>${icon('book-open')} Procédure de déploiement</h2></div>
        <textarea class="info-text" rows="6" data-howto placeholder="ex. Remplacer Code.gs et Scripts.html, puis Gérer les déploiements › Nouvelle version…">${esc(d.howto || '')}</textarea>
      </section>
    </div>`;

  let timer;
  const save = (rerender = false) => {
    clearTimeout(timer);
    const run = async () => { try { p.deploy = d; await update('d_projects', p.id, { deploy: d }); await refreshProjects(); if (rerender) render(ctx); } catch (e) { toastError(e); } };
    if (rerender) return run();
    timer = setTimeout(run, 500);
  };
  const list_ = el.querySelector('.deploy-list');
  list_.addEventListener('change', (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.matches('[data-done]')) { d.checklist[+r.dataset.i].done = e.target.checked; save(true); } });
  list_.addEventListener('input', (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.matches('[data-text]')) { d.checklist[+r.dataset.i].text = e.target.value; save(); } });
  list_.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.closest('[data-del]')) { d.checklist.splice(+r.dataset.i, 1); save(true); } });
  el.querySelector('[data-add]').onclick = () => { d.checklist.push({ text: '', done: false }); save(true); };
  el.querySelector('[data-reset]').onclick = () => { d.checklist.forEach(c => (c.done = false)); save(true); };
  el.querySelector('[data-howto]').addEventListener('input', (e) => { d.howto = e.target.value; save(); });
  el.querySelector('[data-deploy]').onclick = async () => {
    const version = el.querySelector('[data-version]').value.trim();
    const notes = el.querySelector('[data-notes]').value.trim();
    if (!allDone && !(await confirmDialog('La checklist n’est pas complète. Marquer quand même cette version comme déployée ?', { danger: false, ok: 'Oui, déployée' }))) return;
    d.history.push({ version, notes, date: todayISO() });
    d.checklist.forEach(c => (c.done = false));
    try {
      const tech = { ...(p.tech || {}), version };
      p.tech = tech;
      await update('d_projects', p.id, { deploy: d, tech });
      if ((p.modules || []).includes('changelog')) await insert('d_changelog', { project_id: p.id, version, date: todayISO(), title: notes.split('\n')[0] || `Version ${version}`, details: notes });
      await refreshProjects();
      toast('Déploiement noté');
      render(ctx);
    } catch (e) { toastError(e); }
  };
}
