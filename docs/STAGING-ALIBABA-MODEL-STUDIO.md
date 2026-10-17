# Google AI Studio Gemini API — VIXORA Staging

This replaces the abandoned Alibaba Cloud setup. VIXORA's staging **Run AI Agent** endpoint uses the Gemini Developer API via Google AI Studio.

## Selected model

- Model: `gemini-3.8-flash`
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`
- Provider: Google Gemini Developer API
- Output: Indonesian answer/draft only. No browsing, no CREAO/n8n workflow execution, and no external side effects.
- No provider fallback.

Official references:
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API key guide](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini API pricing and Free Tier details](https://ai.google.dev/gemini-api/docs/pricing)

## Important: keep this Free Tier only

Google's pricing documentation lists free input/output pricing for eligible Gemini models, including `gemini-3.8-flash`, while the Free Tier has limited access and rate quotas. It also notes that content on the Free Tier may be used to improve Google's products.

To avoid accidental charges, create or select a Google AI Studio project that remains on the **Free Tier** and is **not linked/upgraded to paid billing**. Do not attach a payment method or switch to paid tier for this experiment. The VIXORA flag described below is an operator confirmation, not an independent billing check.

If your key's project is already linked to billing or you cannot confirm it remains free, do not configure the key until verified in Google AI Studio / Google Cloud billing settings.

## Configure only the staging Cloudflare Worker

1. Open [Google AI Studio](https://aistudio.google.com/), sign in, choose **Get API key**, and create a key for a Free Tier project.
2. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → `vixora-workspace-staging` → **Settings** → **Variables and Secrets**.
3. Add:

| Name | Type | Value |
|---|---|---|
| `GEMINI_API_KEY` | **Secret** | API key from the Free Tier Google AI Studio project |
| `GEMINI_FREE_TIER_ONLY_CONFIRMED` | Text variable | `true`, only after verifying the project remains Free Tier with no paid billing |

4. Save and redeploy the staging Worker.

The route fails closed if either binding is missing. It uses the fixed model `gemini-3.8-flash`, caps output at 1,200 tokens, times out after 25 seconds, hides provider error bodies, and never falls back to another provider. The flag is not a substitute for checking Google billing: do not use it to override an account/project that's already upgraded to paid billing.

## Test

1. Sign in to [VIXORA staging](https://vixora-workspace-staging.viqiquotex.workers.dev).
2. Open **Task Center** and choose a saved task.
3. Click **Run AI Agent** once.
4. A successful response should show `gemini-3.8-flash`, an answer, timestamp and token usage where returned.
5. A quota error stops that run; no alternative model is called.

## Isolation

All code changes belong to `redesign/sveltekit-staging` and deploy to `vixora-workspace-staging`. Do not merge to `main`, change the production domain, or use production secrets during this test.
