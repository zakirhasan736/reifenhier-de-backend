// ecosystem.config.cjs
module.exports = {
    apps: [
        {
            name: "tyre-backend",
            script: "src/server.js",
            node_args: "--max-old-space-size=8192",
            instances: 1,
            autorestart: true,
            max_memory_restart: "10G",
        },
    ],
};
