import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev';

/**
 * Authentication Middleware
 * Validates the Authorization: Bearer <token> header.
 * Attaches the decoded user payload to req.user.
 */
export function auth(roles = []) {
  return (req, res, next) => {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
      // 2. Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 3. Attach user payload
      req.user = decoded;

      // 4. Role-based Access Control (RBAC)
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
