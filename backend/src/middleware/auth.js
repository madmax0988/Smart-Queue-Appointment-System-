const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired access token', 401));
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
