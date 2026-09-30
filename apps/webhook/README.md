# @dollarkoers/webhook

Legacy Cloudflare Worker: receives content-change webhooks from Payload and dispatches `tenant-deploy.yml`.

**Production no longer uses this by default.** Editors publish via **Publish content** in the Payload admin (manual deploy). Saves do not trigger CI.

## When you still need this worker

- You explicitly re-enable `afterChangeNotify` hooks on content collections **and** set `webhookEnabled` on a tenant row.
- You want auto-deploy on every save for a specific integration (not recommended for editorial workflows).

## Flow (legacy)

```
Payload afterChange/afterDelete  (only if hooks are wired)
    -> POST https://webhook.example.com/  { tenantSlug, collection, id, operation }
        -> GitHub workflow_dispatch  { tenant_slug: ... }
            -> tenant-deploy.yml  (sync + build + deploy)
```

## Setup

```sh
cd apps/webhook
pnpm wrangler secret put WEBHOOK_TOKEN
pnpm wrangler secret put GITHUB_TOKEN
pnpm wrangler secret put GITHUB_OWNER
pnpm wrangler secret put GITHUB_REPO
pnpm deploy
```

Point Payload `WEBHOOK_URL` at the deployed Worker URL only if you use auto-deploy.

## Preferred workflow (manual publish)

1. Editors save blog posts, pages, etc. (CMS only — no CI).
2. When ready, click **Publish content to live site** (banner on content screens or tenant page).
3. One GitHub Actions run syncs all tenant content and deploys.
