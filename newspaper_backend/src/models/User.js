const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
  },
  role: {
    type: String,
    enum: ['author', 'proofreader', 'illustrator', 'layout_designer', 'chief_editor'],
    required: [true, 'Role is required'],
  },
}, {
  timestamps: true,
});

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    role: this.role,
  };
};
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;

