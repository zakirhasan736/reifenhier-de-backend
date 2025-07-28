// ecosystem.config.cjs
module.exports = {
    apps: [
        {
            name: "tyre-backend",
            script: "src/server.js",
            node_args: "--max-old-space-size=8192", // Allow 8GB heap for large operations
            instances: 1,                           // Single instance (can scale later)
            autorestart: true,
            max_memory_restart: "10G",              // If memory exceeds 10GB, auto-restart
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "awin-cron",
            script: "src/start-cron.mjs",
            interpreter: "node",
            node_args: "--max-old-space-size=8192", // Same for cron job
            instances: 1,
            autorestart: true,
            max_memory_restart: "10G",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
