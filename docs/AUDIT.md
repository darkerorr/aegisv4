# Aegis - audit initial

Date de l audit: 2026-07-19

## Perimetre

Le depot est actuellement une application CLI Node.js/TypeScript. Il ne
contient pas encore Aegis Web, Aegis App ou une API distante. Le dossier `.git`
est present mais ne contient pas de metadonnees exploitables; l historique et
les modifications precedentes ne peuvent donc pas etre verifies par Git.

## Etat actuel

### Fonctionnel et reutilisable

- Entrypoint global `aegis` dans `src/index.ts` et publication npm via `bin`.
- Session interactive projet dans `src/core/session.ts`.
- Routage des commandes principales dans `src/core/commandRouter.ts` et
  `src/cli/commands/`.
- Streaming et appels synchrones via le contrat `AIProvider` dans
  `src/types/index.ts` et `src/core/aiClient.ts`.
- Drivers Ollama, LM Studio et OpenAI-compatible dans `src/providers/`.
- Gestion locale des providers et modeles dans `src/core/providerManager.ts`
  et `src/core/modelManager.ts`.
- Scan de projet avec exclusions de base, limite de taille et detection de
  type dans `src/core/projectScanner.ts`.
- Demande de confiance d un workspace dans `src/config/trustManager.ts`.
- Lecture de contexte, outils read/glob/grep et controle des chemins.
- Confirmation des commandes shell dans `src/core/safetyManager.ts`.
- Historique JSON local et export dans `src/core/historyManager.ts`.
- Installation Windows, shell Unix, reset, update et doctor.
- Identite CLI deja documentee dans `design/` et mascot terminal dans
  `src/ui/mascot.ts`.
- `npm.cmd run build` passe actuellement avec TypeScript strict.

### Partiel ou a durcir

- Le diff existe comme objet et affichage texte, mais reste mono-fichier et
  ne propose pas encore de selection par bloc, undo robuste ou patch persiste.
- Le mode agent existe mais n est pas encore un moteur de plan, d approbation
  et d execution partageable avec une app desktop.
- Les interfaces TUI sont des fonctions de rendu et des prompts; Ink n est
  pas installe et la cible n est pas encore une vraie surface desktop.
- Les providers sont utiles en local, mais leur configuration est stockee en
  JSON/.env sans coffre-fort systeme ni validation de schema.
- L historique est local uniquement. Il n existe pas de compte, synchronisation,
  partage d identite ou session CLI liee a un compte Aegis.
- Les scripts d installation existent, mais il n y a pas de pipeline de
  packaging signe pour trois plateformes.
- Le README annonce `lint`, `format` et des commandes de test, alors que le
  `package.json` ne declare actuellement ni script `test`, ni `lint`, ni
  `format`.

### Absent

- Aegis Web: landing, authentification, onboarding, dashboard, chat web,
  gestion des providers, documentation et pages de compte.
- Aegis API: endpoints, streaming SSE, sessions, device flow CLI et limites.
- Base de donnees: Prisma/ORM, migrations, PostgreSQL et mode SQLite local.
- Aegis App: projet Tauri 2, bridge Rust, acces fichiers controle, terminal,
  notifications, updater et stockage natif.
- Authentification: mots de passe haches, verification email, reset,
  sessions HTTP, appareils et tokens CLI.
- Tests unitaires, integration, routes web, flows auth, providers et CLI.
- Contrat partage entre Web, App et CLI pour conversations, projets, agents,
  approvals et politiques de confidentialite.

## Problemes prioritaires

1. `src/core/session.ts` concentre orchestration, rendu terminal, streaming,
   historique implicite et execution d outils. Il faut l extraire en services
   purs avant de le reutiliser depuis Web ou App.
2. `src/tools/write.ts` et `src/tools/edit.ts` ecrivent directement sur le
   disque lorsqu un appel outil est execute. Ils contournent le workflow de
   `PatchManager` et ne satisfont donc pas encore la regle "diff puis
   confirmation" pour tous les chemins d execution.
3. `src/tools/bash.ts` utilise `process.cwd()` au lieu du workspace de session.
   Une session ouverte sur un autre chemin peut donc executer une commande dans
   le mauvais dossier.
4. Les secrets peuvent etre lus depuis `.aegis/.env` ou des variables
   d environnement. Il manque une abstraction de secret capable d utiliser le
   coffre-fort Windows, macOS et Linux.
5. La validation des configurations et des appels provider repose surtout sur
   des types TypeScript et des conversions `any`; Zod doit devenir la frontiere
   de validation.
6. Le scanner ignore des noms sensibles de base, mais la politique doit etre
   centralisee, configurable et partagee par CLI et App.
7. Le depot contient a la fois `package-lock.json` et `pnpm-lock.yaml`, tandis
   que `pnpm-workspace.yaml` ne declare pas encore de packages workspace.

## Decisions de conservation

Conserver sans reecriture immediate:

- les drivers provider et leur contrat, en les deplacant ensuite dans
  `packages/providers`;
- le scanner, le lecteur de fichiers, les regles de chemins et la confiance,
  en les deplacant dans `packages/project-engine`;
- le calcul de diff et les sauvegardes, apres correction du workflow;
- les commandes CLI et les scripts d installation comme facade de compatibilite;
- les messages et tokens de `design/`, apres nettoyage de l encodage et
  extension Web/App.

Ne pas reutiliser comme architecture partagee:

- `AppContext` global qui assemble toutes les dependances CLI;
- les prompts Inquirer et les sorties ANSI dans le core;
- les fichiers JSON locaux comme modele de donnees serveur;
- les valeurs d URL, de version et de providers encodees dans plusieurs modules.

## Verification executee

- Compilation: `npm.cmd run build` reussie.
- Tests: echec attendu, script `test` absent.
- Lint/format: non verifiables, scripts absents.
- Git: impossible de lire l historique, metadonnees `.git` absentes ou
  incompletes.

