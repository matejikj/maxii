# LUMI family API

Optional family service for later sharing. The personal Baby Tracker build does **not** require this process, database, or OIDC.

This stack is **not** end-to-end encrypted: the API processes domain changes. TLS (Caddy) and optional disk encryption protect transport/at-rest boundaries only.

## Local PostgreSQL

```bash
npm run family:compose:up
npm test --workspace @lumi/api
```

Compose publishes Postgres on `127.0.0.1:5433` for local proofs. Fresh volumes apply identity and worker migrations from `migrations/` via initdb. On an existing volume, apply `002_worker_jobs.sql` manually once.

## Auth

Keycloak realm import lives in `deploy/keycloak/realm-lumi.json`:

```bash
docker compose -f apps/lumi-api/deploy/docker-compose.yml --profile oidc up -d
```

Auth endpoints: `GET /v1/auth/mode`, `POST /v1/auth/login/start`, `POST /v1/auth/login/callback`, `POST /v1/auth/logout`, `GET /v1/auth/session`.

Family membership: `POST /v1/families`, `GET /v1/families/:id/members`, invitations (`POST .../invitations`, preview/accept), admin-only revoke/transfer/erasure, and `POST /v1/me/identities/link` for a second verified issuer on the same internal account. Invitation secrets are hashed; plaintext is returned once.

## Single-VPS overlay

```bash
cd apps/lumi-api/deploy
./provision.sh
docker compose -f docker-compose.yml -f docker-compose.vps.yml --profile api --profile worker --profile edge config
```

- Caddy terminates TLS; API is not published on the host.
- Postgres ports are reset in the VPS overlay (not publicly reachable).
- `worker-a` and `worker-b` share durable leases in PostgreSQL.
- Ownership and handoff for backup/observability/release gates: `deploy/operations-owners.json`.

## Configuration

See `deploy/.env.example`. Development secrets in Compose are not for shared hosts.
