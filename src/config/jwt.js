import jwt from 'jsonwebtoken';

export const signJwt = (payload, expiresIn = '7d') =>
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

export const verifyJwt = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;c 
    }
};
