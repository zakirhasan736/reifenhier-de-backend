// Must load env before importing app (ESM import order)
import './loadEnv.js'
import app from './app.js'

const PORT = Number(process.env.PORT) || 8004

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`)
})
