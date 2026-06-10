# lnvoice

다자간 음성 통화 + 채팅 (Chrome, WebRTC Mesh)

## 포트 (53xxx)

| 서비스 | 포트 |
|--------|------|
| MongoDB | 53017 |
| Backend | 53001 |
| Frontend (Vite dev) | 53002 |

## 실행

```bash
# MongoDB
cd packages/lnvoice/deploy
cp .env.example .env   # 비밀번호 설정
docker compose up -d

# PM2 (FE/BE)
export MONGO_URI='mongodb://admin:YOUR_PASSWORD@127.0.0.1:53017/lnvoice?authSource=admin'
pm2 start packages/lnvoice/ecosystem.lnvoice.config.cjs
pm2 save
```

## URL

- https://voice.dair.co.kr
