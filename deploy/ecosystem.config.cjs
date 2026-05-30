/** PM2 — npm run dev (BE + FE) */
module.exports = {
  apps: [
    {
      name: 'lnsms-be-dev',
      cwd: '/var/lnsms/packages/lnsms-be',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: '40000',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/lnsms',
        UPLOAD_DIR: '/var/lnsms/packages/lnsms-be/uploads',
      },
    },
    {
      name: 'lnsms-admin-fe-dev',
      cwd: '/var/lnsms/packages/lnsms-admin-fe',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_URL: 'https://admin.necall.com',
        API_PROXY_TARGET: 'http://127.0.0.1:40000',
        LNSMS_SYNC_SERVER_URL: 'https://admin.necall.com',
        NEXT_PUBLIC_LNSMS_SYNC_SERVER_URL: 'https://admin.necall.com',
      },
    },
  ],
};
