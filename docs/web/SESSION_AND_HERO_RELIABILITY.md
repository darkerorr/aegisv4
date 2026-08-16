# Session globale et fiabilité du Hero 3D

Date de validation : 23 juillet 2026

## Résultat

La landing partage maintenant la même session que le login et le workspace. Un utilisateur authentifié voit `Open workspace`, son avatar et les CTA `Open your workspace` / `New conversation`; la landing ne redirige pas automatiquement l'utilisateur. Une panne réseau est distincte d'une déconnexion et n'affiche pas `Sign in` à tort.

La scène du Hero conserve un visuel Aegis noir et blanc jusqu'à ce que le canvas WebGL soit réellement créé. Elle ne peut plus laisser une zone vide pendant l'import du module, après une navigation, avec reduced motion, sur mobile ou sans WebGL.

## Causes reproduites

### Session non reconnue

Deux chemins d'authentification implicites existaient, mais aucune source de vérité globale :

1. le formulaire de login appelait directement l'API puis naviguait vers `/chat` ;
2. le workspace chargeait ses données indépendamment.

La navbar marketing était statique et rendait toujours `Sign in` / `Start free`. Aucun `AuthProvider`, query `/auth/me` partagée ou état racine ne pouvait la mettre à jour après un login ou au retour depuis `/chat`.

La source de vérité retenue est désormais une seule query TanStack `['auth', 'current-user']`, exposée par un `AuthProvider` monté dans `AppProviders` sous le `RootLayout`. Elle couvre tous les route groups : marketing, auth et workspace.

États explicites :

- `loading` : espace réservé stable, sans flash `Sign in` ;
- `authenticated` : utilisateur et actions privées ;
- `anonymous` : réponse 401 `AUTH_REQUIRED` seulement ;
- `session-expired` : réponse 401 dédiée ;
- `error` : panne réseau/API, sans la convertir en logout.

La stratégie choisie est un chargement client immédiat avec rendu indéterminé stable. La landing reste statique et rapide; aucun token ou cookie n'est exposé au rendu serveur. Après login/register, le formulaire injecte immédiatement l'utilisateur retourné dans la query avant la navigation. Après logout, les queries privées sont vidées.

### Hero parfois absent

Deux causes concrètes ont été trouvées :

1. `hero-scene.tsx` retirait le fallback après un délai fixe de 180 ms, indépendamment de l'état réel du module Three.js et du canvas. Le chargement dynamique retournait `null`, créant une zone vide sur réseau lent ou pendant une navigation.
2. la scène utilisait `<Environment preset="city" />`, ressource asynchrone non locale, sans Suspense ni error boundary dédiée. Une suspension ou erreur pouvait intervenir après le retrait prématuré du fallback.

La nouvelle scène ne contient aucun asset 3D distant : noyau, anneaux, lumières et particules sont des géométries et matériaux locaux. Le fallback n'est retiré qu'après `Canvas.onCreated` et une frame de rendu.

## Architecture créée

- `features/auth/auth-provider.tsx` : état global, invalidation et logout ;
- `features/auth/auth-query.ts` : définition unique de `/auth/me` ;
- `features/auth/use-auth.ts` : accès typé au contexte ;
- `lib/auth/get-current-user.ts` : appel centralisé avec `credentials: include` via l'API client ;
- `components/marketing/hero-actions.tsx` : CTA adaptés à la session ;
- `components/three/GlobalIntelligenceScene.client.tsx` : canvas isolé, sans ressource distante ;
- `components/three/GlobalIntelligenceFallback.tsx` : orbe et anneaux CSS noirs et blancs ;
- `components/three/SceneErrorBoundary.tsx` : confinement des erreurs 3D et retry ;
- `components/three/use-webgl-support.ts` : détection WebGL ;
- `components/three/use-scene-visibility.ts` : ResizeObserver, IntersectionObserver et visibilité document.

Le conteneur a une largeur de 100 %, un `min-height` de 470 px sur desktop, un ratio stable et un canvas forcé à 100 % de sa surface. Sur la capture 1280 × 720, la scène occupe environ la moitié droite du Hero; sur mobile 390 × 844, son conteneur reste à 440 px.

## Cycle de vie 3D

- montage uniquement après mesure non nulle et détection WebGL positive ;
- identité React stable, sauf remount volontaire lors d'un retry ou d'une restauration de contexte ;
- fallback maintenu pendant import et création du canvas ;
- error boundary avec message discret et `Retry visual` ;
- gestion de `webglcontextlost` / `webglcontextrestored` avec nettoyage des listeners ;
- pause via `frameloop="demand"` hors viewport, onglet caché ou reduced motion ;
- DPR limité à `[1, 1.5]` ;
- mode mobile simplifié et particules supprimées sur appareil faible ;
- aucun chargement Three.js dans les routes workspace.

Les objets essentiels sont nommés dans la scène : `AegisCore`, `PrimaryRing`, `SecondaryRing`, `TertiaryRing`, `LightingRig`, `Environment` (lumière locale) et `AegisHeroCamera`.

## Cookies et CORS vérifiés

Aucune modification API n'était nécessaire.

- cookie développement : `HttpOnly`, `Path=/`, `SameSite=Lax`, sans `Domain`, `Secure` uniquement en production ;
- origines locales autorisées explicitement : `http://127.0.0.1:3000` et `http://localhost:3000` ;
- `Access-Control-Allow-Origin` reflète uniquement une origine autorisée ;
- `Access-Control-Allow-Credentials: true` ;
- `Vary: Origin` ;
- requêtes `OPTIONS` traitées avant les routes protégées ;
- le client API envoie les credentials.

L'hôte de référence pour les validations est `127.0.0.1` côté Web (3000) et API (4000).

## Validation navigateur

La première passe a révélé un ancien serveur `next dev` Aegis, PID 9168, encore en écoute sur le port 3000. Il avait écrit dans `.next` pendant un build de production : Chromium recevait l'HTML, mais les chunks CSS/JS étaient incompatibles. Le processus Aegis identifié a été arrêté, le cache généré `apps/web/.next` supprimé, puis un build propre a été produit. Playwright utilise maintenant `next start` et valide les véritables artefacts de production.

Résultats finaux :

- lint : succès, aucune erreur ou warning ESLint ;
- Vitest : 2/2 ;
- build Next.js : succès, 31 routes, landing à 47,7 kB / 171 kB first load ;
- Playwright complet final : 19/19 en 46,3 secondes, y compris nouvel onglet, précédent/suivant et perte/restauration du contexte WebGL ;
- dix rechargements successifs : succès ;
- erreurs de page : aucune ;
- assets same-origin en 404 : aucun dans le scénario Hero ;
- fallback WebGL : succès ;
- reduced motion : succès ;
- mobile 390 × 844 : succès ;
- retour arrière landing/login/workspace : succès.

La validation par le navigateur intégré Codex n'a pas pu être utilisée : aucun navigateur contrôlable n'était enregistré dans l'environnement (`[]`). La validation réelle a donc été effectuée avec Chromium Playwright installé dans le projet.

## Captures

Dans `apps/web/test-results/screenshots/` :

- `home-anonymous.png` ;
- `home-authenticated.png` ;
- `hero-3d-loaded.png` ;
- `hero-3d-fallback.png` ;
- `hero-reduced-motion.png` ;
- `hero-after-back-navigation.png` ;
- `hero-mobile.png`.

Les captures authentifiée, canvas chargé, fallback et mobile ont été inspectées visuellement : styles noirs et blancs présents, navbar alignée, CTA adaptés, orbe/anneaux visibles et aucun contenu brut.

## Limites

La session est hydratée côté client afin de préserver la landing statique. Il existe donc une courte phase `loading`, mais elle réserve exactement l'espace des actions et n'affiche jamais un faux `Sign in`. Une hydratation serveur serait possible plus tard si une route proxy Next sécurisée vers l'API devenait nécessaire, sans être requise pour corriger le bug actuel.
