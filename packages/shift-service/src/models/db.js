import mongoose from 'mongoose';
import Shift from "./shift.js";
import Department from "./department.js";
import {pathEnv} from "../../config.js";
import dotenv from "dotenv";
import department from "./department.js";


dotenv.config({
    path: pathEnv.__dirname + "/.env",
});

/**
 * Connects to MongoDB with retry logic
 * @param {number} retryCount - Number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @param uri
 * @returns {Promise<boolean>} - True if connection is successful
 */
const connectDB = async (retryCount = 3, retryDelay = 3000) => {
    const url = process.env.MONGODB_URI_PROD;
    if (!url) {
        console.error('MONGODB_URI is not defined in .env');
        process.exit(1);
    }
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            await mongoose.connect(url, {
                tls: true,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
            });

            // await models.Shift.create({
            //     assigneeEmail: "ramazon.k@payme.uz",
            //     department: new mongoose.Types.ObjectId("694c0e96c3862c3bc82ac303"),
            //
            //     "accountId": "712020:93e44725-6250-4ccb-959a-df50c32c5506",
            //     "shifts": {
            //         "0": {
            //             "startTime": "10:00",
            //             "endTime": "19:00"
            //         },
            //         "1": {
            //             "startTime": "10:00",
            //             "endTime": "19:00"
            //         },
            //         "2": {
            //             "startTime": "10:00",
            //             "endTime": "18:00"
            //         },
            //         "3": {
            //             "startTime": "10:00",
            //             "endTime": "19:00"
            //         },
            //         "4": {
            //             "startTime": "10:00",
            //             "endTime": "18:00"
            //         },
            //         "5": {
            //             "startTime": "12:00",
            //             "endTime": "21:00"
            //         }
            //     },
            //
            //
            //     "assigneeName": "Ramazon"
            //
            // })
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
    connectDB,
    Shift,
    Department
};



