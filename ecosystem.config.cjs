const path = require("path");

const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: "openclaw-backend",
      cwd: path.join(rootDir, "src/backend"),
      script: "./node_modules/.bin/ts-node",
      args: "src/index.ts",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "openclaw-frontend",
      cwd: path.join(rootDir, "src/frontend"),
      script: "./node_modules/.bin/vite",
      args: "--host 127.0.0.1 --port 5173 --strictPort",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "pm-agent-dispatcher",
      cwd: rootDir,
      script: "node",
      args: `scripts/pm-agent-dispatcher.mjs --watch --interval 10 --pidfile ${path.join(rootDir, "tmp/pm-dispatcher.pid")}`,
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
