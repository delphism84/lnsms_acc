# Subpath architecture (Platform / Store)

## URLs

| Area | Path |
|------|------|
| Platform UI | `/platform` |
| Store site UI | `/s/{agentId}/{storeId}/*` |
| Platform API | `/api/platform/*` |
| Store API | `/api/s/{agentId}/{storeId}/*` |

## Monorepo (target in [lnsms_acc](https://github.com/delphism84/lnsms_acc))

```
packages/lnsms-be/
packages/lnsms-admin-fe/
packages/agent-host/     # CareReceiverAgent.Host (from lunar-agent-acc-web)
packages/agent-fe/
legacy/
deploy/
scripts/
docs/
```

## Local store mode

```env
# packages/lnsms-be/.env
MONGODB_URI=memory
PORT=40000

# packages/lnsms-admin-fe/.env.local
NEXT_PUBLIC_API_URL=http://localhost:40000
```

Apply scaffold: run `scripts/apply-to-lunar-sms.ps1` from Documents scaffold (requires write ACL on lunar-sms).
