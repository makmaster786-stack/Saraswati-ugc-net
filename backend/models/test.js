const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Test title is required'],
        trim: true
    },
    description: String,
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Course reference is required']
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    duration: {
        type: Number, // in minutes
        required: [true, 'Test duration is required'],
        min: [1, 'Duration must be at least 1 minute']
    },
    totalMarks: {
        type: Number,
        default: 100
    },
    passingMarks: {
        type: Number,
        default: 35
    },
    isFree: {
        type: Boolean,
        default: false
    },
    unlockDate: {
        type: Date,
        default: Date.now
    },
    maxAttempts: {
        type: Number,
        default: 3
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    instructions: [String],
    isPublished: {
        type: Boolean,
        default: false
    },
    isTimed: {
        type: Boolean,
        default: true
    },
    showResultsImmediately: {
        type: Boolean,
        default: true
    },
    attempts: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        score: Number,
        percentage: Number,
        timeTaken: Number, // in seconds
        submittedAt: {
            type: Date,
            default: Date.now
        },
        answers: [{
            question: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Question'
            },
            selectedOption: Number,
            isCorrect: Boolean,
            timeSpent: Number // in seconds
        }]
    }]
}, {
    timestamps: true
});

// Virtual for question count
testSchema.virtual('questionCount').get(function() {
    return this.questions.length;
});

// Index for better query performance
testSchema.index({ course: 1, unlockDate: 1 });
testSchema.index({ isPublished: 1, unlockDate: 1 });

module.exports = mongoose.model('Test', testSchema);