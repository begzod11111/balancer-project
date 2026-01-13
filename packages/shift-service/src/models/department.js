// packages/shift-service/src/models/department.js
import mongoose, {Schema} from "mongoose";

// packages/shift-service/src/models/department.js
const Department = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    ObjectId: {
        type: String,
        required: true,
        unique: true
    },
    active: {
        type: Boolean,
        default: true
    },
    description: {
        type: String
    },
    // Массив типов задач с весами
    taskTypeWeights: [{
        typeId: {type: String, required: true},
        name: {type: String, required: true},
        weight: {type: Number, required: true, min: 0.1, max: 10}
    }],

    loadCalculationFormula: {type: String, default: 'activeIssues * 1.5 + dailyIssues'},
    defaultMaxLoad: {
        type: Number,
        default: 100
    },
    priorityMultiplier: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 5.0
    }
}, {
    timestamps: true
});


export default mongoose.model('department', Department);
