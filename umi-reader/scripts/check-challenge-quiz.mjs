import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8');
const files=['book.js','grammar.js','lesson-notes.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js'];
const ctx={window:{}};vm.createContext(ctx);for(const f of files)vm.runInContext(read(f),ctx);
const {BOOK:book,SENTENCE_QUIZ:quiz,STUDY_GROUPS:study}=ctx.window,before=JSON.stringify(book),counts={};
const seed=n=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
const all=book.lines.map(l=>study.create(book,l));
const forms=new Map(),readings=new Map();
for(const gs of all)for(const g of gs){const key=g.p+'\0'+study.describe(g).base;if(!forms.has(key))forms.set(key,new Set());forms.get(key).add(g.s);if(!readings.has(g.s))readings.set(g.s,new Set());readings.get(g.s).add(g.k);}
let total=0;
for(let index=0;index<book.lines.length;index++){
 const round=quiz.create(book,index,{difficulty:'challenge',limit:6,rng:seed(index+3)}),groups=all[index];
 assert(round.length>0&&round.length<=6,`line ${index+1}: bounded nonempty round`);
 assert.equal(new Set(round.map(q=>q.id)).size,round.length);
 for(const q of round){
  total++;counts[q.kind]=(counts[q.kind]||0)+1;
  assert.equal(q.choices.length,4);assert.equal(new Set(q.choices.map(c=>c.text)).size,4);assert.equal(new Set(q.choices.map(c=>c.id)).size,4);
  assert(q.explanation&&q.prompt&&q.focus);const answer=q.choices.filter(c=>c.id===q.answerId);assert.equal(answer.length,1);
  if(q.source){
   const span=groups.slice(q.source.start,q.source.end);assert.equal(span.map(g=>g.s).join(''),q.source.text);
   assert.match(q.prompt,/原文/,'Recall tasks do not claim other grammatical variants are universally wrong');
   if(q.kind==='order'){
    assert.equal(answer[0].text,span.map(g=>g.s).join(' → '));
    for(const c of q.choices)assert.deepEqual(c.text.split(' → ').sort(),Array.from(span,g=>g.s).sort());
   }else{
    assert.equal(answer[0].text,q.source.text);
    if(q.kind==='particle')assert.equal(span[0].p,'助词');
    if(q.kind==='form'){
     const family=forms.get(span[0].p+'\0'+study.describe(span[0]).base);
     for(const c of q.choices){assert(family.has(c.text),'Inflections belong to the same source lexeme');assert(!/[っッ]$/.test(c.text),'No truncated inflection distractors');}
    }
   }
  }else if(['meaning','grammar'].includes(q.kind)){
   assert(groups.some(g=>g.s===q.focus&&study.describe(g).reviewed&&study.describe(g).definition===answer[0].text));
   assert(q.context.includes('【'+q.focus+'】'));
  }else if(q.kind==='reading'){
   assert(groups.some(g=>g.s===q.focus&&g.k===answer[0].text));
   assert(q.choices.filter(c=>c.id!==q.answerId).every(c=>!readings.get(q.focus).has(c.text)));
  }else assert.equal(q.kind,'translation');
 }
}
assert.equal(JSON.stringify(book),before);
for(const k of ['reading','meaning','grammar','particle','form','order'])assert(counts[k]>0,k);
const make=n=>quiz.create(book,1,{difficulty:'challenge',limit:6,rng:seed(n)});
assert.equal(JSON.stringify(make(20)),JSON.stringify(make(20)));
assert.notEqual(JSON.stringify(make(20)),JSON.stringify(make(21)));
assert(new Set(make(20).map(q=>q.kind)).size>=4,'Opening round mixes skills');
console.log(`PASS challenge bank: ${book.lines.length} lines, ${total} questions, source-aligned answers, same-verb forms, exact permutations, safe readings and randomization. ${JSON.stringify(counts)}`);

// Exercise the actual reader without keyboard entry or sound. This also runs
// unchanged in the lightweight mirror, whose media-mode file is optional here.
const dom=new JSDOM('<div id="app"></div>',{url:'http://127.0.0.1:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
let stopped=0,saved='{}',spoken=0;w.Android={readState:()=>saved,writeState:s=>saved=s,stop:()=>stopped++,speakClip:()=>{spoken++;return 'ok';}};
for(const f of [...files.slice(0,-1),'wanakana.min.js','playback.js','web-tools.js','sentence-quiz.js'])w.eval(read(f));
let qs=[],calls=0;const real=w.SENTENCE_QUIZ;
w.SENTENCE_QUIZ={create:(...args)=>{calls++;return qs=real.create(...args);}};w.eval(read('app.js'));
const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
click('[data-tab="quiz"]');assert(stopped>0);assert.equal(spoken,0);assert(d.querySelector('.main.quiz-mode'));
assert.equal(d.querySelector('[data-quiz-level="challenge"]').getAttribute('aria-pressed'),'true');
assert.equal(d.querySelectorAll('#learning-panel input,#learning-panel textarea').length,0);
assert.equal(d.querySelector('.quiz-hint'),null);const first=qs[0];click('[data-quiz-hint]');assert(d.querySelector('.quiz-hint'));assert.equal(calls,1);
click('[data-quiz-hint]');click(`[data-quiz-answer="${first.answerId}"]`);assert.match(d.querySelector('.quiz-feedback').textContent,/答对了/);
assert([...d.querySelectorAll('[data-quiz-answer]')].every(b=>b.disabled));
for(let i=1;i<qs.length;i++){click('[data-quiz-next]');assert.equal(d.querySelector('.quiz-hint'),null);click(`[data-quiz-answer="${qs[i].answerId}"]`);}
click('[data-quiz-next]');assert.match(d.querySelector('#learning-panel').textContent,/1 题使用过提示/);
click('[data-quiz-level="basic"]');assert.equal(JSON.parse(saved).quizDifficulty,'basic');assert(qs.every(q=>['reading','meaning','base','translation'].includes(q.kind)));
const backup=w.UMI_WEB.encode(JSON.parse(saved),book.lines.length);assert.equal(w.UMI_WEB.decode(backup,book.lines.length).quizDifficulty,'basic');
click('[data-quiz-level="challenge"]');assert.equal(JSON.parse(saved).quizDifficulty,'challenge');
click('[data-tab="words"]');assert(!d.querySelector('.main.quiz-mode'));assert.equal(spoken,0);w.close();
console.log('PASS click-only UI: default challenge, hidden references, explicit hint tracking, all choices/results, difficulty persistence, backup and no speech.');
