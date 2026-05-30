# License Signing Webhook (self-hosted key issuance)

This is the **option-2** key issuance path: keep using a checkout provider
(Lemon Squeezy by default) for payments, but mint your own
**cryptographically signed** license keys on purchase. The Ed25519 private key
lives only in this webhook's secret store — never in the app or the repo.

```
buyer pays ──▶ Lemon Squeezy ──webhook──▶ this service ──▶ signs key ──▶ email to buyer
                                              │
                                   private key (secret store)
```

Issued keys use the **exact same format the desktop app verifies**
(`DEVWORK.<payload>.<signature>`), guaranteed by reusing the app's
`signLicenseKey` signer. See [license-keys.md](./license-keys.md) for the key
format and the offline verification the app performs.

## Why this design

- **No third-party holds your signing key.** It only exists in this function's
  environment.
- **Offline verification.** The app validates keys with the embedded public key;
  no runtime call to this service is needed after issuance.
- **Provider-agnostic core.** The handler is plain functions over a raw body +
  signature header, so it runs on Node http, Vercel, AWS Lambda, or Cloudflare
  Workers (with `nodejs_compat`).

> ⚠️ Offline signed keys cannot be **revoked** — a key is valid until its expiry
> year. If you need revocation or per-seat activation, add an online activation
> check or use a managed issuer (e.g. Keygen).

## Source

| File | Purpose |
| --- | --- |
| `app/src/main/server/licenseWebhook.ts` | HMAC verify, tier mapping, expiry, key minting |
| `app/src/main/server/licenseWebhookHandler.ts` | End-to-end request handler (verify → mint → deliver) |
| `app/src/main/server/email.ts` | Optional Resend email delivery |
| `app/src/main/server/config.ts` | Loads config from environment variables |
| `app/src/main/server/server.ts` | Standalone Node HTTP server + entrypoint |
| `app/tests/main/licenseWebhook.test.ts` | Unit + HTTP integration tests |

## Configuration (environment variables)

**Required**

| Var | Description |
| --- | --- |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | The signing secret you set when creating the LS webhook. |
| `DEVWORK_LICENSE_PRIVATE_KEY` | Ed25519 **private** key (PKCS#8 PEM). `\n` escapes are supported so it can be a single-line secret. |
| `DEVWORK_LICENSE_PRIVATE_KEY_FILE` | Alternative to the above: path to the PEM file. |
| `LICENSE_TIER_MAPPING` | JSON mapping product/variant ids → tier. At least one id required. |

`LICENSE_TIER_MAPPING` shape (any subset):

```json
{ "proVariantIds": [101], "teamVariantIds": [202], "proProductIds": [], "teamProductIds": [9] }
```

Team takes precedence if an id is (mis)configured under both tiers.

**Optional**

| Var | Default | Description |
| --- | --- | --- |
| `LICENSE_DURATION_YEARS` | `1` | Key is valid through Dec 31 of `currentYear + duration`. |
| `LICENSE_BIND_EMAIL` | `true` | Bind the key to the buyer's email (`false` to disable). |
| `LICENSE_ACCEPTED_EVENTS` | `order_created` | Comma-separated provider event names that mint a key. |
| `RESEND_API_KEY` + `LICENSE_EMAIL_FROM` | — | Enable email delivery via [Resend](https://resend.com). If unset, the key is returned in the HTTP response instead. |
| `LICENSE_EMAIL_SUBJECT`, `LICENSE_PRODUCT_NAME` | — | Customize the delivery email. |
| `PORT` | `8787` | Port for the standalone server. |

## Generating the keypair

Generate a **fresh** keypair in a secure environment (do not reuse any key that
has been pasted into a chat/log):

```bash
node app/scripts/license-keygen.mjs genkey
```

- Put the **private** key in this webhook's secret store (`DEVWORK_LICENSE_PRIVATE_KEY`).
- Embed the **public** key in the app at `DEFAULT_LICENSE_PUBLIC_KEY`
  (`app/src/main/services/license.ts`) and ship a new build.

## Routes

- `GET /health` → `{ "ok": true }`
- `POST /webhooks/lemonsqueezy` → verifies the `X-Signature` HMAC, mints a key

Responses:

| Status | Meaning |
| --- | --- |
| `200 {issued:true, delivered:true}` | Key minted and emailed. |
| `200 {issued:true, delivered:false, key}` | Key minted, returned in body (no email configured). |
| `200 {ignored:true}` | Event not in the accepted list. |
| `401` | Bad/missing signature. |
| `400` | Malformed body. |
| `422` | Purchase didn't map to a sellable tier, or no buyer email. |
| `502` | Email delivery failed. |

## Run locally

Bundle the entry once (esbuild ships with the app's toolchain), then run it with
plain Node:

```bash
cd app
npx esbuild src/main/server/server.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist-webhook/server.mjs

DEVWORK_LICENSE_PRIVATE_KEY_FILE=./private.pem \
LEMON_SQUEEZY_WEBHOOK_SECRET=whsec_dev \
LICENSE_TIER_MAPPING='{"proVariantIds":[101],"teamVariantIds":[202]}' \
PORT=8799 \
node dist-webhook/server.mjs
```

Test it with a correctly signed request:

```bash
BODY='{"meta":{"event_name":"order_created"},"data":{"attributes":{"user_email":"buyer@acme.com","first_order_item":{"variant_id":202}}}}'
SIG=$(node -e "const c=require('node:crypto');process.stdout.write(c.createHmac('sha256','whsec_dev').update(process.argv[1]).digest('hex'))" "$BODY")
curl -s -X POST http://127.0.0.1:8799/webhooks/lemonsqueezy \
  -H 'Content-Type: application/json' -H "X-Signature: $SIG" -d "$BODY"
```

## Deploy

Bundle the entry into a single file (no Electron, ~10 KB):

```bash
cd app
npx esbuild src/main/server/server.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist-webhook/server.mjs
```

Then run `node dist-webhook/server.mjs` on any Node host (Fly.io, Railway,
Render, a VM) with the env vars set as secrets. For Vercel/Lambda, import
`handleLemonSqueezyWebhook` (or `createWebhookServer`) from the bundle in a
function handler. For Cloudflare Workers, enable the `nodejs_compat` flag (the
code uses `node:crypto`).

### Lemon Squeezy setup

1. **Settings → Webhooks → +**. URL = `https://<your-host>/webhooks/lemonsqueezy`,
   signing secret = your `LEMON_SQUEEZY_WEBHOOK_SECRET`, events = `order_created`.
2. Find your product/variant ids (Products → variant → the URL/ID) and put them
   in `LICENSE_TIER_MAPPING`.
3. Test from the LS dashboard ("Send test") and confirm a `200 {issued:true}`.

## Security checklist

- Private key only in the secret store; never committed, logged, or shipped.
- Webhook signature verified (constant-time) before doing any work.
- Key is only returned in the HTTP body when **no** email sender is configured.
- Rotate by generating a new keypair, shipping the new public key, and updating
  the webhook secret. See [license-keys.md](./license-keys.md#key-rotation).
