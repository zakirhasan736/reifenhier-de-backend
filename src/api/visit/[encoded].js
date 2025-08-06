
export default function handler(req, res) {
    const { encoded } = req.query

    if (!encoded || typeof encoded !== 'string') {
        return res.status(400).send("Missing or invalid encoded URL")
    }

    try {
        const decodedUrl = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf-8')

        console.log(`[Redirect] → ${decodedUrl}`)

        // Permanent or temporary redirect
        res.writeHead(302, { Location: decodedUrl })
        res.end()
    } catch (err) {
        res.status(500).send("Failed to decode URL")
    }
}