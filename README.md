# Domursan

Référencement de tous mes projets (dev, RP, perso…). HTML/CSS/JS vanilla sur GitHub Pages, données sur Supabase (projet `Gestion_RP`, tables `d_*`).

## Ce que fait le site

- **Accueil** : une carte par projet (raccourci vers son onglet), filtres catégorie / statut, tri par activité, nom ou ordre manuel (glisser-déposer).
- **Menu** : un onglet par projet, groupé par catégorie (repliable), projets épinglés en haut. Les projets « Archivé » sont masqués.
- **Features** : catalogue de cartes remplies à la main (devis, agenda, connexion…) avec description, technique, liens et projets qui ont la feature.
- **Fiche projet** : onglets à la carte, activables dans « Réglages » du projet :
  Vue d’ensemble · Liens · Tâches · Notes · Journal · Agenda · Fichiers · Comptabilité · Contacts · Inventaire · Fiche technique · Bugs & idées · Déploiements.
- **Paramètres** : apparence (jour / nuit / auto, daltonien, 7 thèmes saisonniers), catégories (couleur + icône), statuts, priorités, listes, onglets par défaut selon la catégorie, export / import JSON.

## Structure

```
Domursan/
├── index.html
├── css/        theme.css, app.css
├── js/
│   ├── config.js, api.js, state.js, ui.js, grid.js, calc.js, app.js, search.js, tour.js
│   ├── pages/      auth, home, features, project, settings
│   └── modules/    registry + un fichier par onglet
└── supabase/schema.sql
```

## Mise en ligne

1. Crée un dépôt GitHub (ex. `domursan`) et pousse ce dossier à la racine.
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Dans Supabase → Authentication → URL Configuration : mets l’adresse GitHub Pages en *Site URL* et dans *Redirect URLs*.

Pour tester en local : VS Code → Live Server (les modules ES ne marchent pas en ouvrant le fichier directement).

## Sécurité

Connexion par email (Supabase Auth). Chaque compte ne voit que ses projets (RLS). Les fichiers et logos sont accessibles par lien direct : n’y mets rien de confidentiel, et jamais de mot de passe dans la fiche technique.
