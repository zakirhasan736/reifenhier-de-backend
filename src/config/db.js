// config/db.js
import mongoose from 'mongoose';

export const isMongoReady = () => mongoose.connection.readyState === 1

export const connectDB = async () => {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        console.error('❌ MONGODB_URI is missing — API will start but DB routes will fail')
        return false
    }

    for (let attempt = 1; attempt <= 8; attempt++) {
        try {
            await mongoose.connect(uri)
            console.log('✅ MongoDB connected')
            return true
        } catch (err) {
            console.error(
                `❌ MongoDB connection error (attempt ${attempt}/8):`,
                err.message
            )
            await new Promise((resolve) =>
                setTimeout(resolve, Math.min(attempt * 2000, 15000))
            )
        }
    }

    console.error('❌ MongoDB still unavailable — keeping HTTP server up for /health')
    return false
}
