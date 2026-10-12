# VIXORA Telegram and command security setup

This branch adds server-side Supabase session validation for website commands and an allowlisted Telegram webhook. Never commit API keys or bot tokens.

## Cloudflare Worker secrets

In Worker `black-limit-8938`, add these under Settings → Variables and Secrets → Production:

- `SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable key already used by the VIXORA website.
- `CREAO_API_KEY`: existing CREAO API Trigger key.
- `TELEGRAM_BOT_TOKEN`: token from BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: a random string using only A-Z, a-z, 0-9, underscore, and hyphen (at least 32 characters recommended).
- `TELEGRAM_ALLOWED_CHAT_IDS`: comma-separated Telegram numeric chat IDs allowed to control VIXORA. Keep this private and do not leave it blank.

The website command endpoint now requires a valid Supabase access token. Until `SUPABASE_PUBLISHABLE_KEY` is configured in the Worker, it intentionally returns a configuration error rather than accepting unauthenticated commands.

## Register the Telegram webhook

After deploying `worker.js` to the existing Worker, set the webhook from a trusted local terminal. Enter the token and secret locally; do not paste them into chat or commit them to Git.

PowerShell example:

```powershell
$token = Read-Host "Telegram bot token"
$secret = Read-Host "Telegram webhook secret"
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body @{
  url = "https://vixora.my.id/api/telegram/webhook"
  secret_token = $secret
  allowed_updates = '["message","edited_message"]'
}
```

Use the exact same secret in Worker variable `TELEGRAM_WEBHOOK_SECRET`. Add the allowed numeric Telegram chat ID to `TELEGRAM_ALLOWED_CHAT_IDS`. Do not leave a bot token in terminal logs or screenshots.

## Smoke tests

- `GET https://vixora.my.id/api/health` returns health and boolean configuration flags only.
- Website commands while logged out receive HTTP 401.
- Website commands while logged in validate the Supabase session before dispatch.
- Telegram messages from non-allowlisted chat IDs are ignored.
- Telegram messages from an allowlisted chat are dispatched to CREAO and receive a dispatch acknowledgement. The acknowledgement confirms submission, not completion.

## Current boundaries

The Telegram bridge submits commands to the existing CREAO executor. It does not grant arbitrary shell, browser, or account access. Add new tools as explicit, permission-checked integrations and require confirmation before external side effects.
