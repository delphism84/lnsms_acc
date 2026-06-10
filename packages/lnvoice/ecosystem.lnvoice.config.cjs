/**
 * PM2: voice.dair.co.kr — lnvoice FE/BE.
 * Mongo: lnvoice @ 127.0.0.1:53017 (lnvoice-mongodb)
 *
 * start: pm2 start packages/lnvoice/ecosystem.lnvoice.config.cjs
 * save:  pm2 save
 */
const path = require("path");

const pkgRoot = __dirname;

module.exports = {
  apps: [
    {
      name: "lnvoice-be",
      cwd: path.join(pkgRoot, "server"),
      script: "npm",
      args: "run start",
      interpreter: "none",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "53001",
        MONGO_URI: process.env.MONGO_URI || "",
        CORS_ORIGIN:
          process.env.CORS_ORIGIN ||
          "https://voice.dair.co.kr,http://voice.dair.co.kr,http://localhost:53002,http://127.0.0.1:53002",
      },
    },
    {
      name: "lnvoice-fe",
      cwd: path.join(pkgRoot, "client"),
      script: "npm",
      args: "run dev",
      interpreter: "none",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
