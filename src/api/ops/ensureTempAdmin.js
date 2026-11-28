import Admin from '../../models/Admin.js';

/** Created once on API start so the temporary /ops desk can be signed into. */
export const TEMP_ADMIN_EMAIL = (process.env.TEMP_ADMIN_EMAIL || 'ops@reifexa.de').trim().toLowerCase();
export const TEMP_ADMIN_PASSWORD = process.env.TEMP_ADMIN_PASSWORD || 'Reifexa-Ops-2026!';

export async function ensureTempAdmin() {
    const email = TEMP_ADMIN_EMAIL;
    const existing = await Admin.findOne({ email });
    if (existing && process.env.TEMP_ADMIN_RESET !== '1') return existing;
    if (existing) {
        existing.password = TEMP_ADMIN_PASSWORD;
        existing.firstName = existing.firstName || 'Temp';
        existing.lastName = existing.lastName || 'Ops';
        await existing.save();
        console.log(`[ops] temporary admin password reset for ${email}`);
        return existing;
    }
    const admin = await Admin.create({
        firstName: 'Temp',
        lastName: 'Ops',
        email,
        password: TEMP_ADMIN_PASSWORD,
    });
    console.log(`[ops] temporary admin ready: ${email}`);
    return admin;
}
