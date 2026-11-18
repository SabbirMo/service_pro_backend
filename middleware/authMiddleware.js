const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'servicepro_secret_key_2026'
      );

      req.user = await User.findById(decoded.id).select('-password -refreshToken');
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found or no longer exists',
        });
      }

      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. You do not have administrator privileges.',
  });
};

module.exports = protect;
module.exports.protect = protect;
module.exports.adminOnly = adminOnly;
