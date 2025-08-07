import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const SECRET = process.env.AWIN_CLOAK_SECRET || "dev-secret";

// Use a proper encoding for production (base64url)
function encodeAffiliateUrl(url) {
    if (!url) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(SECRET, "utf8").slice(0, 32), iv);
    let encrypted = cipher.update(url, "utf8", "base64");
    encrypted += cipher.final("base64");
    const tag = cipher.getAuthTag();
    return (
        Buffer.concat([iv, tag, Buffer.from(encrypted, "base64")]).toString("base64url")
    );
}

function decodeAffiliateUrl(encoded) {
    try {
        const buf = Buffer.from(encoded, "base64url");
        const iv = buf.slice(0, 12);
        const tag = buf.slice(12, 28);
        const encrypted = buf.slice(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(SECRET, "utf8").slice(0, 32), iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) {
        return null;
    }
}

export default { encodeAffiliateUrl, decodeAffiliateUrl };
