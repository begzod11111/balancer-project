// models/Shift.js
import mongoose, {Schema} from "mongoose";

// В схеме Shift измените определение shifts
const Shift = new Schema({
    assigneeName: {
        type: String,
        required: true,
        default: "Неизвестный сотрудник"
    },
    assigneeEmail: {
        type: String,
        required: true,
        unique: true
    },
    department: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Department",
    },
    accountId: {
        type: String,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "User",
    },
    shifts: {
        type: Schema.Types.Mixed,  // Изменяем на Mixed для поддержки объекта
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deleted: {
        type: Boolean,
        default: false
    },
    limits: {
        maxDailyIssues: {type: Number, default: 30},
        maxActiveIssues: {type: Number, default: 30},
        preferredLoadPercent: {type: Number, default: 80}
    },

}, {
    timestamps: true
});

// Индексы для производительности
Shift.index({ 'schedule.dayOfWeek': 1 });
Shift.index({ 'accountId': 1 }, { unique: true });

export default mongoose.model('shift', Shift);