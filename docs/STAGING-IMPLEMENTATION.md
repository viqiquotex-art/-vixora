# VIXORA Workspace staging

This branch starts the SvelteKit + TypeScript rebuild in isolation. It intentionally does not replace the current GitHub Pages deployment or attach a route to the production domain.

## Current scope

- SvelteKit app shell and initial responsive workspace UI.
- Staging-only health endpoint at `/api/health`.
- Task composer creates browser-session drafts only; it does not claim to run an agent.
- Agent Hub is a blueprint/registry view, not a live multi-agent runtime.
- Supabase, CREAO, and n8n are marked pending until auth, persistence, and executor contracts are tested end to end.

## Local validation

```sh
npm install
npm run check
npm run build
npm run dev
```

## Deployment safety

- Worker name is `vixora-workspace-staging`.
- No production route is configured in `wrangler.toml`.
- Do not merge this branch into `main` until the staging build, auth, task persistence, API authorization, executor error handling, and acceptance tests pass.
- Keep all credentials in Cloudflare Worker secrets. Never place Supabase service-role keys or executor tokens in browser code.
