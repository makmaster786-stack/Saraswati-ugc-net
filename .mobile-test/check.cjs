const fs = require('fs');
const path = require('path');
const http = require('http');
const ejs = require('./ejs-v3.1.10/lib/ejs');
const { chromium } = require('C:/Users/ABC/AppData/Local/OpenAI/Codex/runtimes/cua_node/b63ee7ee40c23b77/bin/node_modules/playwright');
const functional = process.argv.includes('--functional');
const root = path.resolve(__dirname, '..');
const sampleTest = {_id:'test1',title:'Political Science: Constitutional Theory and Comparative Government',duration:60,questions:Array(50).fill({}),isFree:true,paper:'Paper 2',difficulty:'Medium',attempts:[]};
const course = {_id:'course1',title:'UGC NET Political Science Complete Preparation',category:'Political Science',price:999,originalPrice:1999,description:'Detailed bilingual lessons and practice tests for your UGC NET preparation.',fetchedTests:[sampleTest,sampleTest],duration:'6 months',lessons:50};
const user = {_id:'sample',fullname:'Sample Student',email:'student@example.test',enrolledCourses:['course1']};
const pages = ['index','login','signup','dashboard','courses-pro','course-details','available-tests','custom-test','knowledge-base','my-results','my-payments','about','contact','take-test'];
const fixtures = {title:'Home',script:'',user,featuredCourses:[course,course,course],courses:[course,course,course],course,tests:[sampleTest,sampleTest],results:[],payments:[],articles:[],resources:[],stats:{},test:sampleTest};
const server = http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
  if(url.pathname.endsWith('/start')) {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,attempt:{_id:'attempt1',remainingTime:3600,answers:[],test:{...sampleTest,questions:Array.from({length:50},(_,i)=>({_id:'q'+i,questionText:{english:'Question '+(i+1)+': Which option best describes this political science concept?',hindi:'प्रश्न '+(i+1)},options:['A','B','C','D'].map(x=>({english:'Option '+x,hindi:'विकल्प '+x}))}))}}}));}
 if(url.pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,data:[],courses:[],tests:[],results:[],resources:[],articles:[],units:[]}));}
 const name = url.pathname.slice(1) || 'index';
 if(pages.includes(name)) {
  try {res.setHeader('Content-Type','text/html');return res.end(ejs.render(fs.readFileSync(path.join(root,'views',name+'.ejs'),'utf8'),{...fixtures,script:name==='take-test'?'/js/test-interface.js':'',user:['index','login','signup'].includes(name)?null:user},{filename:path.join(root,'views',name+'.ejs')}));}
  catch(e){res.statusCode=500;return res.end(e.stack);}
 }
 const file = path.join(root,'public',url.pathname);
 if(!file.startsWith(path.join(root,'public'))||!fs.existsSync(file)) {res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/jpeg');
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page = await browser.newPage({hasTouch:true});
 page.on('dialog', d=>d.accept());
 await page.route('**/*', route=>{
  const u = new URL(route.request().url());
  if(u.hostname!=='127.0.0.1')return route.abort();
  // Isolate responsive templates and inline UI from database/payment code.
  if(u.pathname.startsWith('/js/') && u.pathname!=='/js/professional.js' && !(functional && u.pathname.startsWith('/js/test-interface')))return route.fulfill({body:'',contentType:'text/javascript'});
  return route.continue();
 });
 if(functional){
  const results=[];
  for(const width of [320,390,844]){
   await page.setViewportSize({width,height:width===844?390:844});
   await page.goto('http://127.0.0.1:4173/take-test?id=test1');
   await page.waitForFunction(()=>window.__testManager?._initComplete);
   await page.locator('#confirm-start-test').tap();
   await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
   await page.waitForTimeout(600);
   await page.locator('#options-container .option-item').first().tap();
   await page.locator('#save-next').tap();
   await page.waitForFunction(()=>document.querySelector('#current-q').textContent==='2');
   const row={width,saved:await page.evaluate(()=>window.__testManager.userAnswers[0].selectedOptionIndex===0)};
   await page.locator('#toggle-sidebar-btn').tap();await page.waitForTimeout(400);
   row.palette=await page.locator('#sidebar-panel').evaluate(e=>e.classList.contains('active'));
   row.overlay=await page.locator('#sidebar-overlay').evaluate(e=>e.classList.contains('active'));
   if(row.palette){
    await page.locator('.palette-btn[data-index="0"]').tap();
    await page.waitForFunction(()=>document.querySelector('#current-q').textContent==='1');
    row.answerRestored=await page.locator('#opt0').isChecked();
    await page.locator('#submit-test').tap();
    await page.waitForFunction(()=>document.querySelector('#submit-modal').classList.contains('active'));
    row.submitConfirmation=await page.locator('#submit-modal').evaluate(e=>e.classList.contains('active'));
    await page.locator('#cancel-submit').tap();
    row.submitCancelled=await page.locator('#submit-modal').evaluate(e=>!e.classList.contains('active'));
    await page.locator('#sidebar-overlay').tap({position:{x:5,y:200}});
    await page.waitForTimeout(400);
    await page.locator('#clear-response').tap();
    row.cleared=!(await page.locator('#opt0').isChecked());
    await page.locator('#mark-review').tap();
    await page.waitForFunction(()=>document.querySelector('#current-q').textContent==='2');
    row.marked=await page.evaluate(()=>window.__testManager.userAnswers[0].status==='marked-for-review');
   }
   await page.screenshot({path:path.join(__dirname,'exam-functional-'+width+'.png')});
   results.push(row);
   await page.evaluate(()=>{localStorage.clear();window.__testManager.currentAttemptId=null;});
  }
  console.log(JSON.stringify(results,null,2));
  fs.writeFileSync(path.join(__dirname,'functional-report.json'),JSON.stringify(results,null,2));
  await browser.close();server.close();return;
 }
 const report=[];
 for(const width of [320,360,390,430,768,844,1280]){
  await page.setViewportSize({width,height:width===844?390:844});
  for(const name of pages){
   console.log('Checking '+name+' at '+width);
   const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
   const response=await page.goto('http://127.0.0.1:4173/'+name);
   await page.waitForTimeout(160);
   await page.locator('#loading-spinner').evaluateAll(els=>els.forEach(e=>e.remove()));
   if(response.status()!==200){report.push({width,name,error:await page.locator('body').innerText()});continue;}
   const overflow=await page.evaluate(()=>[...document.body.querySelectorAll('*')].filter(e=>{
    const s=getComputedStyle(e), r=e.getBoundingClientRect();
    if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||e.closest('.mobile-menu,.sidebar-panel,.modal-overlay,.dropdown-menu,.toast-container'))return false;
    if(r.right<=innerWidth+1&&r.left>=-1)return false;
    let a=e.parentElement;while(a&&a!==document.body){if(['auto','scroll','hidden'].includes(getComputedStyle(a).overflowX))return false;a=a.parentElement;}
    return true;
   }).slice(0,10).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,45),right:Math.round(e.getBoundingClientRect().right)})));
   const row={width,name,overflow,errors};
   row.nav=await page.locator('.navbar-pro').evaluate(e=>({height:e.getBoundingClientRect().height,desktopLinks:getComputedStyle(e.querySelector('.nav-menu')).display}));
   if(name==='index'&&width<=1100){
    await page.locator('#hamburger-btn').click();
    await page.waitForTimeout(400);
    row.menu=await page.locator('#mobile-drawer').evaluate(e=>!e.inert&&e.getAttribute('aria-hidden')==='false'&&e.getBoundingClientRect().right<=innerWidth+1);
    await page.locator('#mobile-close-btn').click();
    row.menuClosed=await page.locator('#mobile-drawer').evaluate(e=>e.inert&&e.getAttribute('aria-hidden')==='true');
   }
   if(name==='take-test'){
    await page.locator('.modal-overlay').evaluateAll(es=>es.forEach(e=>e.classList.remove('active')));
    await page.locator('#question-text').evaluate(e=>e.textContent='Long bilingual practice question. '.repeat(150));
    row.exam=await page.evaluate(()=>({mainHeight:document.querySelector('main').getBoundingClientRect().height,viewport:innerHeight,buttons:[...document.querySelectorAll('.question-footer-pro button')].map(e=>{const r=e.getBoundingClientRect();return {id:e.id,visible:r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1,height:r.height,unobstructed:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),scrollable:document.querySelector('#question-scroll-area').scrollHeight>document.querySelector('#question-scroll-area').clientHeight}));
    if(width<=1024){await page.locator('#toggle-sidebar-btn').click();await page.waitForTimeout(400);row.palette=await page.locator('#sidebar-panel').evaluate(e=>{const r=e.getBoundingClientRect();return {active:e.classList.contains('active'),height:r.height,top:r.top,bottom:r.bottom};});await page.locator('#sidebar-overlay').click({position:{x:5,y:200}});await page.waitForTimeout(400);row.paletteClosed=await page.locator('#sidebar-panel').evaluate(e=>getComputedStyle(e).visibility==='hidden');}
   }
   if(width===390||name==='take-test'&&width===320)await page.screenshot({path:path.join(__dirname,`${name}-${width}.png`),fullPage:true});
   report.push(row);page.off('pageerror',listener);
  }
 }
 fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.filter(r=>r.error||r.overflow?.length||r.errors?.length||r.exam),null,2));
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});

