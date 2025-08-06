// src/api/utils/visit.js
import express from 'express';
const router = express.Router();

router.get('/:encoded', (req, res) => {
  const { encoded } = req.params;

  if (!encoded) {
    return res.status(400).send("Missing encoded affiliate URL");
  }

  try {
    // Decode base64 URL
    const originalUrl = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf-8');

    console.log(`[Redirect Page] ${originalUrl}`);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Redirecting...</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding-top: 100px;
              color: #333;
            }
            .button {
              background-color: #1a73e8;
              color: white;
              padding: 12px 24px;
              font-size: 16px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h2>Redirecting to the offer...</h2>
          <p>If you are not redirected automatically, click below:</p>
          <button class="button" id="go">Go to Offer</button>

          <script>
            document.getElementById("go").addEventListener("click", function () {
              window.location.href = "${originalUrl}";
            });

          
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Failed to decode redirect URL:", err.message);
    res.status(500).send("Invalid encoded URL.");
  }
});

export default router;
