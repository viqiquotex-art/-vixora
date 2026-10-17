# Alibaba Cloud Model Studio — VIXORA Staging AI Agent

This connects the VIXORA staging **Run AI Agent** endpoint to Alibaba Cloud Model Studio, using the OpenAI-compatible Chat Completions API.

## Model and region

- Model: `qwen3.8-flash`
- Region: **Singapore** (`ap-southeast-1`)
- Deployment scope: **International**
- API: OpenAI-compatible `/compatible-mode/v1/chat/completions`
- Endpoint: workspace-specific, `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`
- Output: answer/draft only. It does not publish content or execute CREAO/n8n workflows.

Official references:
- [Create an API key](https://www.alibabacloud.com/help/en/model-studio/get-api-key)
- [Singapore endpoints and API Host](https://www.alibabacloud.com/help/en/model-studio/regions)
- [OpenAI-compatible Chat API](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope)
- [Free quota rules](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)
- [Model pricing and quotas](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

Alibaba's documentation lists a 1-million-token free quota for `qwen3.8-flash` in Singapore / International for eligible users. Free quota eligibility, expiration and remaining balance vary by account. Free quota is time-limited. After free quota is depleted, billing can automatically switch to pay-as-you-go unless **Free Quota Only** is enabled. Verify actual quota and switch status in your own console before making an inference request.

## 1. In Alibaba Cloud Model Studio (use desktop)

1. Open the [Model Studio console](https://modelstudio.console.alibabacloud.com/) on your desktop.
2. Select **Singapore** at the top-right / region selector.
3. Open **Free Quota** (or Model Usage → Free Quota). Find `qwen3.8-flash`, confirm it has quota remaining and enable **Free Quota Only** for that model.
4. Wait for the setting to take effect before making calls. If the quota is empty/expired or Free Quota Only is unavailable, stop here and do not test the API.
5. Open **Workspace Management** and choose the workspace you will use (the default workspace is fine). Copy its **Workspace ID** / API Host details.
6. Open **API Key**, ensure the region is still **Singapore**, and create a key in that same workspace. Give it a descriptive label such as `VIXORA staging`.
7. Copy the full API key immediately to a safe place. Alibaba shows plaintext only once for new keys; do not share it in chat, screenshots or the repository.

The API key and workspace endpoint must belong to the same region/workspace. A mismatched region is rejected by the provider. Do not use a China-region API key with the Singapore endpoint.

## 2. Configure only the staging Cloudflare Worker

Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → `vixora-workspace-staging` → **Settings** → **Variables and Secrets**. Add these bindings:

| Name | Type | Value |
|---|---|---|
| `DASHSCOPE_API_KEY` | **Secret** | The key created for the Singapore workspace |
| `MODELSTUDIO_WORKSPACE_ID` | Text variable | Workspace ID from that same Singapore workspace |
| `DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED` | Text variable | `true`, only after Free Quota Only is visibly enabled for `qwen3.8-flash` |

Save and click **Deploy** / redeploy the staging Worker so the bindings become active.

The code intentionally fails closed: if the key, workspace ID, or quota-confirmation variable is absent, the Run AI endpoint will not invoke Alibaba. The confirmation variable is an operator confirmation—not an automatic check of Alibaba's console—so only set it after you have actually enabled Free Quota Only. The code uses no provider fallback, limits output to 1,200 tokens and times out after 25 seconds. Keep all work on staging; do not touch the production site or production secrets.

## 3. Test

1. Open [VIXORA staging](https://vixora-workspace-staging.viqiquotex.workers.dev) and sign in.
2. Open **Task Center** and choose a saved task.
3. Press **Run AI Agent** once.
4. A successful run should show a `qwen3.8-flash` response and token usage where returned.
5. If quota is exhausted while Free Quota Only is active, Alibaba should refuse inference rather than switch to paid usage. VIXORA displays an error and will not fall back to another provider.

## Isolation

The integration is on branch `redesign/sveltekit-staging` and deployed to Worker `vixora-workspace-staging`. Do not merge to `main` or route the production domain until the owner has validated staging.
