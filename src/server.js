// src/server.js
import app from './app.js';

const PORT = process.env.PORT || 6000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
