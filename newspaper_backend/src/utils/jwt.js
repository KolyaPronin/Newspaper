const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const signToken = (user) => jwt.sign(
  {
    sub: user._id.toString(),
    role: user.role,
  },
  JWT_SECRET,
  {
    expiresIn: JWT_EXPIRES_IN,
  },
);

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = {
  signToken,
  verifyToken,
};

