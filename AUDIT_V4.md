# AUDIT V4 — Relevé initial

> Branch : `refonte-v4` · Base : `5a4d7a0`
> Mesures Playwright (chromium, viewport 390×844 mobile / 1280×800 laptop, API mockée)
> Généré après fix scroll (`be04287`) — l'audit reflète un état où la Vague 3 (scroll) est déjà corrigée.

## 1. Bug critique corrigé (Vague 3 — scroll bloqué)

**Symptôme** : sur desktop, impossible d'atteindre le bas de certaines pages (bouton sous le pli).

**Cause racine** : `.v3-workspace` est une grille `grid-template-columns` **sans `grid-template-rows`**. La rangée implicite `auto` grandissait à la hauteur du contenu (1046px mesuré au lieu de 800px de viewport). `.v3-sidebar`, `.v3-rail`, `.v3-main` s'étiraient donc sous le pli et se faisaient couper par `overflow: hidden` du shell. Le conteneur de scroll `.v3-page__body` était plus haut que l'écran (982px), donc son contenu inférieur restait invisible. Le mobile marchait car la sidebar y est `position: fixed` (hors flux) et la rail masquée.

**Correctif** (`v3-premium.css`) :
- `.v3-workspace { grid-template-rows: minmax(0, 1fr); }` → la rangée est verrouillée à `100svh`.
- `min-height: 0` ajouté sur `.v3-sidebar` et `.v3-rail` → leurs zones internes scrollables (`__nav`, `__list`) reprennent la main.

**Vérification** : avant `ch=982 > vh=800` (coupé), après `ch=736` correctement dans le viewport. Scroll réel (wheel Playwright) OK sur toutes les routes à contenu débordant.

## 2. Overflows horizontaux réels (à corriger)

| Route · Viewport | Élément | Mesure | Sévérité |
|---|---|---|---|
| Drive · mobile | `.aegis-metric-row` | déborde jusqu'à 454px > 390px (64px) | **Élevé** — scroll horizontal forcé |
| Drive · mobile | `.aegis-metric` | [374,454] | Hérité de la ligne ci-dessus |
| ~~Chat · laptop~~ | ~~`.v3-chat`~~ | ~~scroll 771 > client 756 (15px)~~ | ✅ Corrigé Vague 4 (`bafce0f`) — grid bornée `min-width:0` |
| ~~Chat · mobile~~ | ~~`.v3-chat`~~ | ~~scroll 398 > client 390 (8px)~~ | ✅ Corrigé Vague 4 — topbar compacte (kicker masqué ≤560), pill shrinkable |
| Chat · laptop | métadonnées `small` de messages | scroll 90-135 > client 81-85 | Moyen — texte tronqué par ellipsis |

## 3. Faux positifs (hors scope — dégagés)

| Route · Viewport | Élément | Raison |
|---|---|---|
| Landing (tous) | `.hero-grid`, `.hero-scene`, `.chat-demo`, `sr-only` | éléments décoratifs `position:absolute`/accessibilité, volontairement hors flux |
| Landing · laptop | `b.B` (hero) | décoratif absolu dans `.hero` (`overflow:hidden`) |
| Download (tous) | `.download-radiance`, `i.I` | halos décoratifs absolus |
| Login/Register · laptop | `b.B` | halo décoratif, layout parent `overflow:hidden` |
| Workspace · laptop | `.v3-canvas__orb` | orbe décoratif `position:fixed` dans `.v3-canvas` |
| Workspace · mobile | `.v3-sidebar__*` (brand, nav, user) | sidebar hors-champ `translateX(-102%)` au repos (menu off-canvas) |
| Workspace (tous) | `section.aegis-page-hero` / `.product-hero` | `::before` décoratif `inset:-40% -10%` ; scrollWidth surestimé, mais `overflow:hidden` sur la section — aucun impact visuel |
| Workspace · mobile | titres `h1`/`p` des pages | `white-space:nowrap; ellipsis` dans le topbar — troncature voulue |
| Login/Register · laptop | `aside.auth-art` | scroll 774 > client 716 — élément décoratif en `overflow:hidden` |

## 4. Notes d'état par route

- **Landing, Product, Download, Docs, Privacy** : scroll documentaire OK, aucun overflow réel. Landing très longue (10598px mobile) — à surveiller en Vague 6 pour la hiérarchie visuelle.
- **Chat** : structure de scroll saine (`v3-chat__scroll` scrollable). Le seul vrai défaut : ellipsis sur les `small` de métadonnées (timestamps/statuts) côté laptop.
- **Search, Providers, Models, Projects, Connections, Gmail, Calendar, GitHub, Settings, Account** : `.v3-page__body` scrollable correctement après fix Vague 3. Les débordements signalés sont des faux positifs décoratifs (voir §3).
- **Drive mobile** : seul overflow horizontal réel du workspace → prioritaire en Vague 4 (responsive).
- **Models** (`/workspace/models`) : faux positif — la mesure initiale portait sur `/models` (page marketing, scroll documentaire attendu). `/workspace/models` scrolle correctement dans `.v3-page__body`, identique à `/drive` (vérifié).

## 5. Axes de travail (chaîne des vagues)

1. ✅ Vague 3 — Scroll : corrigé + committé (`be04287`).
2. ✅ Vague 1 — Audit : ce document.
3. ✅ Vague 2 — UX route par route : Drive metric-row mobile (`339e9e2`), quick tiles chat (`2943d9d`), cohérence Models = faux positif (`8a54484`).
4. ✅ Vague 4 — Responsive 320→2560 : audit 20 routes × 8 viewports (spec dédiée). Topbar chat compacte (kicker masqué ≤560, pill/actions shrinkables), grid `.v3-chat`/`.v3-home` bornées (`min-width:0`), `.v3-chat__scroll` `overflow-x:hidden`, stats hero `flex-wrap` ≤700. Plus aucun overflow réel à 320 (`docScroll==vw` partout). `bafce0f`.
5. ✅ Vague 5 — Chat : sidebar 260px (`92a034b`), navigation mobile accessible — toggle hamburger dans les topbars chat et workspace pages (drawer ≤560), contexte `WorkspaceNavContext` (`workspace-shell.tsx`). Composer et bienvenue déjà complets.
6. ✅ Vague 6 — Home (landing publique) : vérifiée via spec dédiée — `docScroll==vw` à 320→1920 (aucun scroll horizontal), `hero-scene` mobile derrière le copy (z-index correct), chat-demo sous le pli (normal). Tous les OVERFLOW/CLIPPED de l'audit sont des faux positifs décoratifs (hero-grid/`light-sweep`/`sr-only` dans conteneurs `overflow:hidden`).
7. Vague 7 — Models/Providers.
8. Vague 8 — Settings.
9. Vague 9 — Animations Framer Motion.
10. Vague 10 — Performance.
11. Vague 11 — Accessibilité.
12. Vague 12 — E2E de bout en bout.

## 6. Session P0-P3 (directives urgentes)

> Nouvelle palette officielle : NOIR & ROUGE. Remplace la consigne monochrome anterieure.

- **P0 - Retheme noir/rouge** (`2a290b4`) : tokens + fichiers premium recalibres
  (`--accent:#e5342b`, `--success:#4ade80`, `--background:#050505`), nouvelle couche
  finale `apps/web/src/styles/retheme.css` (CTAs, nav active, bulle user, dots status,
  titres degrades, focus). Build + lint OK, verif Playwright style calcule 13/13.
- **P1 - Chevauchement cartes Home** (`46ce1d2`) : reproduit avec titre 140 car.
  Cause : `.v3-home__list` en grille auto (max-content 597px) + wrapper flex sans
  `min-width:0` -> les lignes debordaient de leur carte jusque dans la colonne 3.
  Fix : `grid-template-columns:minmax(0,1fr)` + `min-width:0` sur rows et wrapper.
- **P2 - Layout chat** (`230c162`) : composer etait `position:absolute` (189px) et
  recouvrait le dernier message meme scroll complet (colonne paddee 150px obsolete).
  Fix : dock en flux (3e rangee de la grille `.v3-chat`), paddings 150/170px retires,
  fondu conserve via `::before`. Verifie par mesures geometriques Playwright.
- **P3 - Moteur de recherche** (`099f142`) : la page /search filtrait sur
  `conversation.messages` cote client, mais GET /conversations ne renvoie jamais les
  messages -> la recherche par contenu etait du code mort (seuls les titres matchaient).
  Fix : endpoint `GET /conversations/search?q=` (Prisma titre OU contenu, scope user,
  enregistre AVANT le pattern `/conversations/:id`), `api-client.searchConversations`,
  page branchee sur la recherche serveur. Tests : contrat API 5 cas (titre, contenu,
  miss, 400, 401) + E2E mock 4/4.

- Serveur courant : `pnpm next start -p 3000` (PID log `next-start.log`), API `pnpm dev` port 4000.
- Rappel : rebuild obligatoire apres tout changement CSS/TS avant re-test (chunking Next).