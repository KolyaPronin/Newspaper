const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Make sure MongoDB is running:');
    console.error('   - Check if MongoDB service is started');
    console.error('   - Verify MONGODB_URI in .env file');
    console.error('   - Default URI: mongodb://localhost:27017/newspaper_db\n');
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Server will continue without database connection');
      console.warn('   API endpoints will not work until MongoDB is available\n');
    }
  }
};

module.exports = connectDB;

