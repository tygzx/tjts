import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {chunkGrammarDetails} from './content/chunk-grammar-details.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,before=JSON.stringify(B);let nominal=0,likeness=0,connections=0,formsInChunks=0;
for(const line of B.lines){
 const gs=S.create(B,line);for(const a of S.analyses(B,line,gs).items){if(a.kind==='形容词变成名词')nominal++;if(a.kind==='比喻表达的接法')likeness++;}
 const l=S.readingChunks(B,line,gs);for(const block of l?.blocks||[]){connections+=S.chunkConnections(block).length;formsInChunks+=S.analyses(B,line,gs).items.filter(a=>a.start<block.end&&a.end>block.start).length;}
}
assert(nominal>0&&likeness>0&&connections>0);
assert.equal(chunkGrammarDetails.length,12);
for(const detail of chunkGrammarDetails){
 const b=S.readingChunks(B,B.lines[detail.sentence-1]).blocks.find(b=>b.quote===detail.quote);assert(b?.detail);
 const covered=new Set();for(const p of detail.parts){
  assert(p.paragraphs.length&&p.paragraphs.every(x=>x.trim()));for(const m of detail.quote.matchAll(new RegExp(p.quote.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g')))for(let i=m.index;i<m.index+p.quote.length;i++)covered.add(i);
 }
 [...detail.quote].forEach((ch,i)=>{if(!/[\p{P}\s]/u.test(ch))assert(covered.has(i),'Unexplained text in '+detail.quote+': '+ch);});
}
const gs=S.create(B,B.lines[16]),a=S.analyses(B,B.lines[16],gs).items.find(a=>a.quote==='美しさ');
assert.equal(a.base,'美しい');assert.equal(a.baseKana,'うつくしい');assert.deepEqual(Array.from(a.steps,x=>x.form),['美しい','美し','美しさ']);
assert(gs.find(g=>g.s==='みたいに').analyses.some(a=>a.grammarLessons.some(l=>l.key==='mitai')));
const hints=S.grammarHints(B,B.lines[16],c.window.GRAMMAR,gs);
assert(!hints.some(h=>h.title==='〜のに'||h.title==='〜ても／〜でも'),'Do not teach false grammar inside もの or いつまでも');
assert.equal(hints.filter(h=>h.title==='〜ている').length,2,'Explain both occurrences, not only the first one');
for(const [words,title] of [[['雨','な','のに'],'〜のに'],[['雨','で','も'],'〜ても／〜でも']]){
 const book={words:words.map((s,i)=>({s,k:s,b:s,p:i?'助词':'名词'}))},line={t:words.map((_,i)=>i)};
 assert(S.grammarHints(book,line,c.window.GRAMMAR).some(h=>h.title===title),'Keep real '+title);
}
const fake={words:[{s:'み',k:'み',b:'みる',p:'动词',ct:'一段'},{s:'たい',k:'たい',b:'たい',p:'助动词'}]},fakeLine={t:[0,1]};
assert(!S.grammarHints(fake,fakeLine,c.window.GRAMMAR).some(h=>h.title==='〜みたい'),'Wanting to see is not a likeness expression');
assert.equal(JSON.stringify(B),before);
const errors=[],dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.addEventListener('error',e=>errors.push(e.message));
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:16,illustrations:false}));for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
const click=s=>{const e=d.querySelector(s);assert(e,s);e.click();};
click('.sentence-chunk[data-sentence-chunk="1"]');let dialog=d.querySelector('#word-dialog');assert(dialog.querySelector('.chunk-deep-lesson'));assert.equal(dialog.querySelectorAll('.chunk-explanation-steps>li').length,5);
assert.match(dialog.querySelector('[data-chunk-focus="美しさ"]').textContent,/去掉最后的い.*换成さ/s);
assert.match(dialog.querySelector('[data-chunk-focus="淋しい美しさに"]').textContent,/充满什么.*不是.*在哪里/s);
assert.deepEqual([...dialog.querySelectorAll('[data-chunk-focus="満ちていた"] .chunk-form-steps b')].map(x=>x.textContent),['満ちる','満ちて','満ちている','満ちていた']);
assert.match(dialog.querySelector('[data-chunk-focus="満ちていた"]').textContent,/不再单独译为“有人在那里”/);
click('.chunk-dialog-nav [data-sentence-chunk="0"]');dialog=d.querySelector('#word-dialog');assert.equal(dialog.querySelectorAll('.chunk-grammar>[data-grammar-variants] .grammar-variant').length,3);
click('#word-dialog [data-close]');click('[data-sentence-mode="words"]');click('[aria-label="查看 みたいに"]');dialog=d.querySelector('#word-dialog');
const variants=dialog.querySelector('[data-grammar-variants]');assert(variants);assert.equal(variants.querySelectorAll('.grammar-variant').length,3);
assert.match(variants.textContent,/みたいだな雲/);assert.match(variants.textContent,/みたいだに/);assert.match(variants.textContent,/見たい/);
assert.equal(dialog.querySelector('details.form-analysis').open,true,'The detailed lesson is directly visible');
click('#word-dialog [data-close]');click('[aria-label="查看 美しさ"]');assert.match(d.querySelector('#word-dialog .analysis-base').textContent,/美しい.*うつくしい/s);
click('#word-dialog [data-close]');click('[data-tab="walk"]');click('.walk-chunk[data-walk-step="1"]');assert(d.querySelector('#walk-details .chunk-deep-lesson'));
click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .chunk-deep-lesson,#learning-panel .grammar-variants').length,0);
assert.deepEqual(errors,[]);dom.window.close();console.log(JSON.stringify({deepChunkGrammar:'passed',detailedChunks:chunkGrammarDetails.length,nominalAnalyses:nominal,likenessAnalyses:likeness,connectionNotes:connections,analysesInChunks:formsInChunks,sourcePreserved:true,falseMatchesRemoved:true,wordPopup:true,quizIsolation:true}));
