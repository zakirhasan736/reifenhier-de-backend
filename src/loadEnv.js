import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load backend/.env even when PM2 cwd is not the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') })
