// public/js/payment.js - FINAL FIXED VERSION
document.addEventListener('DOMContentLoaded', () => {
    // --- FIX 1: Corrected Button ID ---
    const enrollButton = document.getElementById('buy-now-btn');
    if (!enrollButton) return;

    // --- Data is now pulled directly from the button attributes ---
    const courseId = enrollButton.dataset.courseId;
    const coursePrice = parseFloat(enrollButton.dataset.coursePrice);
    const courseTitle = enrollButton.dataset.courseTitle;
    const razorpayKey = enrollButton.dataset.razorpayKey;
    
    // User data is still necessary
    const user = window.AppConfig?.USER;

    // --- Prerequisite Check ---
    if (!user) {
        enrollButton.textContent = 'Login to Enroll';
        enrollButton.addEventListener('click', () => {
            window.location.href = '/login';
        });
        return;
    }

    // Attach the correct handler with all necessary data passed directly
    // Attach the correct handler with all necessary data passed directly
    enrollButton.addEventListener('click', () => {
        handleEnrollment(enrollButton, courseId, coursePrice, courseTitle, user, razorpayKey);
    });

    // --- NEW: AUTO-OPEN PAYMENT IF COMMANDED ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'true') {
        enrollButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening Secure Payment...';
        enrollButton.style.pointerEvents = 'none'; // Prevent double clicking
        
        // Wait exactly 800ms to ensure the page and Razorpay scripts are fully loaded, then click!
        setTimeout(() => {
            enrollButton.style.pointerEvents = 'auto';
            enrollButton.click();
        }, 800);
    }
});


async function handleEnrollment(button, courseId, coursePrice, courseTitle, user, razorpayKey) {
    if (coursePrice === 0) {
        // --- HANDLE FREE ENROLLMENT ---
        await enrollFree(courseId, button, courseTitle); // Pass courseTitle for better messaging
    } else {
        // --- HANDLE PAID ENROLLMENT ---
        await createRazorpayOrder(button, courseId, coursePrice, courseTitle, user, razorpayKey);
    }
}

async function enrollFree(courseId, button, courseTitle) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enrolling...';
    
    try {
        const response = await fetch('/api/courses/enroll-free', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (window.showToast) window.showToast(`Successfully enrolled in ${courseTitle}!`, 'success');
            setTimeout(() => window.location.reload(), 1500); // Reload to see "Go to Dashboard"
        } else {
            if (window.showToast) window.showToast(result.message || 'Enrollment failed', 'error');
            button.disabled = false;
            button.textContent = 'Enroll for Free';
        }
    } catch (error) {
        if (window.showToast) window.showToast('Network error. Please try again.', 'error');
        button.disabled = false;
        button.textContent = 'Enroll for Free';
    }
}

async function createRazorpayOrder(button, courseId, coursePrice, courseTitle, user, razorpayKey) {
    if (!razorpayKey) {
        console.error('Razorpay Key is missing.');
        if (window.showToast) window.showToast('Payment configuration error.', 'error');
        return;
    }
    
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // 1. Create Order
        const orderResponse = await fetch('/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId })
        });

        if (!orderResponse.ok) throw new Error('Failed to create payment order.');
        const { order } = await orderResponse.json();

        // 2. Configure Razorpay Options
       // 2. Configure Razorpay Options
        const options = {
            key: razorpayKey,
            amount: order.amount,
            currency: "INR",
            name: "Saraswati UGC NET",
            description: `Enrollment for ${courseTitle}`, 
            order_id: order.id,
            handler: async (response) => {
                // 3. Verify Payment
                await verifyPayment(response, courseId);
            },
            prefill: {
                name: user.fullname,
                email: user.email,
                contact: user.phone || ''
            },
            theme: {
                color: '#4F46E5' 
            },
            // --- NEW FIX: Handle when the user closes the payment window ---
            modal: {
                ondismiss: function() {
                    // 1. Reset the button text and re-enable it
                    button.disabled = false;
                    button.innerHTML = `<i class="fas fa-lock-open"></i> Join Test Series — ₹${coursePrice}`;
                    
                    // 2. Remove '?checkout=true' from the URL so it doesn't auto-open if they refresh the page
                    const url = new URL(window.location);
                    url.searchParams.delete('checkout');
                    window.history.replaceState({}, '', url);
                }
            }
        };

        // 4. Open Razorpay Checkout
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (response) => {
            console.error(response.error);
            if (window.showToast) window.showToast(response.error.description || 'Payment failed.', 'error');
            button.disabled = false;
            button.textContent = `Buy Now for ₹${coursePrice}`;
        });
        
        rzp.open();

    } catch (error) {
        console.error('Payment Error:', error);
        if (window.showToast) window.showToast('Could not initiate payment. Please try again.', 'error');
        button.disabled = false;
        button.textContent = `Buy Now for ₹${coursePrice}`;
    }
}

async function verifyPayment(paymentResponse, courseId) {
    try {
        const verifyResponse = await fetch('/api/payment/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                courseId: courseId
            })
        });

        const result = await verifyResponse.json();
        
        if (result.success) {
            if (window.showToast) window.showToast('Enrollment successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } else {
            if (window.showToast) window.showToast(result.message || 'Payment verification failed.', 'error');
        }
    } catch (err) {
        if (window.showToast) window.showToast('Payment verification failed. Please contact support.', 'error');
    }
}
