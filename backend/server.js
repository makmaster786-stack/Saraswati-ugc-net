/* --- FILE: backend/server.js (CLEANED) --- */

// 1. IMPORT PACKAGES
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jsonrepair } = require('jsonrepair');

const Razorpay = require('razorpay');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const {translate} = require('@vitalets/google-translate-api');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// 2. INITIALIZE APP & CONSTANTS
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// 3. ENHANCED MIDDLEWARE
// REPLACE your app.use(helmet({ ... })) block with this:

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.tiny.cloud"],
scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://checkout.razorpay.com", "https://cdnjs.cloudflare.com", "https://cdn.tiny.cloud", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://cdn.razorpay.com"],           scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com", "https://cdn.tiny.cloud", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
            frameSrc: ["https://checkout.razorpay.com", "https://api.razorpay.com"]
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Set correct paths for EJS views and public assets from the new structure
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public'))); // Serves the 'public' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '../admin'))); // Serves the 'admin' folder

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// 4. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 5. ENHANCED MONGOOSE MODELS
// User Schema
const UserSchema = new mongoose.Schema({
    // Auth Fields
    googleId: { type: String, sparse: true, unique: true },
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String }, // Optional for Google users
    avatar: { type: String, default: '/images/default-avatar.png' },

    // Personal Info (from new form)
    phone: { type: String },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },

    // Education Info (from new form)
    highestQualification: { type: String }, // Renamed from 'education'
    subject: { type: String },
    collegeUniversity: { type: String },

    // Goal Info (from new form)
    goals: [{ type: String }], // Array of strings (e.g., ['jrf', 'both'])
    targetDate: { type: String },
    preparationLevel: { type: String },

    // App Data
    enrolledCourses: [{ 
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        enrolledAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 },
        completedLessons: [{ type: mongoose.Schema.Types.ObjectId }]
    }],
    testAttempts: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    preferences: {
        language: { type: String, default: 'english' },
        notifications: { type: Boolean, default: true }
    },
    dateRegistered: { type: Date, default: Date.now }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

UserSchema.virtual('testResults', {
    ref: 'TestResult',
    localField: '_id',
    foreignField: 'student'
});

// Admin Schema
const AdminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

// Course Schema
const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    duration: { type: String, default: '6 Months' },
    lessons: { type: Number, default: 0 },
    studentsEnrolled: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 0 },
    thumbnail: { type: String, default: '/images/course-thumbnail.jpg' },
    features: [{ type: String }],
    curriculum: [{
        title: String,
        duration: String,
        type: { type: String, enum: ['video', 'test', 'material'] },
        resources: [{ title: String, url: String, type: String }]
    }],
    isPublished: { type: Boolean, default: true },
    isNewLaunched: { type: Boolean, default: false },
    category: { type: String, default: 'UGC NET' },
    tags: [{ type: String }],
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    dateCreated: { type: Date, default: Date.now }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

CourseSchema.virtual('enrolledUsers', {
    ref: 'User',
    localField: '_id',
    foreignField: 'enrolledCourses.courseId'
});

// Test Schema
const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    duration: { type: Number, default: 180 },
    maxMarks: { type: Number, default: 100 },
    passingMarks: { type: Number, default: 40 },
    attempts: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    unlockDate: { type: Date, default: Date.now },
    tags: [{ type: String }],
    instructions: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    dateCreated: { type: Date, default: Date.now }
}, { timestamps: true });

// Question Schema
// Question Schema (Updated for Syllabus Analytics)
const QuestionSchema = new mongoose.Schema({
    // Standard Fields
    questionText: { 
        english: { type: String, required: true }, 
        hindi: { type: String, required: true } 
    },
    options: [{ 
        english: { type: String, required: true }, 
        hindi: { type: String, required: true } 
    }],
    correctAnswerIndex: { type: Number, required: true },
    explanation: {
        english: { type: String },
        hindi: { type: String }
    },
    marks: { type: Number, default: 2 },
    
    // --- FIELD FOR TEST SERIES ANALYTICS ---
    unit: { type: String, default: 'General' }, // Required for your Unit-wise analysis
    
    // --- FIELDS FOR PYQ DATA BANK ONLY ---
    // These can be null for your normal test series
    year: { type: Number }, 
    month: { type: String },
    paper: { type: String, enum: ['Paper 1', 'Paper 2'] }, 

    // Links
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' }
});
// Test Result Schema
const TestResultSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
    
    status: { 
        type: String, 
        enum: ['in-progress', 'completed'], 
        default: 'in-progress',
        index: true 
    },
    remainingTime: { type: Number }, // Time left in seconds
    
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },

    timeTaken: { type: Number }, // This will be set on final submission
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        selectedOptionIndex: { type: Number },
        isCorrect: { type: Boolean },
        timeSpent: { type: Number },
        status: { type: String }
    }],
    submittedAt: { type: Date }, // Will be set on final submission
    analysis: {
        strongTopics: [{ type: String }],
        weakTopics: [{ type: String }],
        accuracy: { type: Number },
        timeManagement: { type: String, enum: ['excellent', 'good', 'average', 'poor'] }
    }
}, { timestamps: true });

// Article Schema
// Updated Article Schema for SEO
const ArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true }, // The H1
    slug: { type: String, required: true, unique: true, index: true }, // The URL
    content: { type: String, required: true },
    metaDescription: { type: String, required: true }, // For Google Search Result Snippet
    keywords: { type: String }, // Helping the AI understand context
    tags: [{ type: String }],     // For internal filtering
    
    author: { type: String, default: 'Dr. Rajesh Mishra' },
    datePublished: { type: Date, default: Date.now },
    dateModified: { type: Date, default: Date.now } // Google loves fresh content
});

// Resource Schema
const ResourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    fileUrl: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: String },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});

// Payment Schema
const PaymentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    razorpay_order_id: { type: String, required: true },
    razorpay_payment_id: { type: String, required: true },
    razorpay_signature: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'success' },
    paymentDate: { type: Date, default: Date.now }
}, { timestamps: true });

// Models
const Payment = mongoose.model('Payment', PaymentSchema);
const User = mongoose.model('User', UserSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const Course = mongoose.model('Course', CourseSchema);
const Test = mongoose.model('Test', TestSchema);
const Question = mongoose.model('Question', QuestionSchema);
const TestResult = mongoose.model('TestResult', TestResultSchema);

// ── ANNOUNCEMENT MODEL ──
const announcementSchema = new mongoose.Schema({
    title:   { type: String, required: true, trim: true, maxLength: 120 },
    message: { type: String, required: true, trim: true },
    type:    { type: String, enum: ['info','warning','urgent','success'], default: 'info' },
    target:  { type: String, enum: ['all','enrolled','free'], default: 'all' },
    link:    { type: String, default: null },
}, { timestamps: true });
const Announcement = mongoose.model('Announcement', announcementSchema);
const Article = mongoose.model('Article', ArticleSchema);
const Resource = mongoose.model('Resource', ResourceSchema);

// 6. EXTERNAL SERVICES CONFIGURATION
const razorpay = new Razorpay({ 
    key_id: process.env.RAZORPAY_KEY_ID, 
    key_secret: process.env.RAZORPAY_KEY_SECRET 
});
const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } 
});
async function sendWelcomeEmail(user) {
    try {
        const mailOptions = {
            from: `"Saraswati UGC NET" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '🎓 Welcome to Saraswati UGC NET — Let\'s crack UGC NET together!',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Welcome</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);margin-top:24px;margin-bottom:24px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0c4a6e,#0369a1,#0EA5E9);padding:40px 32px;text-align:center;">
      <h1 style="color:white;font-size:24px;font-weight:800;margin:0 0 8px;">Welcome to Saraswati UGC NET! 🎓</h1>
      <p style="color:rgba(255,255,255,0.8);margin:0;font-size:15px;">Your journey to cracking UGC NET starts today</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#374151;line-height:1.7;">
        Hi <strong>${user.fullname}</strong>,<br><br>
        We're thrilled to have you on board! Your account has been successfully created and you're all set to begin your preparation.
      </p>

      <!-- Quick Start Steps -->
      <div style="background:#f0f9ff;border-radius:12px;padding:20px 24px;margin:20px 0;">
        <h3 style="color:#0369a1;margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Your First 3 Steps</h3>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <span style="background:#0EA5E9;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">1</span>
          <div><strong style="color:#1e3a5f;">Explore Available Tests</strong><br><span style="font-size:13px;color:#64748b;">Take a free mock test to assess your current level</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <span style="background:#0EA5E9;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">2</span>
          <div><strong style="color:#1e3a5f;">Browse Courses</strong><br><span style="font-size:13px;color:#64748b;">Enroll in a course that matches your subject</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="background:#0EA5E9;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">3</span>
          <div><strong style="color:#1e3a5f;">Visit the Knowledge Base</strong><br><span style="font-size:13px;color:#64748b;">Download PDFs and study materials for free</span></div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.SITE_URL || 'https://saraswatiugcnet.com'}/dashboard"
           style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
          Go to My Dashboard →
        </a>
      </div>

      <p style="font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
        Need help? Reply to this email or reach us via our Telegram channel.<br>
        Best of luck with your preparation! 🌟
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        You received this email because you signed up at <a href="${process.env.SITE_URL || 'https://saraswatiugcnet.com'}" style="color:#0EA5E9;">saraswatiugcnet.com</a>
      </p>
    </div>

  </div>
</body>
</html>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Welcome email sent to ${user.email}`);
    } catch (err) {
        // Don't block signup if email fails
        console.error(`[EMAIL] Failed to send welcome email to ${user.email}:`, err.message);
    }
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/resources/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

// 6.5. PASSPORT GOOGLE STRATEGY
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL || process.env.FRONTEND_URL || 'http://localhost:5000'}/api/auth/google/callback`
},
async (accessToken, refreshToken, profile, done) => {
    try {
        const userEmail = profile.emails[0].value;
        const userGoogleId = profile.id;

        // 1. Find user by their Google ID first
        let user = await User.findOne({ googleId: userGoogleId });
        if (user) {
            // User found by Google ID, this is the fastest and correct login
            return done(null, user);
        }

        // 2. If not found by GID, find by email
        user = await User.findOne({ email: userEmail });
        if (user) {
            // User exists with this email, but NOT with this Google ID.
            
            // Check if this email account has a password.
            if (user.password) {
                // CONFLICT: This email is already registered with a password.
                // Pass an error message to the failure callback.
                return done(null, false, { message: 'This email is already registered. Please log in with your password.' });
            }
            
            // User exists (e.g., from another social login) but has no password.
            // We can safely link this Google ID to their account.
            user.googleId = userGoogleId;
            user.avatar = profile.photos[0].value || user.avatar;
            await user.save();
            return done(null, user);

        } else {
            // 3. No user found by email or GID. Create a new user.
            const newUser = new User({
                googleId: userGoogleId,
                fullname: profile.displayName,
                email: userEmail,
                avatar: profile.photos[0].value,
                // No password or other details, they will be redirected to /complete-profile
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (error) {
        return done(error, false); // Pass database errors, etc.
    }
}));

// 7. AUTHENTICATION MIDDLEWARE
const checkUser = async (req, res, next) => {
    const token = req.cookies.authToken;
    if (token) {
        try {
            if (!JWT_SECRET) {
                console.error("CRITICAL: JWT_SECRET is not defined in .env file!");
                res.locals.user = null;
                return next();
            }
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password').lean();
            if (user) {
                res.locals.user = user;
                User.findByIdAndUpdate(user._id, { lastActive: new Date() }).exec();
            } else {
                res.locals.user = null;
                res.clearCookie('authToken');
            }
        } catch (e) {
            console.warn("Invalid JWT token received:", e.message);
            res.locals.user = null;
            res.clearCookie('authToken');
        }
    } else {
        res.locals.user = null;
    }
    next();
};

app.use(checkUser);

const protectStudent = (req, res, next) => {
    if (res.locals.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

const protectStudentApi = (req, res, next) => {
    if (res.locals.user) {
        next(); // User is logged in, proceed
    } else {
        // User is not logged in, send a JSON 401 Unauthorized error
        res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: Please log in to continue.' 
        });
    }
};

const protectAdmin = (req, res, next) => {
    // 1. HANDLE PREFLIGHT (CORS) REQUESTS
    // We must explicitly return "200 OK" for OPTIONS requests. 
    // If we just call next(), it might hit a 404 and fail.
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    // 2. GET TOKEN (Try Header first, then Cookie)
    let token;

    // A. Check Authorization Header (Standard API)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } 
    // B. Check Cookie (Fallback - Crucial for Admin Panel stability)
    else if (req.cookies && req.cookies.adminAuthToken) {
        token = req.cookies.adminAuthToken;
    }

    // 3. IF NO TOKEN FOUND
    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ success: false, message: 'No authentication token found.' });
    }

    // 4. VERIFY TOKEN
    try {
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set.");
            return res.status(500).json({ success: false, message: 'Server config error' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        req.adminId = decoded.adminId; // Save admin ID to request
        next();
        
    } catch (e) {
        // Only log detailed error to server console, not to client
        console.error("Admin Auth Failed:", e.message);
        return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
    }
};
const protectAdminPage = (req, res, next) => {
    const token = req.cookies.adminAuthToken;
    if (!token) {
        return res.redirect('/admin/login'); // Not logged in, send to login page
    }
    
    try {
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set.");
            return res.redirect('/admin/login');
        }
        jwt.verify(token, JWT_SECRET);
        next(); // Token is valid, continue
    } catch (e) {
        res.clearCookie('adminAuthToken');
        return res.redirect('/admin/login'); // Token is invalid
    }
};
// --- PASTE THIS IN server.js ---

// 1. Make sure you have this line at the very top of server.js:
// const translate = require('@vitalets/google-translate-api'); 

// 2. The corrected route:
app.post('/api/admin/translate-bulk', async (req, res) => {
    try {
        const { inputs, targetLang } = req.body;
        const translations = {};
        const keys = Object.keys(inputs);

        // Translate all fields in parallel
        await Promise.all(keys.map(async (key) => {
            if (inputs[key] && inputs[key].trim() !== '') {
                try {
                    const result = await translate(inputs[key], { to: targetLang });
                    translations[key] = result.text;
                } catch (err) {
                    console.error(`Error translating ${key}:`, err);
                    translations[key] = inputs[key]; 
                }
            } else {
                translations[key] = '';
            }
        }));

        res.json({ success: true, translations });
    } catch (error) {
        console.error("Translation API Error:", error);
        res.status(500).json({ success: false, message: 'Translation failed' });
    }
});

// --- DYNAMIC XML SITEMAP (For Google SEO) ---
app.get('/sitemap.xml', async (req, res) => {
    try {
        // 1. Define your base URL (Use your real domain in production)
        const baseUrl = process.env.FRONTEND_URL || 'https://saraswatiugcnet.com';
        
        // 2. Define Static Pages
        const urls = [
            { url: '/', changefreq: 'daily', priority: 1.0 },
            { url: '/about', changefreq: 'monthly', priority: 0.6 },
            { url: '/contact', changefreq: 'monthly', priority: 0.6 },
            { url: '/courses', changefreq: 'daily', priority: 0.8 },
            { url: '/articles', changefreq: 'daily', priority: 0.8 },
            { url: '/knowledge-base', changefreq: 'weekly', priority: 0.7 },
            { url: '/login', changefreq: 'monthly', priority: 0.5 },
            { url: '/signup', changefreq: 'monthly', priority: 0.5 },
        ];

        // 3. Fetch Dynamic Articles
        const articles = await Article.find({}).select('slug dateModified datePublished').lean();
        articles.forEach(article => {
            urls.push({
                url: `/article/${article.slug}`,
                changefreq: 'weekly',
                priority: 0.7,
                // Use modification date, fallback to publish date, fallback to now
                lastmod: article.dateModified || article.datePublished || new Date()
            });
        });

        // 4. Fetch Dynamic Courses
        const courses = await Course.find({ isPublished: true }).select('_id updatedAt createdAt').lean();
        courses.forEach(course => {
            urls.push({
                url: `/course/${course._id}`, // Ensures we link to the specific course page
                changefreq: 'weekly',
                priority: 0.8,
                lastmod: course.updatedAt || course.createdAt || new Date()
            });
        });

        // 5. Build the XML String
        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        urls.forEach(u => {
            xml += '<url>';
            xml += `<loc>${baseUrl}${u.url}</loc>`;
            xml += `<changefreq>${u.changefreq}</changefreq>`;
            xml += `<priority>${u.priority}</priority>`;
            if (u.lastmod) {
                xml += `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>`;
            }
            xml += '</url>';
        });

        xml += '</urlset>';

        // 6. Send Response with correct Header
        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error("Sitemap XML Error:", error);
        res.status(500).end();
    }
});
// 8.  RENDERING ROUTES (FOR STUDENTS)
app.get('/', async (req, res) => {
    try {
        // This route now handles both the homepage and the dashboard

        if (res.locals.user) {
            // USER IS LOGGED IN: Render the dashboard
            res.render('dashboard', { 
                title: 'My Dashboard',
                script: '/js/dashboard-pro.js'
                // The dashboard API (/api/dashboard/stats) will load the courses
            });
        } else {
            // NO USER: Render the homepage
            const courses = await Course.find({ isPublished: true }).sort({ studentsEnrolled: -1 }).limit(3).lean();

            res.render('index', { 
                title: 'Saraswati UGC NET - Best Coaching for NET/JRF',
                isDashboard: false, // This is correct for the homepage
                script:'/js/courses-pro.js',
                courses: courses,
                featuredCourses: courses 
            });
        }
    } catch (error) {
        console.error("Error in GET / route:", error);
        res.status(500).render('404', { title: 'Error' });
    }
});
app.get('/dashboard', protectStudent, (req, res) => {
    res.render('dashboard', { 
        title: 'My Dashboard',
        script: '/js/dashboard-pro.js'
    });
});
app.get('/about', (req, res) => res.render('about', { title: 'About Us - Saraswati UGC NET' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us - Saraswati UGC NET' }));
app.get('/login', (req, res) => {
    // Check for an error query parameter
    const error = req.query.error || null;
    res.render('login', { 
        title: 'Login - Saraswati UGC NET', 
        script: '/js/auth.js',
        error: error // Pass the error message to EJS
    });
});
app.get('/signup', (req, res) => {
    const error = req.query.error || null;
    res.render('signup', { 
        title: 'Sign Up - Saraswati UGC NET', 
        script: '/js/auth.js',
        error: error // Pass the error to EJS
    });
});
app.get('/forgot-password', (req, res) => res.render('forgot-password', { title: 'Forgot Password - Saraswati UGC NET', script: '/js/auth.js' }));
app.get('/reset-password', (req, res) => res.render('reset-password', { title: 'Reset Password - Saraswati UGC NET', script: '/js/auth.js' }));
app.get('/knowledge-base', (req, res) => res.render('knowledge-base', { title: 'Knowledge Base - Saraswati UGC NET', script: '/js/knowledge-pro.js' }));

app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find({ isPublished: true }).sort({ studentsEnrolled: -1 }).limit(9).lean();
        res.render('courses-pro', { title: 'UGC NET Courses & Test Series', script: '/js/courses-pro.js', courses: courses });
    } catch (error) { res.status(500).render('404', { title: 'Error' }); }
});
app.get('/course-details', async (req, res) => {
    try {
        const courseId = req.query.id;
        if (!courseId) {
            return res.redirect('/courses');
        }

        const course = await Course.findById(courseId).lean();
        
        if (!course) {
            res.locals.title = "Course Not Found";
            return res.status(404).render('404');
        }
        
        // 👇 BULLETPROOF TEST FETCHING 👇
        // This checks multiple field names just in case your schema uses 'courseId' instead of 'course'
        const tests = await Test.find({ 
            $or: [
                { course: course._id }, 
                { courseId: course._id },
                { courseId: String(course._id) }
            ]
        })
        .select('title duration isFree questions')
        .sort({ createdAt: 1 })
        .lean();
        
        // Print to your VS Code terminal so we can prove it works!
        console.log(`🔍 FOUND ${tests.length} TESTS FOR COURSE: ${course.title}`);
        
        course.fetchedTests = tests; 
        
        res.locals.title = course.title;
        res.locals.script = '/js/courses-pro.js'; 
        res.render('course-details', { course: course }); 

    } catch (error) {
        console.error("Course details page error:", error);
        res.locals.title = "Error";
        res.status(500).render('404');
    }
});

app.get('/available-tests', protectStudent, async (req, res) => {
    try {
        const tests = await Test.find({}).populate('course', 'title category').sort({ createdAt: -1 }).lean();
        const userResults = await TestResult.find({ student: res.locals.user._id, status: 'completed' }).select('test percentage submittedAt').lean();
        res.render('available-tests', { title: 'Available Mock Tests', script: '/js/test-pro.js', tests: tests, userResults: userResults });
    } catch (error) { res.status(500).render('404', { title: 'Error' }); }
});
app.get('/my-results', protectStudent, async (req, res) => {
    try {
        const results = await TestResult.find({ student: res.locals.user._id, status: 'completed' }).populate('test', 'title').sort({ submittedAt: -1 }).lean();
        res.render('my-results', { title: 'My Test Results', script: '/js/result-pro.js', results: results });
    } catch (error) { res.status(500).render('404', { title: 'Error' }); }
});
app.get('/my-payments', protectStudent, async (req, res) => {
    try {
        const payments = await Payment.find({ student: res.locals.user._id })
            .populate('course', 'title thumbnail')
            .sort({ paymentDate: -1 })
            .lean();

        res.render('my-payments', { 
            title: 'My Payment History', 
            payments: payments 
        });
    } catch (error) {
        console.error('My Payments page error:', error);
        res.status(500).render('404', { title: 'Error' });
    }
});
app.get('/resources', protectStudent, (req, res) => {
    res.render('resources', { title: 'Study Resources' });
});
app.get('/take-test', protectStudent, (req, res) => {
    res.render('take-test', { title: 'UGC NET Mock Test', script: '/js/test-interface.js' });
});
app.get('/course/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).lean();
        
        if (!course) {
            res.locals.title = "Course Not Found";
            return res.status(404).render('404');
        }
        
        // 👇 NEW: FETCH THE TESTS ASSIGNED TO THIS COURSE 👇
        const tests = await Test.find({ course: course._id })
                                .select('title duration isFree questions')
                                .sort({ createdAt: 1 })
                                .lean();
        
        // Attach the found tests to the course object
        course.fetchedTests = tests; 
        
        res.locals.title = course.title;
        res.locals.script = '/js/courses-pro.js'; 
        res.render('course-details', { course: course }); 

    } catch (error) {
        console.error("Course page error:", error);
        res.locals.title = "Error";
        res.status(500).render('404');
    }
});
app.get('/complete-profile', protectStudent, (req, res) => {
    res.render('complete-profile', { 
        title: 'Complete Your Profile',
        script: '/js/complete-profile.js'
    });
});
/* --- UNIVERSAL FIX: Make '/tests' work exactly like '/available-tests' --- */
app.get('/tests', protectStudent, async (req, res) => {
    try {
        // Reuse the exact same logic as available-tests
        const tests = await Test.find({}).populate('course', 'title category').sort({ createdAt: -1 }).lean();
        const userResults = await TestResult.find({ student: res.locals.user._id, status: 'completed' }).select('test percentage submittedAt').lean();
        
        // Render the existing 'available-tests.ejs' file
        res.render('available-tests', { 
            title: 'Available Mock Tests', 
            script: '/js/test-pro.js', 
            tests: tests,
            userResults: userResults
        });
    } catch (error) { 
        res.status(500).render('404', { title: 'Error' }); 
    }
});

// 9. API ROUTES (FOR STUDENTS)
app.get('/api/auth/google', (req, res, next) => {
    // Get the action from the query ('login' or 'signup')
    const action = req.query.action || 'login'; 
    
    // We'll pass this action to Google, who will send it back to us
    const state = Buffer.from(JSON.stringify({ action })).toString('base64');
    
    passport.authenticate('google', { 
        scope: ['profile', 'email'], 
        state: state // Pass our custom 'action' as the state
    })(req, res, next);
});
app.get('/api/auth/google/callback', (req, res, next) => {
    
    // 1. Get our 'action' back from Google's state parameter
    let action = 'login'; // Default to login
    if (req.query.state) {
        try {
            const decodedState = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf-8'));
            action = decodedState.action || 'login';
        } catch (e) {
            console.warn('Invalid state parameter received from Google');
        }
    }

    // 2. Authenticate
    passport.authenticate('google', { 
        session: false
    }, (err, user, info) => {
        
        // 3. Handle server errors
        if (err) {
            console.error('Google Auth Error:', err);
            return res.redirect('/login?error=server_error');
        }
        
        // 4. Handle authentication failure (e.g., email conflict)
        if (!user) {
            const errorMessage = info?.message || 'Login failed. Please try again.';
            
            // --- THIS IS THE NEW LOGIC ---
            // Redirect to the page where the user started
            let redirectUrl = (action === 'signup') ? '/signup' : '/login';
            
            return res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMessage)}`);
        }

        // 5. Handle success
        const token = jwt.sign(
            { userId: user._id, fullname: user.fullname, email: user.email }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.cookie('authToken', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });
        
        // 6. Check if profile is complete
        if (!user.phone || !user.subject) { // Using the 'subject' field
            return res.redirect('/complete-profile');
        } else {
            return res.redirect('/dashboard');
        }
    })(req, res, next);
});
app.post('/api/signup', async (req, res) => {
    try {
        // 1. Destructure all fields (Note: 'goals' is removed)
        const { 
            fullname, email, phone, dob, gender,
            highestQualification, subject, collegeUniversity,
             password 
        } = req.body;
        
        // 2. Updated validation (Note: 'goals' is removed)
        if (!fullname || !email || !password || !dob || !phone || !highestQualification || !subject || !collegeUniversity) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
        }
        
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }
        
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 3. Create the new user (Note: 'goals' is removed)
        const newUser = new User({ 
            fullname, 
            email: email.toLowerCase(), 
            password: hashedPassword, 
            dob: new Date(dob), 
            phone,
            gender,
            highestQualification,
            subject,
            collegeUniversity
           
            
        });
        
        await newUser.save();
        
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set. Cannot sign token.");
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        const token = jwt.sign({ userId: newUser._id, fullname: newUser.fullname, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.cookie('authToken', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });
        sendWelcomeEmail(newUser).catch(err => console.error('Welcome email error:', err));
        res.status(201).json({ 
            success: true, 
            message: 'Account created successfully!', 
            token, 
            user: { id: newUser._id, fullname: newUser.fullname, email: newUser.email, avatar: newUser.avatar } 
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }
        
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set. Cannot log in.");
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Handle users without passwords (e.g., Google sign-up)
        if (!user.password) {
            return res.status(401).json({ success: false, message: 'Please log in with Google, as this account was created with it.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ userId: user._id, fullname: user.fullname, email: user.email, enrolledCourses: user.enrolledCourses }, JWT_SECRET, { expiresIn: '7d' });
        
        res.cookie('authToken', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });
        
        res.json({ success: true, message: 'Login successful', token, user: { id: user._id, fullname: user.fullname, email: user.email, avatar: user.avatar, enrolledCourses: user.enrolledCourses.length } });
    
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
        
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set. Cannot create reset token.");
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
        
        const mailOptions = { from: process.env.EMAIL_USER, to: user.email, subject: 'Password Reset for Saraswati UGC NET', html: `<p>Hello ${user.fullname},</p><p>Please click the following link to reset your password:</p><a href="${resetLink}">Reset Password</a><p>This link will expire in 15 minutes.</p>` };
        
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('FORGOT PASSWORD ERROR:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set. Cannot verify reset token.");
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await User.findByIdAndUpdate(decoded.userId, { password: hashedPassword });
        res.json({ success: true, message: 'Password has been reset successfully. Please log in.' });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid or expired token. Please try again.' });
    }
});
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/ping', protectStudentApi, async (req, res) => {
    try {
        await User.findByIdAndUpdate(res.locals.user._id, { lastActive: new Date() });
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});


app.get('/api/dashboard/stats', protectStudent, async (req, res) => { 
    try {
        const userId = res.locals.user._id;
        
        // 1. Populate course curriculum for progress calculation
        const user = await User.findById(userId).populate({
            path: 'enrolledCourses.courseId',
            select: 'title thumbnail curriculum' 
        }).lean();
        
        if (!user) { // Safety check
             return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 2. Get ALL completed test results
        const allUserResults = await TestResult.find({ 
            student: userId, 
            status: 'completed' 
        }).select('test percentage submittedAt').populate('test', 'title').lean();
        
        const completedTestIds = new Set(allUserResults.map(r => r.test._id.toString()));

        // 3. Get all tests for enrolled courses - FIX APPLIED HERE
        const enrolledCourseIds = user.enrolledCourses
            .filter(ec => ec.courseId && ec.courseId._id) // <--- CRITICAL SAFETY FILTER: Ensures courseId and its _id are present
            .map(ec => ec.courseId._id);

        const allTests = await Test.find({ 
            course: { $in: enrolledCourseIds } 
        }).select('title course').lean();

        // 4. Map enrolled courses and CALCULATE progress
        const enrolledCoursesData = user.enrolledCourses
            .filter(ec => ec.courseId && ec.courseId._id) // <--- Apply filter again before mapping to data
            .map(ec => {
                
                // --- Progress Calculation ---
                const totalLessons = ec.courseId.curriculum ? ec.courseId.curriculum.length : 0;
                const completedLessons = ec.completedLessons ? ec.completedLessons.length : 0;
                let lessonProgress = 0;
                if (totalLessons > 0) {
                    lessonProgress = Math.round((completedLessons / totalLessons) * 100);
                }

                // --- Test Status Calculation ---
                const courseTestsWithStatus = allTests
                    .filter(test => test.course.toString() === ec.courseId._id.toString())
                    .map(test => ({
                        _id: test._id,
                        title: test.title,
                        isCompleted: completedTestIds.has(test._id.toString())
                    }));

                // --- Final Progress Decision ---
                let testProgress = 0;
                const totalTestsInCourse = courseTestsWithStatus.length;
                if (totalTestsInCourse > 0) {
                    const completedTestsInCourse = courseTestsWithStatus.filter(t => t.isCompleted).length;
                    testProgress = Math.round((completedTestsInCourse / totalTestsInCourse) * 100);
                }

                // Final progress uses test status if tests exist; otherwise, lesson status.
                const finalProgress = totalTestsInCourse > 0 ? testProgress : lessonProgress;

                return {
                    courseId: ec.courseId._id,
                    title: ec.courseId.title,
                    thumbnail: ec.courseId.thumbnail,
                    progress: finalProgress,
                    tests: courseTestsWithStatus
                };
            });

        // 5. Calculate user stats
        const testsTaken = allUserResults.length;
        let averageScore = 0;
        let bestScore = 0;
        if (testsTaken > 0) {
            const totalScore = allUserResults.reduce((sum, r) => sum + r.percentage, 0);
            averageScore = totalScore / testsTaken;
            bestScore = allUserResults.reduce((max, r) => Math.max(max, r.percentage), 0);
        }

        res.json({
            success: true,
            stats: {
                testsTaken: testsTaken,
                averageScore: averageScore,
                bestScore: bestScore,
                enrolledCourses: user.enrolledCourses.length || 0,
                lastActive: user.lastActive,
            },
            enrolledCourses: enrolledCoursesData,
            recentTests: allUserResults.slice(0, 5).map(t => ({
                title: t.test.title,
                submittedAt: t.submittedAt,
                percentage: t.percentage
            }))
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
    }
});
app.get('/api/courses', async (req, res) => {
    try {
        const { category, price, sort, search, page = 1, limit = 9 } = req.query;
        let query = { isPublished: true };
        
        if (category && category !== 'all') query.category = category;
        if (price === 'free') query.price = 0;
        if (price === 'paid') query.price = { $gt: 0 };
        if (search) query.title = { $regex: search, $options: 'i' };

        let sortOption = { studentsEnrolled: -1 };
        if (sort === 'rating') sortOption = { rating: -1 };
        if (sort === 'newest') sortOption = { createdAt: -1 };
        if (sort === 'price-low') sortOption = { price: 1 };
        if (sort === 'price-high') sortOption = { price: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const courses = await Course.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Course.countDocuments(query);

        res.json({ success: true, courses, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch courses' });
    }
});
app.get('/api/tests', async (req, res) => {
    try {
        const { search, category, course } = req.query;
        let query = {};
        
        if (search) query.title = { $regex: search, $options: 'i' };
        if (category === 'free') query.isFree = true;
        if (category === 'paid') query.isFree = false;
        if (course) query.course = course;
        
        const tests = await Test.find(query).populate('course', 'title category').sort({ unlockDate: 1 }).lean();

        let completedTestIds = new Set();
        // Check if a user is logged in
        if (res.locals.user) {
            const userResults = await TestResult.find({ 
                student: res.locals.user._id, 
                status: 'completed' 
            }).select('test').lean();
            completedTestIds = new Set(userResults.map(r => r.test.toString()));
        }

        // Add completion status to each test
        const testsWithStatus = tests.map(test => ({
            ...test,
            isCompleted: completedTestIds.has(test._id.toString())
        }));

        res.json({ success: true, tests: testsWithStatus }); // Send the modified array

    } catch (error) {
        console.error('GET /api/tests ERROR:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tests' });
    }
});

app.get('/api/results/my-results', protectStudent, async (req, res) => {
    try {
        const { sort, period } = req.query;
        let query = { student: res.locals.user._id, status: 'completed' }; 
        
        if (period && period !== 'all') {
            const now = new Date();
            let cutoffDate;
            if (period === 'week') cutoffDate = new Date(now.setDate(now.getDate() - 7));
            if (period === 'month') cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
            if (period === 'year') cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
            if(cutoffDate) query.submittedAt = { $gte: cutoffDate };
        }

        let sortOption = { submittedAt: -1 };
        if (sort === 'oldest') sortOption = { submittedAt: 1 };
        if (sort === 'score-high') sortOption = { percentage: -1 };
        if (sort === 'score-low') sortOption = { percentage: 1 };

        const results = await TestResult.find(query).populate('test', 'title').sort(sortOption).lean();
        res.json({ success: true, results: results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch results' });
    }
});

app.get('/api/results/:id', protectStudent, async (req, res) => {
    try {
        const resultId = req.params.id;
        const userId = res.locals.user._id;

        const result = await TestResult.findOne({ _id: resultId, student: userId })
            .populate({
                path: 'test',
                select: 'title'
            })
            .populate({
                path: 'answers.questionId',
                model: 'Question' // Explicitly state the model
            })
            .lean();

        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found or unauthorized' });
        }
        
        res.json({ success: true, result: result });

    } catch (error) {
        console.error('Error fetching single result:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch result details' });
    }
});

app.post('/api/user/complete-profile', protectStudent, async (req, res) => {
    try {
        // 1. Get all fields (Note: 'goals', 'targetDate', etc. are removed)
        const {
            fullName,
            phone,
            dateOfBirth,
            gender,
            highestQualification,
            subject,
            collegeUniversity,
            password // <-- NEW
        } = req.body;

        // 2. Simple validation
        if (!phone || !highestQualification || !subject || !collegeUniversity) {
            return res.status(400).json({ success: false, message: 'Please fill out all required fields.' });
        }

        // 3. Find the user first
        const user = await User.findById(res.locals.user._id);

        // 4. Update all profile fields
        user.fullname = fullName;
        user.phone = phone;
        user.dob = dateOfBirth ? new Date(dateOfBirth) : null;
        user.gender = gender;
        user.highestQualification = highestQualification;
        user.subject = subject;
        user.collegeUniversity = collegeUniversity;

        // 5. --- PASSWORD LOGIC ---
        if (password && password.length >= 6) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(password, salt);
        }
        
        
        await user.save(); 

        res.json({ success: true, message: 'Profile updated successfully!' });

    } catch (error) {
        console.error('Profile complete error:', error);
        res.status(500).json({ success: false, message: 'Server error updating profile.' });
    }
});

app.post('/api/payment/create-order', protectStudent, async (req, res) => { 
    try {
        const { courseId } = req.body;
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const options = {
            amount: course.price * 100, // Razorpay expects amount in paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            notes: {
                courseId: courseId,
                userId: res.locals.user._id
            }
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });

    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ success: false, message: 'Could not create payment order' });
    }
});
app.post('/api/payment/verify-payment', protectStudent, async (req, res) => { 
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
        const userId = res.locals.user._id;

       const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn(`[PAYMENT FRAUD] Invalid signature from user ${userId} for order ${razorpay_order_id}`);
            return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
        }
        const user = await User.findById(userId);
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Create a new Payment record
        const newPayment = new Payment({
            student: userId,
            course: courseId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount: course.price,
            status: 'success'
        });
        await newPayment.save();

        // Enroll user if not already enrolled
        if (!user.enrolledCourses.some(c => c.courseId.toString() === courseId)) {
            user.enrolledCourses.push({ courseId: courseId, enrolledAt: new Date() });
            await user.save();
            await Course.findByIdAndUpdate(courseId, { $inc: { studentsEnrolled: 1 } });
        }

        res.json({ success: true, message: 'Enrollment successful!' });

    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
});
app.post('/api/courses/enroll-free', protectStudent, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = res.locals.user._id;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Server-side check to ensure the course is actually free
        if (course.price !== 0) {
            return res.status(400).json({ success: false, message: 'This course is not free.' });
        }

        const user = await User.findById(userId);

        // Check if user is already enrolled
        const isEnrolled = user.enrolledCourses.some(c => c.courseId.toString() === courseId);
        if (isEnrolled) {
            return res.status(400).json({ success: false, message: 'You are already enrolled in this course' });
        }

        // Add the course to the user's enrolledCourses array
        user.enrolledCourses.push({ courseId: courseId, enrolledAt: new Date() });
        await user.save();

        // Optional: Increment the student count for the course
        await Course.findByIdAndUpdate(courseId, { $inc: { studentsEnrolled: 1 } });

        res.json({ success: true, message: 'Enrolled successfully!' });

    } catch (error) {
        console.error("Free enroll error:", error);
        res.status(500).json({ success: false, message: 'Server error during enrollment' });
    }
});



app.post('/api/tests/:id/start', protectStudent, async (req, res) => {
    try {
        const idParam = req.params.id;
        const userId = res.locals.user._id;

        // 1. Get Test Data
        const test = await Test.findById(idParam)
            .select('questions duration title difficulty course')
            .populate('course', 'title');

        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        // 2. Check for existing attempt
        let attempt = await TestResult.findOne({
            student: userId,
            test: test._id,
            status: 'in-progress'
        });

        // 3. POPULATE QUESTIONS (Critical)
        await test.populate({
            path: 'questions',
            select: '-correctAnswerIndex -explanation' 
        });

        if (attempt) {
            // --- RESUME EXISTING ---
            await attempt.populate({
                path: 'answers.questionId',
                select: '-correctAnswerIndex -explanation'
            });

            const attemptObj = attempt.toObject();
            
            // 🔥 FIX 1: Add .toObject() here to keep questions populated
            attemptObj.test = test.toObject(); 

            return res.json({ success: true, isNew: false, attempt: attemptObj });
        }

        // --- START NEW ---
        const newAttempt = new TestResult({
            student: userId,
            test: test._id,
            status: 'in-progress',
            remainingTime: test.duration * 60,
            totalQuestions: test.questions.length,
            answers: test.questions.map(q => ({
                questionId: q._id,
                status: 'not-visited',
                selectedOptionIndex: null,
                timeSpent: 0
            }))
        });

        await newAttempt.save();
        await newAttempt.populate({
            path: 'answers.questionId',
            select: '-correctAnswerIndex -explanation'
        });

        const finalAttempt = newAttempt.toObject();
        
        // 🔥 FIX 2: Add .toObject() here as well
        finalAttempt.test = test.toObject(); 

        res.status(201).json({ success: true, isNew: true, attempt: finalAttempt });

    } catch (e) {
        console.error("Test Start Error:", e);
        res.status(500).json({ success: false, message: "Error starting test: " + e.message });
    }
});
app.put('/api/tests/attempt/:id/save', protectStudent, async (req, res) => {
    try {
        const { answers, remainingTime } = req.body;
        
        const attempt = await TestResult.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    answers: answers,
                    remainingTime: remainingTime
                }
            },
            { new: true } // Return the updated document
        );

        if (!attempt) {
            return res.status(404).json({ success: false, message: "Test attempt not found" });
        }
        
        res.json({ success: true, message: "Progress saved", lastSaved: new Date() });

    } catch (error) {
        console.error("Test save error:", error);
        res.status(500).json({ success: false, message: 'Server error saving progress' });
    }
});

app.post('/api/tests/attempt/:id/submit', protectStudentApi, async (req, res) => {
    try {
        const attemptId = req.params.id;
        const userId = res.locals.user._id;
        const { answers = [], timeTaken = 0 } = req.body;

        // 1. Fetch attempt first to calculate score
        const attempt = await TestResult.findById(attemptId).populate({
            path: 'test',
            populate: { path: 'questions' }
        });

        if (!attempt || attempt.student.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Test attempt not found' });
        }

        // 2. CRITICAL FIX: Check status immediately. 
        // If it was already completed by a previous click, return success immediately (Idempotency)
        if (attempt.status === 'completed') {
             return res.json({ success: true, message: 'Test already submitted', resultId: attempt._id });
        }

        const test = attempt.test;
        let score = 0;
        let totalMarks = 0;
        const processedAnswers = [];

        // 3. Logic to calculate scores (unchanged)
        for (const userAnswer of answers) {
            const question = test.questions.find(q => q._id.toString() === userAnswer.questionId);
            if (!question) continue;

            const marks = question.marks || 2;
            totalMarks += marks;

            const isCorrect = question.correctAnswerIndex === userAnswer.selectedOptionIndex;
            if (isCorrect) score += marks;

            processedAnswers.push({
                questionId: question._id,
                selectedOptionIndex: userAnswer.selectedOptionIndex,
                isCorrect: isCorrect,
                status: userAnswer.status || 'answered',
                timeSpent: userAnswer.timeSpent || 0
            });
        }

        const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

        // 4. ATOMIC UPDATE (The Magic Fix)
        // Instead of attempt.save(), we use findOneAndUpdate with a condition.
        // We only update IF the status is STILL 'in-progress'.
        const updatedAttempt = await TestResult.findOneAndUpdate(
            { _id: attemptId, status: 'in-progress' }, // Condition
            {
                $set: {
                    status: 'completed',
                    score: score,
                    percentage: percentage,
                    timeTaken: timeTaken,
                    answers: processedAnswers,
                    submittedAt: new Date(),
                    remainingTime: 0
                }
            },
            { new: true }
        );

        // If updatedAttempt is null, it means another request beat us to it.
        // We consider this a success (the user's goal was to submit, and it is submitted).
        if (!updatedAttempt) {
             return res.json({ success: true, message: 'Test submitted successfully', resultId: attemptId });
        }

        // 5. Update User Stats (Background operation)
        const userStats = await TestResult.aggregate([
            { $match: { student: new mongoose.Types.ObjectId(userId), status: 'completed' } },
            { $group: {
                _id: "$student",
                averageScore: { $avg: "$percentage" },
                bestScore: { $max: "$percentage" }
            }}
        ]);

        await User.findByIdAndUpdate(userId, { 
            $inc: { testAttempts: 1 },
            $set: { 
                averageScore: userStats[0]?.averageScore || percentage,
                bestScore: userStats[0]?.bestScore || percentage
            }
        });

        return res.json({
            success: true,
            message: 'Test submitted successfully',
            resultId: updatedAttempt._id
        });

    } catch (error) {
        console.error('Submit Error:', error);
        res.status(500).json({ success: false, message: 'Server error submitting test' });
    }
});
// --- NEW: Dedicated Articles Page Route ---
app.get('/articles', async (req, res) => {
    try {
        // Fetch all articles, sorted by newest first
        const articles = await Article.find({}).sort({ datePublished: -1 }).lean();

        res.render('articles', { 
            title: 'Articles & Study Notes - Saraswati UGC NET',
            user: res.locals.user || null, // Pass user for header logic
            articles: articles 
        });
    } catch (error) {
        console.error("Error fetching articles page:", error);
        res.status(500).render('404', { title: 'Error Loading Articles' });
    }
});

app.get('/api/articles', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        
        // If user is searching, filter by title or keywords
        if (search) {
            query = {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { keywords: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const articles = await Article.find(query)
            .select('title slug metaDescription datePublished keywords author')
            .sort({ datePublished: -1 }) // Newest first
            .lean();
            
        res.json({ success: true, articles });
    } catch (error) {
        console.error('Public articles error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch articles' });
    }
});


app.post('/api/custom-test/generate', protectStudent, async (req, res) => {
    try {
        const { paper, units, count } = req.body;
        const studentId = res.locals.user._id;

        const durationSeconds = count * 1.2 * 60; // e.g., 50 * 1.2 * 60 = 3600s (60 mins)

        const questions = await Question.aggregate([
            { 
                $match: { 
                    paper: paper, 
                    unit: { $in: units } 
                } 
            },
            { $sample: { size: count } }, // Randomly pick 'count' questions
            { $project: { _id: 1 } }      // We only need the IDs
        ]);

        if (questions.length === 0) {
            return res.status(404).json({ success: false, message: "No questions found for these units yet. Please select different units." });
        }

       
        
        const newResult = new TestResult({
            student: studentId,
            test: null, // It's dynamic, no parent test
            status: 'in-progress',
            
            // SPECIAL: Store the dynamic metadata here so we can reconstruct the test title later
            analysis: { 
                strongTopics: units, // Storing units here temporarily for reference
            },
            
            totalQuestions: questions.length,
            remainingTime: durationSeconds,
            answers: questions.map(q => ({
                questionId: q._id,
                status: 'not-visited'
            }))
        });

        await newResult.save();

        res.json({ success: true, attemptId: newResult._id });

    } catch (error) {
        console.error("Custom Gen Error:", error);
        res.status(500).json({ success: false, message: "Server error generating test" });
    }
});

app.get('/api/pyq/available', async (req, res) => {
    try {
        // Aggregate to find distinct Year/Month combinations
        const archives = await Question.aggregate([
            { $match: { year: { $ne: null } } }, // Only get PYQ questions
            { 
                $group: { 
                    _id: { year: "$year", month: "$month", paper: "$paper" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } }
        ]);
        
        res.json({ success: true, archives });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// B. Start a "Dynamic Test" from PYQ Data
app.post('/api/pyq/start', protectStudent, async (req, res) => {
    try {
        const { year, month, paper } = req.body;

        // 1. Find all questions matching this criteria
        const questions = await Question.find({ 
            year: parseInt(year), 
            month: month, 
            paper: paper 
        }).select('_id'); // We just need IDs

        if (questions.length === 0) {
            return res.status(404).json({ success: false, message: "No questions found for this date." });
        }

        
        const newResult = new TestResult({
            student: res.locals.user._id,
            test: null, // No parent test
            status: 'in-progress',
            
            // SPECIAL FIELDS FOR DYNAMIC TEST
            isDynamic: true,
            meta: { year, month, paper },
            
            totalQuestions: questions.length,
            remainingTime: 180 * 60, // 3 Hours default
            answers: [] 
        });

        
        const virtualTest = {
            _id: "dynamic_" + Date.now(), // Fake ID
            title: `PYQ ${month} ${year} - ${paper}`,
            duration: 180,
            questions: questions.map(q => q._id)
        };

        // SAVE the result
        await newResult.save();

        res.json({ 
            success: true, 
            attemptId: newResult._id,
            
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Could not start PYQ" });
    }
});
// 10. ADMIN PANEL ROUTES
app.get('/admin/login', (req, res) => {
    res.render('admin/admin-login', { 
        title: 'Admin Login',
        page: 'login'
    });
});
app.get('/admin/pyq-manager', (req, res) => {
    res.render('admin/admin-pyq', { title: 'Upload PYQ', page: 'pyq' });
});

// All routes below this are protected by 'protectAdminPage' middleware
app.use('/admin', protectAdminPage);

// Dashboard
app.get('/admin/dashboard', (req, res) => {
    res.render('admin/admin-dashboard', { 
        title: 'Dashboard',
        page: 'dashboard',
        script: null 
    });
});

// Students
app.get('/admin/students', (req, res) => {
    res.render('admin/admin-students', { 
        title: 'Manage Students',
        page: 'students',
        script: null
    });
});

// Courses List
app.get('/admin/courses', (req, res) => {
    res.render('admin/admin-courses', { 
        title: 'Manage Courses',
        page: 'courses',
        script: null
    });
});

// Edit Course Page
app.get('/admin/edit-course', async (req, res) => {
    try {
        const courseId = req.query.id;
        if (!courseId) {
            // No ID was provided
            return res.status(400).render('admin/admin-404', { 
                title: 'Bad Request', 
                page: 'courses' 
            });
        }

        const course = await Course.findById(courseId).lean();

        if (!course) {
            // No course found with that ID
            return res.status(404).render('admin/admin-404', { 
                title: 'Course Not Found', 
                page: 'courses' 
            });
        }

        // Success: Render the page and pass the course data to it
        res.render('admin/edit-course', { 
            title: 'Edit Course',
            page: 'courses', // Keep sidebar on 'Courses'
            script: null,
            course: course 
        });

    } catch (error) {
        // Handle database errors (e.g., invalid ID format)
        console.error("Error fetching course for edit:", error);
        res.status(500).render('admin/admin-404', { 
            title: 'Server Error', 
            page: 'courses' 
        });
    }
});

// Tests List
app.get('/admin/tests', (req, res) => {
    res.render('admin/admin-tests', { 
        title: 'Manage Tests',
        page: 'tests',
        script: null
    });
});

// Test Details Page
app.get('/admin/test-details', (req, res) => {
    res.render('admin/admin-test-details', { 
        title: 'Test Details',
        page: 'tests', // Keep sidebar on 'Tests'
        script: null
    });
});

// Edit Test Page
app.get('/admin/edit-test', (req, res) => {
    res.render('admin/edit-test', { 
        title: 'Edit Test',
        page: 'tests', // Keep sidebar on 'Tests'
        script: null,
        testId: req.query.id // This passes the ID to your EJS template
    });
});

// Knowledge Base
app.get('/admin/knowledge-base', (req, res) => {
    res.render('admin/admin-knowledge-base', { 
        title: 'Manage Knowledge Base',
        page: 'knowledge',
        script: null
    });
});

// Resources
app.get('/admin/resources', (req, res) => {
    res.render('admin/admin-resources', { 
        title: 'Manage Resources',
        page: 'resources',
        script: 'admin-resources.js' // Page-specific JS
    });
});

app.get('/admin/announcements', (req, res) => {
    res.render('admin/admin-announcements', {
        title: 'Announcements',
        page: 'announcements'
    });
});




// 11. API ROUTES (FOR ADMIN PANEL)

// Admin login (This route is UNPROTECTED so the admin can log in)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // 1. Find the admin by email in the database
        const admin = await Admin.findOne({ email: email });
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // 2. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // 3. Check for JWT_SECRET
        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not set. Cannot log in admin.");
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        // 4. Create token and cookie
        const token = jwt.sign({ 
            adminId: admin._id, // Use the database ID
            email: admin.email 
        }, JWT_SECRET, { expiresIn: '8h' });

        res.cookie('adminAuthToken', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 8 * 60 * 60 * 1000 
        });    

        res.json({ 
            success: true, 
            message: 'Admin login successful!',
            token: token
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during admin login' 
        });
    }
});

// All routes below this line are protected by the 'protectAdmin' API middleware
app.use('/api/admin', protectAdmin);

// Admin Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalStudents = await User.countDocuments();
        const totalCourses = await Course.countDocuments();
        const totalTests = await Test.countDocuments();
        const totalArticles = await Article.countDocuments();
        const totalQuestions = await Question.countDocuments();
        
        res.json({
            success: true,
            stats: {
                studentCount: totalStudents,
                courseCount: totalCourses,
                testCount: totalTests,
                articleCount: totalArticles,
                questionCount: totalQuestions
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch admin stats' 
        });
    }
});

// Recent Students
app.get('/api/admin/recent-students', async (req, res) => {
    try {
        const students = await User.find()
            .select('fullname email dateRegistered')
            .sort({ dateRegistered: -1 })
            .limit(10)
            .lean();
            
        res.json({
            success: true,
            students: students
        });
    } catch (error) {
        console.error('Recent students error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch recent students' 
        });
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { fullname: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } } // Added Phone Search
                ]
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // POPULATE course details to get titles
        const users = await User.find(query)
            .select('fullname email phone dateRegistered enrolledCourses testAttempts averageScore')
            .populate('enrolledCourses.courseId', 'title')
            .sort({ dateRegistered: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const totalUsers = await User.countDocuments(query);

        res.json({
            success: true,
            users: users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalUsers / limit),
                totalUsers: totalUsers
            }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// 2. NEW: Fetch detailed Test Results for a specific student (For the Modal)
app.get('/api/admin/users/:id/details', async (req, res) => {
    try {
        const userId = req.params.id;

        // Fetch User with deeply populated course info
        const user = await User.findById(userId)
            .select('-password')
            .populate('enrolledCourses.courseId', 'title price')
            .lean();

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Fetch all completed test results for this user
        const results = await TestResult.find({ student: userId, status: 'completed' })
            .populate('test', 'title totalMarks')
            .sort({ submittedAt: -1 })
            .lean();

        res.json({
            success: true,
            user: user,
            results: results
        });
    } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user details' });
    }
});
app.delete('/api/admin/questions/bulk', async (req, res) => {
    try {
        const { paper, year, month, unit } = req.body;
        let query = {};

        // Safety: Prevent accidental "Delete All Database"
        if (!paper && !year && !month && !unit) {
            return res.status(400).json({ success: false, message: "Please select at least one filter (Year, Month, etc.) to delete." });
        }

        if (paper) query.paper = paper;
        if (year) query.year = parseInt(year);
        if (month) query.month = month;
        if (unit) query.unit = unit;

        const result = await Question.deleteMany(query);

        res.json({ success: true, message: `Deleted ${result.deletedCount} questions.` });

    } catch (error) {
        console.error("Bulk Delete Error:", error);
        res.status(500).json({ success: false, message: "Server error during delete" });
    }
});
// Delete a User
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        
        await TestResult.deleteMany({ student: req.params.id });
        await Payment.deleteMany({ student: req.params.id });

        res.json({ success: true, message: 'User deleted successfully!' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

app.get('/api/admin/courses', async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = {};
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const totalCourses = await Course.countDocuments(query);
        
        const courses = await Course.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
            
        res.json({ 
            success: true, 
            courses: courses,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCourses / parseInt(limit)),
                totalItems: totalCourses,
                hasNext: skip + courses.length < totalCourses,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Admin courses error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch courses' });
    }
});
    
    app.post('/api/admin/courses', async (req, res) => {
    try {
        // Added originalPrice to the destructured variables
        const { title, description, price, originalPrice, isPublished } = req.body;
        
        const newCourse = new Course({
            title,
            description,
            price: parseFloat(price),
            // Added originalPrice to the database save logic
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            isPublished: isPublished || false,
            shortDescription: description ? description.substring(0, 150) + '...' : ''
        });
        
        await newCourse.save();
        
        res.status(201).json({
            success: true,
            message: 'Course created successfully!',
            course: newCourse
        });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create course' 
        });
    }
});

app.get('/api/admin/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }
        
        res.json({
            success: true,
            course: course
        });
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch course' 
        });
    }
});

app.put('/api/admin/courses/:id', async (req, res) => {
    try {
        // Here we destructure all fields from the schema
        const { 
            title, description, shortDescription, price, originalPrice, 
            duration, lessons, thumbnail, features, curriculum, 
            isPublished, isNew, category, tags, level
        } = req.body;
        
        const updatedCourse = await Course.findByIdAndUpdate(
            req.params.id,
            {
                // And update all of them
                title, description, shortDescription, price: parseFloat(price), originalPrice,
                duration, lessons, thumbnail, features, curriculum,
                isPublished, isNew, category, tags, level
            },
            { new: true } // Return the updated document
        );
        
        if (!updatedCourse) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }
        
        res.json({
            success: true,
            message: 'Course updated successfully!',
            course: updatedCourse
        });
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update course' 
        });
    }
});

app.delete('/api/admin/courses/:id', async (req, res) => {
    try {
        const deletedCourse = await Course.findByIdAndDelete(req.params.id);
        
        if (!deletedCourse) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }

       
        res.json({
            success: true,
            message: 'Course deleted successfully!'
        });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete course' 
        });
    }
});


app.get('/api/admin/tests', async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const totalTests = await Test.countDocuments(query);

        const tests = await Test.find(query)
            .populate('course', 'title')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
            
        res.json({ 
            success: true, 
            tests: tests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalTests / parseInt(limit)),
                totalItems: totalTests,
                hasNext: skip + tests.length < totalTests,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Admin tests error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tests' });
    }
});
app.post('/api/admin/tests', async (req, res) => {
    try {
        const { title, courseId, isFree, unlockDate } = req.body;
        
        if (!title || !courseId) {
            return res.status(400).json({ success: false, message: 'Title and Course are required' });
        }

        const newTest = new Test({
            title,
            course: courseId,
            isFree: isFree || false,
            unlockDate: unlockDate ? new Date(unlockDate) : new Date()
        });
        
        await newTest.save();
        
        res.status(201).json({
            success: true,
            message: 'Test created successfully!',
            test: newTest
        });
    } catch (error) {
        console.error('Create test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create test' 
        });
    }
});

app.get('/api/admin/tests/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id)
            .populate('questions')
            .populate('course', 'title');
            
        if (!test) {
            return res.status(404).json({ 
                success: false, 
                message: 'Test not found' 
            });
        }
        
        res.json({
            success: true,
            test: test
        });
    } catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch test' 
        });
    }
});

app.put('/api/admin/tests/:id', async (req, res) => {
    try {
        const { title, course, duration, isFree, unlockDate, difficulty, instructions } = req.body;

        const updatedTest = await Test.findByIdAndUpdate(
            req.params.id,
            {
                title,
                course: course,
                duration: parseInt(duration, 10),
                isFree: isFree || false,
                unlockDate: unlockDate ? new Date(unlockDate) : null,
                difficulty,
                instructions
            },
            { new: true } // This returns the updated document
        );

        if (!updatedTest) {
            return res.status(404).json({ 
                success: false, 
                message: 'Test not found' 
            });
        }

        res.json({
            success: true,
            message: 'Test updated successfully!',
            test: updatedTest
        });
    } catch (error) {
        console.error('Update test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update test' 
        });
    }
});

app.delete('/api/admin/tests/:id', async (req, res) => {
    try {
        const deletedTest = await Test.findByIdAndDelete(req.params.id);
        
        if (!deletedTest) {
            return res.status(404).json({ 
                success: false, 
                message: 'Test not found' 
            });
        }
        
        // Also delete associated questions
        await Question.deleteMany({ test: req.params.id });
        
        res.json({
            success: true,
            message: 'Test deleted successfully!'
        });
    } catch (error) {
        console.error('Delete test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete test' 
        });
    }
});


// --- Question Management API Routes ---
app.post('/api/admin/tests/:id/questions', async (req, res) => {
    try {
const { questionText, options, correctAnswerIndex, explanation, marks, difficulty, topic, paper, unit } = req.body;        
        const newQuestion = new Question({
            questionText,
            options,
            correctAnswerIndex: parseInt(correctAnswerIndex),
            explanation,
            marks: parseInt(marks) || 2,
            difficulty,
            topic,
            test: req.params.id,
            paper: paper || 'Paper 2',
    unit: unit || 'General'
            
        });
        
        await newQuestion.save();
        
        // Add question to test's question array
        await Test.findByIdAndUpdate(
            req.params.id,
            { $push: { questions: newQuestion._id } }
        );
        
        res.status(201).json({
            success: true,
            message: 'Question added successfully!',
            question: newQuestion
        });
    } catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add question' 
        });
    }
});

app.put('/api/admin/questions/:id', async (req, res) => {
    try {
        const { 
            questionText, options, correctAnswerIndex, explanation, 
            marks, difficulty, topic, paper, unit 
        } = req.body;

        // Dynamic Update: Only changes fields that are sent
        let updateData = {};
        
        if (questionText) updateData.questionText = questionText;
        if (options) updateData.options = options;
        if (correctAnswerIndex !== undefined) updateData.correctAnswerIndex = parseInt(correctAnswerIndex);
        if (explanation) updateData.explanation = explanation;
        if (marks) updateData.marks = parseInt(marks);
        if (difficulty) updateData.difficulty = difficulty;
        if (topic) updateData.topic = topic;
        
        // --- THIS WAS MISSING BEFORE ---
        if (paper) updateData.paper = paper;
        if (unit) updateData.unit = unit;

        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true } // Return the fresh updated document
        );

        if (!updatedQuestion) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        res.json({ success: true, message: 'Question updated successfully!', question: updatedQuestion });

    } catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({ success: false, message: 'Failed to update question' });
    }
});
app.post('/api/admin/classify-question', protectAdmin, async (req, res) => {
    try {
        const { questionText, paperContext } = req.body; // <--- Getting the hint
        if (!questionText) return res.status(400).json({ success: false, message: "No text to classify" });

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Define strict buckets based on user preference
        let validUnits = "";
        let contextInstruction = "";

        if (paperContext === "Paper 1") {
            validUnits = `
            - Teaching Aptitude
            - Research Aptitude
            - Comprehension
            - Communication
            - Mathematical Reasoning
            - Logical Reasoning
            - Data Interpretation
            - ICT
            - People & Environment
            - Higher Education`;
            contextInstruction = "STRICTLY classify this into a UGC NET Paper 1 (General) Unit.";
        } else if (paperContext === "Paper 2") {
            validUnits = `
            - Political Theory
            - Western Political Thought
            - Indian Political Thought
            - Comparative Politics
            - International Relations
            - India's Foreign Policy
            - Political Institutions
            - Political Processes
            - Public Administration
            - Governance`;
            contextInstruction = "STRICTLY classify this into a UGC NET Paper 2 (Political Science) Unit.";
        } else {
            // If no context, allow both (Fallback)
            validUnits = "All Paper 1 and Paper 2 Units...";
            contextInstruction = "Determine the most likely Unit.";
        }

        const prompt = `
            Act as a UGC NET Expert.
            ${contextInstruction}
            
            Question: "${questionText.substring(0, 400)}..."
            
            Allowed Units:
            ${validUnits}

            Return JSON: { "unit": "Exact Unit Name" }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        res.json({ success: true, unit: data.unit });

    } catch (error) {
        console.error("Classification Error:", error);
        res.status(500).json({ success: false, message: "Could not classify" });
    }
});
app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        const questionId = req.params.id;
        const deletedQuestion = await Question.findByIdAndDelete(questionId);

        if (!deletedQuestion) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        // Remove the question reference from its parent Test
        await Test.findByIdAndUpdate(
            deletedQuestion.test,
            { $pull: { questions: questionId } }
        );

        res.json({ success: true, message: 'Question deleted successfully!' });

    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete question' });
    }
});

app.get('/api/admin/questions/:id', protectAdmin, async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if(!question) return res.status(404).json({ success: false, message: 'Question not found' });
        res.json({ success: true, question });
    } catch(e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Article Management API Routes ---
app.get('/api/admin/articles', async (req, res) => {
    try {
        const articles = await Article.find()
            .sort({ datePublished: -1 })
            .lean();
            
        res.json({
            success: true,
            articles: articles
        });
    } catch (error) {
        console.error('Admin articles error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch articles' 
        });
    }
});
app.post('/api/admin/articles', async (req, res) => {
    try {
        // 1. Get the new SEO fields from the request
const { title, content, author, metaDescription, slug, keywords } = req.body;        
        // 2. Slug Logic: If you typed one, use it. If not, auto-generate it.
        let finalSlug = slug;
        if (!finalSlug || finalSlug.trim() === '') {
            finalSlug = title.toLowerCase()
                .replace(/[^a-z0-9 -]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
        }
        
        const newArticle = new Article({
            title,
            content,
            author: author || 'Dr. Rajesh Mishra',
            slug: finalSlug,                 // Uses your manual slug if provided
            metaDescription: metaDescription, // Saves your SEO description
            keywords: keywords
        });
        
        await newArticle.save();
        
        res.status(201).json({
            success: true,
            message: 'Article published successfully!',
            article: newArticle
        });
    } catch (error) {
        console.error('Create article error:', error);
        if (error.code === 11000) { 
             return res.status(400).json({ success: false, message: 'An article with this title or slug already exists.' });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Failed to publish article' 
        });
    }
});

app.delete('/api/admin/articles/:id', async (req, res) => {
    try {
        const deletedArticle = await Article.findByIdAndDelete(req.params.id);
        
        if (!deletedArticle) {
            return res.status(404).json({ 
                success: false, 
                message: 'Article not found' 
            });
        }
        
        res.json({
            success: true,
            message: 'Article deleted successfully!'
        });
    } catch (error) {
        console.error('Delete article error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete article' 
        });
    }
});

// --- Resource Management API Routes ---
app.get('/api/admin/resources', async (req, res) => {
    try {
        const resources = await Resource.find()
            .populate('course', 'title')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, resources: resources });
    } catch (error) {
        console.error('Get resources error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch resources' });
    }
});
/* --- GET ALL QUESTIONS (With Filters) --- */
app.get('/api/admin/all-questions', protectAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, paper, year, unit, search } = req.query;
        let query = {};

        // Filters
        if (paper) query.paper = paper;
        if (year) query.year = parseInt(year);
        if (unit) query.unit = unit;
        
        // Search (Checks English text)
        if (search) {
            query['questionText.english'] = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const questions = await Question.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Question.countDocuments(query);

        res.json({
            success: true,
            questions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalQuestions: total
            }
        });

    } catch (error) {
        console.error("Fetch Questions Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching questions" });
    }
});

// Also add the Page Render route
app.get('/admin/questions', (req, res) => {
    res.render('admin/admin-questions', { title: 'Question Bank', page: 'questions' });
});

app.post('/api/admin/resources', upload.single('resourceFile'), async (req, res) => {
    try {
        const { resourceTitle, resourceCourse, resourceType, resourceDescription } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload a file' 
            });
        }
        
        const newResource = new Resource({
            title: resourceTitle,
            description: resourceDescription,
            fileUrl: `/uploads/resources/${req.file.filename}`,
            fileType: resourceType || req.file.mimetype,
            course: resourceCourse || null,
            fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
        
        await newResource.save();
        
        res.status(201).json({
            success: true,
            message: 'Resource uploaded successfully!',
            resource: newResource
        });
    } catch (error) {
        console.error('Upload resource error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload resource' 
        });
    }
});
app.get('/admin/questions', (req, res) => {
    res.render('admin/admin-questions', { 
        title: 'Question Bank Manager', 
        page: 'questions',
        script: null 
    });
});
/* --- FETCH ALL QUESTIONS (For Question Bank) --- */
app.get('/api/admin/all-questions', protectAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, paper, year, unit, search } = req.query;
        let query = {};

        // 1. Build Query from Filters
        if (paper) query.paper = paper;
        if (year) query.year = parseInt(year);
        if (unit) query.unit = unit;
        
        // 2. Search Logic (Matches English Question Text)
        if (search) {
            query['questionText.english'] = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. Fetch Data
        const questions = await Question.find(query)
            .select('paper year month unit questionText') // Optimize: Only get needed fields
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Question.countDocuments(query);

        // 4. Send Response
        res.json({
            success: true,
            questions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalQuestions: total
            }
        });

    } catch (error) {
        console.error("Fetch Questions Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching questions" });
    }
});

app.delete('/api/admin/resources/:id', async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        
        

        await Resource.findByIdAndDelete(req.params.id);
        
        res.json({ success: true, message: 'Resource deleted successfully' });
    } catch (error) {
        console.error('Delete resource error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete resource' });
    }
});

// ═══════════════════════════════════════
//  ANNOUNCEMENTS API
// ═══════════════════════════════════════

// GET all announcements (paginated + filterable by type)
app.get('/api/admin/announcements', async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const query = type ? { type } : {};
        const total = await Announcement.countDocuments(query);
        const announcements = await Announcement.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean();
        res.json({
            success: true,
            announcements,
            pagination: {
                currentPage: Number(page),
                totalPages:  Math.ceil(total / limit),
                totalItems:  total,
                hasPrev:     page > 1,
                hasNext:     Number(page) < Math.ceil(total / limit),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
});

// POST create new announcement
app.post('/api/admin/announcements', async (req, res) => {
    try {
        const { title, message, type, target, link } = req.body;
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }
        const announcement = new Announcement({
            title: title.trim(),
            message: message.trim(),
            type:   type   || 'info',
            target: target || 'all',
            link:   link   || null,
        });
        await announcement.save();

        // Optional: send to Telegram channel
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const emoji = { info: 'ℹ️', warning: '⚠️', urgent: '🚨', success: '🎉' }[type] || 'ℹ️';
            const tMsg = `${emoji} *${title}*\n\n${message}${link ? `\n\n🔗 ${link}` : ''}`;
            try {
                const TelegramBot = require('node-telegram-bot-api');
                const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
                await bot.sendMessage('@saraswatiugcnet', tMsg, { parse_mode: 'Markdown' });
            } catch (tgErr) {
                console.warn('Telegram notification failed:', tgErr.message);
            }
        }

        res.status(201).json({ success: true, announcement });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement' });
    }
});

// DELETE announcement
app.delete('/api/admin/announcements/:id', async (req, res) => {
    try {
        const result = await Announcement.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete announcement' });
    }
});

// GET active announcements for students (no auth - for dashboard banners)
app.get('/api/announcements/active', async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title message type link createdAt')
            .lean();
        res.json({ success: true, announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


app.post('/api/admin/generate-question', protectAdmin, async (req, res) => {
    try {
        const { topic, paper } = req.body;
        if (!topic) return res.status(400).json({ success: false, message: "Topic is required" });

        // 1.5-flash is perfect for recalling broad patterns quickly
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-Flash" });

        // 1. Define Syllabus Context
        let validUnits = "";
        let contextInstruction = "";

        if (paper === "Paper 1") {
            validUnits = `Teaching Aptitude, Research Aptitude, Comprehension, Communication, Mathematical Reasoning, Logical Reasoning, Data Interpretation, ICT, People & Environment, Higher Education`;
            contextInstruction = "Context: UGC NET **Paper 1 (General)**.";
        } else {
            validUnits = `Political Theory, Western Political Thought, Indian Political Thought, Comparative Politics, International Relations, Foreign Policy, Political Institutions, Political Processes, Public Administration, Governance`;
            contextInstruction = "Context: UGC NET **Paper 2 (Political Science)**.";
        }

        const prompt = `
            ${contextInstruction}
            Topic: "${topic}"
            stirct tule : Generate ONE multiple-choice question (MCQ) in BOTH English and Hindi.
            - Randomly assign the correct answer to Option A, B, C, or D.
            *** STEP 3: OUTPUT JSON (Strict) ***
            {
                "unit": "Choose ONE valid Unit Name from: ${validUnits}",
                "q_text_en": "Question text in English (Include ALL HTML tags for tables/breaks)",
                "q_text_hi": "Question text in Hindi (Include ALL HTML tags for tables/breaks)",
                "opt1_en": "Option A (e.g. Code or Match)", "opt1_hi": "Hindi Opt A",
                "opt2_en": "Option B", "opt2_hi": "Hindi Opt B",
                "opt3_en": "Option C", "opt3_hi": "Hindi Opt C",
                "opt4_en": "Option D", "opt4_hi": "Hindi Opt D",
                "correct_answer_index": 0,
                "explanation_en": "Explain why this answer is correct based on facts/logic.",
                "explanation_hi": "Hindi explanation..."
            }
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Robust JSON Parsing
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error on: ", text);
            return res.status(500).json({ success: false, message: "AI generated invalid format. Try again." });
        }

        // Pass back paper type
        data.paper = paper; 
        
        res.json({ success: true, data });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false, message: "AI Generation Failed" });
    }
});
// --- UPDATED AI ARTICLE GENERATOR (GEO OPTIMIZED) ---
app.post('/api/admin/generate-article', protectAdmin, async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ success: false, message: "Topic is required" });

        console.log(`[AI] Generating SEO Article for: ${topic}`);

        // Use the best model available to you (gemini-2.5-flash or gemini-1.5-pro)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Act as a Senior Professor and SEO Expert for the UGC NET Exam.
            Write a comprehensive blog post about: "${topic}".

            STRICT SEO REQUIREMENTS:
            1. **Title**: Catchy, contains the keyword, under 60 chars.
            2. **Slug**: URL-friendly version of the title (lowercase, hyphens only).
            3. **Meta Description**: Exactly 155-160 characters. compelling summary for Google results.
            4. **Keywords**: List of 5-8 relevant semantic keywords (comma-separated).
            5. **Content**: 
               - Use HTML tags (<h2>, <p>, <ul>, <li>, <strong>).
               - NO Markdown (\`\`\`html).
               - Include a section called "UGC NET Exam Relevance".
               - Include a "Conclusion".

            OUTPUT FORMAT (Strict JSON):
            {
                "title": "...",
                "slug": "...",
                "metaDescription": "...",
                "keywords": "...",
                "content": "..."
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up any markdown the AI might accidentally add
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);
        res.json({ success: true, data });

    } catch (error) {
        console.error("AI Article Error:", error);
        res.status(500).json({ success: false, message: "AI Generation Failed. Try again." });
    }
});
;



const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
const fs = require('fs');
const mammoth = require('mammoth'); // <--- REQUIRE MAMMOTH
app.post('/api/admin/upload-pyq', protectAdmin, upload.single('pdfFile'), async (req, res) => {
    try {
        // 1. Basic Validation
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const { examYear, paperType, examMonth } = req.body;
        console.log(`🤖 Processing: ${req.file.originalname} (${paperType})...`);

        let contentPart = null;

        // --- STRATEGY A: IF PDF (Use Gemini File Manager) ---
        if (req.file.mimetype === 'application/pdf') {
            const uploadResponse = await fileManager.uploadFile(req.file.path, {
                mimeType: "application/pdf",
                displayName: `PYQ_${Date.now()}`,
            });

            // Wait for processing
            let file = await fileManager.getFile(uploadResponse.file.name);
            while (file.state === "PROCESSING") {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(uploadResponse.file.name);
            }
            if (file.state === "FAILED") throw new Error("Gemini failed to process PDF.");

            contentPart = { 
                fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } 
            };
        } 
        
        // --- STRATEGY B: IF WORD DOC (Use Mammoth) ---
        else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: req.file.path });
            const extractedText = result.value;
            
            if (!extractedText) throw new Error("Could not extract text from Word file.");
            
            contentPart = { 
                text: `DOCUMENT CONTENT START:\n${extractedText}\nDOCUMENT CONTENT END` 
            };
        } 
        else {
            return res.status(400).json({ success: false, message: "Only .pdf and .docx files are supported." });
        }

        // --- 2. CONFIGURE MODEL ---
        // Switched to 'gemini-1.5-flash' (Standard, fast, handles large context). 
        // Note: 'gemini-2.5' is likely a typo/unavailable unless you have special preview access.
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
        }, { 
            timeout: 600000 
        });

        // --- 3. PROMPT (Strict) ---
        const validUnitsList = paperType === "Paper 1" 
            ? `Teaching Aptitude, Research Aptitude, Comprehension, Communication, Mathematical Reasoning, Logical Reasoning, Data Interpretation, ICT, People & Environment, Higher Education`
            : `Political Theory, Western Political Thought, Indian Political Thought, Comparative Politics, International Relations, Foreign Policy, Political Institutions, Political Processes, Public Administration, Governance`;

        const prompt = `
            Act as a UGC NET Professor. 
            Analyze the provided document content (PDF or Text) for ${paperType} (${examYear}).
            
            CRITICAL INSTRUCTIONS:
            1. Extract EVERY single question found.
            2. **CLASSIFICATION:** Map each question to exactly ONE unit from: ${validUnitsList}
            3. **FORMAT:** Ensure exactly 4 options. Generate distractors if missing.
            4. **BILINGUAL:** Provide explanations in BOTH English and Hindi.
            
            OUTPUT FORMAT (Strict JSON Array):
            [
              { 
                "q_en": "Question text in English", 
                "q_hi": "Question text in Hindi", 
                "options": [
                    {"en":"Option A", "hi":"Option A Hindi"},
                    {"en":"Option B", "hi":"Option B Hindi"},
                    {"en":"Option C", "hi":"Option C Hindi"},
                    {"en":"Option D", "hi":"Option D Hindi"}
                ], 
                "correct_index": 0, 
                "expl_en": "Detailed explanation in English", 
                "expl_hi": "Detailed explanation in Hindi", 
                "unit": "Exact Unit Name" 
              }
            ]
        `;

        // --- 4. GENERATE ---
        console.log("🚀 Sending to AI...");
        const result = await model.generateContent([
            contentPart, 
            { text: prompt }
        ]);
        
        const responseText = result.response.text();

        // --- 5. ROBUST PARSING (The Fix) ---
        let questionsData;
        try {
            // A. Clean basic markdown
            const cleanedText = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // B. Extract content between first '[' and last ']'
            const jsonStart = cleanedText.indexOf('[');
            const jsonEnd = cleanedText.lastIndexOf(']');
            
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error("AI did not return a valid JSON array.");
            }
            
            const rawJson = cleanedText.substring(jsonStart, jsonEnd + 1);

            // C. REPAIR AND PARSE
            // jsonrepair automatically fixes missing quotes, unescaped characters, and trailing commas
            const repairedJson = jsonrepair(rawJson);
            questionsData = JSON.parse(repairedJson);

            console.log(`✅ JSON Parsed Successfully! Found ${questionsData.length} questions.`);

        } catch (error) {
            console.error("❌ Fatal Parsing Error:", error.message);
            // Log the raw output to help you debug if it fails again
            console.log("⚠️ AI Raw Output Snippet:", responseText.substring(0, 500) + "..."); 
            throw new Error("Failed to parse AI response. The file might be too complex or the AI output was invalid.");
        }

        // --- 6. SAVE TO DB ---
        let savedCount = 0;
        for (const q of questionsData) {
            if (!q.q_en || !q.options || q.options.length < 2) continue;

            await Question.create({
                paper: paperType,
                year: parseInt(examYear),
                month: examMonth,
                unit: q.unit || 'General',
                questionText: { english: q.q_en, hindi: q.q_hi || q.q_en },
                options: q.options.map(o => ({ english: o.en || "", hindi: o.hi || "" })),
                correctAnswerIndex: q.correct_index ?? 0,
                explanation: { english: q.expl_en || "", hindi: q.expl_hi || "" },
                marks: 2
            });
            savedCount++;
        }

        // Cleanup
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        res.json({ success: true, count: savedCount, message: `Successfully saved ${savedCount} questions!` });

    } catch (error) {
        console.error("❌ Processing Error:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
});
app.get('/article/:slug', async (req, res) => { 
    try {
        const article = await Article.findOne({ slug: req.params.slug }).lean();
        
        if (!article) {
            return res.status(404).render('404', { title: 'Article Not Found' });
        }

        const canonicalUrl = `${process.env.FRONTEND_URL || 'https://saraswatiugcnet.com'}/article/${article.slug}`;

        // 1. KEYWORDS FIX: Handle Array vs String
        let seoKeywords = 'UGC NET, Political Science';
        if (article.keywords) {
            seoKeywords = Array.isArray(article.keywords) 
                ? article.keywords.join(', ') 
                : article.keywords;
        }

        // 2. DATE FIX: Ensure it is a valid Date Object before calling toISOString
        // If date is missing, use current date
        const pubDate = article.datePublished ? new Date(article.datePublished) : new Date();
        const modDate = article.dateModified ? new Date(article.dateModified) : new Date();

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": article.title,
            "image": [
                article.featuredImage || "https://saraswatiugcnet.com/images/logo.png"
            ],
            // Use the safe variables we created above
            "datePublished": pubDate.toISOString(),
            "dateModified": modDate.toISOString(),
            "author": [{
                "@type": "Person",
                "name": article.author || "Dr. Rajesh Mishra",
                "url": "https://saraswatiugcnet.com/about"
            }],
             "publisher": {
                "@type": "Organization",
                "name": "Saraswati UGC NET",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://saraswatiugcnet.com/images/logo.png"
                }
            },
            "description": article.metaDescription || "Read this article on Saraswati UGC NET"
        };

        res.render('article', { 
            title: `${article.title} - Saraswati UGC NET`, 
            article: article,
            seo: {
                description: article.metaDescription,
                keywords: seoKeywords, 
                canonical: canonicalUrl,
                jsonLd: JSON.stringify(structuredData)
            }
        });

    } catch (error) {
        console.error("Article Page Error:", error);
        res.status(500).render('404', { title: 'Server Error' });
    }
});


const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

// 1. SAFE BOT INITIALIZER
function getBot() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error("❌ TELEGRAM ERROR: Token missing in .env file");
        return null;
    }
    return new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

// 2. FULL POLITICAL SCIENCE SYLLABUS (UNITS 1-10)
const POL_SCI_TOPICS = [
    // Unit 1: Political Theory
    "Political Theory: Liberty", "Political Theory: Equality", "Political Theory: Justice (Rawls)", "Political Theory: Rights", "Political Theory: Democracy", "Political Theory: Power", "Political Theory: Citizenship", "Political Theory: Liberalism", "Political Theory: Conservatism", "Political Theory: Socialism", "Political Theory: Marxism", "Political Theory: Feminism", "Political Theory: Ecologism", "Political Theory: Multiculturalism", "Political Theory: Post-Modernism",
    
    // Unit 2: Western Political Thought
    "Western Political Thought: Confucius", "Western Political Thought: Plato", "Western Political Thought: Aristotle", "Western Political Thought: Machiavelli", "Western Political Thought: Hobbes", "Western Political Thought: Locke", "Western Political Thought: Rousseau", "Western Political Thought: Hegel", "Western Political Thought: Mary Wollstonecraft", "Western Political Thought: John Stuart Mill", "Western Political Thought: Karl Marx", "Western Political Thought: Gramsci", "Western Political Thought: Hannah Arendt", "Western Political Thought: Frantz Fanon", "Western Political Thought: Mao Zedong", "Western Political Thought: John Rawls",
    
    // Unit 3: Indian Political Thought
    "Indian Pol Thought: Dharamshastra", "Indian Pol Thought: Kautilya", "Indian Pol Thought: Aggannasutta", "Indian Pol Thought: Barani", "Indian Pol Thought: Kabir", "Indian Pol Thought: Pandita Ramabai", "Indian Pol Thought: Bal Gangadhar Tilak", "Indian Pol Thought: Swami Vivekananda", "Indian Pol Thought: Rabindranath Tagore", "Indian Pol Thought: M.K. Gandhi", "Indian Pol Thought: Sri Aurobindo", "Indian Pol Thought: Periyar E.V. Ramasamy", "Indian Pol Thought: Muhammad Iqbal", "Indian Pol Thought: M.N. Roy", "Indian Pol Thought: V.D. Savarkar", "Indian Pol Thought: Dr. B.R. Ambedkar", "Indian Pol Thought: J.L. Nehru", "Indian Pol Thought: Ram Manohar Lohia", "Indian Pol Thought: Jaya Prakash Narayan", "Indian Pol Thought: Deendayal Upadhyaya",
    
    // Unit 4: Comparative Politics
    "Comparative Politics: Approaches", "Comparative Politics: Colonialism and Decolonization", "Comparative Politics: Nationalism", "Comparative Politics: State Theory", "Comparative Politics: Political Regimes", "Comparative Politics: Constitutions and Constitutionalism", "Comparative Politics: Democratization", "Comparative Politics: Development", "Comparative Politics: Structures of Power", "Comparative Politics: Actor and Processes", "Comparative Politics: Electoral Systems", "Comparative Politics: Party Systems",
    
    // Unit 5: International Relations
    "International Relations: Approaches", "International Relations: Conflict and Peace", "International Relations: United Nations", "International Relations: Political Economy", "International Relations: Regional Organizations", "International Relations: Contemporary Challenges", "International Relations: Realism", "International Relations: Liberalism",
    
    // Unit 6: India's Foreign Policy
    "India's Foreign Policy: Principles", "India's Foreign Policy: Non-Alignment", "India's Foreign Policy: Changing Relations with Major Powers", "India's Foreign Policy: Engagement with Multipolar World", "India's Foreign Policy: Neighbours", "India's Foreign Policy: Nuclear Doctrine",
    
    // Unit 7: Political Institutions in India
    "Indian Govt: Constituent Assembly", "Indian Govt: Preamble", "Indian Govt: Fundamental Rights", "Indian Govt: Directive Principles", "Indian Govt: Parliament", "Indian Govt: Executive", "Indian Govt: Judiciary", "Indian Govt: Federalism", "Indian Govt: Election Commission", "Indian Govt: CAG", "Indian Govt: Constitutional Amendment",
    
    // Unit 8: Political Processes in India
    "Political Processes: State, Economy and Development", "Political Processes: Identity Politics", "Political Processes: Social Movements", "Political Processes: Civil Society", "Political Processes: Regionalisation of Indian Politics", "Political Processes: Gender and Politics", "Political Processes: Ideology and Social Basis of Parties",
    
    // Unit 9: Public Administration
    "Public Admin: Theories and Concepts", "Public Admin: Scientific Management", "Public Admin: Human Relations", "Public Admin: Rational Choice", "Public Admin: New Public Management", "Public Admin: Good Governance", "Public Admin: E-Governance",
    
    // Unit 10: Governance and Public Policy in India
    "Governance: Accountability and Control", "Governance: Institutional Mechanisms for Good Governance", "Governance: Grassroots Governance", "Governance: Planning and Development", "Governance: Public Policy", "Governance: Monitoring and Evaluation"
];

// 3. WORKER: Generate & Post 1 Question
async function postSingleTelegramQuestion(count) {
    try {
        const bot = getBot(); 
        if (!bot) return; 

        const topic = POL_SCI_TOPICS[Math.floor(Math.random() * POL_SCI_TOPICS.length)];
        const channelId = "@saraswatiugcnet"; // <--- VERIFY THIS ID

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = `
            Act as a UGC NET Political Science Question Setter (June 2025 Pattern).
            Create 1 Question about: "${topic}".

            STYLE GUIDE (Strictly follow June 2025 Paper):
            1. **Focus**: Books & Authors, Chronology (Years), Articles of Constitution, Direct Definitions.
            2. **Difficulty**: Moderate/Factual (Avoid overly complex Assertion-Reasoning).
            3. **Conciseness**: Keep text short for Telegram.

            OUTPUT JSON (Must use these exact keys):
            {
                "q_en": "Question in English",
                "q_hi": "Question in Hindi (Devanagari)",
                "options_en": ["Opt A", "Opt B", "Opt C", "Opt D"],
                "options_hi": ["Hindi A", "Hindi B", "Hindi C", "Hindi D"],
                "correct_index": 0,
                "expl_en": "Reason in English",
                "expl_hi": "Reason in Hindi"
            }
        `;

        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Robust JSON Parsing
        let qData;
        try {
            qData = JSON.parse(text);
        } catch (e) {
            // Fallback: If AI fails to give valid JSON, try to extract it
            const match = text.match(/\{[\s\S]*\}/);
            if (match) qData = JSON.parse(match[0]);
            else throw new Error("AI returned invalid JSON");
        }

        // --- CODE-LEVEL COMBINATION ---
        
        // A. Combine Question
        let finalQuestion = `[#${count}] ${qData.q_en}\n${qData.q_hi}`;
        if (finalQuestion.length > 295) finalQuestion = finalQuestion.substring(0, 292) + "...";

        // B. Combine Options
        const finalOptions = qData.options_en.map((optEn, i) => {
            const optHi = qData.options_hi[i] || "";
            let combined = `${optEn} / ${optHi}`;
            if (combined.length > 95) return combined.substring(0, 92) + "...";
            return combined;
        }).slice(0, 4);

        // C. Combine Explanation
        let finalExpl = `${qData.expl_en}\n${qData.expl_hi}`;
        if (finalExpl.length > 195) finalExpl = finalExpl.substring(0, 192) + "...";

        // 3. SEND QUIZ
        await bot.sendPoll(
            channelId, 
            finalQuestion, 
            finalOptions, 
            {
                type: 'quiz', 
                correct_option_id: qData.correct_index,
                explanation: finalExpl,
                is_anonymous: true 
            }
        );
        console.log(`✅ Posted Quiz Q${count} to Telegram: ${topic}`);

    } catch (error) {
        console.error("❌ Telegram Post Failed:", error.message);
    }
}

// 4. BATCH RUNNER
async function startBatch(batchName) {
    console.log(`🚀 Starting ${batchName} Batch (10 Questions)...`);
    for (let i = 1; i <= 10; i++) {
        await postSingleTelegramQuestion(i);
        // Wait 20 seconds between posts
        await new Promise(r => setTimeout(r, 20000));
    }
    console.log(`🏁 ${batchName} Batch Complete.`);
}

// 5. SCHEDULE (IST TIMEZONE)
cron.schedule('0 9 * * *', () => startBatch("Morning"), { 
    scheduled: true, 
    timezone: "Asia/Kolkata" 
});

cron.schedule('0 19 * * *', () => startBatch("Evening"), { 
    scheduled: true, 
    timezone: "Asia/Kolkata" 
});


app.use((error, req, res, next) => {
    console.error('Unhandled Error:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
});


// 13. 404 HANDLER (MUST BE LAST)
app.use('*', (req, res) => {
    // Handle API 404s
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }

    // Handle Admin 404s
    if (req.originalUrl.startsWith('/admin')) {
        // If they try to access an old .html file, send to new login
        if (req.originalUrl.endsWith('.html')) {
            return res.redirect('/admin/login');
        }
        // Otherwise, show a proper admin 404 page
        return res.status(404).render('admin/admin-404', { 
            title: 'Page Not Found', 
            page: '' 
        });
    }


    // Handle all other 404s
    res.status(404).render('404', { title: 'Page Not Found' });
});


// 14. START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Professional UGC NET Platform running on port ${PORT}`);
    const initTelegramQuiz = require('./telegramWorker');
    initTelegramQuiz();
});
