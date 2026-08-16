# Provider credential API — 23 July 2026

## Routes

The one canonical system is:

- `POST /providers/nvidia-nim/connect`
- `POST /providers/nvidia-nim/test`
- `POST /providers/nvidia-nim/refresh-models`
- `DELETE /providers/nvidia-nim`
- `POST /providers/openrouter/connect`
- `POST /providers/openrouter/test`
- `POST /providers/openrouter/refresh-models`
- `DELETE /providers/openrouter`

The legacy `nvidia` spelling is only an adapter into the same handler. The API client calls the canonical routes.

## Transaction and discovery

Connect authenticates the Aegis session, validates the body, tests the credential against the provider, discovers models, rejects an empty catalog, then writes credential/provider/model metadata in one Prisma transaction. Replacement does not touch the old credential until both upstream checks succeed. Disconnect removes discovered models and clears the credential/default model while preserving the provider card record.

The response contains connection ID, canonical provider ID, enabled/status flags, `secretConfigured`, model count, default model ID and latency. It never contains `apiKey`, encrypted data or a masked key.

## Encryption

`apps/api/src/provider-secrets.ts` centralizes `encryptProviderSecret`, `decryptProviderSecret` and `deleteProviderSecret`.

- AES-256-GCM.
- Random 96-bit nonce per write.
- Authentication tag.
- Versioned serialized envelope: `v2:nonce:tag:ciphertext`.
- `PROVIDERS_ENCRYPTION_KEY` is documented in `apps/api/.env.example` and required in production.
- Development can decrypt legacy `v1` rows and uses the existing session secret only as a compatibility fallback; production fails closed when the dedicated key is missing.
- Invalid keys are tested before persistence.

The current Prisma `Provider.apiKey` column stores the complete authenticated envelope. Separate database columns were not introduced because the version, nonce, tag and ciphertext are already individually encoded within that envelope and changing the schema was unnecessary for this correction.

## Error behavior

The API distinguishes authentication rejection, provider timeout/unavailability, no models, missing configuration and missing production encryption configuration. Cloud test routes refuse to execute without a stored secret.

## Test evidence

- Types build: passed.
- API client build: passed.
- Providers build: passed.
- API lint: passed.
- API build: passed.
- API tests: 18/18 passed in the full run.
- Credential encryption tests: 2/2 passed, including unique nonces and tag tampering.
- Canonical NVIDIA API test: 2 mocked models discovered; response contained no secret; database value began with `v2:` and did not contain the submitted secret.
- OpenRouter rejection test: response code `PROVIDER_AUTH_FAILED`; the default record retained `apiKey = null` and `active = false`.

No unit test contacts NVIDIA or OpenRouter. No live key existed in the environment, so external availability and live model counts are intentionally not asserted.
