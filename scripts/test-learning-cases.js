/* Reviewed synthetic expectations, separate from the image OCR observations. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
global.window=global;
require('../assets/js/conversation.js');require('../assets/js/detector.js');
require('../assets/js/analyzer.js');const A=global.Analyzer;
A.load(require('../data/patterns.json')).loadFuzzy(require('../data/lexicon.json'));
const cases=require('../assets/examples/cases.json').cases;
const ids=r=>r.matches.filter(m=>m.points>0).map(m=>m.pattern.id);
for(const c of cases){
  const r=A.analyze(c.text,{},[]);
  assert.equal(r.assessment,c.expect,c.id+' assessment');
  c.required.forEach(id=>assert(ids(r).includes(id),c.id+' missing '+id));
  if(c.category==='ordinary')assert.equal(ids(r).length,0,c.id+' false positive');
  assert(fs.existsSync(path.join(root,c.image)),c.image);
  for(const lang of ['ko','en'])assert(c.title[lang]&&c.why[lang]);
}
for(const name of ['Minji','Alice','Hana','Jimin','Sam','집주인의 친구'])assert.equal(Conversation.roleFor(name),'unknown',name);
assert.equal(Conversation.roleFor('Tenant Lee'),'tenant');
assert.equal(ids(A.analyze('Landlord: Could you send the register to check for tax arrears?',{},[])).length,0,'document question is not a money request');
assert(ids(A.analyze('Landlord: Could you please send the deposit first?',{},[])).includes('pay-urgency'),'polite English payment request');
assert(ids(A.analyze('Agent: This property is held in trust.\nAgent: Do you need consent from the trust?',{},[])).includes('reg-trust'),'question is not verified consent');
for(const text of ['중개사: 방을 보려면 먼저 입금할 필요 없습니다.', '세입자: 방을 보려면 먼저 입금해야 하나요?'])
  assert(!ids(A.analyze(text,{},[])).includes('pay-before-viewing'),'viewing/payment benign control');
assert(ids(A.analyze('중개사: 먼저 입금하지 않으면 방을 볼 수 없습니다.',{},[])).includes('pay-before-viewing'),'conditional refusal of viewing remains a warning');
for(const fuzzy of [false,true]){
  A.lexicon=fuzzy?require('../data/lexicon.json'):null;
  const r=A.analyze('Tenant: Pay now.\nLandlord: Pay now.',{},[]);
  assert(ids(r).includes('pay-urgency'),'later identical counterparty sentence must survive');
  assert.equal(r.matches.find(m=>m.pattern.id==='pay-urgency').speaker,'landlord');
  assert(ids(A.analyze('Landlord: Pay now. Do you have any questions?',{},[])).includes('pay-urgency'));
  assert(!ids(A.analyze('Tenant: Could you please send the deposit first?',{},[])).includes('pay-urgency'));
  const long=A.analyze('Landlord: '+('Please read this introduction carefully, '.repeat(20))+'pay now.',{},[]);
  assert.equal(long.matches.find(m=>m.pattern.id==='pay-urgency').speaker,'landlord');
  assert(long.matches.find(m=>m.pattern.id==='pay-urgency').quote.includes('pay now'));
}
console.log('Learning cases passed: 12 bilingual scenarios plus ownership, mixed-sentence, polite-request and long-quote regressions.');
