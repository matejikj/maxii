# LUMI family API

Optional family service for later sharing. The personal Baby Tracker build does **not** require this process, database, or OIDC.

## Local PostgreSQL

```bash
npm run family:compose:up
npm test --workspace @lumi/api
```

Compose publishes Postgres on `127.0.0.1:5433`. Keycloak is behind the `oidc` profile:

```bash
docker compose -f apps/lumi-api/deploy/docker-compose.yml --profile oidc up -d
```

## Configuration

See `deploy/.env.example`. Development secrets in Compose are not for shared hosts.
