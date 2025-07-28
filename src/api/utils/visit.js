// src/api/utils/visit.js
import express from 'express';
const router = express.Router();

router.get('/:encoded', (req, res) => {
  const { encoded } = req.params;

  if (!encoded) return res.status(400).send("Missing encoded affiliate URL");

  try {
    const originalUrl = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf-8');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Redirecting...</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding-top: 50px; }
            .button {
              background-color: #1a73e8;
              color: white;
              padding: 12px 24px;
              font-size: 16px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <h2>Redirecting to the offer...</h2>
          <p>If not redirected automatically, click the button below:</p>
          <button class="button" id="go">Go to Offer</button>

          <script>
            document.getElementById("go").addEventListener("click", function () {
              window.location.href = "${originalUrl}";
            });
            setTimeout(() => {
              document.getElementById("go").click();
            }, 200);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Redirect decode failed:", err.message);
    res.status(500).send("Failed to decode redirect URL");
  }
});

export default router;
