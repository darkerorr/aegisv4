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