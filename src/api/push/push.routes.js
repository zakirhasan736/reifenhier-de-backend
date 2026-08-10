import express from 'express'
import {
  getPublicKey,
  subscribe,
  unsubscribe,
  trackInterest,
  status,
  testPush,
} from './push.controller.js'

const router = express.Router()
const beaconJson = express.json({ type: ['application/json', 'text/plain'] })

router.get('/vapid-public-key', getPublicKey)
router.get('/status', status)
router.post('/subscribe', beaconJson, subscribe)
router.post('/unsubscribe', beaconJson, unsubscribe)
router.post('/interest', beaconJson, trackInterest)
router.post('/test', beaconJson, testPush)

export default router
