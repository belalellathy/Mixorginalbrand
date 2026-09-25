# Mix Originals — Project Description, Security Audit & Bug Report

## 1. Project Overview

**What the project does:**
Mix Originals (also branded “L'ÉCLAT Haute Beauté” / “Maison” in UI copy) is a luxury beauty e-commerce single-page application. It lets visitors browse perfume / skincare / makeup categories, search products, view product details with image galleries and customer reviews, add items to a persistent shopping bag, and check out via a 3-step manual bank-transfer flow (contact → address + review → upload payment screenshot). After placing an order the user sees an order-confirmation screen.

There is **no custom backend in the repo**. Reads go directly from the browser via Supabase; **order creation is delegated to a Supabase Edge Function (`createorder`)** whose server code is not versioned here, so its pricing/stock logic cannot be audited from this snapshot.

**Tech stack:**

| Layer | Technology |
|---|---|
| Frontend | React 18.3.1, React Router DOM 6.26.2, Vite 5.4.8 |
| Styling | Tailwind CSS 3.4.13, PostCSS 8.4.47, Autoprefixer 10.4.20, Google Fonts (Playfair Display + Inter), lucide-react 0.453.0 icons |
| State | Zustand 4.5.5 + `zustand/middleware/persist` (localStorage) |
| Forms/validation | react-hook-form 7.53.0, Zod 3.23.8, @hookform/resolvers 3.9.0 |
| Backend / DB / Storage | Supabase (Postgres + PostgREST + Storage) via @supabase/supabase-js 2.45.4, plus Edge Function `createorder` (server code not in repo) |
| Auth | None — anonymous access only |
| Payments | Manual: bank / Instapay transfer + image receipt upload, no payment gateway |
| Build/deploy | `vite build` → static `dist/`, `vercel.json` SPA rewrite (no SSR) |

**High-level architecture:**

```
Browser SPA (React Router)
 ├─ Zustand cartStore (localStorage `leclat-beauty-cart`)
 ├─ src/lib/supabase.js ── Supabase JS client (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
 │     ├─ PostgREST reads: categories, product_images, reviews,
 │     │                    products_with_ratings (view — ALL product reads)
 │     ├─ Direct writes: reviews (submitReview), Storage uploads
 │     └─ Storage bucket: `payment-screenshots/receipts/*` (upload + 1h signed URLs)
 ├─ Edge Function `createorder` (POST items + contactInfo + receipt_path,
 │     returns { id, total_price }) — pricing computed server-side
 ├─ src/lib/format.js ── central `formatEGP()` price formatter
 └─ src/config/categories.js ── single source for category slugs/names
```

Product reads never touch the `products` table directly — all go through `products_with_ratings`. Client totals are display-only; the authoritative `total_price` comes from the Edge Function. RLS policies, Edge Function code, and Storage policies are not in the repo and remain unverified.

---

## 2. Project Structure

```
/
├── .env                        # REAL Supabase URL + anon JWT (should never be committed)
├── .env.example                # Placeholder Supabase vars
├── vercel.json                 # SPA rewrite: /(.*) → /index.html
├── DESCRIPTION.md              # This file
├── index.html                  # SPA shell, fonts, #root, /src/main.jsx entry
├── package.json / package-lock.json  # Deps (React 18, Vite 5, Supabase 2, Tailwind 3)
├── vite.config.js              # Vite + @vitejs/plugin-react, dev server :3000
├── postcss.config.js           # tailwindcss + autoprefixer
├── tailwind.config.js          # container, fonts, accent colors, card shadows/radii
├── dist/                       # Committed production build output (should be gitignored)
├── node_modules/               # Committed/installed deps (should be gitignored)
└── src/
    ├── main.jsx                # ReactDOM.createRoot → <App/> in StrictMode
    ├── App.jsx                 # BrowserRouter + ScrollToTop + Navbar/Routes/Footer + catch-all 404
    ├── index.css               # Tailwind base + .shadow-soft, .card-flat, .btn-base, .no-scrollbar
    ├── lib/
    │   ├── supabase.js         # Supabase client + queries (categories, products_with_ratings,
    │   │                         search, reviews, orders via Edge Function, storage upload)
    │   └── format.js           # Central formatEGP() currency formatter
    ├── config/
    │   └── categories.js       # CATEGORIES slugs/names + getCategoryBySlug()
    ├── store/
    │   └── cartStore.js        # Zustand persistent cart: cartItems, totalPrice, totalItems
    ├── components/
    │   ├── Navbar.jsx          # Logo, desktop/mobile nav, categories dropdown, debounced live
    │   │                         search suggestions, cart badge
    │   ├── Footer.jsx          # Brand, fake newsletter signup, category links, credit
    │   ├── ProductCard.jsx     # Image, badges, rating stars, EGP price, add-to-cart, wishlist toggle
    │   └── CategoryCard.jsx    # Category tile with accent_color + contrast text
    └── pages/
        ├── Home.jsx            # Hero, featured carousel, categories grid, bestsellers, value props
        ├── Category.jsx        # Accent banner, sort (featured/price-low/high), product grid
        ├── ProductDetail.jsx   # Gallery, price, qty stepper, add-to-cart, reviews list + form, related
        ├── Search.jsx          # ?q= results, 300ms debounce + stale-guard, via searchProducts()
        ├── Cart.jsx            # Line items, stock-capped qty stepper, order summary, checkout CTA
        ├── Checkout.jsx        # 3-step form: contact → address/review → payment proof + upload + place order
        ├── OrderConfirmation.jsx # Thank-you screen driven by location.state + id guard (no fetch)
        └── NotFound.jsx        # Catch-all 404 page
```

No tests, no CI, no Dockerfile, no SQL migrations/seeds, no `.gitignore`, no README (before this file) were found. No git repo is initialized in this snapshot.

---

## 3. Key Features & Flows

**Main features:**
1. Category browsing (slugs/names centralized in `src/config/categories.js`) + DB-driven category pages with price sorting.
2. Featured carousel and bestsellers, both reading `products_with_ratings` (ratings ship with every product row — no per-card fetch).
3. Product detail with multi-image gallery (`product_images` ordered by `sort_order`), related products, rating from the product row itself.
4. Customer reviews: list + unauthenticated submit (name, 1–5 stars, optional comment) with a 24h-per-product localStorage cooldown.
5. Search (`name.ilike`, `description.ilike`) via URL `?q=`, with input sanitization (100-char cap), 300ms debounce, stale-response guard, 60-char display truncation — plus live suggestions in the Navbar.
6. Persistent cart (Zustand + localStorage) with stock-capped quantity steppers, out-of-stock UI, and `formatEGP` totals (display-only).
7. Manual checkout with Zod validation and payment-screenshot upload to Supabase Storage (`receipt_path` stored, 1-hour signed URL for display).
8. Order creation through the `createorder` Edge Function (client sends only `items {product_id, quantity}` + `contactInfo` + `receipt_path`; server returns `{ id, total_price }`).
9. Order confirmation screen showing items, server-priced total, receipt image, and reference ID — guarded: redirects home without `state.order.id`.
10. Wishlist heart toggle (UI-only, not persisted), newsletter signup (UI-only, not persisted), catch-all 404 route.

**Critical user flows:**

- **Browse → Product:** `Home.jsx:25-29` / `Category.jsx:23` fetch via `supabase.js` (`products_with_ratings`) → `ProductCard.jsx:55,113` links to `/product/:id` → `ProductDetail.jsx:51-67` loads `fetchProductById` + `fetchProductImages` + `fetchRelatedProducts` in parallel; ratings come on the product row (`72-73`).
- **Review:** `ProductDetail.jsx:107-119` loads `fetchProductReviews` only; `handleReviewSubmit (128-180)` enforces the localStorage cooldown (`134-140`), calls `submitReview (supabase.js:208-222)`, then optimistically prepends the review and recomputes the average locally (`161-166`).
- **Cart:** `cartStore.js:11-73` `addToCart` / `updateQuantity` / `removeFromCart` recompute `totalItems`/`totalPrice` for display; `updateQuantity` caps at `maxStock` (`55`); `Cart.jsx:105-111` passes `product.stock` and disables increment at cap; `navigate('/checkout')` on CTA.
- **Checkout (manual payment):** Step 1 contact (`Checkout.jsx:47-52`, Zod schema `12-17`), Step 2 address + item review, Step 3 upload screenshot (`65-87`) → `uploadPaymentScreenshot (supabase.js:11-32)` returns `{ path, signedUrl }` → `createOrder (supabase.js:151-167)` POSTs `{ items, contactInfo, receipt_path }` to the Edge Function → `clearCart()` → `navigate('/order-confirmation', { state: { order: { id, total_price, items }, contactInfo, receiptUrl } })` (`Checkout.jsx:90-139`). `OrderConfirmation.jsx:10-15` guards on `order?.id` and renders purely from that navigation state — no DB fetch.

---

## 4. 🔴 Security Issues

### S1 — Real Supabase credentials on disk in `.env`, no `.gitignore`
- Severity: **High** (Critical if pushed to a public repo; anon key is long-lived: `exp 2105498020`)
- Affected: `.env:1-2`, missing `.gitignore` (repo root), `dist/` and `node_modules/` present on disk
- Description: `VITE_SUPABASE_URL=https://lvrjxjnbugrwinxrqpun.supabase.co` and a live `VITE_SUPABASE_ANON_KEY` (JWT) are stored in plaintext on disk. There is no `.gitignore` (and no git repo yet), so the first `git init && git add .` would commit secrets, build output, and dependencies. Vite inlines `VITE_*` vars into `dist/assets/*.js`, so the key is also public by design once deployed — which makes Supabase RLS policies (not visible here) the only protection, and none are documented.
- Fix: Add `.gitignore` (`.env`, `dist/`, `node_modules/`), rotate the anon key in Supabase dashboard, move to environment-based deploys, restrict Supabase allowed origins / API settings, and document RLS policies.

### S3 — Direct anonymous writes remain for reviews and Storage (orders moved to Edge Function)
- Severity: **High**
- Affected: `src/lib/supabase.js:18-23,208-222`
- Description: Order writes now go through the `createorder` Edge Function (good), but `submitReview` still inserts directly with the anon key (including a `.select().single()` round-trip, so anon also needs `SELECT` on `reviews`), and payment screenshots upload straight from the browser. Anyone can spam reviews and uploads with no login, CAPTCHA, or rate limit. No policies/migrations are in the repo to prove RLS posture either way.
- Fix: Route reviews through the Edge Function (or least-privilege `INSERT` + no public `SELECT`), add CAPTCHA/rate-limiting, require signed upload URLs. Do not expose `orders.email/phone/address` for public `SELECT`.

### S5 — Payment-proof upload still lacks an extension allowlist (naming + signed URLs fixed)
- Severity: **High**
- Affected: `src/lib/supabase.js:14-16` (`file.name.split('.').pop()`, no allowlist), `src/pages/Checkout.jsx:70-79` (`file.type.startsWith('image/')`, 10 MB client-only check)
- Description: Filenames now use `crypto.randomUUID()` and display goes through 1-hour signed URLs (fixed). But client MIME checks are still trivially bypassed (curl with fake `Content-Type`), and `fileExt` still accepts anything (`html`, `svg`, `php`, extensionless, `foo.jpg.php`). If the bucket is public, an uploaded HTML/SVG executes in victims' browsers (stored XSS + phishing). No server-side magic-byte check, no AV scan.
- Fix: Validate server-side (Edge Function or Storage policy): allowlist `jpg/jpeg/png/webp`, verify magic bytes + dimensions, enforce size, strip EXIF. Set `Content-Disposition: attachment` and `Content-Security-Policy: sandbox` on the bucket.

### S6 — PII + payment receipts handling improved but retention posture unknown
- Severity: **High**
- Affected: `src/lib/supabase.js:26-31`, `src/pages/Checkout.jsx:101,115-122`, `src/pages/OrderConfirmation.jsx:116-128`
- Description: Uploads now store the private `receipt_path` and render via short-lived `createSignedUrl()` (fixed). Remaining unknowns: whether the bucket is actually private, who else can mint signed URLs, and PII (`full_name`, `email`, `phone`, `address`) retention/deletion.
- Fix: Confirm bucket is private, scope signed-URL minting to owner/admin, minimize retained PII, and add a retention/deletion policy.

### S7 — Review abuse surface reduced to a bypassable client cooldown
- Severity: **Medium** (spam: High likelihood; script execution: Low in React but still a risk via SVG/attributes)
- Affected: `src/lib/supabase.js:208-222`, `src/pages/ProductDetail.jsx:128-140` (cooldown), review render `~460-490` (`{review.full_name}`, `{review.comment}`)
- Description: A 24h-per-product localStorage cooldown now exists, but it is trivially bypassed (clear storage / new browser / script the Edge Function–less direct insert). Still no length caps, moderation, CAPTCHA, or purchase check. React escapes text by default (no `dangerouslySetInnerHTML` found — good), but abusive content, links, and Unicode tricks are still stored and rendered to all visitors.
- Fix: Enforce server-side (name ≤ 80 chars, comment ≤ 1000 chars, rating 1–5 int, per-IP/per-product rate limit), require purchase or CAPTCHA, add moderation flag + profanity filter.

### S8 — Sensitive PII in `console.error` + verbose Supabase errors to UI-adjacent logs
- Severity: **Low**
- Affected: `src/pages/Home.jsx:37`, `src/pages/Category.jsx:31`, `src/pages/ProductDetail.jsx:88,115,175`, `src/pages/Search.jsx:39`, `src/pages/Checkout.jsx:134`, `src/components/Navbar.jsx:81`
- Description: Full Supabase error objects (which can include query, table, and hint details) are logged to the browser console on every failure, aiding reconnaissance.
- Fix: Log a generic message to console, send details to a server-side logger (Sentry etc.), and show only user-friendly text.

### S9 — Hardcoded bank details (IBAN) in the client bundle
- Severity: **Medium**
- Affected: `src/pages/Checkout.jsx:428-436` (`FR76 3000 4018 2901 2345 6789 012`, `L'ÉCLAT Haute Beauté SARL`, `Haute Bank International / Instapay`)
- Description: Real-looking banking instructions are baked into JS shipped to everyone. Rotation requires a code deploy, and scrapers can harvest the IBAN for fraud/social-engineering.
- Fix: Serve payment instructions from a backend/config endpoint, mask by default, and make them environment-specific.

### S10 — Cart held in plaintext `localStorage`, no expiry
- Severity: **Medium**
- Affected: `src/store/cartStore.js:4-83` (`persist` name `leclat-beauty-cart`)
- Description: Full product objects persist indefinitely in `localStorage`, readable by any XSS payload. Price tampering via localStorage no longer reaches order creation (server reprices — S2 fixed), but stale prices still display and full product snapshots bloat storage. No versioning/migration or TTL.
- Fix: Persist only `{ product_id, quantity }`, rehydrate prices from DB, add version + TTL, and clear on order. Consider `sessionStorage` for checkout PII.

### S11 — Missing security headers / CSP; third-party assets without integrity
- Severity: **Medium**
- Affected: `index.html:10-12` (Google Fonts), `src/pages/Home.jsx:68` (`images.unsplash.com` hero), no CSP/HSTS/X-Frame-Options in repo
- Description: No `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, or SRI (`integrity`/`crossorigin`) is configured. A compromised CDN/font/image host can inject code. No `referrer`/`permissions` policy either.
- Fix: Add CSP (`default-src 'self'`, `img-src self https: data:`, `font-src fonts.gstatic.com`, `connect-src self https://*.supabase.co`), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and SRI where possible. Serve deploys over HTTPS only.

### S12 — Rate limiting still missing on reviews, newsletter, checkout
- Severity: **Medium**
- Affected: `src/lib/supabase.js:208-222` (reviews), `src/components/Footer.jsx:9-14` (newsletter), checkout upload
- Description: Search is now debounced with stale-request guards (`Search.jsx:17-55`, `Navbar.jsx:61-86`), and reviews have a weak client cooldown (see S7). Still no CAPTCHA, per-IP quota, or backend throttle on reviews/uploads/newsletter/checkout — all scriptable in a loop.
- Fix: Per-IP quotas via Edge Functions / WAF, CAPTCHA on review + checkout, and bucket upload quotas.

**Resolved and removed:** S2 (prices now computed server-side by the `createorder` Edge Function; client sends no `total_price`/`unit_price`), S4 (PostgREST reserved chars stripped, 100-char cap, empty-query early return in `searchProducts`).

---

## 5. 🟡 Bugs & Code Issues

### B1 — Dead error check in Category page; invalid slugs throw unhandled
- Affected: `src/pages/Category.jsx:23-24`, `src/lib/supabase.js:77-101`
- Problem: `fetchProductsByCategorySlug` returns `{ data, category }` or throws — never `{ error }`. `if (res.error)` is dead code. An unknown `slug` throws from `.single()` and only shows a generic banner, with no 404 state.
- Fix: Destructure in try/catch; if `catError.code === 'PGRST116'` render a proper Not Found page.

### B3 — `handleSubmit` imported but never used; final submit bypasses form validation
- Affected: `src/pages/Checkout.jsx:29-33,47-62,90-139`
- Problem: `handleSubmit` from `react-hook-form` is destructured (`31`) and never called; step navigation uses `trigger()` and final submit uses `getValues()` directly, so full-form validation never runs at submit time. The unused `ImageIcon` import (`Checkout.jsx:6`) is also dead code.
- Fix: Wrap steps in `<form onSubmit={handleSubmit(onFinalSubmit)}>` and call `await trigger()` + `handleSubmit` consistently; remove unused imports.

### B4 — Quantity caps are UI-only; `addToCart` merge can exceed stock, server stock flow unverified
- Affected: `src/store/cartStore.js:11-35,51-73`, `src/pages/ProductDetail.jsx:189-192`, `src/pages/Cart.jsx:105-111`
- Problem: The stepper (`handleIncrement`), `updateQuantity(maxStock)`, and disabled states now cap at `product.stock` (fixed). Remaining gaps: `addToCart` merges into an existing line with no cap (5 in cart + add 5 at stock 5 → 10), and stock decrement/reservation on the server is unverified (Edge Function code not in repo).
- Fix: Cap the merged quantity in `addToCart` (pass stock in), validate + decrement stock in the order transaction (row lock / `CHECK (stock >= 0)`).

### B6 — Confirmation guard fixed; `0`-total hidden and address block dead
- Affected: `src/pages/OrderConfirmation.jsx:13-15,97-114`
- Problem: Direct visits now `<Navigate to="/" replace />` and no fake IDs are generated (fixed). Remaining: `order.total_price &&` hides a legitimate `0` total (falsy), and the Delivery Address block (`97-104`) can never render because `Checkout.jsx:128` builds `order` without `address`.
- Fix: Render `total_price != null` instead of truthiness; include `address` in the navigation-state order (or drop the dead block).

### B8 — File-extension parsing still weak (randomness fixed)
- Affected: `src/lib/supabase.js:14-16`
- Problem: `crypto.randomUUID()` naming is done (fixed). But `file.name.split('.').pop()` still returns the whole name for extensionless files and keeps `php` in `photo.jpg.php`, with no allowlist and no lowercasing.
- Fix: Allowlist `['jpg','jpeg','png','webp']` (lowercased, single ext), reject others before upload.

### B10 — Animation classes without the plugin (dead CSS)
- Affected: `src/pages/Checkout.jsx:231,318,410` (`animate-in fade-in`), `src/pages/OrderConfirmation.jsx:30` (`animate-in zoom-in`), `src/components/Navbar.jsx:348,391` (`animate-in slide-in-from-top`), `package.json:11-30`
- Problem: `tailwindcss-animate` / `tw-animate-css` is not installed, so these classes do nothing.
- Fix: Install and configure the animate plugin or replace with Tailwind built-ins (`transition`, `animate-pulse` already used elsewhere).

### B11 — `shadow-soft` naming collision/confusion
- Affected: `tailwind.config.js:28-31` (`boxShadow.card`, `card-hover`) vs `src/index.css:23-30` (`.shadow-soft`, `.shadow-soft-hover`)
- Problem: Code uses `shadow-soft` (custom utility) while config defines `shadow-card` (unused). Two sources of truth for the same shadow.
- Fix: Move shadows into `tailwind.config.js` (`soft`, `soft-hover`) and delete the custom CSS, or vice versa.

### B12 — Fragile hex-contrast helpers crash on short/invalid hex
- Affected: `src/pages/Category.jsx:48-56`, `src/components/CategoryCard.jsx:7-15`
- Problem: `hex.replace('#','')` + `substr` assumes 6-digit hex. `null` → default, but `#fff`, `#fff8`, named colors, or a bad DB value yield `NaN` brightness and wrong text color.
- Fix: Normalize 3-digit hex, validate with `/^#?[0-9a-f]{6}$/i`, and wrap in try/catch with a safe default.

### B14 — Newsletter signup is fake + unvalidated
- Affected: `src/components/Footer.jsx:9-14,54-70`
- Problem: `handleSubscribe` only flips `isSubscribed` locally; email is discarded on reload, never sent anywhere. No length/typo check beyond `type="email"`.
- Fix: Wire to Supabase table / newsletter API with double opt-in, or remove the form.

### N1 — NEW: `undefined` stock renders “In Stock (undefined available)”
- Affected: `src/pages/ProductDetail.jsx:346-372`
- Problem: The stepper guard is `product.stock !== 0` and the label interpolates `product.stock` directly. Any product whose row lacks `stock` (null/undefined) shows a purchasable stepper plus the literal text “In Stock (undefined available)”.
- Fix: Treat nullish stock as unknown — hide the count (`In Stock` without a number) or block purchase until stock is known: `{product.stock == null ? 'In Stock' : ...}` and cap `handleIncrement` only when stock is a number.

### N2 — NEW: `addToCart` can push a line past stock
- Affected: `src/store/cartStore.js:11-35`, `src/pages/ProductDetail.jsx:182-187`
- Problem: The quantity selector is capped, but `addToCart(product, quantity)` adds onto any existing line with no cap, so repeated adds exceed `product.stock` (and the Cart cap only constrains the stepper, not the stored value).
- Fix: Pass available stock into `addToCart` and clamp: `quantity: Math.min(existing + added, stock)`.

### N3 — NEW: Order-confirmation address block is unreachable
- Affected: `src/pages/Checkout.jsx:124-132`, `src/pages/OrderConfirmation.jsx:96-104`
- Problem: Since the Edge Function migration, the navigation-state `order` is built as `{ id, total_price, items }` with no `address`, so the Shipping Address section never renders despite the UI supporting it.
- Fix: Include `address: formData.address` in the navigation-state order (display-only; the server remains the source of truth for the stored order).

### N4 — NEW: `submitReview` insert-then-select repeats the old RLS failure pattern
- Affected: `src/lib/supabase.js:208-222`
- Problem: `.insert().select().single()` requires anon `SELECT` on `reviews` right after insert — the same pattern that caused RLS failures on orders before the Edge Function migration. If `reviews` RLS grants `INSERT` but not `SELECT`, every review submit errors even though the row was written (and the retry then trips the 24h cooldown, confusing users).
- Fix: Route review creation through an Edge Function returning the row, or drop the `.select()` and prepend a locally built review object.

**Resolved and removed:** B2 (order creation is a single Edge Function call — server-side atomicity still unverified, see B4), B5 (`|| 25` fallback removed; real stock confirmed), B6-guard + fake ID (redirect guard added, `Math.random()` fallback deleted), B7 (all product reads via `products_with_ratings`; per-card `fetchProductRating` deleted), B9 (`NotFound.jsx` + catch-all route + `vercel.json` rewrite), B13 (`src/lib/format.js` `formatEGP` used in all 5 price-display files), B15 (300ms debounce + request-id stale guard + 60-char display truncation in Search and Navbar suggestions), B16 (`src/config/categories.js` single source; Navbar/Footer/ProductCard/OrderConfirmation consume it).

---

## 6. Dependencies & Outdated Packages

`package.json:11-30`, lockfile v3. No `npm audit` / Dependabot / Renovate configured. Versions are ~Oct 2024 (2 years old as of 2026-09-21):

| Package | Pinned | Status / note |
|---|---|---|
| `react`, `react-dom` `^18.3.1` | 18.x | Behind: React 19.x stable since Dec 2024 (new compiler, Server Components). No known RCE in 18.3.1, but misses 19 a11y/perf fixes. Plan a codemod upgrade. |
| `vite` `^5.4.8` | 5.x | Behind: Vite 6 (Nov 2024) + 7 (2025). Vite 5 no longer receives minor features; esbuild/Rollup transitive CVEs fixed in 6/7. Upgrade to `^6`/`^7` and re-test `vite.config.js:1-11`. |
| `@vitejs/plugin-react` `^4.3.2` | 4.x | Keep in lockstep with Vite; 5.x required for Vite 6+. |
| `react-router-dom` `^6.26.2` | 6.x | Behind: v7 (2024) renames to `react-router`. 6.x still maintained, no critical CVE, but new `createBrowserRouter` data APIs / prefetch only in 7. |
| `@supabase/supabase-js` `^2.45.4` | 2.x | ~1 year behind 2.5x (2026). Older `auth-js`/`realtime-js` had token-refresh and WS-reconnect bugs. Run `npm audit`; upgrade to latest `2.x`. |
| `zustand` `^4.5.5` | 4.x | Behind: v5 (2024) requires React 18+ and drops deprecated APIs. Current usage (`create`, `persist`) is v5-compatible — safe to bump. |
| `zod` `^3.23.8` | 3.x | Behind: 3.24/4.x (2025). No breakout CVE, but 4.x is faster with better `email()`/`url()` checks. |
| `@hookform/resolvers` `^3.9.0`, `react-hook-form` `^7.53.0` | — | Current for 2024; keep paired (v5 resolvers need RHF 7.55+). |
| `lucide-react` `^0.453.0` | — | Very old icon set (1000+ icons behind in 2026). No vuln, but larger bundle; consider tree-shaking / selective imports. |
| `tailwindcss` `^3.4.13`, `postcss` `^8.4.47`, `autoprefixer` `^10.4.20` | — | Tailwind 4.x (2025) is now current (CSS-first config). 3.4 still patched, but plan migration; `postcss 8.4.47` has no critical CVE but update to latest 8.5.x. |
| `@types/react`, `@types/react-dom` | 18.x | Must match React major on upgrade. |

Other flags:
- No test runner (`vitest`/`playwright`), no linter (`eslint`), no `npm audit` script — regressions and CVEs go unnoticed.
- `dist/index-*.js` is ~568 kB (157 kB gzip) per last build — no code-splitting (`React.lazy` / `manualChunks`); whole app + Supabase ships on first load.
- No abandoned packages found, but `tailwindcss-animate` is **missing** while its classes are used (see B10).

Run: `npm audit`, `npm outdated`, then `npm i -g npm-check-updates && ncu -u` in a branch + `npm run build` regression test.

---

## 7. Recommendations Summary

**P0 — Do this week (blockers / money loss / data leak):**
1. Rotate Supabase anon key, add `.gitignore`, keep `.env`/`dist`/`node_modules` out of version control (S1).
2. Audit the `createorder` Edge Function code (not in repo): confirm server-side repricing from `products.price`, atomic order + items insert, and stock decrement — client fixes assume all three (S2 follow-through, B4).
3. Lock down RLS: least-privilege policies for `reviews` (insert-then-select will fail under locked RLS — N4), private `payment-screenshots` bucket with scoped signed URLs (S3, S6).
4. Harden upload: extension allowlist + magic-byte check (S5, B8).

**P1 — Do this sprint (abuse + correctness):**
5. CAPTCHA + rate limits + server validation on reviews/newsletter/checkout (S7, S12, B14).
6. Fix Category 404 handling, confirmation `0`-total + address block, `undefined`-stock label, `addToCart` cap (B1, B6, N1–N3).
7. Move bank instructions to backend config (S9); quiet `console.error` leaks (S8).
8. Persist only IDs in storage with TTL (S10).

**P2 — Hygiene / tech debt:**
9. Add CSP/HSTS/SRI, HTTPS-only deploys (S11).
10. Fix contrast-helper validation, shadow naming, missing animate plugin (B10–B12); fix dead `handleSubmit`/`ImageIcon` (B3).
11. Upgrade Vite 5→7, React 18→19, Supabase/Zod/Zustand to latest, add ESLint + Vitest + `npm audit` CI, enable code-splitting (bundle is ~568 kB).
12. Add migrations/seeds, RLS policy docs, Edge Function source, README runbook, and a `LICENSE`.

*If a section above shows “None found”, it means no additional instances beyond those listed were detected in this snapshot.*
