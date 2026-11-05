const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../backend/server.js'), 'utf8');
function harness(claims, user, adminExists = true) {
  const context = { JWT_SECRET: 'test', console, jwt: { verify: () => claims },
    mongoose: { isValidObjectId: id => /^[a-f0-9]{24}$/.test(id) },
    Admin: { exists: async () => adminExists },
    User: { findById: () => ({ select: () => ({ lean: async () => user }) }), findByIdAndUpdate: () => ({ exec() {} }) },
    app: { use() {} } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const checkUser ='), source.indexOf('// --- PASTE THIS IN server.js ---')) + '\nthis.handlers = { checkUser, protectAdmin, protectAdminPage };', context);
  return context.handlers;
}
function response() { return { locals: {}, statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; }, clearCookie() { this.cleared = true; }, redirect(url) { this.redirected = url; } }; }
for (const [name, stored, supplied, allowed] of [
  ['current session', 'new', 'new', true], ['replaced device', 'new', 'old', false],
  ['revoked session', null, 'old', false], ['legacy token', 'new', undefined, false],
  ['missing session on both sides', null, undefined, false]
]) test(name, async () => {
  const res = response();
  await harness({ userId: 'student', sessionId: supplied }, { _id: 'student', activeSessionId: stored }).checkUser({ cookies: { authToken: 'token' } }, res, () => {});
  assert.equal(Boolean(res.locals.user), allowed);
});
for (const handler of ['protectAdmin', 'protectAdminPage']) {
  for (const [name, claims, exists, allowed] of [
    ['student token', { userId: 'student' }, true, false],
    ['deleted admin', { adminId: 'a'.repeat(24) }, false, false],
    ['valid admin', { adminId: 'a'.repeat(24) }, true, true]
  ]) test(`${handler}: ${name}`, async () => {
    let passed = false;
    await harness(claims, null, exists)[handler]({ cookies: { adminAuthToken: 'token' }, headers: {}, method: 'GET' }, response(), () => { passed = true; });
    assert.equal(passed, allowed);
  });
}
