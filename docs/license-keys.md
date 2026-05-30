# License Keys

Dev-work gates Pro/Team features with license keys validated entirely offline —
no activation server required.

## Key formats

Two formats are accepted:

| Format | Shape | Validation | Status |
|--------|-------|------------|--------|
| **Signed** (recommended) | `DEVWORK.<payload>.<signature>` | Ed25519 signature verified against an embedded public key | Cannot be forged or altered |
| **Legacy** | `DEVWORK-TIER-YEAR-SERIAL-CHECKSUM` | SHA-256 checksum | Forgeable; kept for backward compatibility |

Both formats are accepted during activation, so existing legacy keys keep
working. New keys should be issued in the signed format.

### Signed key anatomy

A signed key has three `.`-separated segments:

1. `DEVWORK` — fixed prefix (distinguishes from the legacy `DEVWORK-…` format).
2. base64url of the UTF-8 JSON payload:
   ```json
   { "v": 1, "tier": "pro", "expiryYear": 2027, "serial": "3C31F34F432D", "email": "buyer@acme.com" }
   ```
   `email` is optional. When present, activation requires the entered email to
   match (case-insensitive).
3. base64url of the Ed25519 signature over the exact payload bytes.

The app verifies the signature with the **public key** embedded in
`app/src/main/services/license.ts` (`DEFAULT_LICENSE_PUBLIC_KEY`). Because only
the signature is checked — not a reversible checksum — a key cannot be modified
(e.g. to upgrade the tier or extend the year) without the private key.

## Issuing keys

The private key is held only by the issuer and must **never** be committed or
shipped. Use the keygen script:

```bash
# 1. Generate a keypair once. Embed the public key in license.ts; store the
#    private key in a secret manager.
node scripts/license-keygen.mjs genkey

# 2. Sign keys (private key via --key <file> or DEVWORK_LICENSE_PRIVATE_KEY env)
node scripts/license-keygen.mjs sign --tier pro  --year 2027
node scripts/license-keygen.mjs sign --tier team --year 2027 --email buyer@acme.com --key ./private.pem

# 3. Verify a key against a public key
node scripts/license-keygen.mjs verify "DEVWORK.<payload>.<sig>" --pub ./public.pem
```

When using a checkout provider (Lemon Squeezy / Paddle / Gumroad), wire this
signing step into the provider's "generate license" webhook/automation so each
purchase yields a signed key emailed to the buyer.

## Rotating the keypair

1. Generate a new keypair with `genkey`.
2. Update `DEFAULT_LICENSE_PUBLIC_KEY` and ship a new app version.
3. Re-issue keys with the new private key. Keys signed by the old private key
   stop verifying once the old public key is removed, so plan a migration window
   (e.g. ship both public keys temporarily if needed).

## Security notes

- The private key never ships in the app — only the public key does.
- Signing prevents **forgery and tampering**. It does not by itself prevent a
  buyer from *sharing* their key. For anti-sharing, bind the key to an email
  (the `email` payload field) and/or add an optional online activation check.
