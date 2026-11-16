import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {buildContextApplications} from './content/context-applications.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','grammar.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,notes=buildContextApplications(B);
for(const n of notes){const analyses=S.analyses(B,B.lines[n.sentence-1]).items;assert(analyses.some(a=>a.applications?.some(x=>x.quote===n.quote)),'Unused source explanation '+n.sentence+' '+n.quote);assert.equal(n.jp.slice(n.start,n.end),n.quote);}
const find=q=>S.analyses(B,B.lines[20]).items.find(a=>a.quote===q);
assert.match(find('いって').application.connection,/去银行.*取钱回来/);assert.match(find('いって').application.time,/いって本身并不是过去式/);
assert.match(find('みちて').application.contrast,/不是先感激完/);assert.match(find('眺めていた').application.role,/看的人是ぼく/);
let contextualForms=0;for(const l of B.lines)for(const a of S.analyses(B,l).items)if(a.contextLesson?.whole){contextualForms++;assert(a.contextLesson.who&&a.contextLesson.source);assert(a.contextLesson.source.includes(a.quote));}
assert(contextualForms>400);
const changed={...B,lines:B.lines.map((l,i)=>i===20?{...l,t:[]}:l)};assert.throws(()=>buildContextApplications(changed),/Changed context application/);
for(const native of [false,true]){
 const dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document,errors=[];
 let saved=JSON.stringify({index:20,done:[0,18],sentenceMode:'words',illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{}};else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 click('[aria-label="查看 いって"]');const popup=d.querySelector('#word-dialog'),a=popup.querySelector('.form-analysis');assert(a.open);
 const application=popup.querySelector('.grammar-application');assert.match(application.textContent,/去的是母亲|去银行的是母亲/);assert.match(application.textContent,/５万10万/);assert.match(application.textContent,/接着/);
 const html=a.innerHTML;assert(html.indexOf('form-steps')<html.indexOf('grammar-application'));assert(html.indexOf('grammar-application')<html.indexOf('data-grammar-lesson'));assert(html.indexOf('grammar-context-recap')>html.lastIndexOf('data-grammar-lesson'));
 assert.match(popup.querySelector('.grammar-context-recap').textContent,/我满怀感激.*母亲.*银行/);assert.match(popup.querySelector('.grammar-context-recap').textContent,/去银行取钱的是母亲/);
 click('#word-dialog [data-close]');click('[aria-label="查看 みちて"]');assert.match(d.querySelector('#word-dialog .grammar-application').textContent,/满怀感激地/);assert.match(d.querySelector('#word-dialog .grammar-application').textContent,/不是先感激完/);
 click('#word-dialog [data-close]');click('[data-sentence-mode="chunks"]');click('[data-sentence-chunk="0"]');assert(d.querySelector('#word-dialog .grammar-application'));assert.match(d.querySelector('#word-dialog').textContent,/取钱回来/);
 click('#word-dialog [data-close]');click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .grammar-application,#learning-panel .grammar-context-recap').length,0);
 assert.deepEqual(JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1')).done,[0,18]);assert.deepEqual(errors,[]);dom.window.close();
}
console.log(JSON.stringify({contextApplications:'PASS',sourceReviewedNotes:notes.length,contextualForms,bankVisitAndWithdrawal:true,feelingWhileWatching:true,returnToPassageAfterGrammar:true,webAndNative:true,progressPreserved:true}));
