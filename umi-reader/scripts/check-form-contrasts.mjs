import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {formContrastGuides} from './content/form-contrast-guides.mjs';import {buildFormContrasts,buildMakuruAnalyses} from './lib/build-form-contrasts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,before=JSON.stringify(B),guides=buildFormContrasts();let explained=0,changes=0,examples=0;
for(const g of Object.values(guides)){examples+=g.examples.length;assert(g.examples.length>=3);assert(g.time&&g.change&&g.trap);for(const e of g.examples)assert(e.kana&&e.zh&&e.why);}
for(const [i,line] of B.lines.entries()){
 const groups=S.create(B,line);assert.equal(groups.map(g=>g.s).join(''),line.t.map(id=>B.words[id].s).join(''));
 for(const a of S.analyses(B,line,groups).items){
  if(a.grammarLessons.some(g=>g.contrastGuide))explained++;
  if(a.change){changes++;assert.equal(a.change.keep+a.change.remove,a.base);assert.equal(a.change.keep+a.change.add,a.quote);}
 }
 for(const a of S.actionConnections(B,line)){assert(a.contrastKeys.length);assert.equal(S.formContrasts(a.contrastKeys).length,a.contrastKeys.length);}
}
assert(explained>5000&&changes>5000);assert.equal(JSON.stringify(B),before);
const at=n=>S.analyses(B,B.lines[n-1]).items;
const makuru=at(19).find(a=>a.kind==='反复动作的接法');assert(makuru);
assert.deepEqual(Array.from(makuru.steps,s=>s.form),['する','し','しまくる','しまくっ','しまくった']);
assert.equal(makuru.change.keep,'しまく');assert.equal(makuru.change.remove,'る');assert.equal(makuru.change.add,'った');
assert.match(makuru.steps[3].why,/小っ/);assert.match(guides.makuru.time,/习惯.*打算/);
assert.equal(guides.makuru.examples.length,6);assert(guides.makuru.examples.some(e=>e.ja.includes('明日')&&e.ja.includes('しまくる')));
assert(guides.makuru.examples[0].ja.includes('を'));assert(guides.makuru.examples[0].kana.includes('おした'));assert(!Object.values(guides).some(g=>g.examples.some(e=>e.kana.includes('を'))),'Pronunciation lines read the particle を as お');
assert(at(1318).some(a=>a.kind==='反复动作的接法'));assert(at(2346).some(a=>a.kind==='反复动作的接法'));
for(const n of [434,746,1763,1194])assert(!at(n).some(a=>a.kind==='反复动作的接法'),'Do not confuse うまく,まくしたてる or rolling sleeves with repeated actions');
const fake={...B,lines:B.lines.map((l,i)=>i===18?{...l,t:[]}:l)};assert.throws(()=>buildMakuruAnalyses(fake),/Changed makuru source/);
const b={words:[{s:'したら',b:'する',k:'したら',p:'动词',ct:'サ変・スル'}]},a=S.analyses(b,{t:[0]}).items[0];assert.match(a.steps.find(s=>s.form==='した').why,/不能.*认定动作已经发生/);

for(const native of [false,true]){
 const errors=[],dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let saved=JSON.stringify({index:18,done:[0,18],sentenceMode:'chunks',meaning:false,illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{},speakClip:()=> 'ok',speakRoleClip:()=> 'ok'};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 const jump=n=>{d.querySelector('#jump-number').value=String(n);d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 click('[data-sentence-chunk="5"]');let cards=d.querySelectorAll('#word-dialog [data-form-contrast="makuru"]');assert.equal(cards.length,1,'Same examples appear once per chunk, repeat on other visits');
 assert(!cards[0].closest('details'));assert.equal(cards[0].querySelectorAll('.form-example').length,6);
 for(const e of cards[0].querySelectorAll('.form-example')){assert(e.querySelector('.form-example-ja').nextElementSibling.matches('.form-example-zh'));assert(e.querySelector('.form-pronunciation small').textContent);}
 assert.equal(d.querySelectorAll('#word-dialog [data-form-reading="しまくっ"]').length,0,'Do not read an unfinished small-tsu stem');
 click('#word-dialog [data-close]');click('[data-sentence-mode="words"]');click('[aria-label="查看 しまくった"]');
 assert.equal(d.querySelectorAll('#word-dialog [data-form-contrast="makuru"]').length,1);
 let edit=d.querySelector('#word-dialog .form-change');assert(edit);assert.equal(edit.querySelector('del').textContent,'る');assert.equal(edit.querySelector('mark').textContent,'った');
 click('#word-dialog [data-close]');click('[data-tab="walk"]');click('[data-walk-step="5"]');assert(d.querySelector('#walk-details [data-form-contrast="makuru"]'));
 click('[data-tab="grammar"]');assert(d.querySelector('#learning-panel [data-form-contrast="makuru"]'));
 jump(17);click('[data-sentence-mode="chunks"]');click('[data-sentence-chunk="1"]');const stateGuide=d.querySelector('#word-dialog [data-form-contrast="progressive"]');assert(stateGuide);assert(!stateGuide.closest('details'),'Examples remain visible even in a deeply annotated chunk');
 click('#word-dialog [data-close]');jump(19);click('[data-sentence-chunk="5"]');assert.equal(d.querySelectorAll('#word-dialog [data-form-contrast="makuru"] .form-example').length,6,'Reading again must repeat examples');
 click('#word-dialog [data-close]');click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .form-contrast,#learning-panel .form-change').length,0);
 assert.deepEqual(JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1')).done,[0,18]);assert.deepEqual(errors,[]);dom.window.close();
}
console.log(JSON.stringify({formContrasts:'PASS',families:Object.keys(formContrastGuides).length,examples,explainedForms:explained,exactChangeCards:changes,makuruContexts:3,webAndNative:true,visibleExamples:true,sourceAndProgressPreserved:true,quizIsolation:true}));
