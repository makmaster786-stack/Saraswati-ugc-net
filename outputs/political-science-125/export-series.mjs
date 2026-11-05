import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const require=createRequire(import.meta.url);
const importer=require('../../backend/question-import.cjs');
const dir=path.dirname(fileURLToPath(import.meta.url));
const working=path.resolve(dir,'../../research/political-science-120/working');
const output=path.join(dir,'Tests');
await fs.mkdir(output,{recursive:true});
const files=(await fs.readdir(path.join(working,'reviewed'))).filter(n=>/^test-\d{3}\.json$/.test(n)).sort();
if(!files.length)throw Error('No reviewed tests exist yet. Do not create empty test workbooks.');
const index=[];
function slug(s){return s.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');}
for(const file of files){
 const test=JSON.parse(await fs.readFile(path.join(working,'reviewed',file),'utf8'));
 if(test.questions.length!==20||test.questions.filter(q=>q.origin==='book').length>10)throw Error(`Test ${test.test_number}: invalid composition`);
 const bookCount=test.questions.filter(q=>q.origin==='book').length;
 const w=Workbook.create(),s=w.worksheets.add('Questions');
 s.showGridLines=false;s.freezePanes.freezeRows(1);
 const rows=test.questions.map(q=>[q.question_en,q.question_hi,...q.options_en.flatMap((o,i)=>[o,q.options_hi[i]]),
   'ABCD'[q.correct_index],`English:\n${q.explanation_en}\n\nहिंदी:\n${q.explanation_hi}`,'Paper 2',test.website_unit]);
 s.getRange('A1:N21').values=[importer.headers,...rows];
 s.getRange('A1:N21').format={font:{name:'Arial',size:11},wrapText:true,verticalAlignment:'top',columnWidth:23};
 s.getRange('A1:A21').format.columnWidth=65;s.getRange('B1:B21').format.columnWidth=75;
 s.getRange('L1:L21').format.columnWidth=110;s.getRange('N1:N21').format.columnWidth=30;
 s.getRange('A1:N1').format={fill:'#153D56',font:{bold:true,color:'#FFFFFF'},rowHeight:35};
 s.getRange('A2:N21').setNumberFormat('@');
 for(let i=0;i<rows.length;i++){
   const cellLines=rows[i].map((v,j)=>String(v).split('\n').reduce((total,line)=>total+Math.max(1,Math.ceil(line.length/([0,1].includes(j)?(j===0?65:50):j===11?82:24))),0));
   const range=s.getRange(`A${i+2}:N${i+2}`);
   range.format.rowHeight=Math.min(409,Math.max(90,Math.max(...cellLines)*18+15));
   if(i%2===0)range.format.fill='#F1F5F8';
 }
 s.getRange('K2:K21').dataValidation={rule:{type:'list',values:['A','B','C','D']}};
 s.getRange('M2:M21').dataValidation={rule:{type:'list',values:['Paper 1','Paper 2']}};
 const review=w.worksheets.add('Sources and review');review.showGridLines=false;
 const meta=[
 ['Test',`${String(test.test_number).padStart(3,'0')} - ${test.title}`],
 ['Unit',`${test.unit_number}: ${test.unit}`],['Focus',test.focus],
 ['Composition',`${test.questions.length} questions: ${bookCount} book-based, ${20-bookCount} newly authored practice questions`],
 ['Suggested duration','30 minutes (topic practice, not an official full-length exam simulation)'],
 ['Import','Use the Questions sheet unchanged. Create/select the intended test before uploading this file.'],
 ['Review status',test.review?.method||'Locally authored draft; review answers and translations before publishing'],
 ['Exam attribution','Book year/shift labels are recorded source claims, not independently authenticated official PYQs. Originals are practice questions.'],
 ['Row','Question origin / source and review note'],
 ...test.questions.map((q,i)=>{
   const b=test.book_questions.find(b=>b.id===q.source_id);
   return [i+2,`${q.origin==='book'?`Book-based: NEW net book 2026.pdf, page ${b?.page}, ${q.source_id}; book source label: ${b?.source_claim}. Hindi translated/retyped.`:`Newly authored practice: ${q.source_id}.`} Pattern: ${q.pattern}. Difficulty: ${q.difficulty}.${q.review_note?' Review note: '+q.review_note:''}`];
 })];
 review.getRange(`A1:B${meta.length}`).values=meta;
 review.getRange(`A1:B${meta.length}`).format={font:{name:'Arial',size:11},wrapText:true,verticalAlignment:'top',rowHeight:70};
 review.getRange(`A1:A${meta.length}`).format.columnWidth=25;
 review.getRange(`B1:B${meta.length}`).format.columnWidth=115;
 review.getRange('A1:B1').format.font={bold:true,size:14,color:'#153D56'};
 review.getRange('A9:B9').format={fill:'#153D56',font:{bold:true,color:'#FFFFFF'},rowHeight:30};
 w.recalculate();
 const inspected=await w.inspect({kind:'table',range:'Questions!K1:N3',include:'values,formulas',tableMaxRows:3,tableMaxCols:4,maxChars:1000});
 if(!inspected.ndjson.includes('Correct Answer'))throw Error('Export inspection failed');
 const filename=`Test-${String(test.test_number).padStart(3,'0')}-U${String(test.unit_number).padStart(2,'0')}-${slug(test.unit)}.xlsx`;
 await (await SpreadsheetFile.exportXlsx(w)).save(path.join(output,filename));
 index.push({test_number:test.test_number,filename,title:test.title,unit_number:test.unit_number,unit:test.website_unit,
   test_number_in_unit:test.test_in_unit,questions:20,book_questions:bookCount,new_questions:20-bookCount,duration_minutes:30,focus:test.focus});
 console.log(`Exported ${filename}`);
}
await fs.writeFile(path.join(dir,'test-index.json'),JSON.stringify(index,null,2));
const columns=Object.keys(index[0]);
await fs.writeFile(path.join(dir,'test-index.csv'),[columns.join(','),...index.map(r=>columns.map(c=>'"'+String(r[c]).replaceAll('"','""')+'"').join(','))].join('\r\n'),'utf8');
console.log(`Exported ${index.length} populated workbooks. Saved index.`);
