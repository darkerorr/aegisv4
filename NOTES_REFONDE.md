# NOTES_REFONDE

Suivi des surfaces UI qui ne sont pas encore branchées à une vraie logique
(état "coming soon" volontaire, pas un bug CSS).

## Settings — raccourcis, notifications, labs (v0.4)

- **Shortcuts** (badge DESKTOP), **Notifications** (badge SYSTEM) et **Labs**
  (badge BETA) pointaient tous vers `/settings` (la page courante) : le clic
  ne produisait aucun effet visible.
- Résolution : ces trois cartes sont maintenant des `<button>` qui affichent
  un toast "coming soon" au clic (`apps/web/src/components/workspace/settings-nav.tsx`).
- **Fonctionnalité réelle restante à développer** :
  - page de raccourcis clavier + command palette,
  - centre de notifications / alertes / heures calmes,
  - surface Labs (outils expérimentaux).
- Aucune route (`/settings/shortcuts`, `/settings/notifications`, `/settings/labs`),
  aucun endpoint API associé n'existe pour l'instant.
