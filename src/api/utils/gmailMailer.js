import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user, pass },
        });
    }
    return transporter;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const STATUS_LABEL = {
    new: "Neu",
    resubscribed: "Erneut angemeldet",
    already_subscribed: "Bereits angemeldet",
};

/**
 * Email a newsletter signup to the site owner's Gmail.
 * Uses EMAIL_USER + EMAIL_PASS (Gmail App Password) from .env.
 */
export async function sendNewsletterLead({ email, source, ip, status }) {
    const transport = getTransporter();
    const to = process.env.LEAD_NOTIFY_EMAIL || process.env.EMAIL_USER;
    if (!transport || !to) {
        console.warn("[MAIL] EMAIL_USER/EMAIL_PASS missing — lead email skipped");
        return { sent: false, reason: "not_configured" };
    }

    const safeEmail = String(email).replace(/[\r\n]/g, "");
    const label = STATUS_LABEL[status] || STATUS_LABEL.new;
    const when = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    await transport.sendMail({
        from: `"Reifexa Newsletter" <${process.env.EMAIL_USER}>`,
        to,
        replyTo: safeEmail,
        subject: `Neue Newsletter-Anmeldung: ${safeEmail}`,
        text: [
            "Neue Newsletter-Anmeldung",
            "",
            `E-Mail: ${safeEmail}`,
            `Status: ${label}`,
            `Quelle: ${source || "footer_form"}`,
            `IP: ${ip || "-"}`,
            `Zeit: ${when}`,
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; color: #222;">
              <h2>Neue Newsletter-Anmeldung</h2>
              <p><strong>E-Mail:</strong> ${escapeHtml(safeEmail)}</p>
              <p><strong>Status:</strong> ${escapeHtml(label)}</p>
              <p><strong>Quelle:</strong> ${escapeHtml(source || "footer_form")}</p>
              <p><strong>IP:</strong> ${escapeHtml(ip || "-")}</p>
              <p><strong>Zeit:</strong> ${escapeHtml(when)}</p>
            </div>
        `,
    });

    return { sent: true };
}

/**
 * Email an Auto-API checkout request to the same inbox as newsletter leads.
 */
export async function sendAutoApiRequest({ email, plan, serverIps, ip }) {
    const transport = getTransporter();
    const to = process.env.LEAD_NOTIFY_EMAIL || process.env.EMAIL_USER;
    if (!transport || !to) {
        console.warn("[MAIL] EMAIL_USER/EMAIL_PASS missing — Auto-API request email skipped");
        return { sent: false, reason: "not_configured" };
    }

    const safeEmail = String(email).replace(/[\r\n]/g, "");
    const ips = Array.isArray(serverIps) ? serverIps.join(", ") : String(serverIps || "");
    const when = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    await transport.sendMail({
        from: `"Reifexa Auto-API" <${process.env.EMAIL_USER}>`,
        to,
        replyTo: safeEmail,
        subject: `Neue Auto-API-Anfrage: ${safeEmail}`,
        text: [
            "Neue Auto-API-Zugangsanfrage",
            "",
            `E-Mail: ${safeEmail}`,
            `Tarif: ${plan || "-"}`,
            `Server-IPs: ${ips || "-"}`,
            `Anfrage-IP: ${ip || "-"}`,
            `Zeit: ${when}`,
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; color: #222;">
              <h2>Neue Auto-API-Zugangsanfrage</h2>
              <p><strong>E-Mail:</strong> ${escapeHtml(safeEmail)}</p>
              <p><strong>Tarif:</strong> ${escapeHtml(plan || "-")}</p>
              <p><strong>Server-IPs:</strong> ${escapeHtml(ips || "-")}</p>
              <p><strong>Anfrage-IP:</strong> ${escapeHtml(ip || "-")}</p>
              <p><strong>Zeit:</strong> ${escapeHtml(when)}</p>
            </div>
        `,
    });

    return { sent: true };
}
