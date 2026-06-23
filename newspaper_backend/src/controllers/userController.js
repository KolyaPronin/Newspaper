const User = require('../models/User');

const sanitizeUser = (user) => (user.toSafeObject ? user.toSafeObject() : {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
});

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');

    res.json({
      success: true,
      count: users.length,
      data: users.map(sanitizeUser),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getUserById,
  getUsers,
};

