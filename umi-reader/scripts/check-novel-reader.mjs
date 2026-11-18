import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8');
const html=read('index.html');assert(html.includes('novel-reader.css'));assert(html.indexOf('novel-reader.js')<html.indexOf('app.js'));
for(const native of [false,true]){
 const dom=new JSDOM(html,{url:'https://umi.local/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,errors=[];
 let saved=JSON.stringify({index:24,done:[0,1,19],ruby:true,romaji:true,sentenceMode:'chunks',sentencePlayback:{24:{mode:'ja',count:0,pause:3}}});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>saved=s,stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const tag of d.querySelectorAll('script[src]'))w.eval(read(tag.getAttribute('src')));
 const B=w.BOOK,original=JSON.stringify(B),text=n=>B.lines[n].t.map(i=>B.words[i].s).join('');
 const current=()=>JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1'));
 const click=selector=>{const e=d.querySelector(selector);assert(e,selector);assert(!e.disabled,selector);e.click();};
 click('#open-novel');assert(d.body.classList.contains('novel-mode'));assert(!d.querySelector('.scene-card,.sentence-card,.learning-tabs,#learning-panel'));assert(!d.querySelector('#novel-flow rt'));
 assert.equal(current().index,24);assert.equal(current().readingMode,'novel');assert.equal(current().ruby,true);
 const checkParagraphs=()=>{for(const p of d.querySelectorAll('[data-novel-paragraph]')){const clone=p.cloneNode(true);clone.querySelectorAll('rt').forEach(e=>e.remove());assert.equal(clone.textContent,text(Number(p.dataset.novelParagraph)),'Source text stays verbatim');}};
 checkParagraphs();click('[data-novel-action="ruby"]');assert(d.querySelector('#novel-flow rt'));checkParagraphs();
 click('[data-novel-action="larger"]');assert.equal(current().novelFont,24);click('[data-novel-action="smaller"]');assert.equal(current().novelFont,22);
 const offset=text(24).indexOf('歩いて');click('[data-novel-line="24"][data-novel-offset="'+offset+'"]');
 assert.match(d.querySelector('#word-dialog .word-zoom-text').textContent,/歩いて/);assert(d.querySelector('#word-dialog .sentence-pattern-lesson'));assert.equal(current().index,24);
 assert.equal(w.readerBack(),true);assert(!d.querySelector('dialog[open]'));assert(d.querySelector('#novel-flow'));
 const backup=w.UMI_WEB.decode(w.UMI_WEB.encode(current(),B.lines.length),B.lines.length);assert.equal(backup.readingMode,'novel');assert.equal(backup.novelRuby,true);assert.deepEqual(JSON.parse(JSON.stringify(backup.novelPosition)),{line:24,offset:0});
 // Cover every original paragraph without manufacturing or dropping text at section boundaries.
 if(!native){let total=d.querySelectorAll('[data-novel-paragraph]').length;for(let i=1;i<B.sections.length;i++){click('[data-novel-action="contents"]');click('[data-novel-section="'+i+'"]');checkParagraphs();total+=d.querySelectorAll('[data-novel-paragraph]').length;assert.equal(current().index,B.sections[i].start);}assert.equal(total,B.lines.length);}
 click('[data-novel-action="exit"]');assert(!d.body.classList.contains('novel-mode'));assert(d.querySelector('.sentence-card'));assert.equal(current().ruby,true);assert.equal(current().romaji,true);assert.equal(current().sentenceMode,'chunks');assert.deepEqual(current().done,[0,1,19]);assert.deepEqual(current().sentencePlayback,{24:{mode:'ja',count:0,pause:3}});
 click('#open-novel');assert.equal(w.readerBack(),true);assert.equal(current().readingMode,'study');assert.equal(JSON.stringify(B),original);assert.deepEqual(errors,[]);dom.window.close();
}
// Deterministic measured-column fixture exercises page boundaries and position persistence.
// It tests navigation logic; it does not substitute for real-browser typography inspection.
{
 const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const B={words:[{s:'文章',k:'ぶんしょう',p:'名词'}],lines:Array.from({length:12},()=>({t:[0]})),sections:[{name:'一',start:0},{name:'二',start:10}]};
 let state={index:0,novelFont:22,novelRuby:false,novelPosition:{line:0,offset:0}},exitLine=null;
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return this.classList.contains('novel-stage')?176:this.id==='novel-flow'?parseFloat(this.style.width)||176:0;}});
 Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return this.classList.contains('novel-stage')?440:0;}});
 Object.defineProperty(w.HTMLElement.prototype,'scrollWidth',{get(){return this.id==='novel-flow'?Math.max(this.clientWidth,this.querySelectorAll('p').length*44+(parseFloat(this.querySelector('.novel-end-space')?.style.width)||0)):0;}});
 Object.defineProperty(w.HTMLElement.prototype,'scrollLeft',{get(){return this._scrollLeft||0;},set(n){this._scrollLeft=Math.max(-(this.scrollWidth-this.clientWidth),Math.min(0,n));}});
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.id==='novel-flow')return {left:0,right:176,top:0,bottom:440};const p=this.matches('p')?this:this.closest('p');if(p){const flow=d.querySelector('#novel-flow'),i=[...flow.querySelectorAll('p')].indexOf(p),right=176-i*44-flow.scrollLeft;return {left:right-30,right,top:0,bottom:100};}return {left:0,right:0,top:0,bottom:0};};
 w.HTMLElement.prototype.getClientRects=function(){return [this.getBoundingClientRect()];};
 w.eval(read('novel-reader.js'));
 const reader=w.createNovelReader({book:B,getState:()=>state,save:()=>{},lookup:()=>{},exit:n=>exitLine=n,showDialog:()=>{}});
 reader.mount(d.querySelector('#app'));assert.equal(d.querySelector('#novel-page-status').textContent,'1 / 3 页');
 reader.turn(1);assert.equal(d.querySelector('#novel-flow').scrollLeft,-176);assert.equal(state.index,4);assert.equal(d.querySelector('#novel-page-status').textContent,'2 / 3 页');
 reader.turn(1);assert.equal(state.index,8);assert.equal(d.querySelector('#novel-page-status').textContent,'3 / 3 页');reader.turn(-1);assert.equal(state.index,4);
 reader.destroy();reader.mount(d.querySelector('#app'));assert.equal(d.querySelector('#novel-flow').scrollLeft,-176,'Reload restores the column containing the saved word');
 reader.turn(1);reader.turn(1);assert.equal(state.index,10);reader.turn(-1);assert.equal(state.index,8,'Previous section opens at its last page');
 reader.leave();assert.equal(exitLine,8);reader.destroy();dom.window.close();
}
console.log(JSON.stringify({novelReader:'PASS',sourceParagraphs:2640,webAndNative:true,lookup:true,independentPreferences:true,backups:true,measuredPageNavigation:true,progressPreserved:true}));
