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

**Refondu et vérifié ✅**

- Header/navigation français (Fonctionnalités → `/#features`, Providers →
  `/#providers`, Documentation → `/docs`, GitHub externe), menu mobile animé.
- Hero : badge rouge « Multi-providers IA · Local-first », titre français avec
  accent **dégradé rouge** (`.lp-hero__accent`), CTA « Commencer gratuitement »
  + « Voir sur GitHub », glow rouge, **métriques réelles** (20+ fournisseurs,
  3 surfaces, MIT, Local-first), preview produit = `ChatDemo` (logo anthropic +
  pastille modèle + bande de logos providers). Section Demo supprimée.
- Fonctionnalités : 6 cartes réelles (Multi-providers, sélecteur de modèle,
  composer avancé, connecteurs, Work Mode, local-first), icônes dans des carrés
  teintés rouge, stagger `Reveal` (`viewport once`).
- Comment ça marche : timeline 3 étapes, ligne horizontale desktop / verticale
  mobile.
- Providers : grille de **23 logos réels** (21 cloud du `cloud-catalog` + Ollama
  + LM Studio), grisés au repos → couleur au hover. Copie honnête
  (« Vingt-trois fournisseurs »).
- CTA final (dégradé rouge sombre) + footer complet en français : colonnes
  Produit / Ressources / Légal, description, **année dynamique**, lien GitHub.
- Polish : float du `ChatDemo`, press states des boutons, arrow shift des liens,
  `prefers-reduced-motion` respecté (`MotionConfig reducedMotion="user"` dans
  `ChatDemo`, animation désactivée via media query, scroll-behavior:smooth
  uniquement sans reduced-motion).
- Responsive : `overflow-x: clip` sur `.lp`, media query ≤400px (titres,
  chips), grille providers 2 colonnes ≤700px. Rendu statique ✓.
- Meta : `metadataBase`, titre/description **français**, Open Graph `fr_FR` +
  Twitter card, manifest/intégrité inchangés. Rendu `/` à **5.08 kB**.
- Build final : 0 erreur TS / lint (seul warning pré-existant
  `chat-stream.test.ts:11` « init » unused).

**Claims vérifiés** : MIT confirmé dans `package.json:45` ; « 20+ fournisseurs »
(vérité : 23), « 3 surfaces » (web/desktop/CLI), « 2 runtimes locaux »
(Ollama/LM Studio).

**Incohérences visuelles restantes (non bloquantes, hors périmètre des 9 étapes)**

1. Sections **Models** (« 04 / Local + cloud »), **Privacy** (« 06 / Privacy by
   choice »), **Surfaces** (« 07 / Everywhere you work ») et **Developer**
   (« 08 / Developer workflow ») sont encore **en anglais** et numérotées à
   l'ancienne (01–08) — à traduire/normaliser dans une passe future.
2. La section Getting started porte l'eyebrow « 03 » et les sections suivantes
   gardent leurs anciens numéros ; la numérotation 01–08 n'est plus continue.
3. `HeroScene` (`components/three/hero-scene.tsx`) n'est plus utilisé sur la
   landing mais le fichier existe toujours.
4. `.lp-hero__signals`, `.lp-hero__eyebrow` et `.lp-marquee` : CSS orphelin
   (plus de markup correspondant) à nettoyer.
5. `docs` et les pages auth restent en anglais (choix assumé — seule la landing
   est en français).