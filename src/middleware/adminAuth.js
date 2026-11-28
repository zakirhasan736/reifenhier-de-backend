import { verifyJwt } from '../config/jwt.js';

/** Bearer token from POST /api/auth/admin/login. */
export function requireAdmin(req, res, next) {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = token ? verifyJwt(token) : null;
    if (!payload || payload.role !== 'admin') {
        return res.status(401).json({ error: 'unauthorized' });
    }
    req.admin = payload;
    next();
}
