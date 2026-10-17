// Liste des modules (onglets) disponibles pour un projet.
export const MODULES = [
  { key: 'overview', label: 'Vue d’ensemble', icon: 'layout-grid', always: true, mod: () => import('./overview.js') },
  { key: 'links', label: 'Liens', icon: 'link', desc: 'Code, site, Apps Script, Sheet, GitHub, Supabase…', mod: () => import('./links.js') },
  { key: 'tasks', label: 'Tâches', icon: 'list-checks', desc: 'Tableau par colonnes, priorités, échéances, sous-tâches', mod: () => import('./tasks.js') },
  { key: 'notes', label: 'Notes', icon: 'notebook-pen', desc: 'Pages de notes libres', mod: () => import('./notes.js') },
  { key: 'changelog', label: 'Journal', icon: 'history', desc: 'Versions et changements datés', mod: () => import('./changelog.js') },
  { key: 'agenda', label: 'Agenda', icon: 'calendar-days', desc: 'Rendez-vous et échéances, répétitions', mod: () => import('./agenda.js') },
  { key: 'files', label: 'Fichiers', icon: 'folder-open', desc: 'Captures, logos, documents', mod: () => import('./files.js') },
  { key: 'accounting', label: 'Comptabilité', icon: 'wallet', desc: 'Recettes, dépenses, graphiques', mod: () => import('./accounting.js') },
  { key: 'contacts', label: 'Contacts', icon: 'contact', desc: 'Clients et contacts, plafond de facturation', mod: () => import('./contacts.js') },
  { key: 'inventory', label: 'Inventaire', icon: 'package', desc: 'Stocks et seuils d’alerte', mod: () => import('./inventory.js') },
  { key: 'tech', label: 'Fiche technique', icon: 'cpu', group: 'Dev', desc: 'Stack, hébergement, URLs, identifiants', mod: () => import('./tech.js') },
  { key: 'bugs', label: 'Bugs & idées', icon: 'bug', group: 'Dev', desc: 'Suivi des bugs et idées d’amélioration', mod: () => import('./bugs.js') },
  { key: 'deploy', label: 'Déploiements', icon: 'rocket', group: 'Dev', desc: 'Checklist de mise en ligne, dernière version', mod: () => import('./deploy.js') },
  { key: 'reglages', label: 'Réglages', icon: 'sliders-horizontal', always: true, mod: () => import('./psettings.js') },
];
export const OPTIONAL = MODULES.filter(m => !m.always);
export const moduleByKey = (k) => MODULES.find(m => m.key === k);
/** Onglets visibles d'un projet, dans l'ordre du registre. */
export const projectTabs = (p) => MODULES.filter(m => m.always || (p.modules || []).includes(m.key));
