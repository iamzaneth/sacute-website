# Orange theme, recruitment teams, and contact update

This is an incremental enhancement of the existing SACUTE monorepo. No package dependencies, public route paths, API modules, database behavior, or prerender settings were replaced.

## Sidebar and footer follow-up

Desktop navigation now collapses to an 84px icon rail with accessible names and native hover labels, and expands through the same keyboard-operable control. State survives client-side navigation; a page reload restores the expanded default. Small-screen navigation opens from the left, with a matching left-side header trigger, orange icon accents and an orange edge. Escape, focus trapping, focus restoration and responsive resize behavior remain intact; reduced motion is respected.

The footer brand now spells out `Trung tâm Tư vấn và Hỗ trợ Sinh viên`. Branding/institution information and contact information form two desktop columns, stacking on mobile. Address and email sit beneath the contact heading, followed by Facebook and TikTok on the same row. The student-information link and redundant contact-page shortcut were removed from the footer.

Follow-up validation: frontend production build, TypeScript, lint and formatting passed; all 7 SEO/content checks and 19 Chrome browser tests passed. Browser checks include collapse/expand at 1024, 1366 and 1920px, navigation while collapsed, mobile/desktop transitions, left drawer positioning, footer social alignment across 360–2560px and axe checks in collapsed mode. Actual collapsed-sidebar, left-drawer and footer screenshots were reviewed. Backend tests were not rerun for this layout-only follow-up.

## Design and tokens

The shared theme uses primary orange `#F97316`, deeper orange `#C2410C` for white-text controls, soft orange `#FDBA74`, pale orange `#FFF7ED`, warm cream `#FFF1DF`, and navy `#17325A`. Bright orange is prominent in navigation, the home illustration surface, the recruitment hero, and the home recruitment banner. Selected filters and primary actions use deeper orange; warm sections balance white content surfaces. Small text on saturated orange uses dark slate `#1E293B` for contrast. The sidebar's active route has a deep-orange inset marker.

All existing public page introductions use a consistent warm surface and orange edge. Official branding replaces the previous text-only placeholder in the header, sidebar, drawer and footer. Mobile header text wraps beside the logo, navigation labels can wrap at narrower laptop widths, footer links wrap, and the drawer closes when resizing into desktop navigation. Reduced-motion styling applies to the small drawer entrance transition.

## Official logo

- Original path: `tmp/logo-sacute.svg`.
- Final path: `apps/web/public/branding/logo-sacute.svg`.
- SVG XML was parsed with DTD processing disabled and checked for scripts, event handlers and external resources.
- The original `viewBox="0 0 258 258"` and all file bytes were preserved.
- SHA-256: `a9f35df31e2431088406b353ffbdc36180ff1e598656db6478df3761e9a63bd2`.
- `BrandLogo` supplies accessible alternative text and intrinsic square dimensions; CSS scales it with `height: auto` and `object-fit: contain`.
- A white circular surface makes the original colors readable on orange without recoloring the artwork.
- The original asset is ignored by Prettier to preserve its bytes; the production copy is checked against its source.

## Recruitment structure and interaction

`apps/web/app/features/recruitment/data/recruitment-teams.ts` is the single typed source for all five teams. Plain records use English stable slugs and icon identifiers; they do not contain React components. The full 72 supplied bullet points are preserved exactly. Short overview summaries are grounded in the supplied responsibilities.

`TeamExplorer` renders overview links and native `<details>/<summary>` disclosures from those records. A three-column detail layout is used on wider desktops; narrower layouts use one readable content column, while overview cards use five, three, or one column according to available width. Native disclosures work without client JavaScript. Only one team is expanded at a time in browsers supporting named details groups.

Deep links such as `/recruitment#communications`, `#administration`, `#academics`, `#skills-workshops`, and `#housing-employment` reveal the matching team. Overview links focus the corresponding summary, mark the selected overview card, and support browser back navigation. Enter and Space operate the native summaries. Hash handling is confined to effects and event handlers; no browser globals are read during render. Every team's full content exists in prerendered HTML regardless of disclosure state.

The Học tập poster repeats the Truyền thông requirements and benefits. These remain unchanged, with a visible editorial note and this documented review item. No replacement requirements or benefits were invented. Recruitment dates and application URLs remain unconfirmed; the page clearly says that no intake has been announced and offers no fake application flow.

The recruitment metadata now names all five teams. Existing noindex, sitemap and robots safeguards remain active until domain/content approval.

## Supplied contact update

The shared organization configuration now contains:

- Email: `sacute@hcmute.edu.vn`.
- Address: `Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM`.
- Facebook: `https://www.facebook.com/hotrosinhvienspkt`.
- TikTok: `https://www.tiktok.com/@sacute.2015`.

These are rendered on the contact page and footer. Email links use `mailto:`; social links use a new tab with `noopener noreferrer` and an accessible new-tab hint. Address text is displayed even without a map URL. Telephone and map details remain unconfigured. The contact page continues to distinguish direct email/social contact from an inactive website submission form. Social destinations were supplied by the owner; external profile availability was not independently checked.

Configured-origin organization JSON-LD now includes the supplied email, address and social profiles. No production domain is invented.

## Future persistence

The local team data is a plain transport-friendly model. When recruitment APIs are added, move the existing contract into the shared package, import approved records through a database migration/seed, and keep campaign status, dates and application URLs separate. A reviewed content snapshot can preserve static builds without a live NestJS server or database. See `docs/architecture.md` for the migration boundary.

## Validation

| Check                        | Actual result                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                  | Passed                                                                                                                     |
| `pnpm typecheck`             | Passed for shared, web and API                                                                                             |
| `pnpm format:check`          | Passed                                                                                                                     |
| Production builds            | Frontend and backend passed; all six public routes prerendered                                                             |
| API / repository / SEO tests | 16 passed                                                                                                                  |
| Chrome browser suite         | 16 passed in the final run                                                                                                 |
| Responsive audit             | All six pages and every expanded team checked at 360, 390, 768, 1024, 1366, 1920 and 2560px; no horizontal overflow        |
| Accessibility                | Selected axe WCAG A/AA rules passed for all public pages at 390 and 1366px, including expanded team content                |
| Recruitment behavior         | Direct hashes, card selection, exclusive disclosure, back history, Enter/Space, focus handling passed                      |
| Shared layout                | Drawer focus loop, Escape, navigation and resize into desktop passed; official logo loads without distortion               |
| Content fidelity             | All five teams and all 72 bullets matched source-derived hashes in generated HTML; original SVG hash unchanged             |
| Contact and links            | Supplied email/address/social links found in generated HTML; browser href/rel checks and internal-link/asset checks passed |

Actual home, recruitment, expanded team and contact screenshots were inspected at mobile and desktop sizes. Browser tests used installed Chrome; the final browser run used an unrestricted local process context so Windows child-server cleanup completed normally. No public deployment or external social-profile availability check was performed. Existing React Router 7 future-version advisory notices remain non-blocking.

The content hash fixture was derived independently from the supplied document. Generated HTML is checked against the ordered bullet counts and SHA-256 for each team, so omitted or changed content fails validation. Browser checks include every public page, expanded team details, direct hashes, history, keyboard disclosures, drawer focus and desktop resizing, contacts, image aspect ratios, and internal links. Automated axe checks cover mobile and desktop, including an expanded Học tập section.

## Changed files

- `.prettierignore`: preserve the original SVG bytes and exclude temporary inspection helpers.
- `packages/shared/src/index.ts`: supplied contact values and social links.
- `apps/web/public/branding/logo-sacute.svg`: original asset moved into public output.
- `apps/web/app/components/brand.tsx`: reusable official logo/branding.
- `apps/web/app/components/layout.tsx`: logo placements, footer contact/social links, drawer resize behavior.
- `apps/web/app/root.tsx`: theme color, recruitment stylesheet and supplied organization structured data.
- `apps/web/app/styles/app.css`: existing theme rules updated; obsolete text-logo and generic recruitment-interest styles removed.
- `apps/web/app/styles/recruitment.css`: official branding dimensions, recruitment layout and responsive details.
- `apps/web/app/features/recruitment/data/recruitment-teams.ts`: complete typed supplied content.
- `apps/web/app/features/recruitment/team-explorer.tsx`: reusable team overview and disclosure rendering.
- `apps/web/app/routes/recruitment.tsx`: new hero and team explorer; existing FAQ/preparation sections retained and updated.
- `apps/web/app/routes/contact.tsx`: real supplied channels and readable address fallback.
- `tests/seo.test.mjs`, `tests/fixtures/recruitment-content-hashes.json`: content fidelity, logo and contact output checks.
- `tests/browser/site.spec.ts`: additional viewports and behavior/asset checks.
- `README.md`, `docs/architecture.md`, `docs/delivery.md`, this report: current content, migration, and validation documentation.

## Remaining editorial and deployment work

Confirm the Học tập duplicated requirements/benefits. Supply recruitment dates and a real application destination when approved. Telephone, map URL, official news, scholarships, event schedules, production origin and hosting are still pending. No database, new recruitment API, application submission, or public deployment was introduced. Actual Safari/Firefox/device and screen-reader testing remains outside the performed Chrome checks.
