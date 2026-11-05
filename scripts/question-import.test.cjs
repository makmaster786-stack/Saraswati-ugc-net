const {test}=require('node:test');
const assert=require('node:assert/strict');
const Excel=require('../backend/node_modules/exceljs');
const {parse,headers}=require('../backend/question-import.cjs');
async function workbook(row,head=headers){const b=new Excel.Workbook(),s=b.addWorksheet('Questions');s.addRow(head);s.addRow(row);return b.xlsx.writeBuffer();}
const row=['Question','प्रश्न','One','एक','Two','दो','Three','तीन','Four','चार','B','English explanation\nहिंदी व्याख्या','Paper 1','Teaching Aptitude'];
test('bilingual workbook maps answer and single explanation',async()=>{const r=await parse(await workbook(row));assert.deepEqual(r.errors,[]);assert.equal(r.questions[0].correctAnswerIndex,1);assert.equal(r.questions[0].options[1].hindi,'दो');assert.equal(r.questions[0].explanation.english,'English explanation<br>हिंदी व्याख्या');assert.equal(r.questions[0].explanation.hindi,'');});
test('invalid answer and missing Hindi prevent import',async()=>{const cells=[...row];cells[1]='';cells[10]='E';const r=await parse(await workbook(cells));assert.equal(r.errors.length,2);});
test('formula cells rejected and HTML escaped',async()=>{const cells=[...row];cells[0]='<script>alert(1)</script>';cells[2]={formula:'1+1',result:2};const r=await parse(await workbook(cells));assert.ok(r.errors.some(e=>e.includes('formula')));assert.ok(r.questions[0].questionText.english.startsWith('&lt;script&gt;'));});
test('wrong headings rejected',async()=>{await assert.rejects(parse(await workbook(row,['wrong'])),/headings/);});
