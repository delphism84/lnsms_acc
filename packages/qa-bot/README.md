# LNSMS QA Bot

BE/FE smoke tests + BE health watchdog for local development.

## Run

```bash
# One-shot (CI / pre-commit)
npm run qa:once

# Watch mode (30s interval + 10s health check)
npm run qa

# PM2 (recommended with dev stack)
pm2 start ecosystem.config.js --only lnsms-qa-bot
pm2 logs lnsms-qa-bot
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `QA_BE_URL` | `http://127.0.0.1:40000` | Backend base |
| `QA_FE_URL` | `http://127.0.0.1:63001` | Frontend base |
| `QA_INTERVAL_MS` | `30000` | Full smoke cycle interval |
| `QA_HEALTH_INTERVAL_MS` | `10000` | BE `/health` poll |
| `QA_ONCE` | — | `1` = run once and exit |
| `QA_AUTO_START_BE` | `0` | `1` = spawn BE if down |
| `QA_GUEST_USERID` | `necall` | Host auto-login userid |
| `QA_GUEST_STORE_ID` | `guest` | Host auto-login storeId |
| `QA_GUEST_PASSWORD` | `guest` | Host password |

## Smoke tests

**BE (8):** health, host login, **WS hello**, context, sync export, admin login, platform stores

**FE (4):** health proxy, `/s/necall/guest/setting`, `/login`, host login via FE proxy

## Watchdog

Every `QA_HEALTH_INTERVAL_MS`, checks `GET /health`. Logs `BE DOWN` when unreachable.
With `QA_AUTO_START_BE=1`, runs `npm run dev` in `packages/lnsms-be`.
