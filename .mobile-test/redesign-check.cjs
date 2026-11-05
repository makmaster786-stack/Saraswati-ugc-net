const { chromium }=require('C:/Users/ABC/AppData/Local/OpenAI/Codex/runtimes/cua_node/b63ee7ee40c23b77/bin/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});
 const issues=[];page.on('pageerror',e=>issues.push({url:page.url(),message:e.message}));page.on('dialog',d=>d.accept());
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'&&r.request().resourceType()==='script')return r.abort();return r.continue();});
 const pages=['/','/courses','/course/paper1','/login','/articles','/article/build-a-study-routine','/knowledge-base','/about','/contact'];
 const checks=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const url of pages){
   const response=await page.goto('http://127.0.0.1:4175'+url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
   await page.locator('.preview-notice').evaluateAll(es=>es.forEach(e=>e.remove()));
   checks.push({width,url,status:response.status(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
   if(url==='/'||url==='/courses')await page.screenshot({path:path.join(__dirname,'redesign-'+(url==='/'?'home':'courses')+'-'+width+'.png'),fullPage:true});
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:4175/courses');
 await page.locator('#course-search').fill('Political');await page.waitForTimeout(650);
 checks.push({flow:'course search',cards:await page.locator('#courses-container .course-card-pro').count(),text:await page.locator('#courses-container').innerText()});
 await page.goto('http://127.0.0.1:4175/__preview/login');
 await page.waitForFunction(()=>document.querySelector('#stats-enrolled-courses')?.textContent.trim()==='1');
 await page.locator('.preview-notice').evaluateAll(es=>es.forEach(e=>e.remove()));
 await page.screenshot({path:path.join(__dirname,'redesign-dashboard-390.png'),fullPage:true});
 await page.goto('http://127.0.0.1:4175/take-test?id=intro');
 await page.waitForFunction(()=>window.__testManager?._initComplete);
 await page.locator('#confirm-start-test').tap();await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
 await page.locator('.preview-notice').evaluateAll(es=>es.forEach(e=>e.remove()));
 for(let i=0;i<5;i++){
  await page.locator('#options-container .option-item').nth(i%4).tap();await page.locator('#save-next').tap();
  if(i<4)await page.waitForFunction(n=>window.__testManager.currentQuestionIndex===n,i+1);
 }
 await page.locator('#toggle-sidebar-btn').tap();await page.waitForTimeout(350);
 await page.locator('#submit-test').tap();await page.waitForFunction(()=>document.querySelector('#submit-modal').classList.contains('active'));
 await page.locator('#confirm-submit').tap();await page.waitForURL('**/my-results*');
 await page.waitForTimeout(600);
 checks.push({flow:'test submission',resultCards:await page.locator('.result-card-item').count(),url:page.url()});
 await page.locator('.preview-notice').evaluateAll(es=>es.forEach(e=>e.remove()));
 await page.screenshot({path:path.join(__dirname,'redesign-results-390.png'),fullPage:true});
 await page.goto('http://127.0.0.1:4175/dashboard');await page.waitForTimeout(500);
 checks.push({flow:'dashboard after test',tests:await page.locator('#stats-tests-taken').innerText(),average:await page.locator('#stats-avg-score').innerText()});
 console.log(JSON.stringify({checks,issues},null,2));fs.writeFileSync(path.join(__dirname,'redesign-report.json'),JSON.stringify({checks,issues},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
