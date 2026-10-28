# Phloem website

The public website for **Phloem**, at **[phloemmarket.com](https://phloemmarket.com)**: African food from home cooks
and food businesses in **Ghana, Nigeria and the United Kingdom**, and a parcel service for sending food between them.

It's a single-page app (React + TypeScript + Vite) that talks to the **Phloem API**
(`https://phloemapi.phloemmarket.com`). The same API serves the mobile app, so the two always show the same dishes,
prices, orders and texts.

| | Repository |
|---|---|
| Website (this) | `adahadapato/Phloem-web` |
| API (.NET 10) | `adahadapato/Phloem-Api` |
| Mobile app (.NET MAUI) | `adahadapato/phloem-mobile` |

---

## Contents

1. [What's on the website](#1-whats-on-the-website)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Scripts](#4-scripts)
5. [Configuration](#5-configuration)
6. [Project structure](#6-project-structure)
7. [Pages and routes](#7-pages-and-routes)
8. [How it works](#8-how-it-works)
9. [Design system and styling](#9-design-system-and-styling)
10. [Conventions](#10-conventions)
11. [Accessibility](#11-accessibility)
12. [Deployment (CI/CD)](#12-deployment-cicd)
13. [Troubleshooting](#13-troubleshooting)
14. [Roadmap](#14-roadmap)

---

## 1. What's on the website

**Everyone**
- **Home**: a restaurant-style landing page with a big food photo, a search box with **predictions while you type**
  (dish names, then shops), "What are you craving?", suggestion rows, top-rated dishes, the cooks, how it works,
  the parcel service and an invitation to sell.
- **Suggestions** on Home: signed in, "Order again" and "You might like" (each card says why it was picked);
  signed out or new, "Popular in Ghana".
- **Explore** (dishes by country, category, search with predictions, sort, pages) and **Shops** (each shop's page
  with its menu).
- A **basket** that remembers dishes from several shops and countries, with a floating basket bar.
- **Track a parcel** by tracking number, **About**, **Terms & Conditions**, **Privacy Policy**, **Help & support**
  (with "Need help?" links on the pages where people get stuck) and **Contact us** (form + phone, WhatsApp, email,
  hours, address).
- A **country picker** in the header (Ghana 🇬🇭 · Nigeria 🇳🇬 · United Kingdom 🇬🇧) that drives what's shown.

**Signed in**
- Sign up, log in (with "Remember me"), two-factor sign-in, confirm email, reset password.
- **Checkout**: today's prices, out-of-stock and closed-shop checks, delivery time, delivery address (with recipient
  name and phone), one order per shop; **My orders** with tabs, search, "Buy it again", order details, cancel.
- **Send a parcel** (route, speed, items, "what can be sent", quote, shipping terms) and **My shipments** with a
  timeline.
- **My account**: profile and photo, delivery addresses, notifications, password, two-factor setup with QR code.
- **"We've updated our Terms"**: shown when new Terms are published; people can browse, but ordering, sending
  parcels and selling wait until they accept. A one-time notice when the Privacy Policy changes.

**Sellers** — become a seller (with "I agree to the Seller terms"), seller dashboard, incoming orders
(accept / decline / send out with a courier or "I'll deliver it myself" / change courier), dishes with photos and
allowed price ranges, shop settings (logo, cover, delivery fee, order cut-off, documents).

**Couriers** — **My deliveries** (`/deliveries`, also for sellers): what to collect where, who to call, the address
(opens Google Maps), and **Delivered** with a photo (on a phone the button opens the camera), how it was handed over
and an optional note. Customers see the photo as **Proof of delivery** on their order and parcel pages.

**Admins** — **Admin dashboard**: overview, shops (review, approve, documents), users (roles, suspend), dish names
(organised by country), pricing (commission, delivery fees, delivery times), shipping (routes, parcels at the hub,
what can be sent), Terms & Help (publish new versions with a live preview, see how many people have accepted), and
**Contact messages**. **Support agents** see only Contact messages.

---

## 2. Tech stack

| Area | Choice | Version |
|---|---|---|
| UI | React | 19.3 |
| Language | TypeScript (strict) | 6.0 |
| Build / dev server | Vite (with `@vitejs/plugin-react`) | 8.3 |
| Routing | React Router (data router, lazy-loaded pages) | 8.5 |
| Server state | TanStack Query | 5.104 |
| Styling | CSS Modules + design tokens (`src/styles/tokens.css`) | — |
| Headline font | DM Serif Display via `@fontsource` (served with the site; no Google call) | 5.3 |
| QR codes | `qrcode.react` (two-factor setup) | 4.2 |
| Linting | ESLint 10 + typescript-eslint + react-hooks + react-refresh | — |
| Hosting | IIS on SmarterASP.NET (`public/web.config`) | — |
| CI/CD | GitHub Actions (Node 22) | — |

No UI framework and no CSS-in-JS: the look is hand-built to match the mobile app's colours.

---

## 3. Getting started

### 3.1 Prerequisites

- **Node.js 22** (the version the pipeline uses) and npm.
- The **Phloem API** running locally on `https://localhost:7103` (see the API's README), or point the site at the live
  API (section 5).
- Trust the .NET development certificate once (`dotnet dev-certs https --trust`), or the browser will refuse the
  local API.

### 3.2 Install and run

```bash
git clone https://github.com/adahadapato/Phloem-web.git
cd Phloem-web
npm install
npm run dev
```

Open **http://localhost:5173**. The local API already allows this origin (CORS).

To sign in locally, use the first admin the API creates (`SeedData:AdminEmail` and the password you set in its User
Secrets), or sign up a new account. With demo data switched on in the API, Home shows demo shops and dishes.

---

## 4. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload, using `.env.development` |
| `npm run build` | type-check (`tsc -b`) then build to `dist/` with `.env.production` |
| `npm run preview` | serve the built `dist/` locally (http://localhost:4173) |
| `npm run lint` | ESLint over the whole project (the pipeline fails on errors) |

Before pushing, run **`npm run lint && npm run build`**: that's exactly what the pipeline checks.

---

## 5. Configuration

There's one setting: where the API is.

| File | Used by | Value |
|---|---|---|
| `.env.development` | `npm run dev` | `VITE_API_BASE_URL=https://localhost:7103` |
| `.env.production` | `npm run build` | `VITE_API_BASE_URL=https://phloemapi.phloemmarket.com` |

- Anything starting with `VITE_` is **built into the JavaScript and visible to everyone**: never put a secret here.
- To try the local site against the live API, create `.env.development.local` with
  `VITE_API_BASE_URL=https://phloemapi.phloemmarket.com` (it's ignored by git). The live API only accepts the
  production origins, so prefer a local API for anything that changes data.
- In the pipeline, the repository **variable** `API_BASE_URL` (if set) overrides `.env.production`.

Read in `src/api/config.ts`.

---

## 6. Project structure

```
Phloem-web/
├── public/
│   ├── images/              photos and illustrations (WebP)
│   ├── favicon.png, apple-touch-icon.png
│   └── web.config           IIS: SPA fallback to index.html, https redirect, caching rules
├── src/
│   ├── main.tsx             entry: fonts, global styles, <App />
│   ├── App.tsx              providers: TanStack Query, Session, Country, Cart, Router
│   ├── routes.tsx           every address, lazy-loaded pages, guards
│   ├── api/
│   │   ├── client.ts        the one HTTP client: tokens, renewal, timeouts, ProblemDetails → ApiError
│   │   ├── tokens.ts        sign-in tokens (localStorage with "Remember me", else sessionStorage)
│   │   ├── apiError.ts      ApiError, ApiResult, unwrap()
│   │   ├── apiQuery.ts      withQuery() for query strings
│   │   ├── config.ts        the API address
│   │   ├── contracts/       dtos.ts, commands.ts, enums.ts, roles.ts (same shapes as the API)
│   │   └── services/        one file per API area: account, admin, auth, contact, country, dish,
│   │                        dishCatalog, legal, order, sellerOrder, shipment, shop, suggestion
│   ├── state/               React contexts
│   │   ├── SessionContext   who is signed in (profile + roles), sign-in restore, sign out
│   │   ├── CountryContext   countries from the API + the picked country
│   │   ├── CartContext      the basket (kept in localStorage)
│   │   └── TermsContext     "We've updated our Terms" + Privacy notice + askToAccept()
│   ├── components/
│   │   ├── layout/          PageShell, Header, Footer, AccountMenu, CountryPicker, BasketBar,
│   │   │                    ProtectedRoute, SellerRoute, TermsUpdate
│   │   └── ui/              Button, Field, DishCard, ShopCard, SearchSuggest, StatusBanner, ListStatus,
│   │                        Pager, Price, Stars, QuantityStepper, Markdown, NeedHelp, EmptyState, labels.ts…
│   ├── pages/
│   │   ├── home/            HomePage + hero, cravings, suggestions (HomeForYou), dish rows, cooks…
│   │   ├── explore/         FoodListingPage, ShopsPage, ShopPage
│   │   ├── auth/            Login, Register, ConfirmEmail, ResetPassword
│   │   ├── orders/          Cart, Checkout, Orders, OrderDetails, BuyItAgainPanel
│   │   ├── shipping/        Track, SendParcel, Shipments, ShipmentDetails
│   │   ├── account/         Account, EditProfile, Addresses, Notifications, ChangePassword, TwoFactor
│   │   ├── seller/          BecomeSeller, SellerDashboard, ShopOrders, MyDishes, DishEditor, ShopSettings
│   │   ├── admin/           AdminLayout, Overview, shops/, users/, dishes/, pricing/, shipping/, texts/, messages/
│   │   └── about/           About, Legal (Terms/Privacy/Help), Contact, NotFound, ComingSoon
│   └── styles/
│       ├── tokens.css       colours, radii, shadows, fonts, sizes (= the app's Colors.xaml)
│       └── global.css       base elements, .container, .card, .muted, .eyebrow, .visually-hidden…
├── .env.development / .env.production
├── eslint.config.js, tsconfig*.json, vite.config.ts
└── .github/workflows/phloem-web.yml
```

---

## 7. Pages and routes

| Address | Page | Access |
|---|---|---|
| `/` | Home | everyone |
| `/explore` | dishes (`?search=&category=&sort=&page=`) | everyone |
| `/shops`, `/shops/:shopId` | shops, a shop's menu | everyone |
| `/cart` | basket | everyone |
| `/track`, `/track/:trackingNumber` | track a parcel | everyone |
| `/send-parcel` | send a parcel | everyone (booking needs sign-in) |
| `/sell` | become a seller | everyone (opening a shop needs sign-in) |
| `/about`, `/terms`, `/privacy`, `/help`, `/contact` | texts and Contact us | everyone |
| `/login`, `/register`, `/confirm-email`, `/reset-password` | sign-in pages (`?returnTo=` supported) | everyone |
| `/checkout`, `/orders`, `/orders/:orderNumber` | buying | 🔒 signed in |
| `/shipments`, `/shipments/:trackingNumber` | my parcels | 🔒 |
| `/account`, `/account/edit`, `/account/addresses`, `/account/notifications`, `/account/password`, `/account/two-factor` | my account | 🔒 |
| `/deliveries` | My deliveries (couriers and sellers) | 🔒 |
| `/seller`, `/seller/orders`, `/seller/dishes`, `/seller/dishes/new`, `/seller/dishes/:dishId`, `/seller/settings` | seller area | 🔒 + a shop (otherwise → `/sell`) |
| `/admin` (+ `shops`, `shops/:id`, `users`, `dishes`, `pricing`, `shipping`, `shipping/parcels`, `shipping/parcels/:n`, `shipping/rules`, `texts`, `messages`) | admin | 🛡 Admin; Support agents → `messages` only |
| `*` | not found | everyone |

Guards: `ProtectedRoute` (signed in, optionally one of several roles; signed-out people go to
`/login?returnTo=…` and come back) and `SellerRoute`. Pages are **lazy-loaded**, so the first visit stays small.
`public/web.config` sends every non-file address to `index.html`, so refreshing any page or opening an emailed link
works.

---

## 8. How it works

### 8.1 Talking to the API

- **One client** (`src/api/client.ts`) for every call. It never throws for HTTP problems: every call returns an
  `ApiResult<T>` — `{ ok: true, value }` or `{ ok: false, error: ApiError }`.
- `ApiError` is read from the API's ProblemDetails: `detail` → `message` (shown to people as-is), `code` → `code`
  (what code checks, e.g. `Terms.NotAccepted`), `errors` → `fieldErrors` (shown under each field with
  `error.fieldError('Email')`).
- Before a request, an access token that's about to run out is **renewed first**; on a 401 the client renews **once**
  and retries; if renewal is refused, the person is signed out. Only one renewal runs at a time.
- 30-second timeout; offline or unreachable gives a friendly message.
- **TanStack Query** for reading: `queryFn: async ({ signal }) => unwrap(await getSomething(signal))`. Query keys are
  grouped (`['orders', …]`, `['dishes', …]`, `['admin', …]`) so one `invalidateQueries` refreshes a whole area
  (e.g. placing an order refreshes My orders and the Home suggestions). Signing out clears the whole cache.
- `contracts/` mirror the API's DTOs and commands exactly (camelCase JSON, enums as names). Keep them in step with the
  API and the app's `Services/Api/Contracts`.

### 8.2 Signing in

- Tokens live in **localStorage** when "Remember me" is ticked, otherwise in **sessionStorage** (gone when the tab
  closes). On start, a kept sign-in is restored before protected pages render (no "Log in" flash).
- `useSession()` gives `status`, `profile`, `isAdmin`, `isSeller`, `isInRole()`, `refreshProfile()` and `logout()`.

### 8.3 Country, basket and Terms

- `useCountry()`: countries come from `GET /api/countries` (names, flags, currencies, where parcels can go), so a new
  country needs no website change.
- `useCart()`: the basket is kept in localStorage; checkout re-checks it with the API (today's prices, stock,
  cut-offs, fees) before placing orders.
- `useTermsPrompt().askToAccept()`: pages whose action the API refused with `Terms.NotAccepted` (checkout, adding a
  dish) open "We've updated our Terms" and try again once it's accepted. After sign-in the box also opens by itself,
  once per visit ("Not now" is remembered in sessionStorage).

### 8.4 Texts from the database

Terms, Privacy and Help come from the API (`GET /api/legal/{type}`), written in a small Markdown dialect rendered by
`components/ui/Markdown.tsx`. Headings carry anchors such as `{#orders}`, `{#parcels}`, `{#sellers}`, `{#contact}`,
which the website and the app link to (e.g. `/help#parcels`, `/terms#sellers`). Admins edit them on
**Admin → Terms & Help**, which warns when a linked anchor is missing.

---

## 9. Design system and styling

- **Colours come from the app**: `src/styles/tokens.css` uses the same values as the app's
  `Resources/Styles/Colors.xaml` (`--brand-dark #043d1f`, `--brand-green #046334`, `--brand-orange #e23902`,
  `--brand-gold #f4a51a`, `--brand-cream #f8f5ef`…). Use the tokens, never raw colours.
- **The website looks like a website**, not a copy of the app: wider layouts, a restaurant-style Home, a left-hand
  admin menu on big screens.
- **CSS Modules** per page/component (`Something.module.css`), plus a few global helpers in `global.css`
  (`.container`, `.card`, `.muted`, `.eyebrow`, `.visually-hidden`, `.skip-link`).
- Headlines use **DM Serif Display** (`--font-display`); everything else uses the system font stack.
- Every page must work from **390 px** wide (phones) without sideways scrolling.

---

## 10. Conventions

- **A component file exports only components** (React Fast Refresh). Hooks for contexts live with their provider and
  carry `// eslint-disable-next-line react-refresh/only-export-components`. Shared lists and labels go in
  `components/ui/labels.ts`.
- **Words people read** come from the API where they can (error messages, texts, contact details); otherwise they're
  short, plain and friendly. No invented reviews or claims.
- **One service file per API area**; admin calls all live in `adminService.ts`.
- **Don't set state inside effects** (the linter enforces it): derive values instead.
- Filters, tabs and pages live in the **address** (`?status=…&page=…`), so they can be shared and survive a refresh.
- Browser storage is wrapped in `try/catch` (private mode can refuse it).

---

## 11. Accessibility

- Semantic landmarks, a **skip link**, one `<h1>` per page, labelled form fields with errors linked by
  `aria-describedby`.
- Search predictions are an **ARIA combobox** (↑ ↓ to move, Enter to pick, first Esc closes the list, a second clears
  the text).
- "We've updated our Terms" is a native **`<dialog>`** (focus kept inside; Esc = Not now).
- Tabs use `role="tablist"`/`aria-selected`; status messages use `role="status"`.
- Colour is never the only signal; focus styles are visible.

---

## 12. Deployment (CI/CD)

`.github/workflows/phloem-web.yml` → **Website CI/CD**, on every push to `main` (pull requests build only; manual
runs allowed):

1. Node 22, `npm ci`.
2. `npm run lint`.
3. `npm run build` (with `API_BASE_URL` from the repository variables, if set); checks that `dist/index.html` and
   `dist/web.config` exist.
4. Upload `dist/` as an artifact.
5. Deploy `dist/` to **SmarterASP.NET** with MSDeploy.

**Secrets:** `WEBSITE_NAME`, `SERVER_COMPUTER_NAME`, `SERVER_USERNAME`, `SERVER_PASSWORD`.
**Variable (optional):** `API_BASE_URL`.

`index.html` is never cached, so a new deploy shows straight away; the hashed files in `/assets` are cached for a
year.

> When a website change depends on a new API endpoint, **deploy the API first**.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| `Failed to resolve import "@fontsource/dm-serif-display/…"` | run `npm install` (a new dependency was added) |
| Every call fails locally ("couldn't reach Phloem") | start the API (`https` profile) and trust the dev certificate |
| CORS error in the console | the API's `Cors:AllowedOrigins` must include your origin (`http://localhost:5173` in Development) |
| 404 when refreshing a page on the server | `web.config` didn't deploy (it comes from `public/`) |
| Signed out unexpectedly | the refresh token ran out (30 days) or was revoked by a password change |
| The Terms box keeps opening | accept the Terms, or "Not now" (remembered for the visit) |
| Build fails on lint in CI | run `npm run lint` locally and fix what it reports |

---

## 14. Roadmap

- **"Chat with us"** AI assistant (answers from Phloem's own data and Help text; hand-over to the team).
- **Google sign-in** (the API is ready; waiting for keys).
- A real **payment provider** instead of the temporary test payment.
- Moving the refresh token to an **http-only cookie**.

---

**Licence:** not specified yet. © Phloem.
