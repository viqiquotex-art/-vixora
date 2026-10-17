# Alibaba Cloud Model Studio — Staging AI Agent

This setup connects the VIXORA staging Run AI Agent endpoint to Alibaba Cloud Model Studio using the OpenAI-compatible Chat Completions API.

## Selected model and region

- Provider: Alibaba Cloud Model Studio
- Region: Singapore
- Deployment scope: International
- Model: `qwen3.8-flash`
- Endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- Output: text/draft only; this endpoint does not launch CREAO, n8n, publish content, or perform external actions.

Alibaba documents a 1-million-token free quota for `qwen3.8-flash` in Singapore / International. New-user free quota is time-limited (90 days from the applicable activation/release/approval date); eligibility and remaining quota must be checked in the Model Studio console. Official references:
- [Free quota for new users](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)
- [OpenAI-compatible Chat API](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)
- [Model pricing and quotas](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

## Mandatory cost guard before the first API call

Alibaba Cloud's `Free Quota Only` protection is disabled by default; without it, calls can switch to pay-as-you-go after free quota is exhausted/expired. Do not enable the VIXORA API key until this is set:

1. Open Alibaba Cloud Model Studio in the **Singapore** region.
2. Open the model usage/usage page, then the **Free Quota** tab.
3. Find `qwen3.8-flash`, confirm there is remaining free quota, and enable **Free Quota Only** for that model.
4. Wait for the setting to take effect before testing. If the free quota is exhausted/expired or the switch is unavailable, do not call the model.
5. Never share the API key in chat, a screenshot, browser code, or a repository file.

## Configure only the staging Cloudflare Worker

In Cloudflare Dashboard → Workers & Pages → `vixora-workspace-staging` → Settings → Variables and Secrets, add:

| Name | Kind | Value |
|---|---|---|
| `DASHSCOPE_API_KEY` | Secret | General-purpose Model Studio API key for Singapore |
| `DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED` | Text variable | `true` — only after the model's Free Quota Only switch is enabled in Alibaba |

Then deploy/redeploy the staging Worker.

The code is deliberately fail-closed: if the API key is missing or the confirmation variable is not exactly `true`, Run AI returns a clear setup message without calling Alibaba. It uses only `qwen3.8-flash`, has no provider fallback, caps output at 1,200 tokens, and times out after 25 seconds. It never puts the API key in the client.

## Test plan

1. Sign in to [VIXORA staging](https://vixora-workspace-staging.viqiquotex.workers.dev).
2. Open Task Center and choose a saved task.
3. Click **Run AI Agent** once.
4. Confirm the result shows model `qwen3.8-flash`, an answer, timestamp and token usage where returned.
5. If the free quota is blocked/exhausted, verify a safe error is shown and that no fallback provider is used.

## Isolation

Keep all work on branch `redesign/sveltekit-staging` and Worker `vixora-workspace-staging`. Do not merge to `main`, change the production domain, or use production secrets during this test.
