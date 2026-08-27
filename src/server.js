// Must load env before importing app (ESM import order)
import './loadEnv.js'
import app from './app.js'
import { connectDB } from './config/db.js'

const PORT = Number(process.env.PORT) || 8004
const HOST = process.env.HOST || '127.0.0.1'

connectDB().catch((err) => {
  console.error('❌ MongoDB bootstrap failed:', err?.message || err)
})

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
})

server.on('error', (err) => {
  console.error(`❌ Failed to bind ${HOST}:${PORT}:`, err.message)
  process.exit(1)
})
