# Aurum Exchange

A complete black-and-gold currency exchange concept, built with plain HTML, CSS, and JavaScript. No Node.js, npm, framework, build process, server setup, or API key is required.

## Open the website

Double-click `index.html` to open it in a modern browser. An internet connection is needed to fetch exchange rates and load Google Fonts. System fonts are used if the fonts cannot load. If your browser restricts requests from local files, upload the files to GitHub Pages using the steps below.

## Deploy to GitHub Pages

1. Create a GitHub repository (public if using GitHub Free).
2. Upload **the contents of this folder** to the repository root:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `assets/` and everything inside it
   - `.nojekyll` (an empty file)
   - This README is optional.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the **main** branch and **/ (root)**, then save.
6. GitHub will display your website URL after deployment completes, typically `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

Keep `index.html` at the top level of the publishing folder, rather than placing the entire `aurum-exchange` folder inside it. Every local asset uses a relative path, so the site also works under a repository subpath or a custom domain.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Included features

- Responsive black-and-gold design, original SVG globe and brand mark.
- **1 USD, 1 EUR, and 1 GBP priced in Turkish lira** together in a compact top strip.
- A rotating gold globe with orbiting currency symbols, locally rendered with canvas and CSS; includes pause/play and reduced-motion support.
- A sticky rate strip that keeps all three quotes visible as visitors scroll, including on phones.
- Historical charts for USD/TRY, EUR/TRY, and GBP/TRY with 1-week, 1-month, and 3-month views.
- A currency watchlist showing TRY values and change since the preceding available business-day observation.
- Smooth section reveals, staggered transitions, a rotating globe, and a scroll progress indicator.
- Reduced-motion support, visible keyboard focus, labeled chart controls, accessible chart summaries, and native FAQ disclosures.
- Manual refresh, checks every five minutes while visible, and refresh when reconnecting.
- Clearly labeled cached rates when a connection fails, and explicit unavailable states without made-up prices.

## Exchange rate data

Source: [Frankfurter](https://frankfurter.dev/), accessed directly from the browser through its public v2 API:

```text
https://api.frankfurter.dev/v2/rates?base=USD&quotes=TRY
https://api.frankfurter.dev/v2/rates?base=EUR&quotes=TRY
https://api.frankfurter.dev/v2/rates?base=GBP&quotes=TRY
```

The source publishes **daily reference rates**, not streaming intraday trading quotes. The website checks for fresh data every five minutes; that does not mean the provider updates prices every five minutes. Weekends and holidays can show a previous business day's date. Reference rates exclude a provider's spread, commissions, and fees.

Each currency pair is requested directly, preserving the published precision of the USD/TRY, EUR/TRY, and GBP/TRY quotes. Historical data is loaded for approximately three months, anchored to the latest rate date. If providers publish different observation dates, the page displays the date range in the sticky strip.

The public API is a third-party dependency. If unavailable, saved rates are labeled as cached; a first-time visitor sees an unavailable state and can retry. There is no hardcoded fallback quote. Clearing browser storage removes the cached rates.

This is an informational exchange concept. It does not process payments, transfers, or currency exchange transactions.

## Customize

- **Brand:** search for `AURUM` / `Aurum` in `index.html`; update the brand mark and favicon in `assets/`.
- **Palette:** edit the semantic color variables at the beginning of `styles.css`.
- **Copy and sections:** edit `index.html`.
- **Rate refresh:** edit the five-minute interval near the bottom of `script.js`.
- **Privacy and terms:** edit the `information` object in `script.js` to match the business and hosting arrangement before using this as a real company website.

Google Fonts supplies DM Sans, Manrope, and Playfair Display, with local fallbacks. No JavaScript libraries, analytics, accounts, cookies, or backend services are included. Currency requests contain currency codes and dates; there are no amount or account fields.

## Design approach

Created with guidance from [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): product hierarchy, a deep-black palette, restrained gold accents, editorial serif contrast, accessible interaction states, responsive layouts, and reduced motion. Visual assets are included locally as SVGs.
