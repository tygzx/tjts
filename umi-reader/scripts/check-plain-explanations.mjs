import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {buildPlainExplanations,plainPatterns} from './content/plain-explanations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,notes=buildPlainExplanations(B),before=JSON.stringify(B);
for(const n of notes){assert.equal(n.jp.slice(n.start,n.end),n.quote);assert.equal(S.plainExplanation(B,B.lines[n.sentence-1],n.quote)?.meaning,n.meaning);}
assert.throws(()=>buildPlainExplanations({...B,lines:B.lines.map((l,i)=>i===20?{...l,t:[]}:l)}),/Invalid plain explanation/);
assert.match(plainPatterns.progressive[1],/住んでいる.*住在那里/);assert.match(plainPatterns.approach[1],/寒くなってきた/);
const visibleText=node=>node.nodeType===3?node.textContent:node.nodeType!==1?'':node.matches('[hidden]')?'':node.matches('details:not([open])')?visibleText(node.querySelector('summary')):[...node.childNodes].map(visibleText).join(' ');
for(const native of [false,true]){
 const dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document,errors=[];
 let saved=JSON.stringify({index:20,done:[0,18],sentenceMode:'words',illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 const popup=()=>d.querySelector('#word-dialog'),close=()=>click('#word-dialog [data-close]');
 const jump=n=>{d.querySelector('#jump-number').value=String(n);d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 for(const [q,expected] of [['いって',/去银行.*取钱回来/s],['引きだしてくる',/引きだす.*て.*くる/s],['眺めていた',/いる换成いた/]]){
  click('[aria-label="查看 '+q+'"]');
  const card=popup().querySelector('.form-analysis'),text=visibleText(card);
  assert.equal(popup().querySelectorAll('.plain-explanation').length,1,'One focused explanation per popup: '+q);
  assert.match(text,expected);assert.match(text,/母亲/);
  const teaching=visibleText(card.querySelector('.plain-explanation'));assert(teaching.indexOf('这句里是什么意思')<teaching.indexOf('拆开看'));
  assert(!text.includes('单列「いっ」')&&!text.includes('元音分组'));
  assert(text.length<800,'Default explanation stays short: '+q+' '+text.length);
  const more=card.querySelector('.analysis-more');assert(!more.open);more.querySelector('summary').click();assert(more.open);assert(popup().querySelector('.form-steps'));
  assert(popup().querySelector('.analysis-base .form-pronunciation'));
  close();
 }
 click('[data-sentence-mode="chunks"]');click('[data-sentence-chunk="2"]');
 let text=visibleText(popup());assert.match(text,/母亲.*这件事.*を.*眺めていた/s);assert.match(text,/这里的の不是“的”/);
 assert(!popup().querySelector('.chunk-more').open);close();
 click('[data-sentence-chunk="1"]');text=visibleText(popup());assert.match(text,/末尾す换成して/);assert.match(text,/取出钱.*回来.*取钱回来/s);assert(!text.includes('层级')&&!text.includes('名词化'));
 close();jump(20);click('[data-sentence-mode="words"]');click('[aria-label="查看 買ってきて"]');text=visibleText(popup());assert.match(text,/くる换成きて/);assert.match(text,/窗帘.*买回来.*装上/s);close();
 jump(19);click('[aria-label="查看 しまくった"]');assert.equal(popup().querySelectorAll('.plain-explanation').length,1,'No duplicated teaching from overlapping analyses');assert.match(visibleText(popup()),/る换成った/);close();
 click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .plain-explanation,#learning-panel .plain-rule').length,0);
 assert.deepEqual(JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1')).done,[0,18]);assert.deepEqual(errors,[]);dom.window.close();
}
assert.equal(JSON.stringify(B),before);
console.log(JSON.stringify({plainExplanations:'PASS',sourceNotes:notes.length,shortPatternGuides:Object.keys(plainPatterns).length,sourceAndProgressPreserved:true,webAndNative:true,detailsExpandable:true}));
