module.exports = {
  apps: [
    {
      name: 'lnsms-be-dev',
      cwd: './packages/lnsms-be',
      script: 'npm',
      args: 'run dev',
      env: {
        PORT: 40000,
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lnsms',
        LOCAL_GUEST_PASSWORD: 'guest',
        UPLOAD_DIR: require('path').join(__dirname, 'data/uploads'),
      },
    },
    {
      name: 'lnsms-admin-fe-dev',
      cwd: './packages/lnsms-admin-fe',
      script: 'npm',
      args: 'run dev',
      env: {
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:40000',
        API_PROXY_TARGET: 'http://127.0.0.1:40000',
        NEXT_PUBLIC_LOCAL_USERID: 'necall',
        NEXT_PUBLIC_LOCAL_STORE_ID: 'guest',
        NEXT_PUBLIC_LOCAL_GUEST_PASSWORD: 'guest',
        NEXT_PUBLIC_REMOTE_API_URL: 'https://admin.necall.com',
      },
    },
    {
      name: 'lnsms-qa-bot',
      cwd: './packages/qa-bot',
      script: 'src/index.js',
      env: {
        QA_BE_URL: 'http://127.0.0.1:40000',
        QA_FE_URL: 'http://127.0.0.1:63001',
        QA_INTERVAL_MS: 30000,
        QA_HEALTH_INTERVAL_MS: 10000,
        QA_AUTO_START_BE: '0',
      },
    },
  ],
};
