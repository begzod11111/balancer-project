// packages/analytics-service/src/models/Type.js
import mongoose from 'mongoose';

const TypeSchema = new mongoose.Schema({
    typeId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['task', 'bug', 'story', 'epic', 'subtask'],
        default: 'task'
    },
    description: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: '📋'
    },
    color: {
        type: String,
        default: '#4CAF50'
    },
    statuses: [{
        self: String,
        name: String,
        untranslatedName: String,
        id: String,
    }],
    defaultWeight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10
    },
    active: {
        type: Boolean,
        default: true
    },
    deleted: {
        type: Boolean,
        default: false,
        index: true // ВАЖНО: индекс для быстрой фильтрации
    }
}, {
    timestamps: true,
    versionKey: false
});

// Индекс для частых запросов
TypeSchema.index({ active: 1, deleted: 1 });
TypeSchema.index({ category: 1, active: 1, deleted: 1 });

export default mongoose.model('Type', TypeSchema);
