const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const routes = ['/', '/courses', '/available-tests', '/login', '/articles', '/knowledge-base', '/about', '/contact', '/admin/login'];
(async () => {
  let failed = false;
  for (const route of routes) {
    try {
      const response = await fetch(base + route, { redirect: 'manual' });
      const ok = response.status >= 200 && response.status < 400;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${response.status} ${route}`);
      if (!ok) failed = true;
    } catch (error) { failed = true; console.log(`FAIL ${route} ${error.message}`); }
  }
  process.exitCode = failed ? 1 : 0;
})();
