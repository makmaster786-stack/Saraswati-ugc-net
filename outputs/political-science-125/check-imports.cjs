const fs=require('node:fs/promises');const path=require('node:path');
const {parse}=require('../../backend/question-import.cjs');
(async()=>{
 const index=JSON.parse(await fs.readFile(path.join(__dirname,'test-index.json'),'utf8'));
 const seen=new Map();let count=0;
 for(const test of index){
  const file=path.join(__dirname,'Tests',test.filename);const result=await parse(await fs.readFile(file));
  if(result.errors.length||result.questions.length!==20)throw Error(`${test.filename}: ${result.errors.join('; ')}`);
  for(const question of result.questions){
   if(!/[\u0900-\u097f]/.test(question.questionText.hindi))throw Error('Missing Hindi question');
   if(!/[\u0900-\u097f]/.test(question.explanation.english)||question.explanation.hindi!=='')throw Error('Combined bilingual explanation mapping failed');
   if(question.unit!==test.unit||question.paper!=='Paper 2')throw Error('Incorrect unit / paper');
   const key=question.questionText.english.toLowerCase().replace(/[^a-z0-9]/g,'');
   if(seen.has(key))throw Error(`Repeated question: ${test.filename} / ${seen.get(key)}`);
   seen.set(key,test.filename);count++;
  }
 }
 await fs.writeFile(path.join(__dirname,'import-validation.json'),JSON.stringify({files:index.length,questions:count,errors:0,scope:'Actual website parser and structural/language checks; not human subject-expert verification'},null,2));
 console.log(`Passed website parser: ${index.length} files / ${count} bilingual questions`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
