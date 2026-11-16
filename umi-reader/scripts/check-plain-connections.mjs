import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {connectionLessons} from './content/connection-lessons.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,before=JSON.stringify(B),found=new Set();let total=0,detailMeanings=0;
for(const [i,line] of B.lines.entries())for(const b of S.readingChunks(B,line)?.blocks||[]){
 for(const n of S.chunkConnections(b)){
  assert.equal(n.sentence,i+1);assert(b.quote.includes(n.quote));assert(n.meaning.trim()&&n.why.trim());
  assert.doesNotMatch(n.why,/东西落在它上面|若前后还有描述|前面的名称怎样/);
  found.add((i+1)+'|'+n.quote);total++;
 }
 for(const p of b.detail?.parts||[]){assert(p.meaning?.trim(),'Detailed Japanese quote needs Chinese meaning');detailMeanings++;}
}
for(const n of connectionLessons)assert(found.has(n.sentence+'|'+n.quote),'Unreachable lesson: '+n.quote);
const at=n=>S.readingChunks(B,B.lines[n-1]).blocks.flatMap(b=>S.chunkConnections(b));
assert.equal(at(19).find(n=>n.quote==='たいがいのこと').meaning,'大多数事情');
assert.match(at(19).find(n=>n.quote==='たいがいのこと').why,/たいがい＝大多数，こと＝事情/);
assert(at(25).some(n=>n.quote==='これから数年の息子どもの教育費'));
assert(!at(25).some(n=>n.quote==='どもの教育'));
assert.match(at(48).find(n=>n.quote==='多いみたいで').why,/好像.*不是一种东西/);
assert.match(at(108).find(n=>n.quote==='さびしいもんやき').meaning,/因为/);
assert.equal(at(7).filter(n=>n.quote.includes('父さん')).length,1,'Explain the family chain together');
assert.equal(JSON.stringify(B),before);
for(const native of [false,true]){
 const errors=[],dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let saved=JSON.stringify({index:18,done:[0,1],sentenceMode:'chunks',meaning:false,illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{},speakClip:()=> 'ok',speakRoleClip:()=> 'ok'};
 else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 const jump=n=>{d.querySelector('#jump-number').value=String(n);d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 click('[data-sentence-chunk="3"]');let card=d.querySelector('#word-dialog [data-connection-quote="たいがいのこと"]');assert(card);
 assert.equal(card.querySelector('.chunk-step-japanese').nextElementSibling.textContent,'大多数事情','Put Chinese immediately under Japanese, even when sentence translations are hidden');
 assert.match(card.querySelector('.chunk-connection-explanation').textContent,/たいがい＝大多数，こと＝事情/);
 click('#word-dialog [data-close]');click('[data-tab="walk"]');click('[data-walk-step="3"]');
 assert.equal(d.querySelector('#walk-details .chunk-connection-translation').textContent,'大多数事情');
 jump(17);click('[data-sentence-chunk="1"]');
 assert.equal(d.querySelector('#word-dialog [data-chunk-focus="美しさ"] .chunk-step-japanese').nextElementSibling.textContent,'美；美感');
 click('#word-dialog [data-close]');click('[data-tab="quiz"]');assert(!d.querySelector('#learning-panel .chunk-connection-notes'));
 const state=JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1'));assert.deepEqual(state.done,[0,1]);assert.equal(state.sentenceMode,'chunks');
 assert.deepEqual(errors,[]);dom.window.close();
}
console.log(JSON.stringify({plainConnections:'PASS',phraseCards:total,detailedPhraseMeanings:detailMeanings,allAnchored:true,webAndNative:true,chineseDirectlyBelowJapanese:true,progressPreserved:true,quizIsolation:true}));
