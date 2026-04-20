// Add this with your other API routes (e.g., after /api/auth/logout)
app.post('/api/profile/complete', protectStudent, async (req, res) => {
    try {
        const { phone, dob, education } = req.body;

        if (!phone || !dob || !education) {
            return res.status(400).json({ success: false, message: 'Please fill out all fields.' });
        }

        // Find the logged-in user and update them
        await User.findByIdAndUpdate(res.locals.user._id, {
            $set: {
                phone: phone,
                dob: new Date(dob),
                education: education
            }
        });

        res.json({ success: true, message: 'Profile updated successfully!' });

    } catch (error) {
        console.error('Profile complete error:', error);
        res.status(500).json({ success: false, message: 'Server error updating profile.' });
    }
});