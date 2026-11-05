import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
try{
 const w=await SpreadsheetFile.importXlsx(await FileBlob.load('outputs/political-science-125/Tests/Test-001-U01-Political-Theory.xlsx'));
 w.recalculate();
 for(const [sheetName,range,name] of [['Questions','A1:B3','questions-preview'],['Questions','K1:N3','explanation-preview'],['Sources and review','A1:B9','sources-preview']]){
  const blob=await w.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(`outputs/political-science-125/${name}.png`,new Uint8Array(await blob.arrayBuffer()));
 }
}catch(e){console.error('Preview rendering unavailable:',e.message);process.exitCode=1;}
