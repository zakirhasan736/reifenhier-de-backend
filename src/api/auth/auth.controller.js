import Admin from '../../models/Admin.js';
import { signJwt } from '../../config/jwt.js';

export const registerAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword } = req.body;

        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const existing = await Admin.findOne({ email });
        if (existing) return res.status(409).json({ error: 'Email already exists' });

        const admin = await Admin.create({ firstName, lastName, email, password });

        // Remove sensitive info before sending
        const token = signJwt({ id: admin._id, email: admin.email, role: 'admin' });

        res.status(201).json({
            token,
            admin: {
                id: admin._id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Registration failed' });
    }
};
  

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await admin.comparePassword(password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = signJwt({ id: admin._id, email: admin.email, role: 'admin' });
        res.status(200).json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Login failed' });
    }
};
