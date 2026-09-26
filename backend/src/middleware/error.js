const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational) {
    console.error('Unexpected error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Internal server error',
    details: err.details,
  });
}

module.exports = { notFoundHandler, errorHandler };
