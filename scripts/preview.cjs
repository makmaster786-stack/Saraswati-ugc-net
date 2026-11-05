/** Local-only interactive preview. No database, emails, AI calls or payment gateway. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ejs = require(process.env.EJS_MODULE || 'ejs');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PREVIEW_PORT || 4175);
const sessions = new Map();
const courses = [
  {_id:'paper1',title:'Paper 1: Start with the essentials',category:'Paper 1',price:0,duration:'Self-paced',thumbnail:'/images/paper1-course.jpeg',shortDescription:'Build a foundation in teaching, research and reasoning with a short practice test.'},
  {_id:'polsci',title:'Political Science: Concepts to confidence',category:'Political Science',price:999,originalPrice:1499,duration:'12 weeks',thumbnail:'/images/course-thumbnail.jpg',shortDescription:'Connect the ideas behind political theory, institutions and international relations.'},
  {_id:'practice',title:'UGC NET practice and revision series',category:'Test Series',price:499,duration:'8 weeks',thumbnail:'/images/course-placeholder.jpg',shortDescription:'Develop a steady practice routine and use every result to plan your next session.'}
].map(c=>({...c,isPublished:true,lessons:5,description:c.shortDescription,rating:0,reviewCount:0}));
const questionData = [
 ['Which approach encourages active learning?','कौन सा तरीका सक्रिय अधिगम को प्रोत्साहित करता है?',['Group discussion','Only copying notes','Silent attendance','Memorising without understanding'],0,'Group discussion encourages learners to participate and exchange ideas.'],
 ['What is the main purpose of a research hypothesis?','शोध परिकल्पना का मुख्य उद्देश्य क्या है?',['To replace evidence','To state a testable prediction','To guarantee the result','To remove the research question'],1,'A hypothesis is a proposed, testable explanation or prediction.'],
 ['Which measure is the middle value of an ordered data set?','क्रमबद्ध आँकड़ों का मध्य मान क्या कहलाता है?',['Mean','Mode','Median','Range'],2,'The median is the middle value after the observations are ordered.'],
 ['Which of these is a primary source?','इनमें से प्राथमिक स्रोत कौन सा है?',['A textbook summary','A review article','A commentary','An original interview transcript'],3,'An original interview transcript records first-hand evidence.'],
 ['Which practice helps evaluate an online claim?','ऑनलाइन दावे का मूल्यांकन करने में कौन सा अभ्यास सहायक है?',['Checking the original source','Counting likes only','Sharing it immediately','Ignoring the date'],0,'Examining the original source helps establish context and evaluate evidence.']
];
const questions = questionData.map((q,i)=>({_id:'q'+i,paper:'Paper 1',unit:'Teaching Aptitude',questionText:{english:q[0],hindi:q[1]},options:q[2].map(s=>({english:s,hindi:s})),correctAnswerIndex:q[3],explanation:{english:q[4],hindi:q[4]}}));
const tests = [{_id:'intro',title:'Paper 1 — a five-question practice session',paper:'Paper 1',difficulty:'Easy',duration:10,isFree:true,course:courses[0],questions,totalMarks:10,createdAt:'2026-09-01'}];
const articles = [{_id:'study-routine',slug:'build-a-study-routine',title:'Build a study routine you can keep',category:'Study skills',tags:['Study skills'],keywords:'study preparation revision',metaDescription:'A simple way to turn a syllabus into a repeatable weekly routine.',author:'Saraswati UGC NET',createdAt:'2026-09-01',publishedAt:'2026-09-01',readTime:3,content:'<p>This sample article demonstrates the study library in the local preview.</p><h2>Begin with one topic</h2><p>Choose a manageable topic, read actively and write a short summary in your own words.</p><h2>Practise and review</h2><p>Follow your study session with a few practice questions. Review the reasoning behind both correct and incorrect answers.</p><h2>Return to difficult ideas</h2><p>Use your results to choose what to revisit in your next session.</p>'}];
function makeSession(){const id=crypto.randomBytes(18).toString('hex');const s={user:{_id:'preview-student',fullname:'Aarushi Sharma',email:'student@example.test',avatar:'/images/default-avatar.svg',enrolledCourses:['paper1'],isProfileComplete:true},results:[],attempts:{}};sessions.set(id,s);return {id,s};}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
function redirect(res,url){res.writeHead(302,{Location:url});res.end();}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>1e6)throw Error('Request too large');}return text?JSON.parse(text):{};}
function render(res,name,locals={},status=200){
 const file=path.join(root,'views',name+'.ejs');
 let html=ejs.render(fs.readFileSync(file,'utf8'),locals,{filename:file});
 // This local-only server never loads payment/analytics/third-party editor scripts.
 html=html.replace(/<script\b[^>]*src="https:\/\/[^\"]*"[^>]*>\s*<\/script>/g, tag => tag.includes('/Chart.js/') ? tag : '');
 const notice='<aside class="preview-notice" aria-label="Local preview"><strong>LOCAL DEMO</strong><span>Sample data · no real payments</span><a href="/">Home</a><a href="/__preview/login">Student demo</a><a href="/admin/dashboard">Admin</a><button type="button" aria-label="Hide preview notice" onclick="this.parentElement.remove()">×</button></aside>';
 html=html.replace('</body>',notice+'<script src="/__preview/client.js"></script></body>');
 res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end(html);
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');const p=url.pathname;
  const sid=(req.headers.cookie||'').match(/(?:^|;\s*)preview_session=([a-f0-9]+)/)?.[1];let session=sessions.get(sid);
  if(p==='/__preview/login'){const created=makeSession();res.setHeader('Set-Cookie',`preview_session=${created.id}; HttpOnly; SameSite=Lax; Path=/`);return redirect(res,'/dashboard');}
  if(p==='/__preview/client.js'){
   res.setHeader('Content-Type','text/javascript');return res.end(`
    localStorage.setItem('adminAuthToken','local-preview-only');
    if(location.pathname.startsWith('/admin')){const css=document.createElement('link');css.rel='stylesheet';css.href='/css/learning-platform.css';document.head.appendChild(css);}
    if(document.querySelector('.auth-page')){const form=document.querySelector('form');if(form){const info=document.createElement('div');info.style='padding:16px;background:#fff8e8;border-radius:10px;margin-bottom:16px;font:14px/1.6 system-ui';info.innerHTML='This is a local demo. Do not enter real credentials. <a href="/__preview/login">Enter the sample student account →</a>';form.before(info);form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='/__preview/login';},true);}}
    document.addEventListener('click',e=>{if(e.target.closest('.enroll-btn[data-course-price]:not([data-course-price="0"]), #buy-now-btn:not([data-course-price="0"])')){e.preventDefault();e.stopImmediatePropagation();window.showToast?.('Paid checkout is disabled in this local demo. Try the free Paper 1 course.','info');}},true);
   `);
  }
  if(p.startsWith('/api/')){
   if(p==='/api/auth/logout'){res.setHeader('Set-Cookie','preview_session=; Max-Age=0; Path=/');return json(res,{success:true});}
   if(p==='/api/courses'){
    let list=[...courses];const q=url.searchParams;const search=(q.get('search')||'').toLowerCase();
    if (['video','tests'].includes(q.get('format'))) list=list.filter(c => (c.deliveryType === 'tests' || (c.deliveryType !== 'video' && /test|series|mock/i.test(c.title+' '+c.category))) === (q.get('format') === 'tests'));
    list=list.filter(c=>(!search||(c.title+' '+c.category).toLowerCase().includes(search))&&(!q.get('category')||q.get('category')==='all'||q.get('category')===c.category)&&(!q.get('price')||q.get('price')==='all'||(q.get('price')==='free'?c.price===0:c.price>0)));
    if(q.get('sort')==='price-low')list.sort((a,b)=>a.price-b.price);if(q.get('sort')==='price-high')list.sort((a,b)=>b.price-a.price);
    return json(res,{success:true,courses:list,totalPages:1,total:list.length});
   }
   if(p==='/api/articles')return json(res,{success:true,articles});
   if(p==='/api/tests')return json(res,{success:true,tests});
   if(p.startsWith('/api/admin/')){
    if(req.method!=='GET')return json(res,{success:false,message:'Admin changes are disabled in this local preview.'},403);
    const sample={_id:'sample',fullname:'Sample Student',email:'student@example.test',dateRegistered:'2026-09-01',enrolledCourses:[]};
    return json(res,{success:true,courses,tests,articles,resources:[],questions,students:[sample],users:[sample],user:sample,results:[],course:courses[0],test:tests[0],stats:{studentCount:1,courseCount:3,testCount:1,articleCount:1},pagination:{currentPage:1,totalPages:1,totalUsers:1,totalQuestions:5}});
   }
   if(!session)return json(res,{success:false,message:'Open the sample student account first.'},401);
   if(p==='/api/auth/ping')return json(res,{success:true});
   if(p==='/api/dashboard/stats'){
    const r=session.results;const average=r.length?Math.round(r.reduce((n,x)=>n+x.percentage,0)/r.length):0;
    return json(res,{success:true,stats:{testsTaken:r.length,averageScore:average,bestScore:Math.max(0,...r.map(x=>x.percentage)),enrolledCourses:session.user.enrolledCourses.length},enrolledCourses:courses.filter(c=>session.user.enrolledCourses.includes(c._id)).map(c=>({...c,courseId:c._id,progress:r.length?100:0,tests:tests.filter(t=>t.course._id===c._id)})),recentTests:r.map(x=>({...x,title:x.test.title}))});
   }
   if(p==='/api/courses/enroll-free'){const data=await body(req);const c=courses.find(c=>c._id===data.courseId&&c.price===0);if(!c)return json(res,{success:false,message:'Choose a free sample course.'},400);if(!session.user.enrolledCourses.includes(c._id))session.user.enrolledCourses.push(c._id);return json(res,{success:true,message:'Added to your demo dashboard.'});}
   if(/^\/api\/tests\/[^/]+\/start$/.test(p)){
    const id=crypto.randomBytes(8).toString('hex');const attempt={_id:id,test:tests[0],answers:[],remainingTime:600};session.attempts[id]=attempt;
    return json(res,{success:true,attempt:{...attempt,test:{...tests[0],questions:questions.map(({correctAnswerIndex,explanation,...q})=>q)}}});
   }
   const attemptMatch=p.match(/^\/api\/tests\/attempt\/([^/]+)\/(save|submit)$/);
   if(attemptMatch){const attempt=session.attempts[attemptMatch[1]];if(!attempt)return json(res,{success:false,message:'Start a new demo test.'},404);const data=await body(req);attempt.answers=data.answers||[];attempt.remainingTime=data.remainingTime||600;if(attemptMatch[2]==='save')return json(res,{success:true});
    if(attempt.resultId)return json(res,{success:true,resultId:attempt.resultId});
    const answers=questions.map(q=>{const a=attempt.answers.find(a=>a.questionId===q._id)||{};return {...a,questionId:q,selectedOptionIndex:a.selectedOptionIndex??null,isCorrect:a.selectedOptionIndex===q.correctAnswerIndex};});const score=answers.filter(a=>a.isCorrect).length;const result={_id:crypto.randomBytes(8).toString('hex'),test:tests[0],answers,score,totalQuestions:questions.length,percentage:score/questions.length*100,timeTaken:data.timeTaken||0,submittedAt:new Date().toISOString()};session.results.unshift(result);attempt.resultId=result._id;return json(res,{success:true,resultId:result._id});
   }
   if(p==='/api/results/my-results')return json(res,{success:true,results:session.results});
   if(p.startsWith('/api/results/')){const result=session.results.find(r=>r._id===p.split('/').pop());return json(res,result?{success:true,result}:{success:false,message:'Result not found.'},result?200:404);}
   return json(res,{success:false,message:'This action needs the configured backend and is not available in the local demo.'},400);
  }
  const protectedPages=['/dashboard','/available-tests','/take-test','/my-results','/my-payments','/resources','/custom-test'];
  if(protectedPages.includes(p)&&!session)return redirect(res,'/login');
  const scriptMap={'/dashboard':'dashboard-pro.js','/courses':'courses-pro.js','/login':'auth.js','/signup':'auth.js','/take-test':'test-interface.js','/my-results':'result-pro.js','/knowledge-base':'knowledge-pro.js'};
  const locals={title:'Saraswati UGC NET',script:scriptMap[p]?'/js/'+scriptMap[p]:null,user:session?.user||null,featuredCourses:courses,courses,tests,results:session?.results||[],payments:[],articles,resources:[],relatedArticles:[],canonicalUrl:'http://127.0.0.1:'+port+p};
  if(p==='/')return render(res,'index',locals);
  if(p.startsWith('/course/')){const course=courses.find(c=>c._id===p.split('/').pop());if(!course)return render(res,'404',locals,404);return render(res,'course-details',{...locals,course:{...course,fetchedTests:tests.filter(t=>t.course._id===course._id)},razorpayKeyId:'',razorpayKey:''});}
  if(p.startsWith('/article/'))return render(res,'article',{...locals,article:articles[0]});
  const pageMap={'/courses':'courses-pro','/dashboard':'dashboard','/available-tests':'available-tests','/take-test':'take-test','/my-results':'my-results','/my-payments':'my-payments','/knowledge-base':'knowledge-base','/articles':'articles','/about':'about','/contact':'contact','/login':'login','/signup':'signup','/resources':'resources','/custom-test':'custom-test','/forgot-password':'forgot-password'};
  if(pageMap[p])return render(res,pageMap[p],locals);
  if(p.startsWith('/admin/')){let name=p.split('/').pop();if(name==='pyq-manager')name='pyq';const filename=name.startsWith('edit-')?name:'admin-'+name;if(fs.existsSync(path.join(root,'views/admin',filename+'.ejs')))return render(res,'admin/'+filename,{...locals,script:null,page:name,testId:'intro',course:courses[0],test:tests[0]});}
  if(p==='/sitemap.xml'){res.setHeader('Content-Type','application/xml');return res.end('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://127.0.0.1:'+port+'/</loc></url></urlset>');}
  const base=p.startsWith('/admin/')?path.join(root,'admin'):path.join(root,'public');const rel=p.startsWith('/admin/')?p.slice(7):p.slice(1);const file=path.resolve(base,decodeURIComponent(rel));
  if(file.startsWith(base+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
   const mime={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});return fs.createReadStream(file).pipe(res);
  }
  return render(res,'404',locals,404);
 }catch(error){console.error(error);if(!res.headersSent)json(res,{success:false,message:'Local preview error: '+error.message},500);else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local sample-data preview: http://127.0.0.1:${port}\nStudent account: /__preview/login\nChanges reset when this process stops. No production services are connected.`));
