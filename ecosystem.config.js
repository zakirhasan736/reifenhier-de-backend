module.exports = {
    apps: [
        {
            name: "server",
            script: "src/server.js", // or your entry point
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
        }
    ]
};
