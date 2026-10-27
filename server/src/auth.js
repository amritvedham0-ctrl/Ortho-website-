import jwt from 'jsonwebtoken';
import { User } from './models.js';

const tokenFor = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
export const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });
export const issueToken = (user) => tokenFor(user);

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user;
    next();
  } catch { res.status(401).json({ message: 'Invalid or expired session' }); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}
