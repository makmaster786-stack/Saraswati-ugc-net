const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Course description is required']
    },
    price: {
        type: Number,
        required: [true, 'Course price is required'],
        min: [0, 'Price cannot be negative']
    },
    originalPrice: {
        type: Number,
        min: [0, 'Original price cannot be negative']
    },
    category: {
        type: String,
        enum: ['paper1', 'paper2', 'combined', 'subject-specific'],
        required: true
    },
    subject: {
        type: String,
        required: function() {
            return this.category === 'subject-specific';
        }
    },
    duration: {
        type: String // e.g., "3 months", "6 months"
    },
    features: [String],
    curriculum: [{
        module: String,
        topics: [String],
        duration: String
    }],
    instructor: {
        name: String,
        bio: String,
        qualifications: [String]
    },
    thumbnail: String,
    previewVideo: String,
    isPublished: {
        type: Boolean,
        default: false
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    enrollmentCount: {
        type: Number,
        default: 0
    },
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Virtual for discount percentage
courseSchema.virtual('discountPercentage').get(function() {
    if (this.originalPrice && this.originalPrice > this.price) {
        return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    }
    return 0;
});

module.exports = mongoose.model('Course', courseSchema);