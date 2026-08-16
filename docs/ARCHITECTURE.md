# Architecture cible Aegis

Aegis est un ecosysteme de trois produits avec une meme identite, un meme
contrat de donnees et des politiques de securite compatibles:

- **Aegis Web**: produit navigateur et surface publique.
- **Aegis App**: application desktop native pour projets locaux.
- **Aegis CLI**: assistant terminal installe globalement.

L API Aegis et les packages partages ne sont pas un quatrieme produit visible;
ils fournissent les services communs.

## Monorepo cible

```text
apps/
  web/                  Next.js, React, TypeScript
  desktop/              Tauri 2, React, TypeScript, Rust minimal
  cli/                  Node.js, TypeScript, interface terminal
  api/                  API HTTP, SSE, auth et synchronisation

packages/
  core/                 contrats metier et orchestration sans UI
  types/                schemas Zod et types publics
  auth/                 sessions, verification email, device flow
  database/             Prisma, migrations et repositories
  providers/            adapters Ollama, LM Studio et APIs compatibles
  ai-runtime/           streaming, messages, model routing, cancellation
  project-engine/       scan, exclusions, contexte, trust, patches
  agent-engine/         plans, outils, approvals, executions, audit
  security/             secrets, redaction, permissions, rate limits
  config/               configuration partagee, defaults et migrations
  shared-ui/            tokens, composants Web/App accessibles
  desktop-ui/           composants propres a Aegis App
  cli-ui/               rendu ANSI, prompts et mode non-interactif

docs/
scripts/
```

La migration commencera par le monorepo, mais le package racine restera
executable pendant la transition pour ne pas casser `aegis`.

## Regles de dependance

1. `packages/types` ne depend d aucun runtime applicatif.
2. `packages/core` depend de ports abstraits, jamais de React, Tauri ou ANSI.
3. `packages/providers` ne connait ni la base de donnees ni les composants UI.
4. `packages/project-engine` traite les fichiers comme donnees non fiables et
   ne lit jamais automatiquement secrets, binaires ou dossiers ignores.
5. `packages/agent-engine` ne peut pas appliquer une mutation sans une
   autorisation explicite fournie par la surface appelante.
6. `apps/api` est la seule surface serveur qui accede a `database`.
7. `apps/web` et `apps/desktop` utilisent les memes schemas et services de
   domaine, mais l App garde les operations locales dans son bridge Tauri.
8. `apps/cli` peut fonctionner sans compte avec un provider local; le compte
   sert a l identite, aux preferences et a la synchronisation optionnelle.

## Responsabilites des produits

### Aegis Web

Routes publiques: `/`, `/download`, `/docs`, `/privacy`, `/terms`, `/status`.
Routes compte: `/login`, `/register`, `/verify-email`, `/forgot-password`,
`/reset-password`, `/account`, `/security`.
Routes produit: `/dashboard`, `/chat`, `/projects`, `/models`, `/providers`,
`/cli`, `/settings`.

Le Web ne lit jamais un projet local. Il affiche uniquement les metadonnees et
le contenu que l utilisateur a choisi de synchroniser.

### Aegis App

L App est une application native qui ajoute ce qu un navigateur ne peut pas
faire proprement: ouverture de dossier, scanner local, detecteurs Ollama/LM
Studio, terminal, notifications, keychain, sessions CLI et updater.

Le frontend React communique avec des commandes Tauri et non avec un acces
filesystem arbitraire depuis la webview. Toute operation sensible passe par une
permission explicite et produit un evenement d audit local.

### Aegis CLI

La CLI garde la commande `aegis` et les commandes historiques. Elle ajoute
progressivement:

- `aegis login`, `logout`, `whoami`, `devices` via device flow;
- une configuration partagee avec l App;
- des sessions locales reprenables;
- un protocole IPC local authentifie avec Aegis App;
- un moteur de patches qui ne modifie jamais un fichier sans approbation.

## Noyau metier partage

Les contrats suivants doivent etre stables entre les trois surfaces:

- `User`, `Session`, `DeviceAuthRequest`;
- `ProviderConnection`, `Model`, `ModelCapability`;
- `Project`, `WorkspaceTrust`, `ProjectPolicy`;
- `Conversation`, `Message`, `ConversationSyncPolicy`;
- `CliSession`, `AgentRun`, `AgentStep`, `Approval`;
- `Patch`, `PatchFile`, `PatchHunk`, `UndoRecord`;
- `PrivacyMode`: `local`, `remote-provider`, `synced`, `private`.

Les schemas Zod sont la frontiere de validation HTTP, IPC, configuration et
persistance. Les types TypeScript en sont derives.

## Flux d authentification

1. Web cree un compte avec mot de passe hache et email non verifie.
2. API emet un token de verification a usage unique avec expiration.
3. Web cree une session HTTP secure et httpOnly apres verification.
4. CLI/App demandent un `DeviceAuthRequest` a duree courte.
5. Le navigateur authentifie l appareil, affiche le code et demande une
   confirmation explicite.
6. API remet un refresh token rotatif; le client le conserve dans le keychain
   systeme quand il est disponible.

Un token CLI ne doit jamais etre place dans `config.json` en clair. Le mode
local reste utilisable sans compte et sans appel a l API Aegis.

## Flux IA et confidentialite

- **Local**: le contexte projet va directement d App/CLI vers Ollama ou LM
  Studio. L API Aegis ne recoit ni code ni conversation sauf opt-in.
- **Remote provider**: le contexte va au provider configure par l utilisateur;
  l UI indique clairement le provider et la portee des donnees.
- **Synced**: seuls les messages et metadonnees explicitement autorises sont
  envoyes a Aegis API.
- **Private**: conversation conservee localement et exclue de la sync.

Le streaming adopte un contrat evenementiel commun (`message.delta`,
`message.completed`, `tool.proposed`, `approval.required`, `error`). L API
utilise SSE; l App et la CLI peuvent aussi consommer un flux local.

## Base de donnees cible

PostgreSQL est la cible production. SQLite est reserve au developpement local et
aux tests. Les repositories isolent Prisma du reste du code.

Entites minimales: `User`, `AccountSession`, `EmailToken`, `DeviceAuthRequest`,
`Provider`, `Model`, `Project`, `Conversation`, `Message`, `CliSession`,
`AgentRun`, `Approval`, `AuditEvent`.

Les secrets provider sont references par un identifiant de coffre-fort et ne
sont jamais exposes dans les reponses API. Les chemins locaux de projet restent
sur l appareil; le serveur ne conserve qu un identifiant d appareil et des
metadonnees opt-in.

## Mapping depuis le depot actuel

| Actuel | Cible | Action |
| --- | --- | --- |
| `src/types/index.ts` | `packages/types` | extraire et remplacer par schemas |
| `src/providers/*` | `packages/providers` | conserver les adapters et tests |
| `src/core/projectScanner.ts`, `fileReader.ts` | `packages/project-engine` | extraire, durcir les exclusions |
| `src/core/patchManager.ts` | `packages/project-engine` | ajouter hunks, backup et undo |
| `src/core/safetyManager.ts` | `packages/security` | policies partagees et audit |
| `src/core/aiClient.ts` | `packages/ai-runtime` | port streaming/cancellation |
| `src/core/session.ts` | `apps/cli` + `packages/core` | separer orchestration et rendu |
| `src/ui/*`, `src/tui/*` | `packages/cli-ui` | garder ANSI, retirer du domaine |
| `src/core/historyManager.ts` | local store + `apps/api` repository | conserver format avec migration |
| `install.ps1`, `install.bat`, `install.sh` | `scripts/install` | conserver comme compatibilite CLI |

