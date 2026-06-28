/* --- FILE: public/js/auth.js --- */

class AuthManager {
    constructor() {
        this.signupForm = document.getElementById('signupForm');
        this.loginForm = document.getElementById('loginForm');
        this.forgotPasswordForm = document.getElementById('forgotPasswordForm');
        this.resetPasswordForm = document.getElementById('resetPasswordForm');
        this.init();
    }

    init() {
        if (this.signupForm) this.setupSignupForm();
        if (this.loginForm) this.setupLoginForm();
        if (this.forgotPasswordForm) this.setupForgotPasswordForm();
        if (this.resetPasswordForm) this.setupResetPasswordForm();
    }

    // --- Login Handler ---
    setupLoginForm() {
        this.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = this.loginForm.querySelector('button[type="submit"]');
            this.toggleButtonState(submitBtn, true, 'Logging In...');

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('email').value.trim(),
                        password: document.getElementById('password').value,
                    }),
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || 'Login failed');
                }

                showToast('Login successful! Redirecting...', 'success');
                
                setTimeout(() => {
                    window.location.href = '/dashboard'; // Redirect to dashboard
                }, 1000);

            } catch (error) {
                console.error('Login error:', error);
                showToast(error.message || 'Login failed. Please check your credentials.', 'error');
                this.toggleButtonState(submitBtn, false);
            }
        });
    }

    // --- Signup Handler (UPDATED) ---
    setupSignupForm() {
        this.signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = this.signupForm.querySelector('button[type="submit"]');
            
            // 1. Basic Validation to prevent "null" errors
            const requiredIds = ['fullname', 'email', 'phone', 'dob', 'highestQualification', 'subject', 'collegeUniversity', 'password'];
            for (const id of requiredIds) {
                if (!document.getElementById(id)) {
                    console.error(`Missing element with ID: ${id}`);
                    showToast('Form Error: Missing field ' + id, 'error');
                    return;
                }
            }

            this.toggleButtonState(submitBtn, true, 'Creating Account...');

            // 2. Gather Data (Matches your new signup.ejs IDs)
            const formData = {
                fullname: document.getElementById('fullname').value.trim(),
                email: document.getElementById('email').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                dob: document.getElementById('dob').value,
                // Handle Gender separately as it might not be selected
                gender: document.getElementById('gender') ? document.getElementById('gender').value : '', 
                // Updated from 'education' to 'highestQualification'
                highestQualification: document.getElementById('highestQualification').value, 
                // New Fields
                subject: document.getElementById('subject').value.trim(),
                collegeUniversity: document.getElementById('collegeUniversity').value.trim(),
                password: document.getElementById('password').value
            };

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || 'Signup failed');
                }

                showToast(result.message || 'Account created successfully!', 'success');
                setTimeout(() => window.location.href = '/dashboard', 1500);

            } catch (error) {
                console.error('Signup error:', error);
                showToast(error.message || 'Signup failed. Please try again.', 'error');
                this.toggleButtonState(submitBtn, false);
            }
        });
    }
    
    // --- Forgot Password Handler ---
    setupForgotPasswordForm() {
        this.forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = this.forgotPasswordForm.querySelector('button[type="submit"]');
            this.toggleButtonState(submitBtn, true, 'Sending...');

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showToast(result.message, 'success');
                this.forgotPasswordForm.reset();

            } catch (error) {
                showToast(error.message || 'Failed to send reset link.', 'error');
            } finally {
                this.toggleButtonState(submitBtn, false);
            }
        });
    }

    // --- Reset Password Handler ---
    setupResetPasswordForm() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
            // Only show this error if we are actually on the reset password page
            if (this.resetPasswordForm) showToast('Invalid or missing reset token.', 'error');
            return;
        }

        this.resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = this.resetPasswordForm.querySelector('button[type="submit"]');
            this.toggleButtonState(submitBtn, true, 'Resetting...');

            try {
                const newPassword = document.getElementById('newPassword').value;
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                showToast(result.message, 'success');
                setTimeout(() => window.location.href = '/login', 2000);

            } catch (error) {
                showToast(error.message || 'Password reset failed.', 'error');
                this.toggleButtonState(submitBtn, false);
            }
        });
    }

    toggleButtonState(button, isLoading, loadingText = 'Loading...') {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || button.innerHTML;
            button.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});