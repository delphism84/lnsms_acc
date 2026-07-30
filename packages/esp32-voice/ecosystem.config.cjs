module.exports = {
  apps: [
    {
      name: "esp32-voice",
      cwd: "/var/lnsms/packages/esp32-voice",
      script: "server/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HTTP_PORT: "53110",
        PUBLIC_HOST: "voice.dualmodule.com",
        INGEST_VIDEO_PORT: "9101",
        INGEST_AUDIO_PORT: "9102",
        INGEST_PLAY_PORT: "9103",
        INGEST_CTRL_PORT: "9104",
      },
      max_restarts: 20,
      restart_delay: 2000,
    },
  ],
};
