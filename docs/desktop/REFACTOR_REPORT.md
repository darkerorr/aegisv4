# Aegis Desktop — journal technique du refactor

Date de l’audit : 20 juillet 2026  
Périmètre d’écriture respecté : `apps/desktop/**`, `docs/desktop/**`.

## Architecture observée avant modification

- Frontend : React 19.1, TypeScript 5.8, Vite 7.1, Framer Motion et Lucide.
- Shell natif : Tauri 2.11 / Rust 2021, WebView2 sous Windows.
- Navigation : état React interne (`SidebarContext`), sans routeur et sans rechargement complet.
- State management : Context API (`AuthContext`, `ChatContext`, `SettingsContext`, `SidebarContext`). Les modèles et fournisseurs étaient mélangés dans `ChatContext`.
- Réseau Cloud : `@aegis/api-client` avec cookies, timeout de 12 s et un retry. Santé, auth, conversations, providers, modèles, chat stream, compte, sessions et Google passaient par l’API Aegis.
- Réseau local : appels directs WebView vers Ollama/LM Studio en mode navigateur, ou trois commandes Rust génériques (`list_local_models`, `stream_local_chat`, `cancel_local_chat`) dans Tauri.
- Stockage : `localStorage` pour réglages non sensibles, conversation locale unique, projets, favoris, sidebar et URL API. Aucun coffre système n’était utilisé.
- Chat : `ChatPage`, `ChatContext`, liste de messages, streaming, composer et sélecteur de modèle inline dans un popover difficile à maintenir.
- NVIDIA/OpenRouter : uniquement via `ProvidersPage` et l’API Aegis en mode Cloud. En mode local, la branche de code classait tout fournisseur différent d’Ollama comme LM Studio.
- Ollama/LM Studio : détection et chat Rust présents, avec fallback `fetch` direct dans le navigateur de développement.
- Sidecars/capabilities : aucun dossier `src-tauri/binaries`, aucun dossier `src-tauri/capabilities`, aucun sidecar et aucun plugin shell.

## Processus lancés au démarrage

### Développement

`pnpm tauri:dev` lance Cargo/Tauri et la commande `beforeDevCommand` `pnpm dev`; celle-ci lance Vite dans un processus Node et son service esbuild. Ces processus sont des outils de développement uniquement. La WebView charge `http://127.0.0.1:1420`.

### Release

Le démarrage autonome doit lancer `aegis-app.exe` et les processus WebView2 gérés par Windows. Il ne lance ni Node, ni Next.js, ni serveur local, ni `.bat`. L’unique `std::process::Command` du code source ouvre un lien explicitement demandé via `rundll32.exe`.

### Installateur

L’installateur NSIS est un exécutable GUI (sous-système PE 2). Il installe le même `aegis-app.exe`; le défaut de console provenait donc du binaire applicatif installé.

## Reproduction du terminal avant correction

- Exécutable inspecté : `apps/desktop/src-tauri/target/release/aegis-app.exe`.
- Sous-système PE mesuré : `3` (`IMAGE_SUBSYSTEM_WINDOWS_CUI`).
- Arbre de processus observé : `aegis-app.exe` PID 9096 → `conhost.exe` PID 22188.
- Installateur inspecté : `Aegis App_0.3.0_x64-setup.exe`, sous-système PE `2` (`WINDOWS_GUI`), sans processus console enfant.
- Cause exacte : `src-tauri/src/main.rs` ne contenait pas `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`. Windows attachait donc `conhost.exe` au binaire release avant l’initialisation Tauri.

## Cause exacte du parcours NVIDIA cassé

Dans l’ancien `ProvidersPage`, le mode local choisissait `ollama` uniquement pour `provider.kind === "ollama"`; toute autre valeur, y compris NVIDIA et OpenRouter, tombait sur `lm-studio`. Le clic Connect interrogeait alors `http://127.0.0.1:1234/v1/models`, sans utiliser la clé NVIDIA, sans écrire de connexion locale et sans mettre à jour un cache natif. En mode Cloud, le parcours dépendait entièrement de l’API Aegis et ne répondait donc pas à l’architecture BYOK local-first.

## Architecture mise en place

Le flux local devient : React → commandes Tauri typées → `ProviderRegistry` Rust → fournisseur → `Channel` Tauri → React.

- Registre et adaptateurs Rust séparés pour NVIDIA, OpenRouter, Ollama, LM Studio et OpenAI-compatible.
- Entrées `serde` avec `deny_unknown_fields`, validation des identifiants, rôles, longueurs et URLs.
- Stockage des clés dans le coffre système via `keyring` 4.1 (Windows Credential Manager, Keychain, Secret Service selon la plateforme).
- `providers.json` ne contient que les métadonnées non sensibles et `secretRef`.
- Cache non sensible des modèles dans le dossier de configuration applicatif.
- Suppression d’une connexion : suppression préalable du secret du coffre, puis métadonnées et cache.
- Timeouts, normalisation des erreurs, request ID, statut HTTP, endpoint logique et durée gérés en Rust.
- Streaming et annulation centralisés; aucune clé n’entre dans le state React, le localStorage ou les logs frontend.
- Logs techniques natifs dans le dossier `app_log_dir`, accessibles depuis Diagnostics.
- Nouveau `modelStore` dédié : modèles, providers, sélection, favoris, récents, cache, chargement, erreur, recherche et filtres.
- `ModelSelector` permanent dans le composer avec clavier et virtualisation.
- Layout chat reconstruit en chaîne flex avec `min-height: 0`; le composer est un enfant `flex: none` relatif, sans positionnement absolu lié à la fenêtre.

## Correction NVIDIA et résultat réel

La découverte seule ne suffit pas à valider NVIDIA : le 20 juillet 2026, un appel réel à `GET https://integrate.api.nvidia.com/v1/models` avec une clé volontairement invalide a répondu `200`. L’adaptateur effectue donc maintenant, après la découverte, une sonde authentifiée `POST /chat/completions` de **1 token** sur un modèle de chat choisi dynamiquement. Le même test réel avec la clé invalide a répondu `403`; le résultat normalisé est `invalid-key` / `The NVIDIA API key was rejected.` et le secret temporairement écrit est supprimé avant toute persistance de connexion.

Aucune vraie clé NVIDIA n’était disponible dans l’environnement. Le test de connexion valide ne peut donc pas être déclaré réussi : **0 modèle NVIDIA authentifié récupéré**. Le catalogue public répond, mais son nombre n’est volontairement pas présenté comme le nombre de modèles du compte. Le parcours valide reste à accepter manuellement avec une vraie clé.

Le runtime local a en revanche réellement détecté Ollama : `GET http://127.0.0.1:11434/api/tags` a répondu avec **1 modèle**, mis en cache dans `%APPDATA%\com.aegis.desktop\provider-models.json`. LM Studio à `127.0.0.1:1234` était arrêté/injoignable.

## Processus et stockage observés après modification

Le premier lancement debug corrigé a produit `target\debug\aegis-desktop.exe` (PID 15444). Son seul enfant direct était `msedgewebview2.exe`; aucun `node.exe`, `cmd.exe`, `powershell.exe` ou `conhost.exe` n’était enfant de l’application. Node/Vite restaient présents uniquement dans la chaîne d’outillage `tauri dev`.

Le journal natif a été créé à `%LOCALAPPDATA%\com.aegis.desktop\logs\aegis-desktop.log`. Les métadonnées non sensibles sont dans `%APPDATA%\com.aegis.desktop\providers.json`; elles contenaient uniquement les connexions intégrées Ollama/LM Studio et aucune clé. Le cache des modèles est séparé.

Le premier `tauri dev` a aussi reproduit un plantage Windows `EBUSY` : Vite surveillait `src-tauri/target/debug/deps/aegis_desktop_lib.dll` pendant que Cargo la verrouillait. `vite.config.ts` exclut désormais `src-tauri/target/**` et `src-tauri/target-*/**`; le second lancement a compilé et lancé l’application sans ce plantage.

## ModelSelector et layout

`ModelSelector` est rendu dans `ChatPage`, dans la rangée inférieure permanente du composer, à côté du bouton Send. Il utilise `modelStoreContext` et expose recherche auto-focalisée, Recommended, Recent, Favorites, Local, Online, groupes fournisseurs, neuf filtres, clavier `ArrowUp/ArrowDown/Enter/Escape` et fenêtre virtualisée au-delà de 80 résultats.

Le correctif du composer n’utilise ni `absolute`, ni compensation arbitraire : `desktop-shell` fait `height: 100dvh; overflow: hidden`; la colonne centrale et la zone chat sont des flex columns avec `min-height: 0`; `chat-messages` fait `flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain`; `composer-section` fait `position: relative; flex: none; margin-top: auto`. Un contrat CSS teste aussi la media query de petite hauteur.

## Fichiers ajoutés ou modifiés

- Configuration/native : `apps/desktop/vite.config.ts`, `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`.
- Couche providers : `src-tauri/src/providers/{mod,registry,error,model,secret_store,nvidia,openrouter,ollama,lm_studio,openai_compatible}.rs`.
- État et bridge frontend : `src/features/providers/providerClient.ts`, `src/features/models/modelStore.ts`, `modelStoreContext.tsx`, `components/ModelSelector.tsx`, `src/api/client.ts`, `src/contexts/ChatContext.tsx`, `SidebarContext.tsx`, `src/App.tsx`.
- UI : `src/pages/{Chat,Models,Providers,Account,Diagnostics}Page.tsx`, `src/components/ui/AegisUI.tsx`, `src/components/Sidebar.tsx`, `src/styles.css`.
- Tests et documentation : `src/desktop-acceptance.test.ts`, `docs/desktop/REFACTOR_REPORT.md`, `docs/desktop/API_REQUIREMENTS.md`.

Composants de design system disponibles : `AegisButton`, `AegisIconButton`, `AegisInput`, `AegisTextarea`, `AegisSelect`, `AegisCard`, `AegisGlassPanel`, `AegisModal`, `AegisDrawer`, `AegisDropdown`, `AegisTooltip`, `AegisToast`, `AegisBadge`, `AegisAvatar`, `AegisSkeleton`, `AegisEmptyState`, `AegisErrorState`, `AegisStatus`, `AegisLogo`.

## Commandes exécutées et résultats

- `pnpm --filter @aegis/desktop lint` : **succès**, `tsc --noEmit`, code 0.
- `pnpm --filter @aegis/desktop test` : **succès**, 3 fichiers et **14 tests réussis**, 0 échec, 1,12 s.
- `cargo test` : **succès**, **5 tests réussis**, 0 échec. Couvre parsing de streams, allowlist, sérialisation sans secret, absence d’une clé connue dans tous les fichiers de configuration et suppression réelle de la référence de coffre.
- `pnpm --filter @aegis/desktop build` : **succès**, Vite 7.3.6, 2022 modules, JS 461,89 kB (141,27 kB gzip), CSS 56,37 kB (11,45 kB gzip), 3,90 s.
- `pnpm --filter @aegis/desktop tauri:build` : **échec environnemental** après un nouveau build frontend réussi. Windows Application Control bloque le chargement des DLL Rust release générées (`schemars_derive`, `thiserror_impl`) avec `LoadLibraryExW ... os error 4551`; les erreurs `E0463` sur `windows`, `windows_core` et `thiserror_impl` en découlent. Plusieurs tentatives, y compris un target release neuf, ont reproduit la même politique.

Le dernier exécutable release présent est l’ancien artefact `apps/desktop/src-tauri/target/release/aegis-app.exe`; il est daté du 20 juillet 2026 à 02:34:58, utilise encore le sous-système CUI et **ne doit pas être livré**. Aucun nouvel exécutable/installateur release n’a été produit, donc aucun chemin d’exécutable final valide ne peut être fourni. Le source corrigé contient bien l’attribut `windows_subsystem = "windows"`, mais l’inspection PE finale et le lancement autonome release restent bloqués tant que la politique WDAC n’autorise pas les artefacts Cargo release.

Le navigateur intégré requis pour la QA visuelle n’était pas exposé (`agent.browsers.list() = []`, puis `Browser is not available: iab`). Les scénarios visuels 1366×768, échelles 125/150 %, panneau droit, pièce jointe et streaming long n’ont donc pas été certifiés manuellement. Aucune validation visuelle n’est déclarée à tort.

## Fonctions restant à terminer ou accepter

- Validation NVIDIA avec une vraie clé, nombre réel de modèles du compte, envoi et streaming réels : bloqués par l’absence de credential de test.
- Bundle release, installateur, inspection PE et redémarrage autonome : bloqués par Windows Application Control.
- QA visuelle WebView2 aux tailles/échelles demandées : bloquée par l’absence du navigateur intégré dans cette session.
- Ollama : le démarrage contrôlé, le téléchargement progressif et la suppression avec confirmation ne sont pas implémentés; la détection, le refresh, la liste et le chat/streaming sont présents.
- Compte Cloud : avatar synchronisé, modification d’e-mail, export complet et suppression du compte attendent les routes consignées dans `API_REQUIREMENTS.md`; l’interface affiche explicitement leur indisponibilité et ne simule pas de réussite.
- Vérification de branche : `git status` et `git branch` répondent `not a git repository` car le `.git` fourni n’est pas exploitable; la branche `agent/desktop` n’a pas pu être attestée. Aucun fichier hors des deux périmètres autorisés n’a été modifié.
