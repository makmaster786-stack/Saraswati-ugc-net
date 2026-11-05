const Excel = require('exceljs');
const JSZip = require('jszip');
const crypto = require('node:crypto');
const headers = ['Question English','Question Hindi','A English','A Hindi','B English','B Hindi','C English','C Hindi','D English','D Hindi','Correct Answer','Explanation','Paper','Unit'];
const escape = text => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\r?\n/g,'<br>');
async function normalizeWorkbook(buffer) {
    // ExcelJS matches literal element names and misses valid prefixed SpreadsheetML.
    // Only change markup for this namespace; never change cell text or r:id attributes.
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file('xl/workbook.xml')) throw new Error('Missing workbook XML.');
    let changed = false;
    for (const file of Object.values(zip.files)) {
        if (file.dir || !/^xl\/.*\.xml$/.test(file.name)) continue;
        const xml = await file.async('string');
        const prefixes = [...xml.matchAll(/xmlns:([\w-]+)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g)].map(m => m[1]);
        if (!prefixes.length) continue;
        const normalized = xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g, tag => {
            if (tag.startsWith('<!--') || tag.startsWith('<![CDATA[')) return tag;
            for (const prefix of prefixes) {
                tag = tag.replace(new RegExp(`^(<\\/?)${prefix}:`), '$1');
                tag = tag.replace(new RegExp(`xmlns:${prefix}=("[^"]*"|'[^']*')`, 'g'), 'xmlns=$1');
            }
            return tag;
        });
        if (normalized !== xml) { zip.file(file.name, normalized); changed = true; }
    }
    return changed ? zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}) : buffer;
}
async function parse(buffer) {
    const book = new Excel.Workbook();
    try {
        await book.xlsx.load(await normalizeWorkbook(buffer));
    } catch (error) {
        throw new Error('Unable to read this Excel workbook. Upload a valid, unencrypted .xlsx file using the question template. No questions were imported.');
    }
    const sheet = book.getWorksheet('Questions') || book.worksheets[0];
    if (!sheet || sheet.rowCount > 201) throw new Error('Use the Questions sheet with at most 200 questions.');
    if (!headers.every((h,i) => sheet.getRow(1).getCell(i+1).text.trim() === h)) throw new Error('Column headings do not match. Download and use the template.');
    const errors = [], questions = [], preview = [];
    sheet.eachRow((row,number) => {
        if (number === 1) return;
        const values = headers.map((h,i) => row.getCell(i+1).text.trim());
        if (values.every(v=>!v)) return;
        headers.forEach((h,i) => {
            const cell = row.getCell(i+1);
            if (cell.type === Excel.ValueType.Formula) errors.push(`Row ${number}: ${h} must be text, not a formula.`);
            if (!values[i]) errors.push(`Row ${number}: ${h} is required.`);
            if (values[i].length > 20000) errors.push(`Row ${number}: ${h} is too long.`);
        });
        const answer = values[10].toUpperCase();
        if (!['A','B','C','D'].includes(answer)) errors.push(`Row ${number}: Correct Answer must be A, B, C or D.`);
        if (!['Paper 1','Paper 2'].includes(values[12])) errors.push(`Row ${number}: Paper must be Paper 1 or Paper 2.`);
        questions.push({questionText:{english:escape(values[0]),hindi:escape(values[1])},options:[2,4,6,8].map(i=>({english:escape(values[i]),hindi:escape(values[i+1])})),correctAnswerIndex:['A','B','C','D'].indexOf(answer),explanation:{english:escape(values[11]),hindi:''},paper:values[12],unit:values[13],marks:2});
        preview.push({row:number,values});
    });
    if (!questions.length) errors.push('Add at least one question.');
    return {questions,preview,errors};
}
module.exports = {parse,headers,install};
function install({app,multer,mongoose,Test,Question,protectAdmin}) {
    const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1}}).single('file');
    app.get('/api/admin/question-template.xlsx',protectAdmin,async(req,res,next)=>{
        try {
            const book=new Excel.Workbook(), sheet=book.addWorksheet('Questions');
            sheet.addRow(headers); sheet.views=[{state:'frozen',ySplit:1}];
            sheet.columns=headers.map((h,i)=>({width:i<2||i===11?45:22}));
            sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
            sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E63'}};
            sheet.autoFilter='A1:N1';
            for(let i=2;i<=16;i++){sheet.getRow(i).height=60;sheet.getRow(i).alignment={wrapText:true,vertical:'top'};sheet.getCell(`K${i}`).dataValidation={type:'list',allowBlank:false,formulae:['"A,B,C,D"']};sheet.getCell(`M${i}`).dataValidation={type:'list',allowBlank:false,formulae:['"Paper 1,Paper 2"']};}
            const guide=book.addWorksheet('Instructions');guide.getColumn(1).width=110;
            ['One question per row on Questions. Keep the headings unchanged.','Fill both languages for the question and all four options.','Correct Answer: A, B, C or D. Paper: Paper 1 or Paper 2.','Explanation: write English and Hindi together in this single cell. Use Alt+Enter for line breaks.','Plain text only; formulas, images and embedded formatting are not imported.','All 14 columns are required. Maximum 200 questions and 2 MB per file.','Preview first. Errors must be corrected before import. Existing test questions are retained.'].forEach(t=>guide.addRow([t]));
            res.setHeader('Content-Disposition','attachment; filename="question-template.xlsx"');
            res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.send(Buffer.from(await book.xlsx.writeBuffer()));
        } catch(e){next(e);}
    });
    app.post('/api/admin/tests/:id/questions/excel',protectAdmin,(req,res)=>upload(req,res,async error=>{
        if(error) return res.status(400).json({success:false,message:'Upload one .xlsx file no larger than 2 MB.'});
        let session;
        try {
            if(!mongoose.isValidObjectId(req.params.id)||!await Test.exists({_id:req.params.id})) return res.status(404).json({success:false,message:'Test not found.'});
            if(!req.file || !/\.xlsx$/i.test(req.file.originalname)) throw new Error('Choose an .xlsx Excel workbook.');
            const result=await parse(req.file.buffer);
            if(result.errors.length) return res.status(400).json({success:false,errors:result.errors});
            if(req.body.action!=='import') return res.json({success:true,preview:result.preview,count:result.questions.length});
            const digest=crypto.createHash('sha256').update(JSON.stringify(result.questions)).digest('hex');
            const docs=result.questions.map((q,i)=>({...q,test:req.params.id,_id:new mongoose.Types.ObjectId(crypto.createHash('sha256').update(`${req.params.id}:${digest}:${i}`).digest('hex').slice(0,24))}));
            session=await mongoose.startSession();
            await session.withTransaction(async()=>{
                // Stable IDs make retrying the same workbook safe, including after connection loss.
                await Question.bulkWrite(docs.map(q=>({updateOne:{filter:{_id:q._id},update:{$setOnInsert:q},upsert:true}})),{session});
                const linked=await Test.updateOne({_id:req.params.id},{$addToSet:{questions:{$each:docs.map(q=>q._id)}}},{session});
                if(!linked.matchedCount) throw new Error('Test was removed. Import cancelled.');
            });
            res.json({success:true,message:`${docs.length} questions imported or already present.`,count:docs.length});
        } catch(e){res.status(400).json({success:false,message:/Transaction numbers|replica set/i.test(e.message)?'Bulk import requires MongoDB Atlas or a local replica set. No questions were imported.': e.message || 'Unable to import workbook.'});}
        finally {if(session) await session.endSession();}
    }));
}
