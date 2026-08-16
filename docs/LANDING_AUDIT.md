# LANDING AUDIT — Page d'accueil publique `/`

Audit effectué avant la refonte. Aucune modification de code à cette étape.

## 1. Stack et structure

- **Next.js 15 App Router** — route group `(marketing)`, page
  `apps/web/src/app/(marketing)/page.tsx`, rendu statique (○ dans le build).
- Layout marketing : `(marketing)/layout.tsx` →
  `<MarketingNav /> {children} <MarketingFooter />`.
- **Framer Motion** déjà utilisé (composant `Reveal`).
- **Pas de Tailwind** — design system CSS maison : `tokens.css`
  (`--accent: #e5342b`, `--border`, `--muted`, `--success`, `--panel`),
  `landing.css` (585 lignes, classes `.lp-*`), boutons
  `.button.button-primary` (dégradé rouge) / `.button-secondary`.
- Fonts locales Geist + Geist Mono (`--font-sans`, `--font-mono`).

## 2. Sections présentes sur la page

| # | Section | Contenu |
| --- | --- | --- |
| 1 | **Hero** | eyebrow « A private intelligence workspace », titre « Every intelligence. One protected workspace. », accent en dégradé **gris/blanc** (pas rouge), lead, `HeroActions`, signaux (Local AI / Cloud / Tools / Private), scène 3D `HeroScene`, grille de fond, fade. |
| 2 | **Getting started** | 3 étapes (« Connect a provider / Choose your model / Start asking »). |
| 3 | **Demo** | `ChatDemo` animé (fenêtre de chat avec composer, sources, messages qui cyclent toutes les 2,6 s). |
| 4 | **Capabilities** | grille 6 cartes : Local first, Cloud when it counts, One continuous context, Projects with memory, Tools on explicit terms, Private by design. |
| 5 | **Models** | `ModelOrbit` (orbite de logos) + chips de capacités + liens. |
| 6 | **Integrations** | marquee statique en texte (« Gmail, Drive, Calendar, GitHub, NVIDIA, OpenRouter ») — **pas de logos**. |
| 7 | **Privacy** | texte + `PrivacyVisual`. |
| 8 | **Surfaces** | triptyque Web / Desktop / CLI. |
| 9 | **Developer** | 3 cartes : Desktop App / Documentation / CLI. |
| 10 | **CTA** | titre + 2 boutons. |
| — | **Footer** | 3 colonnes (Product / Learn / Legal) + logo + copyright codé en dur « © 2026 Aegis ». |

## 3. Composants réutilisables existants

- `components/navigation/marketing-nav.tsx` (client) : logo Aegis, dropdown
  « Product », liens, slot session, menu mobile, état `scrolled`.
- `components/marketing/marketing-footer.tsx` (serveur).
- `components/marketing/hero-actions.tsx` : CTA selon l'état de session
  (loading / error / connecté / anonyme).
- `components/marketing/chat-demo.tsx`, `model-orbit.tsx`,
  `privacy-visual.tsx`.
- `components/three/hero-scene.tsx` (canvas 3D).
- `components/motion/reveal.tsx` : fade + translation au scroll,
  `viewport={{ once: true }}`, **respecte déjà `useReducedMotion`**.
- `components/brand/aegis-logo.tsx` (logo officiel) ;
  `components/brand/provider-icon.tsx` + assets
  `public/brand/providers/*.svg` (avec variantes `-color.svg`).

## 4. Écarts avec l'objectif de refonte

1. **Header** : liens ≠ « Fonctionnalités / Providers / Documentation /
   GitHub » ; menu mobile sans animation (affichage brut).
2. **Hero** : accent **non rouge** ; pas de ligne de métriques réelles ; pas de
   CTA « GitHub » ; glow rouge absent.
3. **Fonctionnalités** : les 6 cartes ne correspondent pas aux 6
   fonctionnalités demandées (Multi-providers, sélecteur de modèle, composer,
   connecteurs, Work Mode, local-first).
4. **Providers** : pas de section dédiée avec logos — assets disponibles.
5. **Footer** : année codée en dur, pas de lien GitHub.
6. **Meta** : pas d'Open Graph / Twitter dans `layout.tsx`.
7. **Animations** : `Reveal` ok ; press states des boutons et cohérence
   `prefers-reduced-motion` à vérifier sur toute la page.
8. **Responsive** : media queries à 1024/700 existantes ; à re-tester
   320 → 2560.

## 5. Vérification finale (étape 9) — après refonte

**Décision de langue** : le reste du produit (workspace, docs, messages de
commit) est en anglais → **la landing entière est repassée en anglais**
(`fix: landing - retour à l'anglais...`). Toute la structure/design de la
refonte est conservée : header, hero avec `ChatDemo`, fonctionnalités,
« How it works », 23 logos providers, CTA, footer, animations, responsive.

**Refondu et vérifié ✅**

- Header/navigation anglais (Features → `/#features`, Providers → `/#providers`,
  Documentation → `/docs`, GitHub externe), menu mobile animé.
- Hero : badge rouge « Multi-provider AI · Local-first », titre avec accent
  **dégradé rouge** (`.lp-hero__accent`), CTA « Start free » + « View on
  GitHub », glow rouge, **métriques réelles** (20+ providers, 3 surfaces, MIT,
  Local-first), preview produit = `ChatDemo` (logo anthropic + pastille modèle +
  bande de logos providers). Section Demo supprimée.
- Fonctionnalités : 6 cartes réelles (Multi-provider, model picker, advanced
  composer, connectors, Work Mode, local-first), icônes en carrés teintés rouge,
  stagger `Reveal` (`viewport once`).
- How it works : timeline 3 étapes, ligne horizontale desktop / verticale mobile.
- Providers : grille de **23 logos réels** (21 cloud du `cloud-catalog` + Ollama
  + LM Studio), grisés au repos → couleur au hover. Copie honnête
  (« Twenty-three providers »).
- CTA final (dégradé rouge sombre) + footer complet en anglais : colonnes
  Product / Resources / Legal, description, **année dynamique**, lien GitHub.
- Polish : float du `ChatDemo`, press states des boutons, arrow shift des liens,
  `prefers-reduced-motion` respecté (`MotionConfig reducedMotion="user"` dans
  `ChatDemo`, animation désactivée via media query, scroll-behavior:smooth
  uniquement sans reduced-motion).
- Responsive : `overflow-x: clip` sur `.lp`, media query ≤400px (titres,
  chips), grille providers 2 colonnes ≤700px. Rendu statique ✓.
- Meta : `metadataBase`, titre/description **anglais**, Open Graph `en_US` +
  Twitter card, manifest/intégrité inchangés. Rendu `/` à **4.97 kB**.
- Build final : 0 erreur TS / lint (seul warning pré-existant
  `chat-stream.test.ts:11` « init » unused).

**Claims vérifiés** : MIT confirmé dans `package.json:45` ; « 20+ providers »
(vérité : 23), « 3 surfaces » (web/desktop/CLI), « 2 runtimes locaux »
(Ollama/LM Studio).

**Nettoyage (commit `chore: landing - nettoyage eyebrow, CSS orphelin, HeroScene`)**

1. Numérotation des eyebrows **continue 01–07** dans l'ordre de la page :
   01 How it works · 02 Capabilities · 03 Local + cloud · 04 Supported providers
   · 05 Privacy by choice · 06 Everywhere you work · 07 Developer workflow.
   Le CTA final reste volontairement non numéroté.
2. CSS orphelin supprimé (vérifié par grep, plus aucun usage JSX) :
   `.lp-demo`, `.lp-hero__eyebrow`, `.lp-hero__signals` (définitions + référence
   dans le media query ≤1024px). `.lp-marquee` avait déjà été retiré.
3. `HeroScene` (`components/three/hero-scene.tsx`) : **inutilisé partout dans le
   projet** (aucun import dans `apps/web/src`) → **fichier supprimé**. Les autres
   composants `three/` (GlobalIntelligenceScene, etc.) restent utilisés par le
   workspace.

**Incohérences restantes** : aucune identifiée. Toute la landing est en anglais,
cohérente avec le reste du produit.