> ## ⚠️ UPDATE — 2026-10-22: These dashboards now live inside the app (this folder is ARCHIVAL)
>
> The Analytics and Coaching dashboards described below have been rebuilt
> as in-app surfaces and this standalone-HTML folder is now **archival
> reference only**:
>
> - **In-app Admin:** sign in as the app owner, then open the header
>   avatar menu → **Admin**. It has two tabs — **Analytics** (the old
>   `admin.html` content) and **Coaching** (the old
>   `admin-coaching.html` content). Visibility of the menu entry is
>   gated client-side by the `VITE_ADMIN_EMAILS` allowlist
>   (`src/lib/admin.ts`), and every call is **server-verified**: the
>   endpoints require a signed-in admin Supabase **bearer token**
>   (`Authorization: Bearer <token>`) and enforce the server-side
>   `ADMIN_EMAILS` allowlist.
> - **Guided Coaching Hub:** the subscriber-facing Coaching Hub is
>   in-app for Guided plan users (header menu / header icon / banner →
>   Coaching Hub), including a server-verified "Coach's Snapshot" from
>   `GET /api/my-coaching`.
> - **The `x-admin-key` flow used by the standalone HTML files below
>   has been retired.** The endpoints no longer accept a typed admin
>   key from these pages. (`GET /api/analytics` keeps an env-key
>   break-glass path server-side for emergencies; it is not used by
>   the app or by anything in this folder.)
>
> Everything below this notice is the original 2026-10-22 relocation
> note, kept for history. Do not follow its "how to use a dashboard
> now" instructions — use the in-app Admin instead.

---

# Life Pilot AI — Admin Tools (NOT deployed)

These two standalone dashboard pages were moved out of `public/` on 2026-10-22
so they are **no longer served on getlifepilot.app**. Keeping public admin
login pages on the production domain is unnecessary exposure — they are
reviewer/scanner bait and don't belong in the store-submission build.
They are kept here in the repo for reference and occasional manual use.

## What's here

- **`admin.html` — LifePilot Analytics dashboard.**
  Shows product-usage analytics collected by `api/analytics.js`: total/today/
  last-7-days event counts, estimated unique users (by anonymized IP),
  a 14-day activity chart, device and browser split, which tabs/features get
  used, the 50 most recent events, and recent app errors.
  You type an admin key into the page; the page sends it to
  `GET /api/analytics?key=…`. The API compares it **server-side** against the
  `ANALYTICS_ADMIN_KEY` environment variable in Vercel. (Note: the API file
  also contains a hardcoded fallback key used when that env var is unset —
  worth removing; until then, treat the env var as required in production.)
  Event data is in-memory on the serverless function (it resets on cold
  start); the same events are also written to Vercel function logs.

- **`admin-coaching.html` — Coaching Dashboard.**
  Built for the Guided plan ($129.99/mo tier, internal tier name
  `enterprise`): it lists every Guided client from the Supabase `user_data`
  table with name, last-active time, subscription, active goals with
  progress %, their tasks, linked habits/streaks, and totals (goals,
  tasks done/pending, journal entries, focus minutes) — so a coach can see
  how each client is doing before a coaching call.
  You type an admin key into the page; it is sent as an `x-admin-key`
  header to `GET /api/admin-coaching`, which compares it **server-side**
  against the `ADMIN_SECRET` environment variable in Vercel (no fallback).

## The API endpoints still exist — deliberately

`api/analytics.js` and `api/admin-coaching.js` remain deployed because the
app itself posts usage events to `/api/analytics`, and both GET endpoints
are gated server-side by their keys. Only the *pages* were undeployed.

## How to use a dashboard now (owner, occasional use)

The pages call the API with **absolute paths** (`/api/…`), so they only
work when served from the same origin as the API. Options:

1. **Temporarily re-deploy (simplest):** copy the HTML file back into
   `public/`, push, use it, then remove it again and push. It will be live
   at `https://getlifepilot.app/admin.html` (or `admin-coaching.html`)
   for exactly as long as it's in `public/` — treat that window as
   sensitive and remove it the same day.
2. **Run the project locally** with `vercel dev` (serves both the static
   pages — if copied locally into `public/` of your checkout — and the
   `/api` functions together), then open the page on localhost.

Do not commit the pages back into `public/` permanently.
