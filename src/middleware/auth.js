import jwt from 'jsonwebtoken';

export function adminAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ error: 'No token' });

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role !== 'admin') throw new Error();
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
