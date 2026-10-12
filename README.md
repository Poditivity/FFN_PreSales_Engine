# FFN Presales Engine

Internal platform for Founders First Network (FFN): public application forms, a lead pipeline, personal "proof hub" pages for applicants, a content database, messaging templates and automatic alerts. Built by Build Theory by Poditivity for FFN.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Edge Functions, pg_cron) · Cloudflare R2 · ZeptoMail.

## Where to start

| You are… | Read |
|---|---|
| Changing UI | `.claude/skills/ffn-design-system/` and `CLAUDE.md` |
| Setting up alerts and uploads | [`docs/alerts-uploads-setup.md`](docs/alerts-uploads-setup.md) |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
npm test                     # unit tests (vitest)
npx tsc --noEmit && npm run lint
```

Secrets for Edge Functions (mail, R2, Google Chat, WhatsApp) are **Supabase function secrets**, not `.env.local`. See `.env.example` for the names and `docs/alerts-uploads-setup.md` for the setup steps.

> This repository uses a Next.js version with breaking changes (for example `src/proxy.ts` instead of `middleware.ts`). Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).
