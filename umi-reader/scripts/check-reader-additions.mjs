import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {sentenceStructures} from './content/sentence-structures.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'dist',file),'utf8');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=';
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
const dom=new JSDOM(read('index.html'),{url:'http://localhost:4192/',runScripts:'outside-only'});
const w=dom.window,d=w.document,errors=[],stored=new Map();
let failImages=false,pickerToken,failProgress=false;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.addEventListener('error',event=>errors.push(event.message));
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:37,done:[],illustrations:false}));
const originalSet=w.Storage.prototype.setItem;
w.Storage.prototype.setItem=function(...args){if(failProgress)throw new Error('Storage full');return originalSet.apply(this,args);};
for(const tag of d.querySelectorAll('script[src]')){
 const file=tag.getAttribute('src');w.eval(read(file));
 if(file==='note-images.js'){
  const api=w.UMI_NOTE_IMAGES;
  w.UMI_NOTE_IMAGES={...api,
   read:async ids=>ids.map(id=>stored.get(id)).filter(Boolean),
   save:async records=>{if(failImages)throw new Error('Image store full');for(const record of records)stored.set(record.id,record);},
   remove:async ids=>{for(const id of ids)stored.delete(id);}
  };
 }
}
const click=selector=>{const target=d.querySelector(selector);assert(target,selector);assert(!target.disabled,selector);target.click();};
const state=()=>JSON.parse(w.localStorage.getItem('umi-progress-v1'));
const jump=n=>{d.querySelector('#jump-number').value=n;d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
const {BOOK:book,STUDY_GROUPS:study,UMI_VOCABULARY:vocabulary}=w;
assert.match(study.describe(study.create(book,book.lines[37]).find(g=>g.s==='ためておこう')).definition,/先攒/);

// Check the generated index independently in novel order, including duplicates
// within a sentence and the full expression boundaries actually clicked.
const seen=new Map(),until=[];let sameLine=0;
for(const [lineIndex,line] of book.lines.entries()){
 const local=new Set(),groups=study.create(book,line),row=w.UMI_WORD_OCCURRENCES[lineIndex];
 assert.equal(row.length,groups.length);
 for(const [index,g] of groups.entries()){
  if(g.p==='标点'){assert.equal(row[index],0);continue;}
  const key=vocabulary.key(g.s,g.k),n=(seen.get(key)||0)+1;seen.set(key,n);
  assert.equal(row[index],n,'Wrong ordinal at line '+(lineIndex+1));
  if(local.has(key))sameLine++;local.add(key);
  if(g.s==='までは')until.push({line:lineIndex+1,index,n});
 }
}
assert(sameLine>0);assert(until.length>=2);assert.equal(until[0].n,1);assert.equal(until[1].n,2);
for(const lesson of sentenceStructures){
 const block=study.readingChunks(book,book.lines[lesson.sentence-1])?.blocks.find(b=>b.quote===lesson.quote);
 assert(block?.syntax,'Structure not attached: '+lesson.sentence+' '+lesson.quote);
 assert.equal(JSON.stringify(block.syntax),JSON.stringify(lesson));
}
click('[data-sentence-chunk="0"]');
assert.match(d.querySelector('.sentence-structure').textContent,/主语（省略）ぼく/);
assert.match(d.querySelector('.sentence-structure').textContent,/时间范围入学するまでは/);
assert.match(d.querySelector('.sentence-structure').textContent,/谓语ヒマだ/);
assert(![...d.querySelectorAll('.syntax-row dt')].some(el=>el.textContent==='宾语'));
click('#word-dialog [data-close]');
for(const occurrence of until.slice(0,2)){
 jump(occurrence.line);click('[data-zoom-word="'+occurrence.index+'"]');
 assert.equal(Number(d.querySelector('.word-occurrence b').textContent),occurrence.n);
 click('#word-dialog [data-close]');click('[data-zoom-word="'+occurrence.index+'"]');
 assert.equal(Number(d.querySelector('.word-occurrence b').textContent),occurrence.n,'Reopening must not change the book ordinal');
 click('#word-dialog [data-close]');
}
jump(38);click('[data-zoom-word][aria-label="放大词语：までは"]');
assert(d.querySelector('.sentence-structure'),'Word popups also expose the enclosing clause structure');
const wordKey=d.querySelector('[data-vocab-note]').dataset.vocabNote;
const entry=()=>state().vocabulary.find(e=>vocabulary.key(e.s,e.k)===wordKey);
const lookups=entry().lookups;
w.Android={chooseNoteImage:token=>pickerToken=token};
d.querySelector('.vocab-note-editor').open=true;
const add=async()=>{click('[data-vocab-action="pick-image"]');w.onNativeNoteImage(pickerToken,png,'');await flush();};
await add();
assert.equal(entry().noteImages.length,1);assert.equal(stored.size,1);assert.equal(entry().note,'');
assert.equal(d.querySelectorAll('.vocab-note-gallery img').length,1);assert.match(d.querySelector('[data-note-summary]').textContent,/1 张截图/);
assert.equal(entry().lookups,lookups,'Adding images must not increase lookup frequency');
click('[data-vocab-action="view-image"]');assert(d.querySelector('#note-image-dialog').open);
w.readerBack();assert(!d.querySelector('#note-image-dialog').open);assert(d.querySelector('#word-dialog').open);
click('#word-dialog [data-close]');click('[data-zoom-word][aria-label="放大词语：までは"]');await flush();
assert.equal(d.querySelectorAll('#word-dialog .vocab-note-gallery img').length,1,'Saved images are loaded on reopen');
assert.equal(d.querySelector('.vocab-note-editor').dataset.noteMode,'preview');
click('#word-dialog [data-vocab-action="open"]');click('[data-vocab-action="notes"]');await flush();
assert.equal(d.querySelectorAll('.vocab-row').length,1,'An image-only note belongs to the notes filter');
const savedState=state(),savedImages=await w.UMI_NOTE_IMAGES.read(w.UMI_WEB.imageIds(savedState));
const backup=w.UMI_WEB.encode(savedState,book.lines.length,savedImages),decoded=w.UMI_WEB.readBackup(backup,book.lines.length);
assert.equal(decoded.images[0].data,png);assert.equal(decoded.state.vocabulary.find(e=>e.noteImages).noteImages[0],savedImages[0].id);
assert.throws(()=>w.UMI_WEB.encode(savedState,book.lines.length,[]),/截图/,'A partial screenshot backup must never silently succeed');
const malformed=JSON.parse(backup);malformed.noteImages[0].data='data:image/svg+xml;base64,PHN2Zz4=';
assert.throws(()=>w.UMI_WEB.readBackup(JSON.stringify(malformed),book.lines.length),/截图/);
failImages=true;await add();assert.equal(stored.size,1);assert.equal(entry().noteImages.length,1);failImages=false;
failProgress=true;await add();assert.equal(stored.size,1,'Roll back image bytes if progress cannot save');assert.equal(entry().noteImages.length,1);failProgress=false;
click('[data-note-view="edit"]');click('[data-vocab-action="remove-image"]');await flush();
assert.equal(stored.size,0);assert.equal(entry().noteImages.length,0);
click('[data-vocab-action="notes"]');assert.equal(d.querySelectorAll('.vocab-row').length,0);
click('#vocabulary-dialog [data-close]');click('#open-settings');
const file=d.querySelector('#progress-file');
Object.defineProperty(file,'files',{value:[{size:backup.length,text:async()=>backup}],configurable:true});
file.dispatchEvent(new w.Event('change',{bubbles:true}));await flush();
assert(d.querySelector('#import-dialog').open);click('#confirm-import');await flush();
assert.equal(stored.size,1);assert(entry().noteImages[0]!==savedImages[0].id,'Import stages new IDs instead of overwriting current images');
click('[data-zoom-word][aria-label="放大词语：までは"]');await flush();
assert.equal(d.querySelector('#word-dialog .vocab-note-gallery img').src,png,'Portable import restores the actual image bytes');
assert.deepEqual(errors,[]);dom.window.close();
console.log('PASS: all novel occurrence ordinals, same-line repeats, '+sentenceStructures.length+' reviewed structure blocks, word/chunk UI, image-only notes, native picker callback, failed-save rollback, screenshot viewing and portable import.');
