// models/department.js
import mongoose, { Schema } from 'mongoose';


// В схеме department измените определение shifts
const Department = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    active: {
        type: Boolean,
        default: true,
        required: true,
    },
    delete: {
        type: Boolean,
        default: false,
        required: true,
    },
    description: {
        type: String,
        required: false,
    }

},);



export default mongoose.model('department', Department);