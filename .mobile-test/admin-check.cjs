const fs=require('fs'),path=require('path'),http=require('http');
const ejs=require('./ejs-v3.1.10/lib/ejs');
const {chromium}=require('C:/Users/ABC/AppData/Local/OpenAI/Codex/runtimes/cua_node/b63ee7ee40c23b77/bin/node_modules/playwright');
const functional=process.argv.includes('--functional');
const student={_id:'student1',fullname:'Sample Student',email:'long.student.email@example.test',phone:'1234567890',dateRegistered:'2026-01-01',enrolledCourses:[]};
const root=path.resolve(__dirname,'..');
const names=['dashboard','students','courses','tests','test-details','questions','knowledge-base','resources','pyq','edit-course','edit-test','login'];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');const name=url.pathname.split('/').pop();
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,users:[student],user:student,results:[],courses:[],tests:[],resources:[],articles:[],questions:[],data:[],pagination:{totalPages:1,currentPage:1,totalQuestions:0,totalUsers:1}}));}
 if(names.includes(name)){
  const file=path.join(root,'views/admin',(name.startsWith('edit-')?name:'admin-'+name)+'.ejs');
  try{res.setHeader('Content-Type','text/html');return res.end(ejs.render(fs.readFileSync(file,'utf8'),{page:name,title:name,script:null,testId:"sample",course:{_id:'course1',title:'Sample course',price:999},test:{_id:'test1',title:'Sample mock',questions:[],duration:60},courses:[]},{filename:file}));}catch(e){res.statusCode=500;return res.end(e.stack);}
 }
 const file=path.join(root,url.pathname);if(!file.startsWith(root)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(4174,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({hasTouch:true});
 await page.addInitScript(()=>{localStorage.setItem('adminAuthToken','local-fixture-only');window.tinymce={init:()=>Promise.resolve([]),get:()=>null};});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(!functional && u.pathname==='/admin/admin.js')return r.fulfill({body:'',contentType:'text/javascript'});return r.continue();});
 if(functional){
  const out=[];
  for(const width of [320,390,844]){
   await page.setViewportSize({width,height:width===844?390:844});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4174/admin/students');
   await page.locator('#studentsTable .view').waitFor();
   const row={width};
   row.tableScroll=await page.locator('#studentsTableElement').evaluate(e=>{const p=e.parentElement;p.scrollLeft=p.scrollWidth;return p.scrollLeft>0;});
   await page.locator('#studentsTable .view').tap();
   await page.waitForFunction(()=>document.querySelector('#modalStudentName').textContent==='Sample Student');
   row.detailsLoaded=true;
   row.dialogFits=await page.locator('#studentModal .modal-content').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth;});
   await page.locator('#closeStudentModal').tap();
   row.dialogClosed=await page.locator('#studentModal').evaluate(e=>e.classList.contains('hidden'));
   await page.goto('http://127.0.0.1:4174/admin/resources');
   const picker=page.waitForEvent('filechooser');await page.locator('#fileUploadArea').tap();
   await (await picker).setFiles({name:'Sample-course-notes-with-a-long-filename.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 local fixture')});
   row.fileSelected=await page.locator('#fileInfo').isVisible();
   await page.locator('#fileInfo .btn-remove').tap();
   row.fileCleared=await page.locator('#resourceFile').evaluate(e=>e.files.length===0);
   await page.goto('http://127.0.0.1:4174/admin/knowledge-base');
   row.singleAdminScript=await page.locator('script[src="/admin/admin.js"]').count()===1;
   await page.locator('#sidebarToggleBtn').tap();await page.keyboard.press('Escape');
   row.drawerClosed=await page.locator('#admin-sidebar').evaluate(e=>e.inert);
   row.errors=errors;
   out.push(row);
  }
  console.log(JSON.stringify(out,null,2));fs.writeFileSync(path.join(__dirname,'admin-functional-report.json'),JSON.stringify(out,null,2));
  await browser.close();server.close();return;
 }
 const results=[];
 async function overflow(){return page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||s.visibility==='hidden'||e.closest('.sidebar'))return false;
  if(r.left>=-1&&r.right<=innerWidth+1)return false;
  for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){if(['auto','scroll','hidden'].includes(getComputedStyle(p).overflowX))return false;}return true;
 }).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,id:e.id,right:Math.round(e.getBoundingClientRect().right)})));}
 for(const width of [320,390,768,844,1280]){
  await page.setViewportSize({width,height:width===844?390:844});
  for(const name of names){
   console.log('Admin '+name+' '+width);
   const errors=[];const handler=e=>errors.push(e.message);page.on('pageerror',handler);
   const response=await page.goto('http://127.0.0.1:4174/admin/'+name+'?id=sample');
   if(response.status()!==200){results.push({name,width,error:await page.locator('body').innerText()});page.off('pageerror',handler);continue;}
   await page.waitForTimeout(100);
   await page.locator('table tbody').evaluateAll(es=>es.forEach(el=>{const count=el.closest('table').querySelectorAll('thead th').length||4;el.innerHTML='<tr>'+Array.from({length:count},(_,i)=>'<td>'+(i===0?'Sample Political Science Course':i===1?'student.long.email@example.test':'Published / Edit')+'</td>').join('')+'</tr>';}));
   const row={name,width,errors,overflow:await overflow()};
   if(name!=='login'){
    await page.locator('#sidebarToggleBtn').tap();await page.waitForTimeout(350);
    row.drawer=await page.locator('#admin-sidebar').evaluate(e=>!e.inert&&e.getBoundingClientRect().left===0);
    await page.keyboard.press('Escape');row.drawerClosed=await page.locator('#admin-sidebar').evaluate(e=>e.inert);
    await page.locator('#sidebarToggleBtn').tap();await page.waitForTimeout(350);
    await page.locator('#sidebarOverlay').tap({position:{x:width-5,y:100}});row.overlayClose=await page.locator('#admin-sidebar').evaluate(e=>e.inert);
   }
   if(['questions','students'].includes(name)){
    const modal=page.locator(name==='questions'?'#fullEditModal':'#studentModal');
    await modal.evaluate(e=>{e.classList.remove('hidden');e.style.display='flex';});
    row.modalOverflow=await overflow();
    row.modal=await modal.locator('.modal-content').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight}});
    if(width===390)await page.screenshot({path:path.join(__dirname,'admin-'+name+'-modal.png')});
    await modal.evaluate(e=>e.style.display='none');
   }
   if(width===390)await page.screenshot({path:path.join(__dirname,'admin-'+name+'.png'),fullPage:true});
   results.push(row);page.off('pageerror',handler);
  }
 }
 fs.writeFileSync(path.join(__dirname,'admin-report.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.filter(r=>r.error||r.errors.length||r.overflow.length||r.modalOverflow?.length||r.drawer===false||r.drawerClosed===false),null,2));
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
