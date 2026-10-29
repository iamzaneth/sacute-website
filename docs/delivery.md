# Delivery report

This records the initial implementation baseline. For the subsequent official logo, orange theme, five-team recruitment and supplied contact update, see [the enhancement report](orange-theme-recruitment.md).

Implementation date: 2026-10-29 (Asia/Saigon).

## Completed work

Initialized the `sacute-web` pnpm monorepo in the provided `sacute-website` directory. Implemented all six Vietnamese public pages, English routes, a catch-all 404, orange desktop navigation, modal mobile navigation, institutional header/footer, reusable controls, structured empty states, URL-based search/filtering, recruitment preparation steps and FAQ. Contact channels remain pending and no submission form pretends to deliver messages.

Built a modular NestJS REST API with health, information, scholarship, and event modules, validated DTOs, exact-origin CORS, environment validation, shared contracts, and a replaceable local repository. No database is required. The frontend has a local provider for build independence and an opt-in future API adapter.

Added strict TypeScript, ESLint, Prettier, pnpm lockfile, environment examples, CI, API documentation, database migration guidance, integration tests, SEO output checks, and responsive/accessibility browser tests. See the README for the actual directory tree and ordered PowerShell commands.

## Installed technology versions

| Technology                                  | Installed version |
| ------------------------------------------- | ----------------- |
| Node.js / pnpm                              | 24.18.1 / 11.18.0 |
| React / React DOM                           | 19.3.1            |
| React Router / framework dev / Node adapter | 7.18.5            |
| Vite                                        | 7.3.7             |
| Tailwind CSS / Vite adapter                 | 4.3.3             |
| Lucide React                                | 1.64.0            |
| NestJS common/core/platform-express         | 11.2.8            |
| NestJS Config                               | 4.0.4             |
| TypeScript                                  | 5.9.3             |
| ESLint / typescript-eslint                  | 10.13.0 / 8.72.1  |
| Prettier                                    | 3.9.10            |
| Playwright / axe Playwright                 | 1.64.1 / 4.14.0   |
| class-validator / class-transformer         | 0.14.4 / 0.5.1    |

Exact transitive versions are retained in `pnpm-lock.yaml`.

## SEO and rendering

Prerendered `/`, `/information`, `/scholarships`, `/events`, `/contact`, and `/recruitment` to standalone HTML with route metadata. List routes also emit React Router data files. Runtime SSR is disabled and the temporary server build is removed by the framework. SSR can be added later through supported configuration and a server data provider.

All pages remain noindex while official content is pending. The generated sitemap is intentionally empty and robots disallows crawling. No production domain is invented. A configured verified HTTPS origin enables canonical metadata and organization structured data, while editorial approval remains necessary before indexing. Production hosting must reproduce the documented 404 fallback behavior.

## Validation

| Check                       | Actual local result                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                 | Passed, no warnings or errors                                                                                                          |
| `pnpm typecheck`            | Passed across all three workspace packages                                                                                             |
| `pnpm format:check`         | Passed                                                                                                                                 |
| `pnpm test`                 | Passed: 13 API/repository/configuration/SEO tests; builds all packages first                                                           |
| Production build            | Passed: NestJS compiles; all six public HTML routes and list data files emitted without a live API                                     |
| `pnpm test:e2e`             | Passed: 11 Chrome browser tests                                                                                                        |
| Responsive layouts          | All six pages checked at 360, 390, 768, 1366 and 1920px; no horizontal overflow or uncaught page errors                                |
| Automated accessibility     | All six pages passed selected axe WCAG A/AA checks at 390 and 1366px; not a complete WCAG certification                                |
| Navigation and interactions | Passed: forward/backward drawer focus cycling, Escape/focus restoration, route links, search/filter reset, FAQs, and HTTP 404 recovery |
| API HTTP checks             | All four endpoints passed; invalid queries rejected; configured CORS origins verified                                                  |
| Generated SEO               | Six unique titles/descriptions, meaningful Vietnamese HTML, noindex, safe robots/sitemap, and fallback presence verified               |
| Visual inspection           | Viewed actual generated home, contact and recruitment screenshots at desktop/mobile sizes                                              |

Development startup was also verified with root `pnpm dev`: both apps started, all six routes returned HTTP 200 in Chrome, the FAQ worked after hydration, and no browser errors were reported. The live API health endpoint returned `ok`.

Browser checks run against the production static output and an actual Chrome installation. CI is configured but has not been run on GitHub. Test artifacts are generated locally under ignored `test-results/` and `playwright-report/` directories.

The final standalone browser run passed in 13.9 seconds outside the restricted process sandbox. Within that sandbox, preview-server shutdown was delayed after the assertions finished. The final run shut down its server successfully; development and preview servers were stopped after validation.

## Remaining limitations

- No reference image was present alongside the text attachment; visual implementation follows its written design direction.
- Official assets, contact details, announcements, scholarships, event schedules, recruitment policies and application links are still required.
- Empty content is intentional. There are no article detail pages without meaningful content.
- No contact delivery, application submission, database, CMS, authentication or administrator interface is included in this phase.
- Browser checks cover installed desktop Chrome at responsive viewports; physical device, Safari, Firefox, screen-reader and real production hosting tests have not been performed.
- Local build and runtime checks do not constitute a public production deployment or measured field Core Web Vitals.
- React Router 7 prints advisory migration notices for future version 8 flags. The selected version 7 architecture remains functional.
