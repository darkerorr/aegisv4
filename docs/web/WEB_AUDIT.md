# Aegis Web Audit

## Architecture actuelle

- Next.js 15 (App Router)
- React 19
- Tailwind CSS 3
- Framer Motion
- Lucide React icons
- react-markdown + remark-gfm
- API client (@aegis/api-client)
- Shared UI (@aegis/shared-ui)

## Routes existantes

| Route | Page | Status |
|-------|------|--------|
| / | Landing page | ✅ |
| /login | AuthForm mode=login | ✅ |
| /register | AuthForm mode=register | ✅ |
| /forgot-password | Directory existe | ⚠️ Vérifier |
| /reset-password | Directory existe | ⚠️ Vérifier |
| /verify-email | Directory existe | ⚠️ Vérifier |
| /chat | Chat page complète | ✅ |
| /chat?conversation=:id | Chat avec conversation | ✅ |
| /connections | Directory existe | ⚠️ Vérifier |
| /dashboard | Directory existe | ⚠️ Vérifier |
| /docs | Directory existe | ⚠️ Vérifier |
| /download | Directory existe | ⚠️ Vérifier |
| /drive | Directory existe | ⚠️ Vérifier |
| /gmail | Directory existe | ⚠️ Vérifier |
| /models | Directory existe | ⚠️ Vérifier |
| /onboarding | Directory existe | ⚠️ Vérifier |
| /projects | Directory existe | ⚠️ Vérifier |
| /providers | Directory existe | ⚠️ Vérifier |
| /account | Directory existe | ⚠️ Vérifier |
| /security | Directory existe | ⚠️ Vérifier |
| /settings | Directory existe | ⚠️ Vérifier |

## Problèmes identifiés

### CSS

1. **Pas de route groups**: Toutes les pages sont dans src/app/ sans séparation (public)/(app).
2. **Layout unique**: Le root layout ne fait qu'importer globals.css et render {children}. Pas de sidebar persistante.
3. **Protected.tsx**: Composant client qui vérifie la session et wrappe dans AppShell. Mais pas de two-tier layout.
4. **CSS potentiellement cassé**: globals.css importe des fichiers depuis @aegis/shared-ui/theme/ qui peuvent ne pas exister.
5. **Tailwind limité**: content: ["./src/**/*.{ts,tsx}"] mais pas les packages.
6. **Pas de variables CSS complètes**: Dépend de tokens.css et components.css dans shared-ui.

### Composants

1. **SiteNav.tsx**: Navbar public avec links ancrés (#features, #app, #models) - pas de vraies routes.
2. **AppShell.tsx**: Sidebar + topbar, mais pas de route groups. Utilise "use client" avec useEffect.
3. **AuthForm.tsx**: Gère login ET register. Pas de Google Sign-In.
4. **Protected.tsx**: Vérifie session, wrappe dans AppShell. Mais pas de Suspense boundaries.
5. **Chat page**: Très longue (284 lignes), intégrée dans page.tsx, pas de features/chat/.

### Fonctionnalités manquantes

1. Google Sign-In: Pas de bouton Google, pas de /auth/google/start appel.
2. Gmail page: Répertoire existe mais page à vérifier.
3. Drive page: Répertoire existe mais page à vérifier.
4. Models page: Répertoire existe mais page à vérifier.
5. Providers page: Répertoire existe mais page à vérifier.
6. Account page: Répertoire existe mais page à vérifier.
7. Settings page: Répertoire existe mais page à vérifier.
8. Connections page: Répertoire existe mais page à vérifier.
9. Download page: Répertoire existe mais page à vérifier.
10. Historique: Pas de couche de données cohérente, pas de cache optimiste.
11. Avatar: Pas de page Account complète avec avatar upload.
12. Pas de CommandPalette.
13. Pas de désign system complet dans web-ui.

### Performances

1. Chat page charge providers + models + conversations au montage (3 appels séquentiels).
2. Protected.tsx charge /health puis /auth/me séquentiellement.
3. SiteNav.tsx charge /health puis /auth/me à chaque navigation.
4. Pas de Server Components pour les données.
5. Pas de prefetch des routes.
6. Bundle important (framer-motion, react-markdown, lucide).
7. Pas de loading.tsx, error.tsx pour chaque route.

### Navigation

1. Pas de route groups: Toutes les pages au même niveau.
2. Pas de sidebar persistante via layout: AppShell est wrappé dans Protected côté client.
3. Les ancres (#features, #app) ne changent pas d'URL.
4. Pas de menu mobile dans AppShell (sidebar).
5. Pas de focus management.

### États manquants

1. Pas de loading.tsx à chaque niveau.
2. Pas de error.tsx à chaque niveau.
3. Pas de not-found.tsx.
4. Pas de global-error.tsx.
5. Pas de Suspense boundaries.

## Bugs reproduits

1. **Double appel API**: SiteNav.tsx appelle /health puis /auth/me à chaque changement de route.
2. **Pas de redirection après login**: AuthForm appelle router.replace mais pas de vérification que le cookie est bien reçu.
3. **Historique non persisté**: Après reload, la sidebar perd les conversations (pas de cache).
4. **Création de conversation**: Pas d'idempotence → double création possible.
5. **CSS dépendant de shared-ui**: Si tokens.css ou components.css manque, tout le style est cassé.

## Recommandations immédiates

1. Créer route groups (public) et (app)
2. Déplacer AppShell dans layout (app)
3. Extraire Chat dans features/chat/
4. Ajouter Google Sign-In
5. Créer pages Connections, Gmail, Drive, Models, Providers, Account, Settings, Download
6. Ajouter pagination curseur
7. Créer design system dans web-ui
8. Ajouter loading.tsx, error.tsx partout
