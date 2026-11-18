import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {buildSentencePatternExplanations} from './content/sentence-pattern-explanations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,original=JSON.stringify(B),notes=buildSentencePatternExplanations(B);
assert.equal(notes.length,26);
for(const sentence of [25,29,30,31]){
 const line=B.lines[sentence-1],blocks=S.walkthrough(B,line).blocks,lessons=S.sentencePatternLessons(B,line);
 assert.equal(lessons.length,blocks.length,'Every chunk in the reviewed line needs a full explanation');
 for(const block of blocks)assert.equal(block.meaning,lessons.find(n=>n.quote===block.quote).meaning,'Chunk meaning must agree with the reviewed lesson');
}
const expenseGroups=S.create(B,B.lines[30]);
for(const [word,part] of [['なんだかんだ','なんだかんだで'],['は','30枚は'],['消えていった','消えていった'],['はずだ','はずだから']]){
 assert.equal(expenseGroups.find(g=>g.s===word).sentencePart?.ja,part,'Each clicked token gets the corresponding part of the explanation');
}
for(const n of notes){assert.equal(n.jp.slice(n.start,n.end),n.quote);assert.equal(S.sentencePatternLesson(B,B.lines[n.sentence-1],n.quote).meaning,n.meaning);const g=S.create(B,B.lines[n.sentence-1]).filter(g=>g.sentenceLesson?.quote===n.quote);assert(g.length,'Lesson is reachable through words: '+n.quote);assert.equal(S.create(B,B.lines[n.sentence-1]).map(g=>g.s).join(''),n.jp);}
for(const n of [434,2634])assert.equal(S.sentencePatternLessons(B,B.lines[n-1]).length,0,'たとえば must not match たとえ');
assert.equal(S.sentencePatternLessons(B,B.lines[445])[0].pattern.title,'名词＋だし：补充情况');
assert.match(S.sentencePatternLessons(B,B.lines[1186])[0].why,/名词.*街のことだし/);
assert.throws(()=>buildSentencePatternExplanations({...B,lines:B.lines.map((l,i)=>i===24?{...l,t:[]}:l)}),/Invalid sentence pattern/);
const visibleText=node=>node.nodeType===3?node.textContent:node.nodeType!==1?'':node.matches('details:not([open])')?visibleText(node.querySelector('summary')):[...node.childNodes].map(visibleText).join(' ');
for(const native of [false,true]){
 const dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document,errors=[];
 let saved=JSON.stringify({index:24,done:[0,18],sentenceMode:'words',illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const e=d.querySelector(s);assert(e,s);e.click();},popup=()=>d.querySelector('#word-dialog'),close=()=>click('#word-dialog [data-close]');
 const jump=n=>{d.querySelector('#jump-number').value=String(n);d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 click('[aria-label="查看 歩いて"]');let lesson=popup().querySelector('.sentence-pattern-lesson');assert(lesson&&!lesson.closest('details'));
 const headings=[...lesson.querySelectorAll('h3')].map(e=>e.textContent);assert.equal(headings.length,5);assert(headings.every((h,i)=>h.startsWith((i+1)+'.')));assert.match(headings[0],/逐词解析/);assert.match(headings[1],/核心句型/);assert.match(headings[2],/歩いて/);
 let text=visibleText(lesson);assert.match(text,/末尾的く换成いて/);assert.match(text,/方式/);assert.match(text,/弟弟.*教育费.*十五分钟.*十三年.*オンの字/s);assert(!/几乎100|极有可能|性价比/.test(text));
 assert.equal(lesson.querySelectorAll('.pattern-example').length,4);for(const e of lesson.querySelectorAll('.pattern-example'))assert(e.querySelector('[lang="ja"]').nextElementSibling.matches('[lang="zh-CN"]'));
 close();click('[data-sentence-mode="chunks"]');
 for(let i=0;i<7;i++){click('[data-sentence-chunk="'+i+'"]');assert.equal(popup().querySelectorAll('.sentence-pattern-lesson').length,1);assert.equal(popup().querySelectorAll('.sentence-pattern-lesson h3').length,5);assert(!popup().querySelector('.sentence-pattern-lesson').closest('details'));close();}
 click('[data-tab="walk"]');click('[data-walk-step="4"]');assert.match(d.querySelector('#walk-details .pattern-why').textContent,/用走路的方式/);
 click('[data-tab="grammar"]');assert.equal(d.querySelectorAll('#learning-panel .sentence-pattern-card').length,7);
 click('[data-sentence-mode="words"]');click('[aria-label="查看 こと"]');text=visibleText(popup().querySelector('.sentence-pattern-lesson'));assert.match(text,/こと.*だ.*し/s);assert.match(text,/いる本身不变/);assert.match(text,/弟弟以后也要读书/);close();
 for(const n of [124,286,446,622,1187]){jump(n);click('[aria-label="查看 こと"]');assert(popup().querySelector('.sentence-pattern-lesson'));close();}
 jump(124);click('[data-tab="grammar"]');
 assert.equal(d.querySelectorAll('#learning-panel .sentence-pattern-card').length,1);
 const originalAnalysis=S.analyses(B,B.lines[123],S.create(B,B.lines[123])),grammarText=d.querySelector('#learning-panel').textContent;
 assert(originalAnalysis.items.length>0);for(const item of originalAnalysis.items)assert(grammarText.includes(item.quote),'A partial rewrite must preserve other grammar: '+item.quote);
 jump(186);click('[aria-label="查看 たとえ"]');assert.match(visibleText(popup().querySelector('.sentence-pattern-lesson')),/着ていなくても.*着てなくても/s);close();
 jump(31);click('[aria-label="查看 消えていった"]');
 const focus=popup().querySelector('.word-pattern-focus');
 assert(focus&&!focus.closest('details'),'The word popup opens directly to its own explanation');
 assert.match(focus.textContent,/一笔笔开销.*花出去了/s);
 assert.deepEqual([...focus.querySelectorAll('.pattern-forms li > b')].map(e=>e.textContent),['消える','消えて','消えていく','消えていった']);
 assert.match(focus.textContent,/る换成て.*いく变成いった/s);
 const blockLesson=popup().querySelector('.sentence-pattern-lesson');
 assert(blockLesson.closest('details:not([open])'),'The rest of the chunk is optional when looking up one part');
 close();click('[data-sentence-mode="chunks"]');click('[data-sentence-chunk="1"]');
 lesson=popup().querySelector('.sentence-pattern-lesson');
 assert(lesson&&!lesson.closest('details'));
 assert.deepEqual([...lesson.querySelectorAll('.pattern-words > li > b')].map(e=>e.textContent),['なんだかんだで','万札が','30枚は','消えていった','はずだから']);
 assert.match(visibleText(lesson),/少说也有三十张.*至少三十万日元.*る换成て.*いく变成いった.*把这整个估计接到后面/s);
 assert.equal(lesson.querySelectorAll('.pattern-example').length,3);
 close();jump(33);click('[data-sentence-chunk="1"]');
 lesson=popup().querySelector('.sentence-pattern-lesson');
 const living=[...lesson.querySelectorAll('.pattern-words > li')].find(el=>el.querySelector('b').textContent==='生活するのに');
 assert.match(living.querySelector('.pattern-part-meaning').textContent,/日常生活/);
 assert.deepEqual([...living.querySelectorAll('.pattern-points > li > b')].map(e=>e.textContent),['生活する','の','に']);
 assert.match(visibleText(lesson),/土佐方言.*ないだろう/s);
 close();click('[data-sentence-mode="words"]');click('[aria-label="查看 生活する"]');
 const livingFocus=popup().querySelector('.word-pattern-focus');
 assert.match(livingFocus.textContent,/生活するのに.*日常生活/s);
 assert.equal(livingFocus.querySelectorAll('.pattern-points > li').length,3);
 close();
 click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .sentence-pattern-lesson').length,0);assert.deepEqual(JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1')).done,[0,18]);assert.deepEqual(errors,[]);dom.window.close();
}
assert.equal(JSON.stringify(B),original);
console.log(JSON.stringify({sentencePatterns:'PASS',sourceReviewedLessons:notes.length,completeSentences:[25,29,30,31],focusedVerbForms:true,kotoDashiOccurrences:6,tatoeOccurrences:3,fiveSectionsVisible:true,webAndNative:true,sourceAndProgressPreserved:true}));
