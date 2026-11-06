# SACUTE frontend refinement — 7 November 2026

Local implementation only. No push, deployment, dependency additions, API changes, or production configuration changes.

## Inspection and baseline

The checkout was clean. No applicable AGENTS.md was found in the checkout or ancestor directories. Inspected the workspace scripts, React Router routes, shared content/configuration, layout, controls, home, listing, article/gallery, recruitment and contact components, both stylesheets, existing browser/content tests, and the previous UI/UX reports. The earlier reports describe historical implementations; current source is authoritative.

Read-only deployed inspection covered all six top-level routes at 390, 768 and 1440px: 18 successful HTTP 200 responses and no overflow. Local baseline inspection covered seven routes (including 404) at five widths: 35 observations, no overflow or runtime errors. Baseline Chrome suite: **31 passed**. Baseline production build and **18 API/SEO/content tests passed** after allowing local API ports. Lint/typecheck/install passed. Baseline formatting already failed on the two protected mock article Markdown files; they remain unchanged.

Evidence: [local baseline measurements](ui-ux/refinement-before-metrics.json), [deployed measurements](ui-ux/refinement-deployed-metrics.json).

## Issue inventory and resolutions

| Priority | Route/component            | Observed problem and user impact                                                                                                              | Implemented resolution                                                                                                                              |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Public workflows           | No critical broken workflow found                                                                                                             | Preserve working route, drawer, gallery and recruitment behavior                                                                                    |
| P1       | ContentList                | Reset removes parameters but implicitly selects Hoạt động again; no explicit all-category choice on information page                          | Add Tất cả and explicit `category=` state, preserving initial Hoạt động default; search submits that state and reset clears query/category together |
| P2       | Global shell/tokens        | Orange-tinted sidebar/header and brown text compete with the official orange cover; 280–320px sidebar and oversized logo reduce content space | White navigation/header, slate text, warm accents, 244px standard/260px wide sidebar, compact 56px brand lockup, 76px desktop header                |
| P2       | Shared/local links         | Repeated arrows and read-more labels add clutter inside already clickable cards                                                               | Remove redundant local cues and hero link; retain one semantic link per card and useful section/global navigation                                   |
| P2       | Recruitment overview       | Repeated card actions and reserved heading heights make five cards unnecessarily tall                                                         | Remove repeated action spans, reserved heading height and hover translation; preserve overview-to-detail links and native disclosure controls       |
| P2       | Home/scholarships/listings | Empty states reserve excessive vertical space despite limited content                                                                         | Compact truthful home state and reduce listing empty-state minimum height from 310px to 220px                                                       |
| P2       | Article details            | 14px article body makes long Vietnamese content harder to read                                                                                | 16px body, 1.85 line height and 72ch maximum reading width; gallery and original text/order unchanged                                               |
| P2       | Contact                    | Large decorative question icon and loose rows distract from contact values                                                                    | Remove decoration, tighten rows and give functioning links 44px minimum height; preserve missing-phone state and all configured values              |
| P2       | Search/control system      | Submit styling duplicates shared button appearance                                                                                            | Reuse button/primary classes; consistent 44px sizing, padding, hover, focus and pressed feedback                                                    |

## CTA and interaction inventory

Every interactive element family was reviewed in source, with representative rendered and keyboard checks. No new workflow or fake action was introduced.

| Area                                        | Purpose and priority                               | Result                                                                                                             |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sidebar/drawer navigation, brand home links | Global navigation                                  | Retained, active route has both text weight/chevron and orange inset indicator; compact brand preserves identity   |
| Sidebar collapse, drawer open/close         | Icon actions                                       | Retained labeled native buttons and existing focus/scroll/Escape/resize behavior                                   |
| Sidebar support link                        | Contextual tertiary navigation                     | Retained as a useful persistent support path                                                                       |
| Home hero information link                  | Local navigation duplicating adjacent quick access | Removed; descriptive copy and official cover remain                                                                |
| Three quick-access cards                    | Primary discovery navigation                       | Entire card remains one link; removed extra arrow cues                                                             |
| Section heading links                       | Tertiary navigation to complete lists              | Retained with 44px minimum height; removed repeated arrows                                                         |
| Article/home event cards                    | Primary navigation to article                      | Entire card remains one link; removed internal read-more labels, retained title, image, summary/date where present |
| Home support note                           | Tertiary help link                                 | Retained without arrow                                                                                             |
| Recruitment preview                         | Secondary navigation                               | One compact ActionLink; truthful pending status retained                                                           |
| Search submit                               | Primary listing action                             | Shared primary button, no extra submit/reset controls                                                              |
| Category buttons and clear filters          | Filter selection/recovery                          | Pressed state and live result count retained; reset genuinely clears both filters                                  |
| Article back/source/author/body links       | Return navigation and attribution                  | Retained original destinations; no duplicate footer action                                                         |
| Gallery thumbnails/close/previous/next      | Image inspection actions                           | Retained native labeled buttons, keyboard navigation and focus restoration                                         |
| Recruitment hero                            | Primary in-page discovery                          | Retained one link to five teams, with no application action                                                        |
| Team overview cards                         | Choose a team/deep link                            | One link per card, no repeated internal CTA                                                                        |
| Team summaries                              | Expand/collapse details                            | One native summary per team; existing Xem chi tiết/Thu gọn state labels retained                                   |
| Team back links                             | Return to overview                                 | Retained to avoid long-scroll navigation burden                                                                    |
| FAQ                                         | Read supporting answers                            | Native summaries retained                                                                                          |
| Recruitment contact                         | Contextual tertiary navigation                     | Retained one supporting link                                                                                       |
| Contact email/socials, footer channels      | Direct contact                                     | Real links retained, email decorative arrow removed; unavailable phone/map remain text                             |
| 404/error recovery and skip link            | Recovery/accessibility                             | Retained                                                                                                           |

Existing ActionLink, SectionHeading, PageIntro and EmptyState are sufficient abstractions for this scope. No unused Button/IconButton/Card API was added merely to match a component checklist. Search now shares the actual button styling. Tokens remain the single semantic color layer; obsolete styles for eliminated decorations/actions were removed rather than overridden.

## Before/after evidence

| View                | Before                                                             | After                                                             |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Home desktop        | [1440px](ui-ux/screenshots/refinement-before/home-1440.png)        | [1440px](ui-ux/screenshots/refinement-after/home-1440.png)        |
| Home mobile         | [390px](ui-ux/screenshots/refinement-before/home-390.png)          | [390px](ui-ux/screenshots/refinement-after/home-390.png)          |
| Recruitment desktop | [1440px](ui-ux/screenshots/refinement-before/recruitment-1440.png) | [1440px](ui-ux/screenshots/refinement-after/recruitment-1440.png) |
| Contact mobile      | [390px](ui-ux/screenshots/refinement-before/contact-390.png)       | [390px](ui-ux/screenshots/refinement-after/contact-390.png)       |

Navigation now gives content more width and uses white surfaces. The header removes “Không gian sinh viên” and aligns the institution/center names to the right, including on mobile. Brand orange remains prominent in the unchanged official cover, selected navigation accents, primary actions and restrained recruitment surfaces. Main text is neutral slate. Primary white-text controls still use #C2410C, with #9A3412 hover; bright #F97316 remains an accent. Blue focus outlines stand apart from the orange palette. Card destinations are communicated by the card itself and hover/focus feedback. The home heading now has a full-width, responsive hierarchy; article text is larger. Mobile retains the proven native modal drawer and stacked layouts, with fewer decorative/action rows.

## Important changed files

- `apps/web/app/styles/tokens.css`: neutral text, white shell, warm surface and accessible interaction tokens.
- `apps/web/app/styles/app.css`: compact shell, responsive home hierarchy, shared button feedback, smaller empty states, article reading width/type and contact density; removed obsolete action/decoration rules.
- `apps/web/app/styles/recruitment.css`: simpler, more compact overview cards.
- `apps/web/app/components/layout.tsx`: remove “Không gian sinh viên”; align the institutional name block to the right as requested.
- `apps/web/app/components/ui.tsx`: remove routine arrow decoration from shared navigation controls.
- `apps/web/app/features/content/content-list.tsx`: deterministic URL category state and shared submit control.
- `apps/web/app/features/content/article-card.tsx`: remove redundant read-more presentation.
- `apps/web/app/features/home/home-page.tsx`: simplify local actions and quick-access/event cards.
- `apps/web/app/features/recruitment/team-explorer.tsx`: remove repeated overview action text; all content/disclosures retained.
- `apps/web/app/routes/contact.tsx`: remove decoration while preserving shared configuration values.
- `tests/browser/site.spec.ts`: update intentional compact-brand/reset expectations; add regression covering all-category search, reload, reset, result counts, browser back/forward and scholarship recovery.
- `tests/capture-refinement*.mjs`: reproducible captures in separate directories, preserving historical audit evidence.

## Validation

Final results are recorded below after completion of the checks. The initial parallel screenshot/browser run had two axe timeouts and one outdated keyboard reset URL expectation. The expectation was updated for the intended explicit all-category URL; no tests were skipped, weakened or deleted. Browser checks were rerun without concurrent capture.

Final checks:

| Check                                         | Result                                                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`              | Passed; lockfile unchanged                                                                                                                                        |
| `pnpm lint`                                   | Passed                                                                                                                                                            |
| `pnpm typecheck`                              | Passed for all workspaces                                                                                                                                         |
| `pnpm build`                                  | Passed; all public routes and both articles prerendered                                                                                                           |
| `pnpm test`                                   | 18 passed: API, SEO, original asset/contact and 72-bullet content integrity                                                                                       |
| `pnpm test:e2e`                               | 32 passed in 26.2 seconds                                                                                                                                         |
| `pnpm format:check`                           | Fails only on the same two pre-existing protected mock article Markdown files                                                                                     |
| Prettier check of changed source/tests/report | Passed                                                                                                                                                            |
| `git diff --check`                            | Passed                                                                                                                                                            |
| Responsive Chrome tests                       | All six top-level pages and expanded teams at 320, 360, 390, 768, 1024, 1366, 1440, 1920, 2560px; no overflow                                                     |
| Article/gallery browser checks                | 390, 768, 1366, 2560px; image order/count, dimensions, keyboard navigation, focus restoration and list-return URL passed                                          |
| Axe WCAG checks                               | All top-level pages at 320, 390, 768, 1366, 1440px, expanded recruitment, collapsed navigation and article details: no reported violations                        |
| Keyboard/input checks                         | Skip link, visible focus, search/reset, drawer Tab/Shift+Tab/Escape/resize/focus return, gallery ArrowLeft/ArrowRight/Escape, and team Enter/Space/history passed |
| Reduced motion/forced colors                  | Existing checks passed                                                                                                                                            |
| 200% text reflow                              | All six top-level pages passed at 768px                                                                                                                           |

The two existing formatting failures are `apps/api/mock-data/posts/events/chuyen-xe-doan-vien-2026/content.md` and `apps/api/mock-data/posts/events/xuan-tinh-nguyen-2026/content.md`. Preserving approved content takes precedence over unrelated formatting cleanup.

The final capture includes both article routes: [after measurements](ui-ux/refinement-after-metrics.json). Screenshots also include [bus article](ui-ux/screenshots/refinement-after/posts-chuyen-xe-doan-vien-2026-390.png) and [volunteer article](ui-ux/screenshots/refinement-after/posts-xuan-tinh-nguyen-2026-1440.png). Automated axe and browser keyboard checks do not constitute human assistive-technology certification. Local short-load CLS observations are not field performance measurements.

## Working tree

Started clean. Final local changes comprise 10 frontend files and 1 existing browser test file, plus this report, two capture scripts, three measurement JSON files and three screenshot directories (`refinement-before`, `refinement-after`, `refinement-deployed`). Changes are grouped into separate local commits for filter correctness (`9c09231`), interface refinement (`1cd514c`), and audit evidence. Source/data/assets outside the frontend scope remain unchanged.

## Preservation and self-review

The source diff contains no article, recruitment team data, branding asset, contact configuration, API, package/lockfile, route-path, SEO or prerender changes. Generated-output content hash checks protect all 72 recruitment bullets. Original article images, order, attribution and full captions remain intact. Pending scholarship/recruitment/phone/map states remain honest.

The final design review inspected actual home desktop/mobile, recruitment, expanded team and contact captures. It found and removed the remaining reserved team-heading height, which created an unnecessary gap after removing the card action. The resulting interface uses one shared palette and hierarchy, with discovery/navigation distinct from disclosure and content reading. Existing responsive and keyboard checks verify preservation rather than replacing working behavior.

Deferred work: human screen-reader review, Safari/Firefox and physical-device testing, and field performance measurements. These are not represented as completed. Editorial confirmation of duplicated Học tập requirements/benefits and approved missing content remains a separate task. The two existing protected Markdown formatting issues remain outside this frontend change. No deployment is authorized by this task.
