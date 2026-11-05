/* Read-only deployment preflight. Run with: npm run production:check */
require('dotenv').config({ path: process.env.ENV_FILE || 'backend/.env' });
const checks = [
  ['MONGO_URI', process.env.MONGO_URI],
  ['JWT_SECRET', process.env.JWT_SECRET],
  ['RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID],
  ['RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET],
  ['RAZORPAY_WEBHOOK_SECRET', process.env.RAZORPAY_WEBHOOK_SECRET],
  ['FRONTEND_URL', process.env.FRONTEND_URL],
  ['EMAIL_USER', process.env.EMAIL_USER],
  ['EMAIL_PASS', process.env.EMAIL_PASS]
];
let failed = false;
for (const [name, value] of checks) {
  const ok = Boolean(value && String(value).trim());
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
if (process.env.NODE_ENV !== 'production') console.warn('WARN NODE_ENV is not production');
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) { failed = true; console.log('FAIL JWT_SECRET must be at least 32 characters'); }
if (process.env.FRONTEND_URL && !/^https:\/\//i.test(process.env.FRONTEND_URL)) console.warn('WARN FRONTEND_URL is not HTTPS');
console.log(failed ? 'Production check failed.' : 'Production configuration check passed.');
process.exitCode = failed ? 1 : 0;
