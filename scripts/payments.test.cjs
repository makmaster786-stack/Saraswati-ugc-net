const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signatureValid, capturedMatches, install } = require('../backend/payments.cjs');
test('signatures validate original bytes and reject altered bodies', () => {
 const body = Buffer.from('{"event":"payment.captured"}');
 const sig = crypto.createHmac('sha256','secret').update(body).digest('hex');
 assert.equal(signatureValid(body,sig,'secret'),true);
 assert.equal(signatureValid(Buffer.from('{}'),sig,'secret'),false);
 assert.equal(signatureValid(body,'bad','secret'),false);
 assert.equal(signatureValid(body,sig,''),false);
});
test('only exact captured, non-refunded payments qualify', () => {
 const order = {_id:'order_1',amount:10000,currency:'INR'};
 const good = {order_id:'order_1',amount:10000,currency:'INR',status:'captured'};
 assert.equal(capturedMatches(good,order),true);
 for (const change of [{status:'authorized'},{order_id:'other'},{amount:1},{currency:'USD'},{amount_refunded:1}]) assert.equal(capturedMatches({...good,...change},order),false);
});
test('retry after receipt saved repairs enrollment; duplicate confirmation stays idempotent', async () => {
 const routes = {}; let receipt; let enrolled = false; let failOnce = true;
 const order = {_id:'order_1',student:'student',course:'course',amount:10000,currency:'INR'};
 const mongoose = { Schema: class {}, model: () => ({findById: async () => order}) }; mongoose.Schema.Types = {ObjectId:String};
 install({ app:{post:(url,...handlers)=>routes[url]=handlers.at(-1),get(){}}, mongoose,
 razorpay:{payments:{fetch:async()=>({order_id:order._id,amount:10000,currency:'INR',status:'captured'})}},
 Payment:{findOneAndUpdate:async(q,update)=>receipt ||= update.$setOnInsert}, Course:{},
 User:{updateOne:async()=>{if(failOnce){failOnce=false;throw new Error('DB interruption');} enrolled=true;}},
 protectStudentApi(){},protectAdmin(){},protectAdminPage(){} });
 process.env.RAZORPAY_KEY_SECRET = 'test-secret';
 const signature=crypto.createHmac('sha256','test-secret').update('order_1|pay_1').digest('hex');
 const req={body:{razorpay_order_id:'order_1',razorpay_payment_id:'pay_1',razorpay_signature:signature,courseId:'course'}};
 const response=()=>({locals:{user:{_id:'student'}},code:200,set(){},status(code){this.code=code;return this;},json(data){this.data=data;}});
 let res=response(); await routes['/api/payment/verify-payment'](req,res); assert.equal(res.code,503); assert.ok(receipt); assert.equal(enrolled,false);
 res=response(); await routes['/api/payment/verify-payment'](req,res); assert.equal(res.data.success,true); assert.equal(enrolled,true);
 res=response(); await routes['/api/payment/verify-payment'](req,res); assert.equal(res.data.success,true);
 res=response(); res.locals.user._id='other'; await routes['/api/payment/verify-payment'](req,res); assert.equal(res.code,403);
});
