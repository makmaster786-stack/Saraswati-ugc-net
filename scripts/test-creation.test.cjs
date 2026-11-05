const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'views/admin/admin-tests.ejs'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin/admin.js'), 'utf8');
function fixture() {
    let globalSubmit;
    let requests = 0, resets = 0, delegated = 0;
    let resolve;
    const response = new Promise(r => { resolve = r; });
    const button = {disabled:false, innerHTML:'Create Test'};
    const form = {id:'createSingleTest', dataset:{}, querySelector:()=>button, reset:()=>resets++};
    const fields = Object.fromEntries(Object.entries({testTitle:'Sample',testCourse:'course1',testDuration:'30',unlockDate:'',seriesTitle:'Series',unitName:'Unit',unitOrder:'2',testOrder:'3'}).map(([k,value])=>[k,{value}]));
    fields.isFreeTest = {checked:true};
    const context = vm.createContext({document:{addEventListener:(name, fn)=>{globalSubmit=fn;},getElementById:id=>fields[id]},fetch:()=>{requests++;return response;},alert:()=>{},console});
    const start = admin.indexOf("document.addEventListener('submit',");
    const end = admin.indexOf('// Handle click events', start);
    vm.runInContext(`(function(){${admin.slice(start,end)}}).call({handleFormSubmit:async()=>{ delegatedCallback(); }});`, Object.assign(context,{delegatedCallback:()=>delegated++}));
    vm.runInContext(page.slice(page.indexOf('async function handleCreateTest'),page.lastIndexOf('</script>')),context);
    context.loadTests = ()=>{};
    const event = ()=>({target:form,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;}});
    return {context,globalSubmit,event,form,button,resolve,get requests(){return requests;},get resets(){return resets;},get delegated(){return delegated;}};
}
test('one bubbling submit creates one request; rapid repeat is ignored',async()=>{
    const f=fixture(), e=f.event();
    const pending=f.context.handleCreateTest(e);
    assert.equal(e.propagationStopped,true);
    await f.globalSubmit(e);
    await f.context.handleCreateTest(f.event());
    assert.equal(f.requests,1);assert.equal(f.delegated,0);assert.equal(f.button.disabled,true);
    f.resolve({ok:true});await pending;
    assert.equal(f.resets,1);assert.equal(f.button.disabled,false);
});
test('failed request preserves form and allows a later submission',async()=>{
    const f=fixture(); const pending=f.context.handleCreateTest(f.event());
    f.resolve({ok:false});await pending;
    assert.equal(f.resets,0);assert.equal(f.form.dataset.submitting,undefined);assert.equal(f.button.disabled,false);
});
test('shared handler still processes forms without a page handler',async()=>{
    const f=fixture();f.form.id='addQuestionForm';await f.globalSubmit(f.event());assert.equal(f.delegated,1);
});
test('legacy shared handler cannot recognize the single-test form',()=>{
    const f=fixture();
    assert.equal(f.form.id.includes('Form'),false);
    assert.ok(!admin.includes("case 'addTestForm'"));
    assert.ok(!admin.includes('async handleAddTest('));
    assert.ok(page.includes('id="createSingleTest"'));
});
