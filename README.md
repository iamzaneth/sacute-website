# SACUTE Web

The first implementation of the SACUTE student information website. A pnpm workspace contains a statically prerendered React Router frontend, a modular NestJS REST API, and shared TypeScript contracts. All public content is Vietnamese; routes and source identifiers are English.

Organization details follow the supplied brief. The official SVG logo, five recruitment team descriptions, email, address, Facebook, and TikTok links were supplied by the project owner and are integrated. News, scholarship, and event collections remain intentionally empty. No recruitment dates, application link, telephone number, production domain, or event photographs have been supplied. Pending information is clearly identified.

## Requirements

- Node.js 22.12 or newer (validated on Node.js 24.18.1).
- pnpm 11.18.0, pinned in `packageManager`.
- Google Chrome for the browser test configuration. No database or cloud account is needed.

## Run locally

From PowerShell in the repository root:

```powershell
npm.cmd install --global pnpm@11.18.0
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

The frontend serves at http://127.0.0.1:5173 and the API at http://localhost:3001/api/v1. The default configuration works without environment files. Stop both applications with Ctrl+C. The shared package is compiled before either app starts; after editing shared contracts, restart `pnpm.cmd dev` to rebuild them.

Optional configuration:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Each application reads its own `.env`. Restart development servers after changing configuration; rebuild the frontend for production environment changes. Never add secrets to `VITE_*` variables: they are public build inputs.

## Validate and build

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd format:check
pnpm.cmd test
pnpm.cmd test:e2e
```

`test` builds all packages, then runs API integration, repository, configuration, and generated SEO/HTML tests. Run it before `test:e2e`, which starts the production static preview automatically and uses installed Chrome. Browser screenshots and failure traces are written under ignored `test-results/`; an HTML report is generated under `playwright-report/`.

```powershell
pnpm.cmd build
pnpm.cmd preview
```

Open http://127.0.0.1:4173 for the production frontend. This preview is a local development utility, not a production server. In a separate terminal, run the compiled API if needed:

```powershell
pnpm.cmd --filter @sacute/api start
Invoke-RestMethod http://localhost:3001/api/v1/health
Invoke-RestMethod 'http://localhost:3001/api/v1/information?page=1&limit=12'
Invoke-RestMethod http://localhost:3001/api/v1/scholarships
Invoke-RestMethod http://localhost:3001/api/v1/events
```

## Repository layout

```text
sacute-website/                 # package name: sacute-web
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── components/     # layout and reusable UI
│   │   │   ├── features/       # home, content lists, recruitment
│   │   │   ├── lib/            # site configuration and metadata
│   │   │   ├── routes/         # six public routes and catch-all 404
│   │   │   ├── services/       # local content provider and opt-in API adapter
│   │   │   ├── styles/         # Tailwind entry and visual system
│   │   │   └── root.tsx
│   │   ├── scripts/            # SEO generation and static preview
│   │   └── react-router.config.ts
│   └── api/
│       ├── src/
│       │   ├── common/         # repository boundary, DTO and error handling
│       │   ├── config/         # validated environment settings
│       │   └── modules/        # health, information, scholarships, events
│       └── test/               # HTTP integration and repository tests
├── packages/shared/src/        # organization, navigation, contracts, local data
├── tests/                      # generated SEO checks and browser tests
├── docs/                       # API, architecture, delivery report
├── .github/workflows/          # CI checks
└── pnpm-workspace.yaml
```

## Pages and behavior

| Route           | Content                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/`             | Hero, introduction, discovery links, latest information, scholarship/event empty states, recruitment section          |
| `/information`  | Searchable, category-filtered announcement list                                                                       |
| `/scholarships` | Scholarship list and pending-information state                                                                        |
| `/events`       | Events list and pending-information state                                                                             |
| `/contact`      | Centrally configured contact channels and explicit inactive-submission notice                                         |
| `/recruitment`  | Five team overviews, complete job descriptions, deep-linked accordions, recruitment status, preparation steps and FAQ |
| `*`             | Vietnamese 404 with a working home link                                                                               |

Search and category filters persist in URL query parameters and support browser back/forward. Native HTML dialog navigation includes explicit focus cycling, Escape dismissal, and focus restoration. The interface includes a skip link, visible focus, reduced-motion support, and responsive grids. No contact or application submissions are accepted.

Desktop navigation can collapse to an accessible icon rail and expand again. Its state survives client-side route changes and resets on a full page reload. At smaller widths, navigation opens from the left and retains focus trapping and Escape dismissal. The footer uses the center's full Vietnamese name and groups the address, email, Facebook and TikTok together; it contains no student-information navigation link.

Recruitment content lives in `apps/web/app/features/recruitment/data/recruitment-teams.ts`. The five cards link to stable English hashes, such as `/recruitment#academics`; direct links reveal and focus the correct accordion. All five complete descriptions remain in prerendered HTML, including closed sections. The supplied Học tập requirements/benefits repeat Truyền thông and carry an editorial verification note. The full 72 supplied bullets are protected by source-derived content hashes in the SEO tests.

The original SVG moved from `tmp/logo-sacute.svg` to `apps/web/public/branding/logo-sacute.svg` without byte changes. Its square aspect ratio, intrinsic dimensions and alternative text are handled by `BrandLogo`. The original asset is excluded from Prettier to preserve its bytes. Contact details and social links are centralized in `packages/shared/src/index.ts`; email links use `mailto:`, external social links open in a new tab, and the address remains readable without inventing a map link.

See [orange theme and recruitment delivery notes](docs/orange-theme-recruitment.md) for the enhancement scope and validation.

## Rendering, SEO, and hosting

All six public routes are prerendered using React Router Framework Mode with `ssr: false`. The build uses typed local content, not HTTP requests. It produces meaningful HTML, route-specific titles/descriptions/Open Graph metadata, `.data` files for list routes, and a SPA fallback under `apps/web/build/client`.

Current builds deliberately produce `noindex, nofollow`, a `Disallow: /` robots file, and an empty sitemap. A blank production origin generates no canonical links or structured data. Once an official HTTPS origin is verified, set `VITE_SITE_ORIGIN` in `apps/web/.env`; canonical links and minimal organization JSON-LD then use that origin. Domain validation rejects local origins, credentials, paths, and HTTP.

Setting `VITE_ALLOW_INDEXING=true` alone does not publish pending pages to search engines. After editorial approval, mark eligible pages verified in `pageMeta` calls and add the same approved paths to `indexablePaths` in `apps/web/scripts/generate-seo.mjs`, then rebuild. Never enable indexing on a preview environment.

Deploy the entire `apps/web/build/client` directory, including `.data` files and hashed assets, to a static host. Serve existing route directories using their `index.html`. Unknown document paths must serve `404.html` (the framework SPA fallback) with HTTP **404**, allowing the catch-all route to hydrate. Do not rewrite every request to the home page with HTTP 200. Missing assets/data requests must remain 404. This host behavior is exercised by the supplied preview server; a selected production host still needs equivalent configuration.

To introduce runtime SSR later, enable `ssr`, add the selected host's supported React Router server adapter, and replace the local provider in server loaders with server-side database access. The current render path avoids browser globals; dialog behavior accesses the DOM only in handlers/effects.

React Router's official [prerendering documentation](https://reactrouter.com/how-to/pre-rendering) describes this static deployment model.

### Vercel build settings

For the frontend project, set Root Directory to `apps/web` and enable **Include source files outside of the Root Directory in the Build Step** so the shared workspace and root configuration are available. Use Node.js 24.x, `pnpm install --frozen-lockfile` as the Install Command, `pnpm run build` as the Build Command, and `build/client` as the Output Directory (relative to `apps/web`). pnpm is pinned to 11.18.0 in the root `packageManager` field.

The web build compiles `@sacute/shared` before React Router loads `react-router.config.ts`, then prerenders the public routes and generates SEO files. This also works with `pnpm --filter @sacute/web build` from the repository root, without a prior root build or committed `dist` files. CI runs this standalone build immediately after installation to detect missing workspace build prerequisites. Production host routing still needs the static hosting behavior described above.

## API and future persistence

The API exposes `GET /api/v1/health`, `/information`, `/scholarships`, and `/events`. Lists accept validated `page`, `limit`, `q`, and `category` queries. Controllers delegate to domain services; services depend on the `ContentRepository` token. A local implementation returns the same empty shared collections used for prerendering. Frontend list interaction needs no live API; the separate HTTP provider is opt-in for future browser reads.

Production API startup requires exact `CORS_ORIGINS` values. Wildcards and path-bearing URLs are rejected. PostgreSQL, Prisma, Supabase, authentication, and admin publishing are intentionally outside this phase.

See [API contracts](docs/api.md), [architecture and database migration](docs/architecture.md), and [delivery and validation report](docs/delivery.md).
