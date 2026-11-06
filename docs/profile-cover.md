# SACUTE profile cover

The homepage uses `apps/web/public/branding/profile/frame-03.svg`, based on the supplied `tmp/Profile/frame-03.svg`. The source has a `1573.2283 × 589.6063` viewBox. Its artwork and text are retained; the source in `tmp/Profile` is unchanged.

The supplied SVG references Montserrat fonts without embedding them. Browser fallback fonts misalign its layered text. The published copy embeds normal and italic Montserrat variable-font WOFF2 subsets containing only the artwork's characters (about 28 KB combined before base64 encoding). These were prepared using FontTools outside the repository; no runtime dependency was added. Supporting Myriad Pro text includes an Arial/sans-serif fallback because the supplied file does not include Myriad Pro.

Font sources: `https://github.com/google/fonts/tree/main/ofl/montserrat`. The required SIL Open Font License is distributed beside the artwork as `Montserrat-OFL.txt`. Both font subsets are embedded in the SVG, so the cover requires no external font request. Replacing the published SVG with the raw source would restore the missing-font issue.

The original PNG remains available as an existing asset. `centerProfile.cover` selects the new SVG, with intrinsic dimensions supplied to reserve layout space and responsive CSS preserving the SVG's native aspect ratio.

Validation: frontend production build, lint, source formatting, SEO checks and Chrome rendering at 320, 390 and 1440px passed. The image decoded successfully at every width, with no horizontal overflow or page errors. The desktop rendered cover was visually inspected.
