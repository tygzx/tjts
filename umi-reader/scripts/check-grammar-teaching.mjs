import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {buildGrammarLessons} from './lib/build-grammar-lessons.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const b=c.window.BOOK,s=c.window.STUDY_GROUPS,before=JSON.stringify(b),lessons=buildGrammarLessons(c.window.GRAMMAR,c.window.CURATED);
assert.equal(lessons.lessons.length,73);
for(const lesson of lessons.lessons){
 assert(lesson.chineseGuide?.chinese&&lesson.chineseGuide.japanese&&lesson.chineseGuide.watch,'Chinese-first explanation for '+lesson.key);
 assert(!/前项|后项|非过去肯定|未然形|连用形|谓语|词干|语态/.test(Object.values(lesson.chineseGuide).join('')),'Do not require grammar terminology before explaining '+lesson.key);
}
let forms=0,contexts=0,manual=0;
for(const line of b.lines){
 const gs=s.create(b,line),text=line.t.map(i=>b.words[i].s).join('');assert.equal(gs.map(g=>g.s).join(''),text);
 const parts=gs.flatMap(g=>g.parts||g.words);assert.equal(parts.length,line.t.length);parts.forEach((p,i)=>assert.strictEqual(p,b.words[line.t[i]]));
 for(const a of s.analyses(b,line,gs).items){
  assert.equal(text.slice(a.start,a.end),a.quote);
  if(a.kind==='本句逐项讲解'){manual++;continue;}
  forms++;assert(a.grammarLessons.length,'Missing actual grammar teaching for '+a.quote);assert(a.meaningLabel&&!a.meaningLabel.includes('本句理解'));
  if(a.kind==='常见活用拆解'){assert(a.verbClass?.rule);assert.equal(a.formTable.length,8);assert(a.steps.length>=2);}
  for(const lesson of a.grammarLessons){assert(lesson.connection&&lesson.role&&lesson.contrast);assert(lesson.examples.every(e=>e.ja&&e.zh));}
  if(a.contextLesson){contexts++;assert(a.contextLesson.quote.includes(a.quote));assert(text.includes(a.contextLesson.quote));assert(a.contextLesson.why);}
 }
}
assert.equal(JSON.stringify(b),before,'Teaching must not rewrite the novel or dictionary');
for(const [,title] of c.window.GRAMMAR)assert(s.grammarTeaching(title).length,'Missing guide for '+title);
assert.throws(()=>buildGrammarLessons([['x','unknown-pattern']]),/without explanation/);
const synth=(surface,base,ct,p='动词')=>{const book={words:[{s:surface,b:base,ct,p,k:surface,d:'词义',f:'基本形'}]},line={t:[0]};return s.analyses(book,line).items;};
const formsOf=(...args)=>Array.from(synth(...args)[0].steps,x=>x.form);
assert.deepEqual(formsOf('した','する','サ変・スル'),['する','し','した']);
assert.deepEqual(formsOf('食べた','食べる','一段'),['食べる','食べ','食べた']);
assert.deepEqual(formsOf('読んでいた','読む','五段・マ行'),['読む','読ん','読んで','読んでいる','読んでいた']);
assert.deepEqual(formsOf('書いてもらった','書く','五段・カ行イ音便'),['書く','書い','書いて','書いてもらう','書いてもらった']);
assert.equal(synth('行いた','行く','五段・カ行促音便').length,0,'Do not teach imaginary conjugation');
assert.equal(synth('食べさせられた','食べる','一段').length,0,'No guessed auxiliary chain');
assert.equal(synth('雨','雨','')[0],undefined,'No grammar hallucination for a noun');
assert.equal(synth('したら','する','サ変・スル')[0].grammarLessons[0].key,'tara');
assert.equal(synth('読んでいた','読む','五段・マ行')[0].grammarLessons[0].key,'progressive');
assert.match(synth('話した','話す','五段・サ行')[0].steps[1].why,/相同/,'Do not call every conjugation an irregular sound change');
for(const [surface,base,ct,p,key] of [['寒くなかった','寒い','形容詞・アウオ段','形容词','i-adjective'],['よかった','いい','形容詞・イ段','形容词','i-adjective'],['だった','だ','特殊・ダ','助动词','copula']])assert.equal(synth(surface,base,ct,p)[0].grammarLessons[0].key,key);
assert.equal(synth('きれかった','きれい','形容動詞','形容词').length,0,'Do not treat every い ending as an i-adjective');
const voice=s.analyses(b,b.lines[180]).items.find(a=>a.quote==='いわれていた');
assert(voice,'A real token-confirmed voice/state chain needs an explanation');
assert.deepEqual(Array.from(voice.steps,x=>x.form),['いう','いわ','いわれる','いわれて','いわれている','いわれていた']);
assert.deepEqual(Array.from(voice.grammarLessons,x=>x.key),['passive-potential','progressive']);
assert(voice.contextLesson?.why.includes('被动'),'Reviewed context resolves the role; generic form alone does not');
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:18,illustrations:false}));
for(const f of ['book.js','wanakana.min.js','grammar.js','lesson-notes.js','playback.js','illustrations.js','sentence-art.js','sentence-illustrations.js','role-audio.js','learning-audio.js','chinese-emotion.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','web-tools.js','app.js'])if(fs.existsSync(path.join(root,'dist',f)))w.eval(read(f));
d.querySelector('[aria-label="查看 した"]').click();const popup=d.querySelector('#word-dialog');assert(popup.open);
assert(popup.querySelector('[data-grammar-lesson="past"]'));assert.match(popup.textContent,/一步一步怎么变/);assert.match(popup.textContent,/し ＋ た/);assert.match(popup.textContent,/不是单纯过去|不能.*过去|不.*过去/);
assert(popup.querySelector('.grammar-in-context'));assert.match(popup.querySelector('.analysis-meaning').textContent,/词语意思/);assert(!popup.querySelector('.analysis-meaning').textContent.includes('本句理解'));
assert.match(popup.querySelector('.chinese-first-guide').textContent,/中文|日语/);
assert.equal(popup.querySelector('.grammar-verb-class').open,false,'Taxonomy is optional, not the entry point');
assert([...popup.querySelectorAll('.grammar-reference')].every(el=>!el.open),'Formal rules are folded by default');
const visibleOrder=popup.querySelector('.form-analysis').innerHTML;
assert(visibleOrder.indexOf('grammar-in-context')<visibleOrder.indexOf('analysis-base'),'Actual sentence meaning comes first');
assert(visibleOrder.indexOf('chinese-first-guide')<visibleOrder.indexOf('一步一步怎么变'),'Explain the purpose before asking readers to transform words');
const reference=popup.querySelector('.grammar-reference');reference.querySelector('summary').click();assert(reference.open);assert.match(reference.textContent,/具体接法/);
const table=popup.querySelector('.grammar-form-table');table.querySelector('summary').click();assert(table.open);assert.equal(table.querySelectorAll('tbody tr').length,8);
const terms=popup.querySelector('.grammar-glossary');terms.querySelector('summary').click();assert(terms.open);assert.match(terms.textContent,/普通形不等于只有原形/);
popup.close();d.querySelector('[data-tab="words"]').click();assert(d.querySelector('.word-analysis [data-grammar-lesson="past"]'));
d.querySelector('[data-tab="grammar"]').click();assert(d.querySelector('.sentence-analysis .grammar-lesson'));assert(d.querySelector('.chinese-reading-primer'));
// Opening curated cards get their explanations too, not only automatically matched hints.
d.querySelector('#jump-number').value='1';d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
d.querySelector('[data-tab="grammar"]').click();const cards=[...d.querySelectorAll('.grammar-item')];assert(cards.length);assert(cards.every(card=>card.querySelector('.grammar-lesson')));
d.querySelector('[data-tab="quiz"]').click();assert.equal(d.querySelectorAll('#learning-panel .grammar-lesson,dialog[open] .grammar-lesson').length,0);
dom.window.close();console.log(JSON.stringify({grammarTeaching:'passed',lessons:lessons.lessons.length,patterns:c.window.GRAMMAR.length,forms,contexts,manual,sourcePreserved:true,popup:true,glossary:true,formTable:true,quizIsolation:true}));
