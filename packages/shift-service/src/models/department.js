// packages/shift-service/src/models/department.js
import mongoose, {Schema} from "mongoose";

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
    workspaceId: {
        type: String,
        required: true,
        default: "1be9e6ab-23d3-4044-be51-802c29c0229a"
    },
    // Массив типов задач с весами
    taskTypeWeights: [{
        typeId: {type: String, required: true},
        name: {type: String, required: true},
        weight: {type: Number, required: true, min: 0.1, max: 10},
        // Веса для конкретных статусов этого типа
        statusWeights: [{
            statusId: {type: String, required: true},
            statusName: {type: String, required: true},
            weight: {type: Number, required: true, min: 0.1, max: 10}
        }]
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

