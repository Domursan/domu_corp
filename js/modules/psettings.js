// Réglages d'un projet : modules actifs, archivage, suppression.
import { update, remove } from '../api.js';
import { esc, icon, toast, toastError, confirmDialog } from '../ui.js';
import { go, projectPath, refreshNav } from '../app.js';
import { OPTIONAL } from './registry.js';
import { editProject } from '../pages/project.js';

export default async function render(ctx) {
  const { el, p } = ctx;
  const mods = new Set(p.modules || []);
  const groups = [['Modules', OPTIONAL.filter(m => !m.group)], ['Modules Dev', OPTIONAL.filter(m => m.group === 'Dev')]];

  el.innerHTML = `
    <section class="panel mb">
      <div class="panel-head"><h2>${icon('layout-grid')} Onglets du projet</h2><span class="muted small">Désactiver un onglet le masque sans effacer ses données.</span></div>
      ${groups.map(([title, list]) => `<h3 class="h-sub">${title}</h3><div class="module-grid">${list.map(m => `
        <label class="module-opt ${mods.has(m.key) ? 'on' : ''}">
          <input type="checkbox" data-mod="${m.key}" ${mods.has(m.key) ? 'checked' : ''}>
          <span class="mo-ic">${icon(m.icon)}</span><span class="grow"><b>${esc(m.label)}</b><small class="muted">${esc(m.desc || '')}</small></span>
        </label>`).join('')}</div>`).join('')}
    </section>
    <section class="panel mb">
      <div class="panel-head"><h2>${icon('info')} Informations</h2></div>
      <div class="pad row gap-s wrap"><button class="btn btn-ghost" data-edit>${icon('pencil')} Modifier nom, catégorie, statut, logo…</button></div>
    </section>
    <section class="panel danger-zone">
      <div class="panel-head"><h2>${icon('shield-alert')} Zone sensible</h2></div>
      <div class="pad row gap-s wrap">
        <button class="btn btn-ghost" data-archive>${icon(p.status === 'Archivé' ? 'archive-restore' : 'archive')} ${p.status === 'Archivé' ? 'Désarchiver' : 'Archiver'}</button>
        <button class="btn btn-danger-ghost" data-delete>${icon('trash-2')} Supprimer le projet</button>
      </div>
    </section>`;

  el.querySelectorAll('[data-mod]').forEach(cb => cb.onchange = async () => {
    cb.closest('.module-opt').classList.toggle('on', cb.checked);
    if (cb.checked) mods.add(cb.dataset.mod); else mods.delete(cb.dataset.mod);
    try { p.modules = [...mods]; await update('d_projects', p.id, { modules: p.modules }); await refreshNav(); go(projectPath(p.id, 'reglages')); } catch (e) { toastError(e); }
  });
  el.querySelector('[data-edit]').onclick = async () => { if (await editProject(p)) go(projectPath(p.id, 'reglages')); };
  el.querySelector('[data-archive]').onclick = async () => {
    try { await update('d_projects', p.id, { status: p.status === 'Archivé' ? 'En cours' : 'Archivé' }); toast('Statut mis à jour'); await refreshNav(); go(projectPath(p.id, 'reglages')); } catch (e) { toastError(e); }
  };
  el.querySelector('[data-delete]').onclick = async () => {
    const ok = await confirmDialog(`Supprimer <b>${esc(p.name)}</b> et <b>toutes</b> ses données (liens, tâches, notes, fichiers référencés, compta…) ? C’est définitif.`, { title: 'Supprimer le projet', ok: 'Supprimer', typeToConfirm: p.name });
    if (!ok) return;
    try { await remove('d_projects', p.id); toast('Projet supprimé'); await refreshNav(); go('#/'); } catch (e) { toastError(e); }
  };
}
