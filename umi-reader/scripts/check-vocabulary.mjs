import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8');
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['book.js','lesson-notes.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','vocabulary.js','web-tools.js'])vm.runInContext(read(f),ctx);
const {BOOK:B,UMI_VOCABULARY:V,STUDY_GROUPS:S,SENTENCE_QUIZ:Q,UMI_WEB:WEB}=ctx.window;
const {threshold}=V;
assert.equal(threshold,9);
const before=JSON.stringify(B),source=i=>B.lines[i].t.map(n=>B.words[n].s).join('');
const at=(line,s)=>{let offset=0;for(const g of S.create(B,B.lines[line])){if(g.s===s)return {g,offset};offset+=g.s.length;}throw Error(s);};
const word=at(0,'問題'),data=[];
for(let n=1;n<=threshold;n++){V.visit(data,0,word.offset,word.g);assert.equal(data[0].lookups,n);assert.equal(V.active(data[0]),n===threshold);}
V.master(data[0]);assert(!V.active(data[0]));assert.equal(data[0].lookups,threshold);
for(let n=1;n<=threshold;n++){V.visit(data,0,word.offset,word.g);assert.equal(V.active(data[0]),n===threshold,'Only nine additional lookups undo mastery');}
const another=B.lines.findIndex((l,i)=>i>0&&source(i).includes('問題')&&S.create(B,l).some(g=>g.s==='問題'&&g.k===word.g.k));assert(another>0);
const otherWord=at(another,'問題'),totalLookups=threshold*2+1;
V.visit(data,another,otherWord.offset,otherWord.g);assert.equal(data.length,1);assert.equal(data[0].lookups,totalLookups);assert.equal(data[0].seen.length,2);
V.visit(data,another,otherWord.offset,otherWord.g,false);assert.equal(data[0].lookups,totalLookups,'Review lookups do not inflate reading statistics');
V.answer(data[0],false);V.answer(data[0],true);assert.equal(data[0].wrong,1);assert.equal(data[0].correct,1);assert.equal(data[0].lookups,totalLookups);
const distinct=[];V.visit(distinct,0,0,{s:'上',k:'うえ'});V.visit(distinct,0,0,{s:'上',k:'かみ'});assert.equal(distinct.length,2,'Different readings retain separate records');
const malformed=[null,{},...data,{s:'x',k:'x',lookups:-8,seen:[{line:-1,offset:0}]}];assert.equal(V.clean(malformed,B.lines.length).length,1);
const back=WEB.decode(WEB.encode({index:1,done:[0],vocabulary:data},B.lines.length),B.lines.length);assert.equal(JSON.stringify(back.vocabulary),JSON.stringify(V.clean(data,B.lines.length)));
const legacy=WEB.decode(JSON.stringify({format:'umi-reading-progress',version:1,book:'umi-volume-1-2640',state:{index:0,done:[]}}),B.lines.length);assert.equal(legacy.vocabulary.length,0);
const fund=at(1,'ふんだ');V.visit(data,1,fund.offset,fund.g);data[1].pinned=true;
const seed=n=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
const make=n=>Q.vocabulary(B,data,{rng:seed(n)}),questions=make(123),allowed=new Set(data.map(e=>V.key(e.s,e.k)));
assert(questions.length>=2&&questions.length<=10);assert.notEqual(JSON.stringify(questions),JSON.stringify(make(125)));
for(const q of questions){
 assert(allowed.has(q.vocabKey));assert.equal(q.choices.length,4);assert.equal(new Set(q.choices.map(c=>c.text)).size,4);assert.equal(q.choices.filter(c=>c.id===q.answerId).length,1);
 const g=S.create(B,B.lines[q.line]).find(g=>V.key(g.s,g.k)===q.vocabKey);assert(g);
 if(q.kind==='recall')assert.equal(q.choices.find(c=>c.id===q.answerId).text,g.s);else assert.equal(q.focus,g.s);
 assert(q.context&&q.explanation);
}
assert.equal(Q.vocabulary(B,[],{}).length,0);assert.equal(JSON.stringify(B),before);

function page(native,saved){
 const dom=new JSDOM(read('index.html'),{url:'http://127.0.0.1:4188/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,errors=[];
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));w.Math.random=()=>.23;
 if(native)w.Android={readState:()=>saved,writeState:s=>saved=s,stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const tag of d.querySelectorAll('script[src]'))w.eval(read(tag.getAttribute('src')));
 const state=()=>JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1'));
 const click=selector=>{const el=d.querySelector(selector);assert(el,selector);assert(!el.disabled,selector);el.click();};
 return {dom,w,d,errors,state,click};
}
for(const native of [false,true]){
 const p=page(native,JSON.stringify({index:0,done:[2],sentenceMode:'words'})),{w,d,click,state}=p;
 for(let i=1;i<=threshold;i++){
  click('[data-zoom-word][aria-label="放大词语：問題"]');assert.match(d.querySelector('[data-vocab-control]').textContent,new RegExp('已查 '+i+' 次'));
  if(i<threshold)assert.match(d.querySelector('[data-vocab-control]').textContent,/查满 9 次/);
  click('#word-dialog [data-close]');
 }
 assert.equal(state().vocabulary[0].lookups,threshold);assert.equal(d.querySelector('[data-vocab-count]').textContent,'1');
 click('[data-vocab-action="open"]');assert.match(d.querySelector('.vocab-row').textContent,/問題[\s\S]*查了 9 次/);
 click('[data-vocab-action="practice"]');await new Promise(r=>setTimeout(r,70));
 const q=w.SENTENCE_QUIZ.vocabulary(w.BOOK,state().vocabulary,{limit:10})[0];
 assert.equal(d.querySelector('.vocab-question').textContent,q.prompt);
 const wrong=q.choices.find(c=>c.id!==q.answerId).id;
 click('[data-vocab-answer="'+wrong+'"]');assert.equal(state().vocabulary[0].wrong,1);assert.equal(state().vocabulary[0].lookups,threshold);
 d.querySelector('[data-vocab-answer="'+wrong+'"]').click();assert.equal(state().vocabulary[0].wrong,1,'Disabled answers cannot be counted twice');
 click('[data-vocab-action="master-next"]');assert(!w.UMI_VOCABULARY.active(state().vocabulary[0]));assert(d.querySelector('.vocab-round-end'));
 click('[data-vocab-action="list"]');assert.match(d.querySelector('.vocab-empty').textContent,/没有待复习/);
 click('[data-vocab-action="all"]');click('[data-vocab-action="toggle"]');assert(w.UMI_VOCABULARY.active(state().vocabulary[0]));
 const initialCount=state().vocabulary[0].lookups;click('[data-vocab-action="source"]');assert(d.querySelector('#word-dialog[open]'));assert.equal(state().vocabulary[0].lookups,initialCount,'Returning to saved explanation does not count as a new reading lookup');
 click('#word-dialog [data-close]');click('#open-novel');
 const problem=d.querySelector('[data-novel-line="0"][data-novel-offset="'+word.offset+'"]');assert(problem);
 problem.dispatchEvent(new w.Event('pointerover',{bubbles:true}));assert.equal(state().vocabulary[0].lookups,initialCount,'Hover does not count');
 problem.click();assert.equal(state().vocabulary[0].lookups,initialCount+1);click('#word-dialog [data-close]');
 const copy=JSON.stringify(state());p.dom.window.close();
 const reloaded=page(native,copy);assert.equal(reloaded.state().vocabulary[0].lookups,initialCount+1);assert.deepEqual(reloaded.state().done,[2]);
 reloaded.click('[data-vocab-action="open"]');assert.match(reloaded.d.querySelector('.vocab-row').textContent,/查了 10 次/);assert.equal(reloaded.errors.length,0);reloaded.dom.window.close();assert.equal(p.errors.length,0);
}
console.log('PASS: lookup counts, cross-sentence identity, nine-lookup review threshold, manual marking/mastery, wrong-answer stats, focused randomized choices, backup migration, web/native persistence, and vertical reading integration.');
