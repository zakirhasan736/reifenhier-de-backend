import NewsletterSubscriber from "../../models/NewsletterSubscriber.js";
import sgMail from "@sendgrid/mail";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

import { generateUnsubscribeToken, verifyUnsubscribeToken } from "../utils/newsletterToken.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * @desc Subscribe to newsletter
 * @route POST /api/newsletter/subscribe
 */
export const subscribeNewsletter = async (req, res) => {
    try {
        const { email, source } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Ungültige E-Mail-Adresse.",
            });
        }

        const frontendUrl = process.env.FRONTEND_URL || "https://reifencheck.de";
        const token = generateUnsubscribeToken(email);

        const existing = await NewsletterSubscriber.findOne({ email });

        // CASE 1️⃣: Already subscribed
        if (existing && existing.status === "subscribed") {
            return res.status(200).json({
                success: true,
                message: "Sie sind bereits für den Newsletter angemeldet!",
            });
        }

        // CASE 2️⃣: Previously unsubscribed
        if (existing && existing.status === "unsubscribed") {
            existing.status = "subscribed";
            existing.reSubscribedAt = new Date();
            existing.source = source || existing.source;
            existing.ip = req.ip;
            await existing.save();
        }

        // CASE 3️⃣: New user
        if (!existing) {
            await NewsletterSubscriber.create({
                email,
                status: "subscribed",
                source: source || "footer_form",
                ip: req.ip,
                subscribedAt: new Date(),
            });
        }

        // Send confirmation email
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM,
            subject: "Newsletter Anmeldung bestätigt!",
            html: `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2>Vielen Dank für Ihre Anmeldung!</h2>
          <p>Sie haben sich erfolgreich für unseren Newsletter angemeldet.</p>
          <p>Wir freuen uns, Ihnen regelmäßig Neuigkeiten und exklusive Angebote zukommen zu lassen.</p>
          <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;" />
          <p style="font-size:13px;color:#777;">
            Wenn Sie keine weiteren E-Mails erhalten möchten,
            können Sie sich jederzeit 
            <a href="${frontendUrl}/unsubscribe?token=${token}" 
               target="_blank" style="color:#007bff;">hier abmelden</a>.
          </p>
          <p style="font-size:13px;color:#777;">Ihr Team von Reifencheck.de</p>
        </div>
      `,
        };

        await sgMail.send(msg);

        res.status(201).json({
            success: true,
            message: "Danke! Sie wurden erfolgreich zum Newsletter hinzugefügt.",
        });
    } catch (err) {
        console.error("[Newsletter ERROR]", err.response?.body || err.message);
        res.status(500).json({
            success: false,
            message: "Serverfehler beim Hinzufügen der E-Mail.",
        });
    }
};

/**
 * @desc Secure unsubscribe (with token verification)
 * @route POST /api/newsletter/unsubscribe
 */
export const unsubscribeNewsletter = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token)
            return res
                .status(400)
                .json({ success: false, message: "Token erforderlich." });

        const email = verifyUnsubscribeToken(token);
        if (!email)
            return res.status(400).json({
                success: false,
                message: "Ungültiger oder abgelaufener Link.",
            });

        const subscriber = await NewsletterSubscriber.findOneAndUpdate(
            { email },
            { status: "unsubscribed", unsubscribedAt: new Date() },
            { new: true }
        );

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: "E-Mail-Adresse nicht gefunden.",
            });
        }

        res.json({
            success: true,
            message: "Sie wurden erfolgreich vom Newsletter abgemeldet.",
        });
    } catch (err) {
        console.error("[Newsletter Unsubscribe ERROR]", err.message);
        res.status(500).json({
            success: false,
            message: "Serverfehler beim Abmelden.",
        });
    }
};

/**
 * @desc Get all subscribers (Admin)
 * @route GET /api/newsletter/subscribers
 */
export const getSubscribers = async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const subscribers = await NewsletterSubscriber.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await NewsletterSubscriber.countDocuments(filter);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: subscribers,
        });
    } catch (err) {
        console.error("[Get Subscribers ERROR]", err.message);
        res.status(500).json({
            success: false,
            message: "Fehler beim Abrufen der Abonnentenliste.",
        });
    }
};

/**
 * @desc Export subscribers to CSV or Excel
 * @route GET /api/newsletter/export?format=csv|excel
 */
export const exportSubscribers = async (req, res) => {
    try {
        const { format = "csv" } = req.query;
        const subscribers = await NewsletterSubscriber.find().lean();

        if (subscribers.length === 0)
            return res
                .status(404)
                .json({ success: false, message: "Keine Abonnenten gefunden." });

        if (format === "excel") {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Subscribers");

            sheet.columns = [
                { header: "Email", key: "email" },
                { header: "Status", key: "status" },
                { header: "Source", key: "source" },
                { header: "IP", key: "ip" },
                { header: "Subscribed At", key: "subscribedAt" },
                { header: "Unsubscribed At", key: "unsubscribedAt" },
            ];

            sheet.addRows(subscribers);
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="newsletter_subscribers.xlsx"'
            );
            await workbook.xlsx.write(res);
            res.end();
        } else {
            const fields = [
                "email",
                "status",
                "source",
                "ip",
                "subscribedAt",
                "unsubscribedAt",
            ];
            const parser = new Parser({ fields });
            const csv = parser.parse(subscribers);
            res.header("Content-Type", "text/csv");
            res.attachment("newsletter_subscribers.csv");
            res.send(csv);
        }
    } catch (err) {
        console.error("[Export Subscribers ERROR]", err.message);
        res.status(500).json({
            success: false,
            message: "Fehler beim Exportieren der Abonnentenliste.",
        });
    }
};

/**
 * @desc Send campaign to subscribers
 * @route POST /api/newsletter/send-campaign
 */
export const sendCampaign = async (req, res) => {
    try {
        const { subject, message, imageUrl } = req.body;

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Betreff und Nachricht sind erforderlich.",
            });
        }

        const subscribers = await NewsletterSubscriber.find({
            status: "subscribed",
        });

        if (!subscribers.length) {
            return res.status(404).json({
                success: false,
                message: "Keine abonnierten Benutzer gefunden.",
            });
        }

        const frontendUrl = process.env.FRONTEND_URL || "https://reifencheck.de";

        const emails = subscribers.map((s) => s.email);
        const messages = emails.map((email) => {
            const token = generateUnsubscribeToken(email);
            return {
                to: email,
                from: process.env.SENDGRID_FROM,
                subject,
                html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>${subject}</h2>
            <p>${message}</p>
            ${imageUrl
                        ? `<div><img src="${imageUrl}" alt="Campaign" style="max-width:600px;width:100%;margin-top:10px;" /></div>`
                        : ""
                    }
            <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;" />
            <p style="font-size:12px;color:#888;">
              Sie erhalten diese E-Mail, weil Sie unseren Newsletter abonniert haben.
              Wenn Sie keine weiteren E-Mails erhalten möchten,
              können Sie sich jederzeit 
              <a href="${frontendUrl}/unsubscribe?token=${token}" target="_blank" style="color:#007bff;">hier abmelden</a>.
            </p>
          </div>
        `,
            };
        });

        await sgMail.send(messages);

        res.status(200).json({
            success: true,
            message: `Kampagne erfolgreich an ${emails.length} Abonnenten gesendet.`,
        });
    } catch (err) {
        console.error("[Send Campaign ERROR]", err.response?.body || err.message);
        res.status(500).json({
            success: false,
            message: "Fehler beim Senden der Kampagne.",
        });
    }
};
