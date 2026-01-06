import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from './user.js';


config(); // Load environment variables

/**
 * Connects to MongoDB with retry logic
 * @param {number} retryCount - Number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<boolean>} - True if connection is successful
 */
export const connectDB = async (retryCount = 3, retryDelay = 3000) => {
  const uri = process.env.MONGODB_URI_PROD;
  if (!uri) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
  }
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      await mongoose.connect(uri, {
        tls: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      console.log('Connected to MongoDB');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, err.message);
      if (attempt === retryCount) {
        console.error('Max retry attempts reached. Exiting...');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};

// Export models
export const models = {
  User,
};



