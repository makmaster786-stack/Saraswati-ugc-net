# Payment deployment

Students purchase on this website. External classroom access is manually supplied by the administrator. Record fulfillment under `/admin/payments`; no external service is contacted by that action.

## Required before accepting money

- Configure server-only RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, MONGO_URI and a strong JWT_SECRET. Use test keys on staging; never expose secrets in browser code.
- Use HTTPS and NODE_ENV=production. Configure Razorpay automatic capture.
- Register `https://YOUR-DOMAIN/api/payment/webhook` for `payment.captured` and `order.paid`, with the matching webhook secret. Raw-body HMAC verification follows Razorpay's webhook validation requirements.
- Back up MongoDB. Review existing Payment records for duplicate order/payment IDs before creating unique indexes. Confirm both unique indexes exist in the deployed database; do not drop or deduplicate production records blindly.
- Publish your actual contact details, delivery timeframe, refund/cancellation policy, privacy policy and terms. No refund guarantee is assumed by this code.
- On staging, complete a Razorpay test purchase, verify the receipt and enrollment, close the browser before confirmation and check webhook recovery, replay a webhook, and verify another student's order is rejected. Confirm pending class access can be marked granted by admin only.
- Test database failure during enrollment, then retry the webhook and verify enrollment recovers without duplicate receipts.
- Monitor webhook failures in Razorpay and server errors. Refunds/disputes and external access revocation remain manual operations through Razorpay and your classroom application. Review those records before granting access.

Run local regression tests with Node 24:

    node --test --test-isolation=none scripts/auth-security.test.cjs scripts/payments.test.cjs

These tests mock gateway/database services; they do not certify live settlement, production indexes, email, backups, or your external classroom access. Existing orders created by the older checkout implementation are not in CheckoutOrder and require manual reconciliation, not automatic acceptance.
