# Personal trading portfolio

Next.js app with **Supabase** (Postgres + email/password auth). Record buys and sells; **Portfolio** shows open positions (BDT), optional **AmarStock** live LTP for symbols in the movers feed, and unrealized P/L when LTP is available.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A free [Supabase](https://supabase.com/) project

## Supabase setup

1. Create a project, then open **SQL Editor** and run the script in [`supabase/schema.sql`](supabase/schema.sql). That creates `transactions` (with `fees_bdt`), **capital contributions** (manual invested total), **long-term** symbol list, **immediate trade plans** (buy/sell + target price), and row-level security.
2. If you created the database **before** `fees_bdt` existed, run [`supabase/migrations/20260208120000_add_fees_bdt.sql`](supabase/migrations/20260208120000_add_fees_bdt.sql) once.
3. If you are upgrading an older project without the planning tables, run [`supabase/migrations/20260209120000_planning_tables.sql`](supabase/migrations/20260209120000_planning_tables.sql) once.
4. In **Project Settings → API**, copy the **Project URL** and **anon public** key.

### Commission (BDT)

On **Record**, broker commission is applied automatically on **both buys and sells**: **0.4%** of gross (quantity × price), rounded to two decimals—aligned with typical DSE notes (e.g. commission 8.20 on amount 2,050.50). The rate lives in [`src/lib/fees/trade-commission.ts`](src/lib/fees/trade-commission.ts). To override without editing code, set **`NEXT_PUBLIC_TRADE_COMMISSION_RATE`** in `.env.local` (decimal, e.g. `0.004` for 0.4%). Buy commission is folded into book cost in portfolio math; sell commission is stored on the row only.

### DSE market prices (Portfolio)

**Portfolio** loads **LTP**, **today’s high / low**, and **unrealized P/L** from DSE’s latest share price page ([`latest_share_price_scroll_l.php`](https://dsebd.org/latest_share_price_scroll_l.php)) via a small HTML parse. **52-week high / low** is read from each symbol’s DSE company page (`displayCompany.php`). Fetches use Next’s `revalidate` (**~60s** for the price table, **~1h** per company page). Optional env overrides: **`DSE_LSP_URL`** (full URL to the LSP page), **`DSE_COMPANY_URL_BASE`** (e.g. `https://dsebd.org/displayCompany.php` without query string).

### Portfolio email reports (manual + monthly)

The Portfolio page includes a **Send portfolio email** button. It sends:

- Total unrealized P/L
- Net Gain/Loss
- Total invested
- CSV sheet attachment of all open positions

Configure these env vars:

- `SMTP_HOST` (example: `smtp.gmail.com`)
- `SMTP_PORT` (`587` for TLS or `465` for SSL)
- `SMTP_USER`
- `SMTP_PASS` (for Gmail, use an app password)
- `SMTP_FROM`
- `PORTFOLIO_REPORT_RECIPIENT` (defaults to `hasebulhassan21@gmail.com`)
- `SUPABASE_SERVICE_ROLE_KEY` (needed for scheduled monthly report)
- `PORTFOLIO_REPORT_CRON_SECRET` (or `CRON_SECRET`) for cron endpoint auth

Monthly schedule is configured in `vercel.json` to call `/api/portfolio-report` on the 1st day of each month.

### Auth URLs (required for production)

In Supabase **Authentication → URL configuration**, set:

- **Site URL**: your deployed app URL (for local dev, `http://localhost:3000`).
- **Redirect URLs**: add the same URLs you use (e.g. `http://localhost:3000/**` and `https://your-app.vercel.app/**`).

For a solo project you may turn off **Confirm email** (see below).

### Email verification (can’t verify / no inbox)

Supabase decides whether a new user must click an email link before signing in.

1. **Turn off confirmation (simplest for local / personal use)**  
   Dashboard → **Authentication** → **Providers** → **Email** → disable **“Confirm email”** (wording may be “Enable email confirmations” — turn it **off**). Save. New sign-ups get a session immediately; use **Register** then you’re in (or sign in if the user already exists).

2. **Confirm an existing user in the dashboard**  
   **Authentication** → **Users** → select the user → use **Confirm user** / mark email confirmed (exact control depends on dashboard version). Then **Sign in** with email + password.

3. **Fix redirect / Site URL (if the link opens but fails)**  
   **Authentication** → **URL configuration**: set **Site URL** to where you use the app (e.g. `http://localhost:3000`). Under **Redirect URLs**, add `http://localhost:3000/**` and any deployed URL. Misconfigured URLs can break the verification link.

4. **Other sign-in methods (optional, more setup)**  
   In **Authentication** → **Providers**, enable **Google**, **GitHub**, etc., and add the client IDs/secrets they require. The app would need extra UI to use them; today it only has email + password.

5. **Magic link**  
   Still email-based; useful if you prefer link login over password, but it does not remove the need for a working inbox.

## Local development

Copy environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```bash
npm install
npm run dev
```

Or one step (install, create `.env.local` if missing, start dev):

```bash
make
```

Open [http://localhost:3000](http://localhost:3000). Register, then use **Record** for trades and **Portfolio** for the summary.

## Deploy (free tier)

The database and auth stay on **Supabase**. The Next.js app can be hosted on **Vercel** or **Netlify** (both have free tiers for personal projects).

1. Push this repository to GitHub.
2. In Vercel or Netlify: **New project → Import** the repo, framework **Next.js**, build `npm run build`, output default.
3. Add the same two variables in the host’s environment UI: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Redeploy after saving env vars.
5. Update Supabase **Site URL** and **Redirect URLs** to match your production domain.

No extra database is required on the host; all persistent data lives in Supabase Postgres.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Development server       |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | ESLint                   |
