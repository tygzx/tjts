import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8');
const note='我把它理解成：遇到的麻烦。\n自己的例子：A < B & C。\n</textarea><img id="note-injection" src="x">';
function page(native,saved){
 const dom=new JSDOM(read('index.html'),{url:'http://127.0.0.1:4190/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,errors=[];
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));w.Math.random=()=>.23;
 if(native)w.Android={readState:()=>saved,writeState:s=>saved=s,stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const tag of d.querySelectorAll('script[src]'))w.eval(read(tag.getAttribute('src')));
 const state=()=>JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1'));
 const click=selector=>{const el=d.querySelector(selector);assert(el,selector);assert(!el.disabled,selector);el.click();};
 const edit=(selector,value,type='input')=>{const el=d.querySelector(selector);assert(el);el.value=value;el.dispatchEvent(new w.Event(type,{bubbles:true}));return el;};
 return {dom,w,d,errors,state,click,edit};
}
for(const native of [false,true]){
 const p=page(native,JSON.stringify({index:0,done:[2],sentenceMode:'words'})),{w,d,click,state,edit}=p;
 click('[data-zoom-word][aria-label="放大词语：問題"]');
 assert(!d.querySelector('.vocab-note-editor').open,'An empty note does not push existing explanations out of view');
 edit('#word-dialog [data-vocab-note]',note);
 assert.equal(state().vocabulary[0].note,note);assert.equal(state().vocabulary[0].lookups,1);assert(!w.UMI_VOCABULARY.active(state().vocabulary[0]));
 assert.match(d.querySelector('[data-note-status]').textContent,/已保存/);
 click('#word-dialog [data-close]');click('[data-zoom-word][aria-label="放大词语：問題"]');
 assert.equal(d.querySelector('#word-dialog [data-vocab-note]').value,note);assert(d.querySelector('.vocab-note-editor').open);assert(!d.querySelector('#note-injection'),'Notes are plain text, not HTML');
 click('#word-dialog [data-vocab-action="toggle"]');assert.equal(d.querySelector('#word-dialog [data-vocab-note]').value,note,'Changing familiarity must not replace the note editor');
 click('#word-dialog [data-vocab-action="open"]');click('[data-vocab-action="notes"]');
 assert.equal(d.querySelectorAll('.vocab-row').length,1);assert.equal(d.querySelector('.vocab-row [data-vocab-note]').value,note);
 const updated='我自己的理解：要结合上下文。\n下次留意这个词的用法。';
 edit('#vocabulary-dialog [data-vocab-note]',updated,'compositionend');assert.equal(state().vocabulary[0].note,updated);assert.equal(state().vocabulary[0].lookups,2);
 const record=state().vocabulary[0],clean=w.UMI_VOCABULARY.clean([{...record,note:{bad:true}},{s:'bad',k:'bad'}],w.BOOK.lines.length);assert.equal(clean[0].note,'');
 const legacy=w.UMI_VOCABULARY.clean([{...record,note:undefined}],w.BOOK.lines.length);assert.equal(legacy[0].note,'');
 const backup=w.UMI_WEB.decode(w.UMI_WEB.encode(state(),w.BOOK.lines.length),w.BOOK.lines.length);assert.equal(backup.vocabulary[0].note,updated);
 const without=state().vocabulary.map(e=>({...e,note:''}));
 assert.equal(JSON.stringify(w.SENTENCE_QUIZ.vocabulary(w.BOOK,without)),JSON.stringify(w.SENTENCE_QUIZ.vocabulary(w.BOOK,state().vocabulary)),'Personal notes never become quiz answer keys');
 if(!native){
  const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(){throw new Error('Simulated full storage');};
  edit('#vocabulary-dialog [data-vocab-note]',updated+'\n补充一句。');
  assert.match(d.querySelector('#vocabulary-dialog [data-note-status]').textContent,/未能保存/);assert(!d.querySelector('#vocabulary-dialog [data-vocab-action="retry-note"]').hidden);
  assert.equal(state().vocabulary[0].note,updated,'Failed writes must not be reported as saved');
  click('[data-vocab-action="notes"]');assert.match(d.querySelector('#vocabulary-dialog [data-note-status]').textContent,/未能保存/,'Rendering the list again cannot turn a failed save into a success');
  w.Storage.prototype.setItem=original;click('#vocabulary-dialog [data-vocab-action="retry-note"]');assert.equal(state().vocabulary[0].note,updated+'\n补充一句。');
 }
 click('[data-vocab-action="practice"]');await new Promise(r=>setTimeout(r,80));
 assert(d.querySelector('.vocab-practice-note'));assert(!d.querySelector('.vocab-practice-note').open,'The personal hint starts closed before answering');
 const q=w.SENTENCE_QUIZ.vocabulary(w.BOOK,state().vocabulary,{limit:10})[0];click('[data-vocab-answer="'+q.answerId+'"]');
 assert(d.querySelector('.vocab-practice-note').open);assert.equal(d.querySelector('.vocab-practice-note p').textContent,state().vocabulary[0].note);assert.equal(state().vocabulary[0].lookups,2);
 const saved=JSON.stringify(state());p.dom.window.close();assert.equal(p.errors.length,0);
 const r=page(native,saved);r.click('[data-zoom-word][aria-label="放大词语：問題"]');
 assert.equal(r.d.querySelector('#word-dialog [data-vocab-note]').value,JSON.parse(saved).vocabulary[0].note,'Reload preserves the complete note');
 const count=r.state().vocabulary[0].lookups;r.edit('#word-dialog [data-vocab-note]','');assert.equal(r.state().vocabulary[0].note,'');assert.equal(r.state().vocabulary[0].lookups,count);
 r.click('#word-dialog [data-vocab-action="open"]');r.click('[data-vocab-action="notes"]');assert.equal(r.d.querySelectorAll('.vocab-row').length,0);assert.match(r.d.querySelector('.vocab-empty').textContent,/还没有自己的笔记/);
 assert.equal(r.errors.length,0);r.dom.window.close();
}
console.log('PASS: immediate autosave, Chinese input, popup/notebook editing, refresh/native persistence, legacy migration and backup, note filtering, practice hints, plain-text escaping, clearing, storage failure and retry, and unchanged lookup/quiz semantics.');
