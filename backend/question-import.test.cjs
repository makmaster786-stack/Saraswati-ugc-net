const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Excel = require('exceljs');
const {parse, install, headers} = require('./question-import.cjs');
const sample = process.env.QUESTION_IMPORT_SAMPLE || 'C:/Users/ABC/Downloads/UGC-NET-Political-Science-10-Units-500-Questions/Unit-04-Comparative-Political-Analysis-50-Questions.xlsx';

test('supplied multi-sheet workbook parses 50 bilingual questions', async () => {
    const result = await parse(fs.readFileSync(sample));
    assert.equal(result.questions.length, 50);
    assert.deepEqual(result.errors, []);
    for (const q of result.questions) {
        assert.ok(q.questionText.english && q.questionText.hindi);
        assert.equal(q.options.length, 4);
        assert.ok(q.options.every(o => o.english && o.hindi));
        assert.ok(q.explanation.english);
    }
});

test('Questions sheet is selected after an additional first sheet', async () => {
    const book = new Excel.Workbook();
    book.addWorksheet('Instructions').addRow(['Read me']);
    const sheet = book.addWorksheet('Questions');
    sheet.addRow(headers);
    sheet.addRow(['Question', 'प्रश्न', 'A','क','B','ख','C','ग','D','घ','A','English / हिंदी','Paper 2','Comparative Politics']);
    const result = await parse(await book.xlsx.writeBuffer());
    assert.deepEqual(result.errors, []);
    assert.equal(result.questions.length, 1);
});

test('preview, append-only import, retry and parsing error use the same endpoint', async () => {
    let handler, writes = 0;
    const linked = new Set(['existing-question']);
    const docs = new Map();
    const mongoose = require('mongoose');
    const mockMongoose = {isValidObjectId:mongoose.isValidObjectId, Types:mongoose.Types,
        startSession:async()=>({withTransaction:async fn=>fn(),endSession:async()=>{}})};
    const multer = () => ({single:()=>async(req,res,next)=>next()});
    multer.memoryStorage = ()=>({});
    install({app:{get(){},post(path,auth,fn){handler=fn;}},multer,mongoose:mockMongoose,protectAdmin(){},
        Test:{exists:async()=>true,updateOne:async(filter,update)=>{
            assert.deepEqual(Object.keys(update), ['$addToSet']);
            update.$addToSet.questions.$each.forEach(id=>linked.add(String(id)));
            return {matchedCount:1};
        }},Question:{bulkWrite:async operations=>{
            writes++;
            operations.forEach(op=>{assert.ok(op.updateOne.$unset === undefined);assert.ok(op.updateOne.update.$setOnInsert);docs.set(String(op.updateOne.filter._id),op.updateOne.update.$setOnInsert);});
        }}});
    async function request(action, buffer=fs.readFileSync(sample)) {
        const req={params:{id:'507f1f77bcf86cd799439011'},body:{action},file:{originalname:'sample.xlsx',buffer}};
        const res={statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
        await handler(req,res);
        return res;
    }
    const preview=await request('preview');
    assert.equal(preview.body.count,50); assert.equal(writes,0);
    const imported=await request('import');
    assert.equal(imported.body.count,50); assert.equal(linked.size,51);
    assert.ok(linked.has('existing-question'));
    await request('import');
    assert.equal(linked.size,51); assert.equal(docs.size,50);
    for (const action of ['preview','import']) {
        const failed=await request(action,Buffer.from('broken workbook'));
        assert.equal(failed.statusCode,400);
        assert.match(failed.body.message,/Unable to read this Excel workbook/);
    }
    assert.equal(writes,2);
});
