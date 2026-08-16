# Plan de migration Aegis

Le plan privilegie des increments executables et verifiables. Chaque phase
doit laisser la CLI actuelle utilisable et doit distinguer ce qui est
fonctionnel de ce qui est encore en construction.

## Phase 0 - audit et fondations

Etat: documentee dans `docs/AUDIT.md` et `docs/ARCHITECTURE.md`.

- figer les contrats de securite et de confidentialite;
- choisir pnpm comme gestionnaire workspace unique;
- ajouter scripts `typecheck`, `test`, `lint`, `format` et CI;
- ajouter des tests de regression pour scanner, trust, providers, streaming,
  diff et commandes sensibles;
- faire passer toute mutation par un patch en attente;
- corriger le cwd du tool shell et centraliser les exclusions;
- migrer les valeurs de version et defaults vers `packages/config`.

Sortie: la CLI actuelle compile, ses comportements importants sont testes et
aucune ecriture d outil ne contourne l approbation.

## Phase 1 - monorepo, API minimale, auth et Web initial

Etat: prochaine phase d implementation.

- creer `apps/cli` en conservant une facade compatible avec le package racine;
- creer `packages/types`, `config`, `security`, `providers`,
  `project-engine` et `ai-runtime`;
- creer `apps/api` avec validation Zod, healthcheck, config serveur et
  repositories;
- ajouter Prisma et migrations pour User, Session, EmailToken, Provider,
  Model, Conversation et Message;
- implementer register, login, verify email, forgot/reset password, logout et
  rate limiting de base;
- implementer `/`, `/login`, `/register`, `/dashboard`, `/chat`,
  `/providers`, `/models`, `/download` avec vrais etats vides;
- rendre le chat Web fonctionnel avec un provider distant configure, puis
  streaming SSE;
- documenter `.env.example`, migrations et demarrage local.

Sortie: un compte peut etre cree, verifie, utilise pour ouvrir le dashboard et
obtenir une conversation persistante; aucun bouton ne pretend faire davantage.

## Phase 2 - providers et chat partage

- deplacer les drivers actuels dans `packages/providers`;
- ajouter vault references, test de connexion et synchronisation des modeles;
- connecter Ollama et LM Studio depuis App/CLI sans proxy serveur;
- implementer selection model/provider, arret et regeneration;
- ajouter markdown, code blocks, copy, erreurs et mode prive;
- ajouter tests d integration par provider avec doubles explicitement marques.

Sortie: Web, App et CLI utilisent le meme contrat de messages et de streaming;
le mode local ne transmet pas le code a Aegis API.

## Phase 3 - Aegis App desktop et device flow

- creer `apps/desktop` avec Tauri 2 et un bridge minimal;
- connecter keychain systeme, ouverture de dossier, trust et scanner local;
- creer onboarding local/compte et page Home avec vrais etats vides;
- ajouter chat desktop, projets, models/providers et privacy indicator;
- implementer `aegis login` par device code et autorisation navigateur;
- ajouter `CliSession` et protocole IPC local authentifie;
- ajouter detection Ollama/LM Studio et notifications essentielles.

Sortie: App fonctionne hors ligne avec Ollama/LM Studio, et un compte peut
connecter App et CLI sans stocker le token en clair.

## Phase 4 - agent, patches et terminal

- extraire `agent-engine` depuis le comportement actuel de session;
- formaliser plan, etapes, outils, commandes proposees et approvals;
- construire explorateur projet, terminal integre et sessions CLI;
- produire diffs multi-fichiers cote a cote/unifie, acceptation par fichier ou
  hunk, rejet, backup et undo;
- journaliser les actions locales sans envoyer le contenu du projet par defaut;
- afficher les etats `Local only`, `Remote provider`, `Synced`, `Private`.

Sortie: le scenario analyse -> proposition -> diff -> confirmation -> undo est
verifiable dans App et CLI.

## Phase 5 - distribution, documentation et durcissement

- packaging signe Tauri Windows/macOS/Linux et updater;
- installateur CLI, update, repair, uninstall et reset coherents;
- documentation Web et Markdown avec exemples executes;
- tests E2E auth/chat/device flow et tests desktop critiques;
- threat model, redaction secrets, CSRF, rotation sessions, audit logs,
  permissions Tauri et limites provider;
- monitoring, status page et procedure de release.

Sortie: les scenarios de validation Web, CLI et App sont automatises sur les
environnements supportes, avec les limitations locales explicites.

## Premiere implementation a effectuer

La premiere implementation ne doit pas commencer par une landing page. Elle
doit proteger le socle existant:

1. creer les packages de contrats/configuration et leur pipeline de tests;
2. extraire providers, scanner, trust, patch et AI runtime sans changer leur
   API publique CLI;
3. corriger les mutations directes des outils et le cwd shell;
4. ajouter un test de non-regression du flux `aegis` dans un workspace temporaire;
5. seulement ensuite creer le squelette executable de `apps/api` et `apps/web`.

Cette sequence permet de construire Web et App sur le vrai moteur Aegis, sans
dupliquer une logique de provider ou de securite dans chaque produit.

