/* Exercise every new fictional screenshot through the real browser OCR UI.
 * --record refreshes the public observations; inspect every draft before commit.
 * Ordinary runs compare with the committed observations and reviewed targets.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';
const record=process.argv.includes('--record');
const cases=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/examples/cases.json'))).cases;
const existing=record?null:JSON.parse(fs.readFileSync(path.join(ROOT,'assets/examples/observations.json')));
const server=createSiteServer({root:path.join(ROOT,'dist')});await listen(server,0);
const base='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch();
const page=await browser.newPage({locale:'en-US',viewport:{width:1120,height:850},colorScheme:'light'});
const faults=[],observations=[];
page.on('pageerror',e=>faults.push(e.message));
try{
  for(const c of cases){
    await page.goto(base);await page.waitForSelector('body[data-ready="true"]');
    await page.locator('#btn-home-ocr').click();
    await page.locator('#ocr-file').setInputFiles(path.join(ROOT,c.image));
    await page.waitForSelector('#ocr-review:not([hidden])',{timeout:180000});
    const draft=await page.locator('#ocr-text').inputValue();
    assert(draft.length>15,c.id+' OCR must produce a draft');
    const raw=await page.evaluate(text=>{const r=Analyzer.analyze(text,{},[]);return {assessment:r.assessment,ids:r.matches.filter(m=>m.points>0).map(m=>m.pattern.id)};},draft);
    const sha256=createHash('sha256').update(fs.readFileSync(path.join(ROOT,c.image))).digest('hex');
    const correctionRequired=raw.assessment!==c.expect||c.required.some(id=>!raw.ids.includes(id));
    if(existing){
      const before=existing.cases.find(item=>item.id===c.id);
      assert.equal(before.sha256,sha256,c.id+' fixture changed: review and record again');
      assert.equal(raw.assessment,before.raw.assessment,c.id+' raw OCR assessment changed');
      assert.equal(correctionRequired,before.correctionRequired,c.id+' OCR review requirement changed');
    }
    // A correction is explicit and recorded; never present corrected text as
    // unedited engine output or adjust the human target to a failed result.
    if(correctionRequired)await page.locator('#ocr-text').fill(c.text);
    await page.locator('#btn-ocr-analyze').click();await page.waitForSelector('#housing-step-4:not([hidden])');
    const reviewed=await page.evaluate(()=>({assessment:Housing.lastResult.assessment,ids:Housing.lastResult.matches.filter(m=>m.points>0).map(m=>m.pattern.id)}));
    assert.equal(reviewed.assessment,c.expect,c.id+' reviewed result');
    c.required.forEach(id=>assert(reviewed.ids.includes(id),c.id+' missing '+id));
    if(c.category==='ordinary')assert.equal(reviewed.ids.length,0,c.id+' ordinary control');
    observations.push({id:c.id,sha256,draft,raw,correctionRequired,reviewed});
    console.log(c.id+': raw '+raw.assessment+'; correction '+correctionRequired+'; reviewed '+reviewed.assessment);
  }
  await page.goto(base+'help.html');await page.waitForSelector('[data-case]');
  // A broken examples request must leave the teaching content and Retry usable.
  await page.route('**/assets/examples/cases.json', route=>route.abort());
  await page.reload();await page.waitForSelector('#samples-retry:not([hidden])');
  assert.equal(await page.locator('#compare').isVisible(),true);
  await page.unroute('**/assets/examples/cases.json');await page.locator('#samples-retry').click();
  await page.waitForSelector('[data-case]');
  assert.equal(await page.locator('[data-case]').count(),12);
  await page.locator('[data-filter="ordinary"]').click();assert.equal(await page.locator('[data-case]').count(),3);
  await page.locator('[data-filter="all"]').click();
  for(const width of [320,390,1120]){
    await page.setViewportSize({width,height:850});
    for(const theme of ['dark','light']){
      const current=await page.locator('html').getAttribute('data-theme');if(current!==theme)await page.locator('[data-theme-toggle]').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'help layout '+width+' '+theme);
    }
  }
  await page.locator('[data-theme-toggle]').click(); // dark persists across pages
  await page.goto(base+'demo.html');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.goto(base);await page.waitForSelector('body[data-ready="true"]');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#home-chat').fill(cases.find(c=>c.id==='pressure-polite').text);await page.locator('#btn-home-analyze').click();
  await page.waitForSelector('#housing-step-4:not([hidden])');
  const numbers=await page.locator('#housing-step-4 .report-number').allTextContents();
  assert.deepEqual(numbers,['1','2','3','4','5','6'],'result reading order');
  const positions=await page.evaluate(()=>['.coverage','.signal','.panel-before','.report-export','#llm-panel'].map(s=>document.querySelector(s).getBoundingClientRect().top));
  assert(positions.every((n,i)=>i===0||n>positions[i-1]),'evidence before actions, export before AI');
  await page.locator('#llm-panel summary').click();await page.locator('#llm-enable').check();
  assert.equal(await page.locator('#llm-wait-warning').isVisible(),true);
  assert.match(await page.locator('#llm-wait-warning').textContent(),/24.*62/);
  assert.equal(await page.locator('#llm-generate').getAttribute('aria-describedby'),'llm-wait-warning');
  for(const width of [320,390,1120]){await page.setViewportSize({width,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'result overflow '+width);}
  fs.mkdirSync(path.join(ROOT,'tmp/review-ui'),{recursive:true});
  await page.screenshot({path:path.join(ROOT,'tmp/review-ui/result-dark.png'),fullPage:true});
  await page.locator('[data-theme-toggle]').click();await page.screenshot({path:path.join(ROOT,'tmp/review-ui/result-light.png'),fullPage:true});
  await page.goto(base+'help.html');await page.waitForSelector('[data-case]');await page.screenshot({path:path.join(ROOT,'tmp/review-ui/help-light.png'),fullPage:true});
  await page.setViewportSize({width:390,height:850});await page.locator('[data-theme-toggle]').click();await page.screenshot({path:path.join(ROOT,'tmp/review-ui/help-mobile.png'),fullPage:true});
  assert.deepEqual(faults,[]);
  if(record)fs.writeFileSync(path.join(ROOT,'assets/examples/observations.json'),JSON.stringify({fictional:true,browser:browser.version(),recordedAt:new Date().toISOString(),method:'Real browser OCR; explicit transcript correction only when required to meet the independently specified target. Not real-world accuracy.',cases:observations},null,2)+'\n');
  console.log('PASS: 12 real OCR scenarios, reviewed targets, themes, layouts, result order and generation warning.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
