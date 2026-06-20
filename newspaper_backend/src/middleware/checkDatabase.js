const mongoose = require('mongoose');

const checkDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database connection is not available',
      message: 'Please ensure MongoDB is running and try again',
    });
  }
  next();
};

module.exports = checkDatabase;

