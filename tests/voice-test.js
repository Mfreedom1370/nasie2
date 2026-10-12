// Run: node tests/voice-test.js — deterministic parser and microphone lifecycle tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const parser = vm.createContext({localStorage: {getItem: () => null, setItem() {}}, document: {}});
vm.runInContext(read('js/store.js') + read('js/parser.js') + `
Store.d.customers=[{id:'a',name:'علی رضایی'},{id:'b',name:'محمد نصرتی'},{id:'c',name:'محمد نصرتی'}];
`, parser);
const parse = s => vm.runInContext(`parseCmd(${JSON.stringify(s)},{source:'voice'})`, parser);
for (const [text, amount] of [
  ['علی رضایی ۱٫۵ میلیون تومان نسیه', 1500000],
  ['علی رضایی 1.5 میلیون تومان نسیه', 1500000],
  ['علی رضایی ۱٬۲۵۰٬۰۰۰ تومان نسیه', 1250000],
  ['علی رضایی 1,250,000 تومان نسیه', 1250000],
  ['علی رضایی نیم میلیون تومان نسیه', 500000],
  ['علی رضایی هزار میلیون تومان نسیه', 1000000000],
  ['علی رضایی یک میلیون و دویست و پنجاه هزار تومان نسیه', 1250000],
  ['علی رضایی 250هزار تومان نسیه', 250000],
  ['علی رضایی ۵۰۰۰۰۰ ریال پرداخت', 50000]
]) {
  const r = parse(text);
  assert.equal(r.amount, amount, text);
  assert.equal(r.customerId, 'a', text);
}
assert.equal(parse('علی رضایی پنجاه هزار تومان پرداخت شده').type, 'payment');
assert.equal(parse('علی رضایی پنجاه هزار تومان داده').type, 'payment');
assert.equal(parse('محمد نصرتی پنجاه هزار تومان نسیه').customerId, null);
assert.equal(parse('علی رضایی پنجاه هزار تومان نسیه پرداخت').needsConfirmation, true);
assert.equal(parse('علی رضایی ۵۰۰۰۰۰ ریال پرداخت').needsConfirmation, true);

const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {value:'',textContent:'',readOnly:false,
    attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v}});
  return elements.get(id);
};
const sessions = [], messages = [], sheets = [], calls = [], timers = new Map();
let timerId = 0;
class Recognition {
  constructor(){ sessions.push(this); }
  start(){ this.onstart(); }
  stop(){ this.stopped = true; }
}
const browser = vm.createContext({
  window:{SpeechRecognition:Recognition,isSecureContext:true},
  document:{querySelector:element}, $:element,
  Store:{}, parseCmd:()=>({intent:'ask',candidates:[]}),
  esc:s=>String(s).replace(/</g,'&lt;'),
  toast:s=>messages.push(s),sheet:s=>sheets.push(s),closeSheet(){},
  run:(text,options)=>calls.push({text,options}),
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId},
  clearTimeout:id=>timers.delete(id)
});
const app = read('js/app.js');
vm.runInContext(app.slice(app.indexOf('const SR='), app.indexOf('render();Store.startGuard(')), browser);
const execute = s => vm.runInContext(s,browser);
const result = (texts, isFinal = true) => Object.assign(texts.map(transcript => ({transcript,confidence:.9})), {isFinal});
element('#cmd').value='متن قبلی';
execute('listen();listen()');
assert.equal(sessions.length,1,'rapid taps must not create concurrent sessions');
assert.equal(element('#cmd').readOnly,true);
const first=sessions[0];
first.onresult({results:[result(['علی رضایی پنجاه هزار','علی رضایی پانصد هزار']),result(['تومان نسیه'],false)]});
assert.equal(element('#cmd').value,'علی رضایی پنجاه هزار تومان نسیه');
assert.equal(calls.length,0,'interim speech must not execute commands');
first.onresult({results:[result(['علی رضایی پنجاه هزار','علی رضایی پانصد هزار']),result(['تومان نسیه'])]});
first.onresult({results:[result(['علی رضایی پنجاه هزار','علی رضایی پانصد هزار']),result(['تومان نسیه'])]});
assert.equal(calls.length,0,'final speech waits for user review');
first.onend();
assert.equal(element('#cmd').readOnly,false);
assert.equal(sheets.length,1);
assert.ok(sheets[0].includes('پانصد هزار تومان نسیه'),'full alternate transcript is reviewable');
element('#voice-edit').value='علی رضایی شصت هزار تومان نسیه';
execute('useVoice()');
assert.equal(calls.length,1);
assert.equal(calls[0].text,'علی رضایی شصت هزار تومان نسیه');
assert.equal(calls[0].options.source,'voice');

execute('listen()');
const second=sessions[1];
second.onerror({error:'network'});second.onend();
assert.equal(timers.size,0,'network failure must not leave retry or recording timers');
assert.equal(sessions.length,2,'network failure must not repeatedly reopen microphone');
assert.equal(element('#cmd').value,'علی رضایی شصت هزار تومان نسیه','failed recognition preserves prior text');
first.onresult({results:[result(['نتیجه قدیمی'])]});
assert.equal(element('#cmd').value,'علی رضایی شصت هزار تومان نسیه','late events must not replace text');

execute('listen()');
const third=sessions[2];
third.onresult({results:[result(['علی رضایی'])]});
element('#mic').onclick();
assert.equal(third.stopped,true,'second tap stops recognition');
third.onend();
assert.equal(element('#mic').attrs['aria-pressed'],'false');
browser.window.isSecureContext=false;
execute('listen()');
assert.equal(sessions.length,3,'insecure origin must not attempt recording');

// Invalid corrections must never create a customer or write a transaction.
let customersCreated=0, transactionsWritten=0;
browser.norm = s => s;
browser.find = () => ({id:'a'});
browser.dys = () => 30;
browser.DAY = 86400000;
browser.alertLimit = () => {};
browser.Store = {
  addC(){customersCreated++;return {id:'new'}},
  addTransaction(){transactionsWritten++},vset(){},batch(fn){return fn()}
};
execute("let cmd={open:true,amount:50000,amountRaw:50,candidates:[{id:'a'}],source:'voice',rawText:'علی پنجاه هزار'};");
vm.runInContext(app.slice(app.indexOf('function okCmd()'),app.indexOf('// ----------',app.indexOf('function okCmd()')) > -1 ? app.indexOf('// ----------',app.indexOf('function okCmd()')) : app.indexOf('function sweep()')),browser);
element('input[name=cs]:checked').value='new';
element('input[name=ty]:checked').value='credit';
element('#voice-amount').value='-50';
execute('okCmd()');
assert.equal(customersCreated,0);
assert.equal(transactionsWritten,0);
element('#voice-amount').value='50000';
element('#dd').value='-3';
execute('okCmd()');
assert.equal(customersCreated,0);
assert.equal(transactionsWritten,0);
element('input[name=cs]:checked').value='0';
element('#dd').value='10';
elements.delete('#kk');
// Unlike the generic fake DOM, a missing checkbox must return null.
browser.$ = s => s === '#kk' ? null : element(s);
browser.closeSheet = () => execute('cmd.open=false');
execute('okCmd()');
execute('okCmd()');
assert.equal(transactionsWritten,1,'valid reviewed correction records exactly once');
console.log('✅ Voice parser and microphone lifecycle tests passed');
