const jwt = require('jsonwebtoken');

const authMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      // MOCK DEV AUTH: If no header is provided by the frontend, inject a default control room admin
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('DEV MODE: No auth token provided. Injecting mock user.');
        req.user = {
          id: 4, // Control room user from seed
          role: 'control_room_admin',
          hospital_id: null,
          name: 'Demo Admin'
        };
      } else {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123');
        req.user = decoded; // { id, role, hospital_id, name }
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: `Access denied for role: ${req.user.role}` });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

module.exports = authMiddleware;
