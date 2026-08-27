module.exports = {
    apps: [
        {
            name: "reifexa-api",
            cwd: __dirname,
            script: "src/server.js",
            interpreter: "node",
            exec_mode: "fork",
            node_args: "--max-old-space-size=1536",
            instances: 1,
            autorestart: true,
            max_memory_restart: "1200M",
            merge_logs: true,
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "awin-cron",
            cwd: __dirname,
            script: "src/start-cron.mjs",
            interpreter: "node",
            exec_mode: "fork",
            node_args: "--max-old-space-size=2048",
            instances: 1,
            autorestart: true,
            max_memory_restart: "1800M",
            merge_logs: true,
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
