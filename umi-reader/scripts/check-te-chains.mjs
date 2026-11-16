import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,before=JSON.stringify(B),at=(n,quote)=>S.analyses(B,B.lines[n-1]).items.find(a=>a.quote===quote);
const buy=at(20,'買ってきて');assert(buy?.layered);
assert.deepEqual(Array.from(buy.steps,s=>s.form),['買う','買っ','買って','買ってくる','買ってきて']);
assert.deepEqual(Array.from(buy.steps,s=>s.kana),['かう','かっ','かって','かってくる','かってきて']);
assert.match(buy.steps[1].why,/う.*って/);assert.match(buy.steps.at(-1).why,/き＋て/);
assert.match(buy.contextLesson.why,/第一个て.*第二个て/);assert.match(buy.contextLesson.why,/きて本身不是过去式/);
for(const [n,quote,forms] of [
 [65,'流れてきて',['流れて','流れてくる','流れてきて']],
 [547,'のりだしてしまっていた',['のりだしてしまう','のりだしてしまって','のりだしてしまっている','のりだしてしまっていた']],
 [576,'戻ってきていて',['戻ってくる','戻ってきて','戻ってきている','戻ってきていて']],
 [698,'戻ってきていた',['戻ってくる','戻ってきて','戻ってきている','戻ってきていた']],
 [1248,'歩いていって',['歩いて','歩いていく','歩いていって']],
 [1282,'来てくれて',['来て','来てくれる','来てくれて']],
 [1682,'思ってみて',['思って','思ってみる','思ってみて']],
 [2215,'使わせてもらって',['使わせる','使わせて','使わせてもらう','使わせてもらって']],
 [2393,'仲裁してもらって',['仲裁して','仲裁してもらう','仲裁してもらって']]
]){const a=at(n,quote);assert(a?.layered,quote);let last=-1;for(const form of forms){const i=a.steps.findIndex(s=>s.form===form);assert(i>last,quote+' missing ordered layer '+form);last=i;}assert(a.steps.every(s=>s.kana&&s.why),quote+' needs readings and explanations');}
const raw=S.create(B,B.lines[19]).find(g=>g.s==='買ってきて').words;
const fixture=words=>S.analyses({words},{t:words.map((_,i)=>i)}).items;
assert(!fixture([{s:'買ってきて',k:'かってきて',b:'買う',p:'动词',ct:'五段・ワ行促音便'}]).some(a=>a.layered),'No substring-only guessing inside one unverified word');
assert(!fixture(raw.map((w,i)=>i===2?{...w,b:'切る'}:w)).some(a=>a.layered),'The actual second verb must be くる');
const kanji=fixture(raw.map((w,i)=>i===2?{...w,s:'来',b:'来る'}:w)).find(a=>a.quote==='買って来て');
assert(kanji?.layered);assert.equal(kanji.steps.at(-1).kana,'かってきて');
let chains=0;for(const [i,l] of B.lines.entries()){const groups=S.create(B,l);assert.equal(groups.map(g=>g.s).join(''),l.t.map(id=>B.words[id].s).join(''));for(const a of S.analyses(B,l,groups).items)if(a.layered){chains++;assert.equal(a.steps.at(-1).form,a.quote);assert(a.grammarLessons.some(g=>g.key==='te-chain'));}}
assert(chains>1000);assert.equal(JSON.stringify(B),before);
for(const native of [false,true]){
 const dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document,errors=[];
 let saved=JSON.stringify({index:19,done:[0,18],sentenceMode:'words',illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const el of d.querySelectorAll('script[src]'))w.eval(read(el.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 click('[aria-label="查看 買ってきて"]');const popup=d.querySelector('#word-dialog'),analysis=popup.querySelector('.form-analysis');assert(analysis.open);
 assert.deepEqual([...analysis.querySelectorAll('.form-steps > li > b')].map(e=>e.textContent),['買う','買っ','買って','買ってくる','買ってきて']);
 const html=analysis.innerHTML;assert(html.indexOf('grammar-in-context')<html.indexOf('form-steps'));assert(html.indexOf('form-steps')<html.indexOf('data-form-contrast'));
 assert.equal(popup.querySelectorAll('[data-form-contrast="te-chain"] .form-example').length,6);assert.match(popup.querySelector('[data-form-contrast="te-chain"]').textContent,/买来.*装上/s);
 click('#word-dialog [data-close]');click('[data-sentence-mode="chunks"]');click('[data-sentence-chunk="2"]');assert.match(d.querySelector('#word-dialog').textContent,/第一个て.*第二个て/s);assert(d.querySelector('#word-dialog .form-steps'));
 click('#word-dialog [data-close]');click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .form-steps,#learning-panel .form-contrast').length,0);
 assert.deepEqual(JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1')).done,[0,18]);assert.deepEqual(errors,[]);dom.window.close();
}
console.log(JSON.stringify({teChains:'PASS',chains,sourceAndProgressPreserved:true,tokenBoundaries:true,kanjiKuruReading:true,webAndNative:true,stepsBeforeLongExamples:true}));
