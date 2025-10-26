import crypto from "crypto";

const SECRET = process.env.NEWSLETTER_SECRET || "supersecretfallback";

/**
 * Generate a secure unsubscribe token
 * Token = base64(email:timestamp:signature)
 */
export const generateUnsubscribeToken = (email) => {
    const timestamp = Date.now();
    const payload = `${email}:${timestamp}`;
    const signature = crypto
        .createHmac("sha256", SECRET)
        .update(payload)
        .digest("hex");
    return Buffer.from(`${email}:${timestamp}:${signature}`).toString("base64url");
};

/**
 * Verify unsubscribe token and return email if valid
 */
export const verifyUnsubscribeToken = (token, maxAgeMinutes = 60 * 24 * 7) => {
    try {
        const decoded = Buffer.from(token, "base64url").toString("utf8");
        const [email, timestamp, signature] = decoded.split(":");
        if (!email || !timestamp || !signature) return null;

        // Recalculate HMAC signature
        const expectedSig = crypto
            .createHmac("sha256", SECRET)
            .update(`${email}:${timestamp}`)
            .digest("hex");

        if (expectedSig !== signature) return null;

        // Expiration check
        const ageMinutes = (Date.now() - parseInt(timestamp)) / 1000 / 60;
        if (ageMinutes > maxAgeMinutes) return null;

        return email;
    } catch {
        return null;
    }
};
