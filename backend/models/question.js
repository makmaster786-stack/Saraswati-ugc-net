const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: {
        english: {
            type: String,
            required: [true, 'English question text is required']
        },
        hindi: {
            type: String,
            required: [true, 'Hindi question text is required']
        }
    },
    options: [{
        english: {
            type: String,
            required: true
        },
        hindi: {
            type: String,
            required: true
        }
    }],
    correctAnswerIndex: {
        type: Number,
        required: [true, 'Correct answer index is required'],
        min: [0, 'Answer index must be between 0 and 3'],
        max: [3, 'Answer index must be between 0 and 3']
    },
    explanation: {
        english: String,
        hindi: String
    },
    marks: {
        type: Number,
        default: 1
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    category: String,
    tags: [String],
    subject: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageCount: {
        type: Number,
        default: 0
    },
    averageTime: { // Average time taken by students in seconds
        type: Number,
        default: 0
    },
    successRate: { // Percentage of students who answered correctly
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Method to validate answer
questionSchema.methods.checkAnswer = function(selectedIndex) {
    return selectedIndex === this.correctAnswerIndex;
};

// Pre-save middleware to ensure 4 options
questionSchema.pre('save', function(next) {
    if (this.options.length !== 4) {
        return next(new Error('Question must have exactly 4 options'));
    }
    next();
});

module.exports = mongoose.model('Question', questionSchema);