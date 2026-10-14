# Mix Originals — Security & Bug Audit (fresh, evidence-based)

> READ-ONLY audit. Only this file was written. Every finding cites code read in this session.
> The previous DESCRIPTION.md was treated as untrusted and was opened only after the audit (see §9).
> Audit date (UTC): 2026-10-12. Scope: entire repo except `node_modules/` and `dist/`.

## 1. Project Overview

**What it is:** React 18 + Vite SPA luxury-beauty storefront ("Mix Originals", also branded "Maison" in copy). Browse categories/search/product detail + reviews, persistent cart, 3-step manual bank-transfer checkout (contact → address/review → payment-screenshot upload), order-confirmation screen. No payment gateway. No login/auth — fully anonymous.

**Actual installed versions** (from `package-lock.json`, not `package.json` ranges):

| Package | Installed | Package | Installed |
|---|---|---|---|
| react / react-dom | 18.3.1 | vite | 5.4.21 |
| react-router-dom (→ react-router) | 6.30.6 | @vitejs/plugin-react | 4.7.0 |
| zustand | 4.5.7 | @vitejs/plugin-basic-ssl | 1.2.0 |
| zod | 3.25.76 | tailwindcss | 3.4.19 |
| react-hook-form | 7.88.0 | postcss / autoprefixer | 8.5.28 / 10.6.1 |
| @hookform/resolvers | 3.10.0 | lucide-react | 0.453.0 |
| @supabase/supabase-js | 2.109.0 | motion | 13.4.1 |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 | — | — |

**Architecture (text diagram):**

```
Browser SPA (BrowserRouter, src/App.jsx:27-51)
├─ Routes: / Home, /category/:slug, /product/:id, /cart, /checkout,
│          /order-confirmation (location.state guard), /search?q=, * → 404
├─ Zustand cartStore, persisted to localStorage key `leclat-beauty-cart`
│   (src/store/cartStore.js:104-108) — full product snapshots + display totals
├─ src/lib/supabase.js — anon-key client. PostgREST READS only, plus 2 fetch()
│   calls to Edge Functions. Client NEVER writes tables or Storage directly.
├─ Edge Functions (in repo, audited): createorder, upload-receipt,
│   submit-review, cloudinary-sign (unused by storefront)
├─ Server-side (Edge, service_role): tables products/orders/order_items/reviews,
│   RPC reserve_stock/release_stock, bucket `payment-screenshots`
└─ Checkout PII flows: memory + navigation state only (never localStorage/URL)
```

**Trust boundaries:**

1. Browser (untrusted) ↔ Supabase PostgREST + Edge Functions via public anon key (by design).
2. Edge Functions (trusted, service_role) ↔ Postgres / Storage. RLS/storage policies are the real enforcement for direct table access — **absent from repo, CANNOT VERIFY**.
3. Manual payment verification (concierge reviews `pending` orders) is the backstop against fake orders — but stock is decremented at order time, so fake orders still deny inventory.

## 2. Project Structure (real tree)

```
/Volumes/Apps/projects/Reactwebsite
├── .env                    # local only, NOT tracked (anon key + Turnstile site key + VITE_DISABLE_CAPTCHA=true)
├── .env.example            # tracked placeholder
├── .gitignore              # .env, .env.*, dist/, node_modules/, testresults.md, DESCRIPTION.md — .env/dist NOT tracked ✔
├── vercel.json             # security headers (partial) + SPA rewrite /(.*) → /index.html
├── index.html              # shell, Google Fonts, #root, /src/main.jsx
├── vite.config.js          # fail-closed CAPTCHA guard; manualChunks vendor split
├── tailwind.config.js      # container/accent/shadow tokens; plugins: [] (no animate plugin)
├── postcss.config.js       # tailwindcss + autoprefixer
├── package.json            # scripts: dev/build/preview only — no lint, no tests
├── src/
│   ├── main.jsx            # StrictMode root
│   ├── App.jsx             # routes (8 incl. catch-all *)
│   ├── index.css           # .shadow-soft/.card-flat/.btn-base/.no-scrollbar utilities
│   ├── lib/supabase.js     # all Supabase access (331 lines)
│   ├── lib/utils.js        # cn() + getErrorMessage() (never leaks raw DB errors)
│   ├── lib/format.js       # formatEGP()
│   ├── config/categories.js# 4 canonical slugs
│   ├── store/cartStore.js  # persisted cart (109 lines)
│   ├── components/Navbar.jsx Footer.jsx ProductCard.jsx CategoryCard.jsx
│   ├── components/ui/Skeleton.jsx (Bone, ProductCardSkeleton, PageSkeleton-unused)
│   ├── components/ui/SlideUpText.jsx
│   ├── pages/Home.jsx Category.jsx ProductDetail.jsx Search.jsx Cart.jsx
│   │        Checkout.jsx (574 lines) OrderConfirmation.jsx NotFound.jsx
│   └── data/               # EMPTY directory (dead)
├── supabase/
│   ├── functions/createorder/index.ts      # audited ✔ (202 lines)
│   ├── functions/upload-receipt/index.ts   # audited ✔ (120 lines)
│   ├── functions/submit-review/index.ts    # audited ✔ (73 lines)
│   └── functions/cloudinary-sign/index.ts  # audited ✔ (38 lines, UNUSED by storefront)
│   └── migrations/: 3 files, stock functions ONLY (no RLS, no storage rules, no schema)
├── dist/                   # present on disk, NOT tracked (gitignored) ✔
└── node_modules/           # present on disk, NOT tracked ✔
```

**Artifact search:** `supabase/functions/**` FOUND (4 above). `*.sql`/migrations FOUND (3, stock-only). RLS `POLICIES`/storage-rules: **NOT FOUND anywhere**. `.github/` workflows: **NONE**. Tests/lint: **NONE** (`package.json:6-10`).

**Git tracking check** (`git ls-files | grep -E "\.env|dist/|node_modules"`): only `.env.example` matched — `.env`, `dist/`, `node_modules/` are all untracked. ✔

## 3. Data-flow & API contract table

Auth level `anon` = anyone with the public anon key. All client reads use it.

| # | Target | Op | file:line | Auth | Payload shape |
|---|---|---|---|---|---|
| D1 | `store_settings` | SELECT key,value | supabase.js:69-77 | anon | → `{key: value}` incl. `payment_bank_name/_iban/_instapay/_account_name` |
| D2 | `categories` | SELECT * ORDER name | supabase.js:82-90 | anon | — |
| D3 | `categories` | SELECT * eq slug SINGLE | supabase.js:95-104, 122-129 | anon | `slug` in URL path |
| D4 | `products_with_ratings` (view) | SELECT + categories join, eq is_featured | supabase.js:109-117 | anon | — |
| D5 | `products_with_ratings` | SELECT + join, eq category_id, optional price ORDER | supabase.js:131-146 | anon | `slug`, `price-low\|price-high` |
| D6 | `products_with_ratings` | SELECT + join, eq id SINGLE | supabase.js:151-160 | anon | `id` from `/product/:id` |
| D7 | `product_images` | SELECT * eq product_id ORDER sort_order | supabase.js:165-174 | anon | product id |
| D8 | `products_with_ratings` | SELECT + join, eq category_id, neq id, LIMIT 4 | supabase.js:179-189 | anon | related-products |
| D9 | `products_with_ratings` | SELECT + join, `.or(name.ilike,description.ilike)` ORDER name | supabase.js:237-245 | anon | sanitized ≤100-char query (strips `%_,()'"\`) |
| D10 | `reviews` | SELECT * eq product_id ORDER created_at desc | supabase.js:250-259 | anon | product id |
| D11 | `reviews` | SELECT rating eq product_id (avg computed client-side) | supabase.js:301-316 | anon | product id |
| D12 | `products_with_ratings` | SELECT + join ORDER avg_rating, review_count LIMIT 8 | supabase.js:321-330 | anon | — |
| D13 | Edge `upload-receipt` | POST FormData{file} → `{path}` | supabase.js:28-43 | anon key in headers | JPEG/PNG/WEBP ≤5 MB (client pre-check; server re-checks magic bytes) |
| D14 | Edge `createorder` (via functions.invoke) | POST `{items, contactInfo, receipt_path}` → `{id, total_price, receipt_signed_url?}` | supabase.js:196-223 | anon key | items `[{product_id, quantity}]` only — **no prices** |
| D15 | Edge `submit-review` | POST JSON `{product_id, name, rating, comment}` → row | supabase.js:265-296 | anon key in headers | server clamps name≤80, comment≤1000, rating int 1–5 |
| D16 | (server) `products` | SELECT id,price,name WHERE id IN (…) | createorder:108-117 | service_role | ids derived from items |
| D17 | (server) RPC `reserve_stock` / `release_stock` | atomic `UPDATE … WHERE stock >= qty` / add-back | createorder:132-147,45-54; migrations | service_role only (REVOKE+GRANT verified) | product_id + qty |
| D18 | (server) `orders` / `order_items` | INSERT order (status `pending`), INSERT lines, DELETE order on lines-failure | createorder:150-180 | service_role | server-computed total; receipt unique-violation → friendly error |
| D19 | (server) Storage `payment-screenshots` | LIST receipts/ (existence) + createSignedUrl 600 s | createorder:100-105,185-193; upload-receipt:102-108 | service_role | path regex `receipts/<uuid>.(jpg\|jpeg\|png\|webp)` |
| D20 | (server) `reviews` | INSERT + SELECT row | submit-review:51-60 | service_role | — |
| D21 | (server) Cloudinary sign | returns `{timestamp, signature, api_key, cloud_name, folder:"product-images"}` | cloudinary-sign:23-36 | presence-only "auth" (see SEC-04) | nothing required |

**localStorage:** `leclat-beauty-cart` (full cart snapshots, cartStore.js:104-108); `review_<productId>` (24 h review-cooldown timestamps, ProductDetail.jsx:138-149,176-180). **sessionStorage:** none. **URL-carried data:** only `?q=` search keywords. **External domains:** `fonts.googleapis.com`, `fonts.gstatic.com`, `images.unsplash.com` (hero, Home.jsx:71), `*.supabase.co`, `linkedin.com` (footer link only).

## 4. Security Findings

`[ID] Title | Severity | Status | Evidence | Exploit (1–2 lines) | Fix`

- [SEC-01] No rate limiting on `createorder` → fake-order stock exhaustion | **High** | CONFIRMED | `supabase/functions/createorder/index.ts:38-202` (no IP/quote check; CORS `*` at :3-7) | Attacker loops anon orders for a product; each reserves real stock (atomic decrement :132-147) with `pending` orders nobody pays for — legitimate customers see out-of-stock. No reservation TTL exists. | Per-IP quota + CAPTCHA on checkout; expire/release stale `pending` reservations (cron); alert on order-velocity spikes.
- [SEC-02] `upload-receipt` unauthenticated + no quota → storage-fill / cost abuse | **High** | CONFIRMED | `supabase/functions/upload-receipt/index.ts:53-119` (no auth, no rate limit; only 5 MB + magic-byte checks :70-87) | Anyone with the public anon key (i.e. anyone) uploads 5 MB images in a loop; orphaned files are never cleaned (see SEC-09). Fills bucket, runs up storage bill. | Require a checkout-session token or CAPTCHA; per-IP daily quota; lifecycle rule purging unreferenced `receipts/*`; cap bucket size.
- [SEC-03] `submit-review` has NO CAPTCHA despite client comment claiming Turnstile is "verified server-side" | **Medium** | CONFIRMED | Comment `src/lib/supabase.js:261-264` vs `supabase/functions/submit-review/index.ts:1-73` (zero Turnstile/captcha code; nothing in `src/` references Turnstile at all) | Review spam/defacement at scale; the false comment gives sign-off confidence that does not exist. Client cooldown (`ProductDetail.jsx:138-149`) is localStorage-only and trivially cleared. | Add Turnstile/Cloudflare verification server-side (or remove the misleading comment); per-IP + per-product rate limit; moderation queue.
- [SEC-04] `cloudinary-sign` mints billable upload signatures for ANY caller; unused by storefront | **Medium** | CONFIRMED | `supabase/functions/cloudinary-sign/index.ts:14-17` (rejects only a *missing* `Authorization` header — any value passes), no method check (GET signs too), returns signature+api_key :34-36 | Attacker with no credentials fetches signatures and uploads to your Cloudinary `product-images` folder on your bill; possible ToS/abuse-content liability. Nothing in `src/` calls it. | Disable/delete the function until needed; then require a real admin check (verify Supabase JWT, admin allowlist) and bind signatures to one `public_id`.
- [SEC-05] `Access-Control-Allow-Origin: *` on all Edge Functions | **Low** | CONFIRMED | createorder :3-7, upload-receipt :4-7, submit-review :4-7, cloudinary-sign :3-7 | Any site can drive the anon-callable endpoints from victims' browsers. Low added risk (anon key is public anyway) but widens CSRF-style abuse and credentialed-misuse confusion. | Restrict to storefront origin(s); keep `*` only if a documented reason exists.
- [SEC-06] Bank/IBAN payment instructions world-readable via anon SELECT | **Medium** | CONFIRMED | `src/lib/supabase.js:69-77` + `src/pages/Checkout.jsx:446-471` (keys `payment_bank_name/_iban/_instapay/_account_name`) | Scrapers harvest the IBAN with one anon query — phishing/social-engineering fuel. (Improvement vs hardcoding: rotation no longer needs a deploy.) | Acceptable IF intentional; otherwise gate behind a short-lived checkout token, mask IBAN until step 3, monitor enumeration.
- [SEC-07] RLS + Storage policies + schema constraints unverifiable from this repo | **— (CANNOT VERIFY)** | CANNOT VERIFY | Repo contains zero policy/storage/schema SQL (only 3 stock-function migrations); client relies on anon SELECT across `categories`, `products_with_ratings`, `product_images`, `reviews`, `store_settings` | If any table/bucket is over-permissive (e.g. anon SELECT on `orders`, anon INSERT anywhere, public receipts bucket), PII/receipts leak. Nothing in-repo proves otherwise. | Supply artifacts in §6 (policies dump, bucket settings, table grants).
- [SEC-08] `orders.receipt_path` uniqueness assumed but not proven (receipt-reuse guard depends on it) | **Medium** | CANNOT VERIFY | `createorder:155-160` maps Postgres `23505` to "receipt already used"; no UNIQUE constraint in repo migrations | If the constraint is missing, one receipt pays for unlimited orders (pay-once, order-many). | Confirm UNIQUE on `orders.receipt_path` in dashboard; add migration to repo.
- [SEC-09] Orphaned receipt files when upload succeeds but order creation fails | **Medium** | CONFIRMED | `src/pages/Checkout.jsx:118-147` (no delete/cleanup path on `createOrder` failure) | Every failed checkout leaves a permanent image in the private bucket — storage growth + stale PII-adjacent artifacts with no owner. | Delete the uploaded object on order failure, or run an orphan-sweeper (receipts unreferenced after N hours).
- [SEC-10] Review "one per day" enforced only in bypassable localStorage | **Medium** | CONFIRMED | `src/pages/ProductDetail.jsx:138-149,176-180`; server has no dedup/rate limit (`submit-review/index.ts`) | Clear storage / new browser / direct POST → unlimited reviews per product. | Server-side per-IP + per-product window; CAPTCHA (see SEC-03).
- [SEC-11] Vercel env hygiene: local `.env` sets `VITE_DISABLE_CAPTCHA=true`, which hard-fails prod builds | **Medium (operational)** | CONFIRMED | `.env:4` + fail-closed guard `vite.config.js:10-14`; `npm run build` with repo `.env` FAILS (verified §8) | If this value is ever set in Vercel/production env, every production build breaks; silent deploy outage at sign-off. | Never set it outside local dev (document in runbook); add CI build check.
- [SEC-12] Dead `VITE_TURNSTILE_SITE_KEY` config (misspelled `TURNSTILE`, nothing reads it) | **Low** | CONFIRMED | `.env:3`, `.env.example:3`; zero `turnstile/captcha` references in `src/` | False sense of bot protection during review; confusion for whoever wires CAPTCHA next. | Remove until real Turnstile integration ships (then fix spelling to `VITE_TURNSTILE_SITE_KEY`).
- [SEC-13] Residual header/CSP gaps (improved but thin) | **Low** | CONFIRMED | `vercel.json:4-22` (has nosniff, Referrer-Policy, `frame-ancestors 'none'`); no HSTS, no script/img `connect-src` allowlist, no SRI on Google Fonts (`index.html:10-12`) or Unsplash hero (`Home.jsx:71`) | Compromised CDN/font host can inject code; no HSTS downgrade protection (Vercel sends its own HSTS on `*.vercel.app` — verify on custom domain). | Add HSTS (custom domain), extend CSP (`connect-src https://*.supabase.co`, font/img sources), SRI where possible.
- [SEC-14] Cart persisted as full product snapshots, stale brand key, no version/TTL | **Low** | CONFIRMED | `src/store/cartStore.js:28-108` (key `leclat-beauty-cart`, whole `product` objects incl. price/stock) | Price tampering can't reach the server (repriced, §5 PASS), but stale prices display, snapshots bloat storage, old shapes never migrate. XSS-readable by design of any XSS. | Persist `{product_id, quantity}` only; rehydrate from DB; add `version` + TTL.
- [PASS-01] Order integrity: client sends NO prices — server reprices from DB | n/a | CONFIRMED SECURE | `Checkout.jsx:135-147` sends only `product_id+quantity`; `createorder:108-129` prices via integer-cents math from `products.price`; qty validated int 1–100/line, merged cap 100, ≤50 lines (:66-83); receipt regex + existence check (:96-105); stock reserved atomically (:132-147) with rollback (:45-54,156,176-178) | — | — |
- [PASS-02] No XSS/injection surface in client rendering | n/a | CONFIRMED SECURE | Zero `dangerouslySetInnerHTML/innerHTML/eval` in `src/`; search strips PostgREST reserved chars + 100-char cap (`supabase.js:228-245`); reviews render as React text (`ProductDetail.jsx:486-511`); `target=_blank` has `rel=noopener noreferrer` (`Footer.jsx:66-68`); no user-controlled redirects (`navigate()` paths static; suggestion nav uses DB ids, `Navbar.jsx:97-102`) | — | — |
- [PASS-03] No secret leakage beyond the public-by-design anon key | n/a | CONFIRMED SECURE | `.env` untracked + gitignored; no `service_role`/API-secret/private URL in repo or `src/`; `console.*` emit generic strings only (`Checkout.jsx:124,159`, `lib/utils.js:15-20` never surfaces raw DB errors); PII lives in memory/navigation state, never localStorage/URLs | — | — |

## 5. Bugs & Code Issues

`[ID] Title | Severity | Status | Evidence file:line | User-visible impact + reproduction | Fix`

- [BUG-01] `ProductCard` quick-add stock logic is boolean-broken; can push cart past stock | **Medium** | CONFIRMED | `src/components/ProductCard.jsx:37-55` (`canAdd` is a boolean; `if (canAdd <= 0)` and `if (canAdd === 1)` are dead; existing-cart quantity ignored) | Impact: from any grid, click Add N times on a stock-2 item → cart holds N; checkout then fails with "Insufficient stock". Repro: stock=2 product → Add ×3 from card → cart qty 3. (Server `reserve_stock` still protects inventory.) | Mirror `ProductDetail.jsx:194-219` logic: compute `canAdd = stock − inCart`, clamp, message when capped.
- [BUG-02] No route code-splitting: single 365 KB index chunk (107 KB gzip) | **Low (perf)** | CONFIRMED | `src/App.jsx:1-12` (all pages statically imported; zero `React.lazy` in `src/`); build output §8 (`index-CWwq7Yhf.js 365 KB`) | Slower first paint on mobile networks; whole app + Supabase client ships for every route. | `React.lazy` + `Suspense` per route; keep `manualChunks` vendors.
- [BUG-03] `animate-in …` classes are dead (animate plugin not installed) | **Low** | CONFIRMED | `Checkout.jsx:256,343,435`, `OrderConfirmation.jsx:30`, `Navbar.jsx:348,391` vs `tailwind.config.js:41` (`plugins: []`), absent from `package.json` | Step transitions / confirmation zoom / mobile-menu slide silently do nothing — UI looks static vs design intent. | Install `tailwindcss-animate` and configure, or replace with built-ins.
- [BUG-04] `shadow-soft` vs `shadow-card` two-sources-of-truth | **Trivial** | CONFIRMED | `tailwind.config.js:28-31` defines `card/card-hover` (unused); code uses CSS utilities `.shadow-soft` (`index.css:23-30`) | Future shadow edits land in the wrong place; visual drift. | Move into config (`soft`, `soft-hover`), delete custom CSS (or vice versa).
- [BUG-05] Hex-contrast helpers misbehave on non-6-digit/invalid colors | **Low** | CONFIRMED | `src/pages/Category.jsx:56-64`, `src/components/CategoryCard.jsx:7-15` (`substr` assumes 6-digit hex; `#fff`/bad DB value → NaN brightness → wrong text color) | A category with short/invalid `accent_color` renders unreadable banner/tile text. Repro: set `accent_color='#fff'` → dark text on near-white assumed wrongly (or white-on-light). | Normalize 3-digit hex, validate `/^#?[0-9a-f]{6}$/i`, safe default in try/catch.
- [BUG-06] Checkout `<label>`s not associated with inputs (a11y) | **Low** | CONFIRMED | `src/pages/Checkout.jsx:269,289,309,392,475` (`<label>` without `htmlFor`; inputs without `id`) | Screen readers don't announce field purpose; smaller tap targets on mobile. (Review form does it right: `ProductDetail.jsx:531-544`.) | Add `htmlFor`/`id` pairs.
- [BUG-07] Refresh/back on `/order-confirmation` loses the order → bounced home | **Low (UX)** | CONFIRMED | `src/pages/OrderConfirmation.jsx:11-15` (guard `<Navigate to="/" replace/>`); state built `Checkout.jsx:150-157` with blob `filePreview` fallback that can't survive reload | User refreshing the confirmation (or sharing it) sees the home page with no receipt/reference and may re-order. Privacy-positive, UX-negative. | Persist minimal `{id, total_price}` in `sessionStorage` as fallback with a "lookup not available offline" note, or document as intended.
- [BUG-08] Dead code: unused `contactInfo` const, unused `PageSkeleton`, empty `src/data/`, dead `manualChunks` branch | **Trivial** | CONFIRMED | `Checkout.jsx:130-134` (built then shadowed by inline object :140-144); `Skeleton.jsx:38-54` (`PageSkeleton` never imported); `src/data/` empty; `vite.config.js:31` matches `@tanstack/react-query` (not installed) | Confusion + tiny bundle waste; no user impact. | Delete all four.
- [BUG-09] Over-fetching: `select('*')` + unbounded review list, no pagination | **Low (perf)** | CONFIRMED | `supabase.js:82-90,95-104,122-129,165-174,250-259` (`select('*')`); `fetchProductReviews` returns all rows | Wide rows + long review threads slow category/product pages and inflate transfer. | Select needed columns; paginate reviews (limit + "load more").
- [BUG-10] `release_stock` adds back blindly with no cap; `submit-review`/`cloudinary-sign` lack method checks | **Low** | CONFIRMED | `20261012193152_version_stock_functions.sql:1-12`; `submit-review/index.ts` (no POST check), `cloudinary-sign/index.ts:9-17` | Only service_role can call stock RPCs (mitigated), but double-release or replay inflates stock; GET requests hit function logic unnecessarily. | Clamp release to a sane ceiling / idempotent reservation tokens; enforce `POST` (+405).
- [PASS-04] Checkout validation actually enforced; double-submit safe; empty-cart guarded | n/a | CONFIRMED OK | Zod schema `Checkout.jsx:13-18`, `handleSubmit(onFinalSubmit, onInvalid)` at :550, step triggers :59-74, `isSubmitting` guard + disabled buttons :108,539,549, reset in `finally` :162, empty-cart screen :165-182 | — | — |
- [PASS-05] Invalid category slugs render proper 404; search debounce/stale-guard correct; product 404 handled | n/a | CONFIRMED OK | `Category.jsx:34-42,70-72` (`PGRST116` → `<NotFound/>`); `Search.jsx:29-57` (300 ms debounce, request-id guard, cleanup invalidation); `Navbar.jsx:61-86,105-110`; `ProductDetail.jsx:243-258` | — | — |

## 6. Items I CANNOT VERIFY from this repo

For each, the exact artifact or dashboard screen required:

1. **RLS policies** (tables `products`, `categories`, `product_images`, `products_with_ratings`, `reviews`, `orders`, `order_items`, `store_settings`) — need: Supabase Dashboard → Authentication → Policies **or** SQL dump (`pg_policies` + `SELECT grantee,privilege_type FROM information_schema.role_table_grants`). Must prove: anon can SELECT catalog/reviews/settings only; anon has ZERO INSERT/UPDATE/DELETE anywhere; anon has ZERO SELECT on `orders`/`order_items`.
2. **`payment-screenshots` bucket privacy + policies** — need: Dashboard → Storage → bucket settings screenshot (Public/Private) + Storage policies SQL (`storage.objects` policies). Must prove: bucket PRIVATE, no anon read; signed-URL minting scoped.
3. **UNIQUE constraint on `orders.receipt_path`** — need: Dashboard → Table Editor → `orders` → constraints, or `\d orders` / `pg_constraint` dump. `createorder` assumes it (SEC-08).
4. **`reserve_stock`/`release_stock` deployment + grants** — need: `SELECT * FROM pg_proc` / grants dump confirming the two migrations actually applied on the linked project and `anon/authenticated` truly lack EXECUTE.
5. **Edge Function deployment parity** — need: Dashboard → Edge Functions → deployed code hash + version for `createorder`, `upload-receipt`, `submit-review`, `cloudinary-sign` (repo copy may differ from production); plus function logs showing error-rate.
6. **Rate-limit / WAF / CAPTCHA settings** — need: Dashboard → Project Settings → API rate limits, any WAF/Bot-management or Cloudflare Turnstile dashboard proving throttling on Functions/Auth/Storage (relevant to SEC-01/02/03/10).
7. **Supabase Auth + service_role key custody** — need: confirmation of who holds the service_role key, rotation history, and that it exists only in Function secrets (never in Vercel/client env).
8. **PII retention/deletion posture** — need: written policy for `orders` PII + receipt images (retention window, deletion procedure, who can view receipts in Dashboard/Storage).
9. **Custom-domain HTTPS/HSTS** — need: response headers from the production domain (`curl -sI`) proving HSTS + final CSP (Vercel defaults differ per plan/domain).

## 7. Dependency audit

`npm audit` (network available; full run): **12 vulnerabilities (5 moderate, 7 high)**. `npm outdated`: most majors behind (React 18→19, Vite 5→8, RRD 6→7, Tailwind 3→4) — upgrade debt, not vulns per se.

| Advisory | Severity | Runtime vs dev-only | Verdict |
|---|---|---|---|
| `react-router` 6.0.0–7.17.0: open redirect via backslash (`GHSA-wrjc-x8rr-h8h6`, CVE-2025-68470 bypass) + SSR `deserializeErrors` constructor injection (`GHSA-337j-9hxr-rhxg`) — installed via react-router-dom 6.30.6 | moderate | **Production bundle**, but barely exploitable here: SPA `BrowserRouter`, no SSR hydration path, all `to=`/`navigate()` targets are static or DB ids | Upgrade to RRD 7.x when convenient (P2); do not pass user input to `to=`/`navigate()` |
| `esbuild ≤0.24.2` (`GHSA-67mh-4wv8-2f99` — dev server accepts cross-origin requests) via vite 5.4.21 | moderate | **Dev server only** | Never expose `npm run dev` to untrusted networks; upgrade Vite P2 |
| `postcss-selector-parser <7.1.6` quadratic-complexity DoS (`GHSA-rj75-hqrm-r3gf`) via tailwindcss chain | moderate | **Build-time only** | Upgrade Tailwind P2 |
| `braces` stack-exhaustion (`GHSA-vfj7-8cjw-p6xm`) via chokidar/micromatch → tailwindcss | high | **Build-time only** | Same as above |
| `source-map-js` event-loop DoS (`GHSA-68fv-2mgg-jv7q`) | high | **Build-time only** | Same as above |

No lint/test tooling exists (`package.json` scripts: `dev/build/preview` only) — CVEs and regressions go unnoticed. Recommend adding `npm audit` to CI.

## 8. Build/lint results

- `npm run build` **with the repo's `.env` (`VITE_DISABLE_CAPTCHA=true`): FAILS** — `vite.config.js:10-14` throws `VITE_DISABLE_CAPTCHA=true must not be set in production` (fail-closed guard working as designed, but the shipped `.env` can never produce a prod build).
- `VITE_DISABLE_CAPTCHA= npm run build`: **PASSES** — `vite v5.4.21`, 2070 modules, chunks: `index 365 KB` (gzip 107), `vendor-supabase 214 KB` (gzip 55), `vendor-motion 128 KB` (gzip 42), `vendor-icons 18 KB`, CSS 35 KB. No build warnings besides chunk-size advisory implied by single 365 KB index chunk (see BUG-02). `dist/` regenerated on disk (untracked).
- Lint/tests: **not configured** — nothing to run (`package.json` has no lint/test scripts; no eslint/vitest/playwright in repo).
- `npm ci` not re-run (node_modules present and consistent with lockfile; `npm audit`/`outdated` executed against it).

## 9. Previous Claims Re-verification table

Old finding ID → verdict (code evidence from this session):

| Old ID | Verdict | Evidence / note |
|---|---|---|
| S1 (secrets, no .gitignore) | **FIXED** | `.gitignore:1-7` exists; `.env`, `dist/`, `node_modules/` all untracked (verified via `git ls-files`). Residual: anon key in bundle is public-by-design (PASS-03). |
| S3 (direct anon writes: reviews + storage) | **FIXED** | Reviews → `submit-review` Edge Function (`supabase.js:265-296`); uploads → `upload-receipt` Function (`supabase.js:17-64`). No direct table/storage writes in client. Residual abuse surface → SEC-01/02/03/10. |
| S5 (upload ext allowlist) | **FIXED** | Client allowlist `supabase.js:13-15` + server magic-byte sniffing `upload-receipt/index.ts:18-51,80-87` + UUID names `:99-100` + 5 MB both sides. |
| S6 (PII/receipt handling) | **FIXED (residuals → §6)** | Private-path + 600 s server-minted signed URLs (`createorder:185-193`). Bucket privacy/retention still CANNOT VERIFY (§6 items 2, 8). |
| S7 (review abuse = client cooldown) | **CONFIRMED** | Cooldown still localStorage-only (`ProductDetail.jsx:138-149`); no server rate limit/CAPTCHA (`submit-review/index.ts`). Server validation added (name≤80/rating/comment≤1000) — partial mitigation only. Now SEC-03/SEC-10. |
| S8 (PII/verbose errors in console) | **FIXED** | All `console.*` generic (`Checkout.jsx:124,159` etc.); `getErrorMessage` never surfaces raw errors (`utils.js:15-20`). |
| S9 (hardcoded IBAN) | **FIXED** | No hardcoded bank data in `src/`; served from `store_settings` (`Checkout.jsx:446-471`, `supabase.js:69-77`). New note: values are anon-readable (SEC-06). |
| S10 (cart in plaintext localStorage) | **CONFIRMED** | Full snapshots, stale key, no version/TTL (`cartStore.js:28-108`). Now SEC-14. |
| S11 (headers/CSP) | **FIXED (residuals → SEC-13)** | `vercel.json:4-22` added nosniff + Referrer-Policy + minimal CSP. Missing HSTS/full CSP/SRI carried as SEC-13. |
| S12 (rate limiting) | **CONFIRMED** (newsletter part FIXED — form removed, `Footer.jsx:43-56`) | Reviews/uploads/checkout still unthrottled. Now SEC-01/02/10. |
| B1 (category dead error check) | **FIXED** | try/catch + `PGRST116` → `<NotFound/>` (`Category.jsx:34-42,70-72`). |
| B3 (handleSubmit unused) | **FIXED** | `handleSubmit(onFinalSubmit, onInvalid)` wired (`Checkout.jsx:550`); Zod enforced. |
| B4 (addToCart exceeds stock) | **FIXED** | Merge clamps `Math.min(qty, stock)` (`cartStore.js:43-49`); server atomic reserve verified. Quick-add path still buggy → BUG-01. |
| B6 (0-total + dead address) | **FIXED** | `order.total_price != null` (`OrderConfirmation.jsx:107`); address in navigation state (`Checkout.jsx:153`). |
| B8 (weak ext parsing) | **FIXED** | See S5. |
| B10 (dead animate classes) | **CONFIRMED** | Still used, plugin still absent. Now BUG-03. |
| B11 (shadow naming) | **CONFIRMED** | Unchanged. Now BUG-04. |
| B12 (hex contrast) | **CONFIRMED** | Unchanged. Now BUG-05. |
| B14 (fake newsletter) | **FIXED** | Form removed from `Footer.jsx`. |
| N1 (undefined stock label) | **FIXED** | `product.stock == null ? 'In Stock' : …` (`ProductDetail.jsx:394-396`). |
| N2 (addToCart past stock) | **FIXED** | See B4. |
| N3 (address block unreachable) | **FIXED** | See B6. |
| N4 (review insert-then-select RLS) | **FIXED** | Service-role Edge Function, no client select. |

No CONFIRMED old item is missing from §§4–5 (S7→SEC-03/10, S10→SEC-14, S12→SEC-01/02/10, B10→BUG-03, B11→BUG-04, B12→BUG-05).

## 10. Go-Live Verdict: **NO-GO** (converts to GO once P0 is cleared)

Core money-flow is sound (server-side repricing, atomic stock, no price input, no key leaks — PASS-01..03), but the store is sign-off-blocked by abuse vectors that deny inventory to real customers and by unverified server posture.

**P0 — must-fix before client sign-off:**
1. Throttle abuse paths: per-IP quotas (+ CAPTCHA) on `createorder`, `upload-receipt`, `submit-review` (SEC-01/02/03/10); add expiry/release for stale `pending` stock reservations.
2. Prove server posture with §6 artifacts 1–4: RLS dump, bucket-privacy screenshot, `orders.receipt_path` UNIQUE proof, RPC grants + function deployment parity. If RLS/policies are wrong, nothing else matters.
3. Neutralize `cloudinary-sign`: delete/disable it (or put real admin auth on it) — it currently mints billable signatures for anyone (SEC-04).
4. Guarantee deployability: ensure `VITE_DISABLE_CAPTCHA` is unset in Vercel/prod env; add a CI `npm run build` gate (SEC-11, §8).
5. Fix `ProductCard` quick-add stock accounting (BUG-01) — it manufactures checkout-time "insufficient stock" failures for real shoppers.
6. Orphan-receipt handling: delete-on-order-failure or sweeper + bucket cap (SEC-02/09).

**P1 — this sprint:** CAPTCHA on checkout, mask/gate IBAN display (SEC-06), `htmlFor` labels (BUG-06), review pagination + `select('*')` narrowing (BUG-09), HSTS/CSP hardening (SEC-13), persist `{product_id, quantity}` only (SEC-14), remove dead code/config (BUG-08, SEC-12).

**P2 — hygiene:** route code-splitting (BUG-02), dead animate classes (BUG-03), shadow/hex helpers (BUG-04/05), dependency upgrades + `npm audit` CI (§7), confirmation-refresh story (BUG-07), method checks + release-stock hardening (BUG-10).
