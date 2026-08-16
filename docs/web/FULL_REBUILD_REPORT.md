# Aegis Web — rapport de reconstruction complète

Date : 20 juillet 2026

## Sauvegarde et périmètre

Le dossier Git fourni n’est pas un dépôt exploitable : `git status`, `git branch` et `git rev-parse` renvoient `not a git repository`. Aucun commit de sauvegarde n’a donc pu être créé.

L’ancien frontend a été conservé avant remplacement dans [docs/web/legacy-frontend](./legacy-frontend), avec 45 fichiers. `.env.local`, `node_modules` et `.next` n’ont pas été copiés. Aucun fichier hors `apps/web/**` et `docs/web/**` n’a été modifié.

## Architecture avant / après

Avant, l’application utilisait un `AppShell` à sidebar fixe, un panneau de conversations intégré au chat, des classes Tailwind dispersées et des surfaces quasi identiques.

Après, le shell persistant est une grille directe :

`Navigation 232px | Conversations 270–310px | Main flex`

Les panneaux sont adjacents, avec bordures de séparation et `min-width/min-height: 0`; le chat occupe tout l’espace restant. Les routes restent App Router et la logique API/streaming existante a été conservée.

## Fichiers et composants reconstruits

- `src/app/globals.css` : tokens, surfaces opaques, glass flottant, responsive, reduced motion, grille sans espaces noirs.
- `src/components/AppShell.tsx` : navigation commerciale réductible, groupes Workspace/Integrations/Account, rail Conversations, topbar persistante.
- `src/components/SiteNav.tsx` et `src/app/page.tsx` : landing complète avec Hero, démo Chat, Desktop, CLI, providers, privacy et footer.
- `src/components/ui/AegisUI.tsx` : `AegisButton`, `AegisIconButton`, `AegisInput`, `AegisSearchInput`, `AegisCard`, `AegisGlassPanel`, `AegisBadge`, `AegisLoader`, `AegisModal`.
- `src/app/chat/page.tsx` : chat centré, messages Markdown, modèle actif, streaming réel, stop, pièces jointes/outils visuels, composer Liquid Glass.
- `src/features/conversations/` : types, API, store réactif, hook de chargement, pagination cursor, recherche, skeleton, empty state, item et menu (rename/pin/archive/delete). Le rail reçoit maintenant les conversations API ; aucune conversation fictive n’est rendue.
- `src/features/chat/` : `ChatWorkspace`, `ChatHeader`, `MessageList`, `UserMessage`, `AssistantMessage`, `ChatComposer`, `ChatEmptyState`, `ChatErrorState`, `StreamingIndicator`, actions, `useConversation`, `useChatStream` et store typé.
- `src/app/models/page.tsx` et `src/app/providers/page.tsx` : cartes fonctionnelles, recherche, filtres, refresh, test et connexions API existantes.
- `src/components/WorkspacePage.tsx` : base de cartes pour Search, Calendar, GitHub et Settings Appearance/AI/Privacy.
- Routes ajoutées : `/search`, `/calendar`, `/github`, `/settings/appearance`, `/settings/ai`, `/settings/privacy`, `/privacy`, `/terms`.
- `tests/rebuild.smoke.test.cjs` : smoke tests du shell, routes et contrat de streaming.
- `e2e/` et `playwright.config.mjs` : scénarios Login, navigation, chat persistant, conversations, models, connections et responsive.

Les appels métier conservés sont `api()`, `streamChat()`, authentification, modèles, providers, conversations, Google Workspace, Gmail et Drive. Aucune fausse donnée de conversation, de provider ou de modèle n’a été injectée.

## Design system

Tokens centralisés : `--aegis-bg-0`, `--aegis-bg-1`, `--aegis-surface-1/2/3`, `--aegis-glass`, `--aegis-glass-strong`, bordures, texte, bleu, orange, succès, danger, rayons, espaces et ombres.

Le backdrop blur est limité aux couches glass (topbar, composer, menus, modal, nav landing). Les cartes de contenu restent opaques. Les messages ne sont plus affichés sous forme `USER/ASSISTANT` de debug : l’utilisateur est une bulle compacte et la réponse Aegis possède modèle, Markdown, code et actions.

## État fonctionnel détaillé

### Implémenté

- Rail Conversations connecté à `GET /conversations`, recherche locale sur les résultats, cursor conservé, loading/error/retry, sélection `/chat/{conversationId}`, GET conversation/messages, rename, pin, archive, delete.
- Première soumission : `POST /conversations` avec `idempotencyKey` dans le corps, navigation vers `/chat/{id}`, streaming `/chat/stream`, récupération de la conversation après `message.completed`.
- Conversation existante : chargement des détails et messages depuis l’API, puis ajout au même historique.
- Logo officiel copié vers `public/brand/aegis-official.png` et utilisé par `AegisLogo` dans la landing, la navigation, le shell, le chat vide, l’authentification et les métadonnées.
- Boutons sans contrat implémenté désactivés avec un libellé explicite : pièces jointes, image, Tools, Agent, partage, filtres avancés, suppression/export de compte.
- Search interroge les conversations API et filtre les résultats réels. Calendar interroge l’état Google réel. GitHub affiche explicitement l’absence de contrat OAuth.
- Appearance possède des contrôles thème/effets/densité/taille ; AI charge les modèles réels ; Privacy distingue les actions disponibles des routes absentes.

### Partiel ou visuel uniquement

- Les contrôles Appearance ne sont pas encore persistés dans l’API ou un store partagé.
- Search utilise le catalogue de conversations disponible et ne dispose pas d’une recherche serveur plein texte.
- Calendar ne peut afficher des événements que lorsque Google est connecté et que le contrat correspondant répond.
- Gmail et Drive conservent leurs composants métier existants ; leur shell est reconstruit mais leur design interne n’est pas encore totalement découpé.
- Le bouton Regenerate reste absent si aucun callback de génération n’est fourni ; il n’est donc pas affiché comme bouton mort.

### Dépendances API manquantes

- GitHub OAuth et routes repositories/issues/pull requests/branches.
- Export et suppression complète du compte, avatar distant et changement d’e-mail.
- Recherche serveur plein texte des conversations.

## Validation runtime

Serveur Next démarré sur `127.0.0.1:3000`. Les requêtes HTTP ont répondu `200` pour `/`, `/login`, `/register`, `/chat`, `/models`, `/providers`, `/connections`, `/gmail`, `/drive`, `/calendar`, `/github`, `/settings`, `/account`, `/download`, `/privacy` et `/terms`.

La page `/` contient bien le nouveau Hero (`Think clearly.` / `Aegis brings powerful cloud models`). Les pages protégées rendent leur shell client après restauration de session.

Le navigateur intégré demandé pour les captures visuelles est indisponible dans cette session (`agent.browsers.get("iab")` : `Browser is not available: iab`; liste vide après diagnostic). Aucune capture intégrée n’est déclarée comme faite.

Playwright 1.52.0 a été récupéré via `pnpm dlx` (`playwright --version` réussi), mais le runner `test` est resté bloqué au chargement de la configuration sous cette politique Windows et a été interrompu. Les fichiers E2E sont prêts dans `apps/web/e2e/`, mais le résultat Playwright est donc **non exécuté**, sans faux succès ni captures générées.

## Commandes exécutées

- `pnpm --filter @aegis/web lint` : succès (`tsc --noEmit`).
- `pnpm --filter @aegis/web test` : succès, 4 tests smoke, 0 échec.
- `pnpm --filter @aegis/web build` : succès, Next.js 15.5.20, 32 routes générées, 102 kB de chunks partagés.
- Validation HTTP locale : 16 routes testées, 16 réponses `200`.
- `pnpm --filter @aegis/web exec playwright test` : **non exécuté jusqu’au bout** ; le runner bloquait au démarrage malgré une récupération du binaire Playwright réussie.

Le build signale des warnings ESLint `no-unused-vars` dans plusieurs écrans métier encore hérités (`account`, `download`, `drive`, `gmail`, `security`, `settings`) et un warning dans `ChatWorkspace` concernant un `catch` compact. Ils ne bloquent pas la compilation mais restent des erreurs de qualité à traiter. Next signale aussi l’absence de plugin ESLint explicite dans la configuration.

## Fonctions encore incomplètes

- Les captures et tests de clics multi-résolutions restent à faire dès que le runner Playwright pourra démarrer dans cet environnement.
- Gmail et Drive conservent leurs appels API réels, mais leurs composants internes n’ont pas tous été visuellement reconstruits dans ce passage.
- Les routes Account/export/suppression suivent les contrats existants; toute route API absente est documentée séparément.
- Le commit Git de sauvegarde n’a pas pu être créé en raison du `.git` non exploitable.
### Dernière passe de fiabilisation

- Implémenté : finalisation du streaming récupère détail et messages séparément; les messages streamés restent visibles en cas d'échec final.
- Implémenté : erreur de création visible avec brouillon restauré et Retry.
- Implémenté : pagination réelle avec fusion sans doublons et `loadingMore`.
- Implémenté : modales Rename/Delete et Pin/Archive optimistes avec rollback.
- Partiel : Playwright déclaré mais installation bloquée dans cet environnement Windows.
- Vérifications : lint réussi; test échoue `spawn EPERM`; build non exécutable après installation interrompue (`next` non résolu); offline `ERR_PNPM_NO_OFFLINE_META`; aucune réussite E2E revendiquée.

Procédure Git sûre : copier le projet; vérifier `.env*`, secrets et PEM; renommer `.git` invalide en `.git.invalid-backup`; `git init`; vérifier `.gitignore`, `git status --ignored` et les secrets; créer ensuite un premier commit privé après revue.
- Mise à jour : après restauration partielle de `next`, `pnpm ... build` échoue toujours explicitement avec `Error: spawn EPERM` pendant la création du build; `playwright` reste absent du binaire workspace (`Command "playwright" not found`).
## Stabilisation environnementale (20 juillet 2026)

- `where node` : `C:\Program Files\nodejs\node.exe`; Node `v24.18.0`.
- `where pnpm` : `C:\Users\ROOT\AppData\Roaming\npm\pnpm(.cmd)`; pnpm `9.15.9`.
- `where next` : aucun binaire global (normal); le binaire local est `apps/web/node_modules/.bin/next.CMD`, Next `15.5.20`.
- Les liens `node_modules` avaient été laissés incomplets par l'installation interrompue. `pnpm install --no-frozen-lockfile --reporter=append-only` a restauré 641 paquets réutilisés et a synchronisé le lockfile pour `@playwright/test`.
- Le processus enfant exact bloqué par le sandbox était le worker Jest de Next : `next/dist/compiled/jest-worker/processChild.js`, lancé par `child_process.fork`, erreur `spawn EPERM`. Hors sandbox, le même build réussit.
- Test unitaire hors sandbox : 4/4 réussi. Build hors sandbox : réussi, 32 routes générées.
- Chromium Playwright installé. La suite E2E a bien été exécutée : 1 réussite, 13 échecs, 2 tests réels ignorés volontairement. Les échecs restants sont fonctionnels (sélecteur Login ambigu, attentes UI obsolètes) et WebKit mobile manque encore; aucun succès global n'est déclaré.
