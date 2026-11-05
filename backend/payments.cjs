const crypto = require('node:crypto');
function signatureValid(body, signature, secret) {
    if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    return crypto.timingSafeEqual(crypto.createHmac('sha256', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}
function capturedMatches(payment, order) {
    return payment.status === 'captured' && payment.order_id === order._id && payment.currency === order.currency && payment.amount === order.amount && !payment.amount_refunded;
}
module.exports = { signatureValid, capturedMatches, install };
function install({ app, mongoose, razorpay, Payment, Course, User, protectStudentApi, protectAdmin, protectAdminPage }) {
    const Order = mongoose.model('CheckoutOrder', new mongoose.Schema({
        _id: String, student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
        amount: Number, currency: String
    }, { timestamps: true }));
    const wrap = handler => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try { await handler(req, res); } catch (error) {
            console.error('Payment operation failed:', error.code || error.name);
            res.status(503).json({ success: false, message: 'Payment confirmation is temporarily unavailable. Do not pay again; retry confirmation or contact support.' });
        }
    };
    async function confirm(order, paymentId, signature = 'webhook') {
        const payment = await razorpay.payments.fetch(paymentId);
        if (!capturedMatches(payment, order)) return false;
        let record;
        try {
            record = await Payment.findOneAndUpdate({ razorpay_order_id: order._id }, { $setOnInsert: {
                student: order.student, course: order.course, razorpay_order_id: order._id,
                razorpay_payment_id: paymentId, razorpay_signature: signature,
                amount: order.amount / 100, status: 'success', accessStatus: 'pending'
            } }, { upsert: true, new: true, runValidators: true });
        } catch (error) {
            if (error.code !== 11000) throw error;
            record = await Payment.findOne({ razorpay_order_id: order._id });
        }
        if (!record || record.razorpay_payment_id !== paymentId || String(record.student) !== String(order.student) || String(record.course) !== String(order.course)) throw new Error('Payment conflict');
        // Retry this even when the receipt already exists: interrupted enrollment recovers.
        await User.updateOne({ _id: order.student, 'enrolledCourses.courseId': { $ne: order.course } }, {
            $push: { enrolledCourses: { courseId: order.course, enrolledAt: new Date() } }
        });
        return true;
    }
    app.post('/api/payment/create-order', protectStudentApi, wrap(async (req, res) => {
        if (!mongoose.isValidObjectId(req.body.courseId)) return res.status(400).json({ success: false, message: 'Invalid course.' });
        const course = await Course.findOne({ _id: req.body.courseId, isPublished: true });
        const amount = Math.round(Number(course?.price) * 100);
        if (!course || !Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ success: false, message: 'Course is unavailable for paid checkout.' });
        if (await User.exists({ _id: res.locals.user._id, 'enrolledCourses.courseId': course._id })) return res.status(409).json({ success: false, message: 'You already own this course.' });
        const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: crypto.randomUUID(), notes: { courseId: String(course._id), userId: String(res.locals.user._id) } });
        await Order.create({ _id: order.id, student: res.locals.user._id, course: course._id, amount, currency: 'INR' });
        res.json({ success: true, order });
    }));
    app.post('/api/payment/verify-payment', protectStudentApi, wrap(async (req, res) => {
        const { razorpay_order_id: id, razorpay_payment_id: paymentId, razorpay_signature: signature, courseId } = req.body;
        if (typeof id !== 'string' || typeof paymentId !== 'string' || !signatureValid(`${id}|${paymentId}`, signature, process.env.RAZORPAY_KEY_SECRET)) return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        const order = await Order.findById(id);
        if (!order || String(order.student) !== String(res.locals.user._id) || String(order.course) !== String(courseId)) return res.status(403).json({ success: false, message: 'Order does not belong to this purchase.' });
        if (!await confirm(order, paymentId, signature)) return res.status(409).json({ success: false, message: 'Payment is not captured yet. Do not pay again; confirmation will follow.' });
        res.json({ success: true, message: 'Payment confirmed. External class access will be arranged separately by the administrator.' });
    }));
    app.post('/api/payment/webhook', wrap(async (req, res) => {
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.sendStatus(503);
        if (!req.rawBody || !signatureValid(req.rawBody, req.headers['x-razorpay-signature'], process.env.RAZORPAY_WEBHOOK_SECRET)) return res.sendStatus(400);
        if (!['payment.captured', 'order.paid'].includes(req.body.event)) return res.sendStatus(200);
        const payment = req.body.payload?.payment?.entity;
        if (!payment?.order_id || !payment?.id) return res.sendStatus(400);
        const order = await Order.findById(payment.order_id);
        if (!order) return res.sendStatus(200); // Other products in the same gateway account.
        if (!await confirm(order, payment.id)) return res.sendStatus(409);
        res.sendStatus(200);
    }));
    app.get('/admin/payments', protectAdminPage, wrap(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const payments = await Payment.find({}).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).populate('student', 'fullname email phone').populate('course', 'title').lean();
        res.render('admin/admin-payments', { payments, currentPage: page, title: 'Payments & Class Access', page: 'payments' });
    }));
    app.post('/api/admin/payments/:id/access', protectAdmin, wrap(async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.id) || !['pending', 'granted'].includes(req.body.status)) return res.sendStatus(400);
        const payment = await Payment.findOneAndUpdate({ _id: req.params.id, status: 'success' }, { $set: { accessStatus: req.body.status, accessUpdatedAt: new Date(), accessUpdatedBy: req.adminId } }, { new: true });
        if (!payment) return res.sendStatus(404);
        res.json({ success: true });
    }));
}
