import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
import importer from '../../backend/question-import.cjs';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1');
const data = [
['What is 20% of 150?','150 का 20% कितना है?','20','20','25','25','30','30','35','35','C','English: 150 × 20 ÷ 100 = 30.\nहिंदी: 150 × 20 ÷ 100 = 30।','Paper 1','General'],
['What is the average of 4, 6 and 8?','4, 6 और 8 का औसत कितना है?','4','4','6','6','8','8','18','18','B','English: Average = (4 + 6 + 8) ÷ 3 = 6.\nहिंदी: औसत = (4 + 6 + 8) ÷ 3 = 6।','Paper 1','General'],
['Find the next number: 2, 4, 8, 16, ...','अगली संख्या ज्ञात कीजिए: 2, 4, 8, 16, ...','18','18','24','24','30','30','32','32','D','English: Each number is twice the previous number. 16 × 2 = 32.\nहिंदी: प्रत्येक संख्या पिछली संख्या की दोगुनी है। 16 × 2 = 32।','Paper 1','General'],
['A class has 12 boys and 18 girls. What is the simplest ratio of boys to girls?','एक कक्षा में 12 लड़के और 18 लड़कियाँ हैं। लड़कों और लड़कियों का सरलतम अनुपात क्या है?','2:3','2:3','3:2','3:2','1:3','1:3','2:5','2:5','A','English: Divide both parts of 12:18 by 6 to get 2:3.\nहिंदी: 12:18 के दोनों पदों को 6 से भाग देने पर 2:3 मिलता है।','Paper 1','General'],
['Which fraction is equal to 0.25?','कौन-सी भिन्न 0.25 के बराबर है?','1/2','1/2','1/4','1/4','3/4','3/4','1/5','1/5','B','English: 0.25 = 25/100 = 1/4.\nहिंदी: 0.25 = 25/100 = 1/4।','Paper 1','General']
];
const w=Workbook.create(), s=w.worksheets.add('Questions');
s.getRange('A1:N6').values=[importer.headers,...data];
s.showGridLines=false;
s.freezePanes.freezeRows(1);
s.getRange('A1:N6').format={font:{name:'Arial',size:11},wrapText:true,verticalAlignment:'top',columnWidth:22};
s.getRange('A1:B6').format.columnWidth=42;
s.getRange('L1:L6').format.columnWidth=58;
s.getRange('A1:N1').format={fill:'#164E63',font:{bold:true,color:'#FFFFFF'},rowHeight:32};
s.getRange('A2:N6').format.rowHeight=105;
s.getRange('A2:N6').setNumberFormat('@');
for(const r of [2,4,6])s.getRange(`A${r}:N${r}`).format.fill='#F0F6FA';
s.getRange('K2:K6').dataValidation={rule:{type:'list',values:['A','B','C','D']}};
s.getRange('M2:M6').dataValidation={rule:{type:'list',values:['Paper 1','Paper 2']}};
const g=w.worksheets.add('Instructions');
g.showGridLines=false;
g.getRange('A1:A8').values=[['How to use this example'],['Five sample questions are included. Replace them with your own before a real import.'],['Keep the Questions sheet name and all 14 column headings unchanged.'],['One question per row. Fill English and Hindi question text and all four options.'],['Correct Answer is A, B, C or D. Explanation contains both languages in ONE cell.'],['Use Alt+Enter for line breaks. Use plain text, not formulas or images.'],['Paper is Paper 1 or Paper 2. Replace General with the exact unit name from your admin form.'],['Save as .xlsx. Upload to the intended test, preview, then import. Maximum 200 questions / 2 MB.']];
g.getRange('A1:A8').format={font:{name:'Arial',size:11},columnWidth:110,wrapText:true,rowHeight:42,verticalAlignment:'center'};
g.getRange('A1').format.font={bold:true,size:15,color:'#164E63'};
w.recalculate();
console.log((await w.inspect({kind:'table',range:'Questions!K1:N6',include:'values',tableMaxRows:6,tableMaxCols:4,maxChars:1500})).ndjson);
if (!process.argv.includes('--render-only')) await (await SpreadsheetFile.exportXlsx(w)).save(`${dir}/bilingual-question-example.xlsx`);
const checked=await importer.parse(await fs.readFile(`${dir}/bilingual-question-example.xlsx`));
if(checked.errors.length || checked.questions.length!==5)throw Error(JSON.stringify(checked.errors));
console.log('Importer validation passed: 5 bilingual questions.');
for(const [sheetName,range,name] of [['Questions','A1:D3','questions'],['Questions','K1:N3','answers'],['Instructions','A1:A8','instructions']]){
 const p=await w.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await p.arrayBuffer()));
}
