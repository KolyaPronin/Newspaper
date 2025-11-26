require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

const initUsers = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const users = [
      {
        username: 'author_ivan',
        email: 'ivan@newspaper.zeta',
        password: 'password123',
        role: 'author',
      },
      {
        username: 'proofreader_maria',
        email: 'maria@newspaper.zeta',
        password: 'password123',
        role: 'proofreader',
      },
      {
        username: 'chief_alpha',
        email: 'alpha@newspaper.zeta',
        password: 'password123',
        role: 'chief_editor',
      },
    ];

    for (const userData of users) {
      const existingUser = await User.findOne({ 
        $or: [
          { username: userData.username },
          { email: userData.email }
        ]
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.username} already exists, skipping...`);
      } else {
        const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
        const user = await User.create({
          username: userData.username,
          email: userData.email,
          passwordHash,
          role: userData.role,
        });
        console.log(`✅ Created user: ${user.username} (ID: ${user._id})`);
      }
    }

    console.log('\n✅ Users initialization completed');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing users:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

initUsers();

