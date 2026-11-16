import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {actionConnectionLessons} from './content/action-connection-lessons.mjs';
import {buildActionConnections} from './lib/build-action-connections.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const B=c.window.BOOK,S=c.window.STUDY_GROUPS,original=JSON.stringify(B),found=new Set();let total=0;
for(const [i,line] of B.lines.entries()){
 const jp=line.t.map(id=>B.words[id].s).join(''),groups=S.create(B,line),actions=S.actionConnections(B,line);
 assert.equal(groups.map(g=>g.s).join(''),jp);
 for(const a of actions){
  total++;assert.equal(jp.slice(a.start,a.end),a.quote);assert.equal(jp[a.particleStart],'を');assert(a.relation.includes('お（o）'));
  assert.equal(a.sentence,i+1);assert(a.nounMeaning&&a.meaning&&a.steps.length);assert.equal(a.steps.at(-1).form,a.form);
  let start=0;const at=groups.map(g=>{const p={g,start,end:start+g.s.length};start=p.end;return p;});
  assert(at.find(g=>g.start<=a.particleStart&&g.end>a.particleStart).g.actionLessons.includes(a),'Teach the particle itself, not only the verb');
  assert(at.find(g=>g.start<=a.verbStart&&g.end>a.verbStart).g.actionLessons.includes(a),'Teach the connected verb too');
  for(const block of S.readingChunks(B,line,groups)?.blocks||[])if(a.start<block.end&&a.end>block.start)assert(block.actionLessons.includes(a));
  found.add(i+1+'|'+a.noun+'|'+a.form);
 }
}
assert.equal(total,99);for(const a of actionConnectionLessons)assert(found.has(a.sentence+'|'+a.noun+'|'+a.form));
// Audit actual token relations, including a する hidden inside a larger study unit.
for(const [i,line] of B.lines.entries()){
 let offset=0;const ts=line.t.map(id=>{const w=B.words[id],start=offset;offset+=w.s.length;return {...w,start};});
 for(let k=0;k<ts.length-1;k++)if(ts[k].s==='を'&&ts[k].p==='助词'&&['する','しまくる'].includes(ts[k+1].b))assert(S.actionConnections(B,line).some(a=>a.particleStart===ts[k].start),'Missing repeated lesson at sentence '+(i+1));
}
const at=n=>S.actionConnections(B,B.lines[n-1]);
assert.deepEqual(Array.from(at(19)[0].steps,s=>s.form),['する','し','した']);
assert.match(at(19)[0].relation,/不表示“做”.*不表示“了”/);
assert.match(at(19)[1].steps.at(-1).why,/不是しまった/);
for(const n of [464,1138,1568])assert(at(n).some(a=>a.noun==='電話'&&a.steps.length===3),'Repeat at each phone call');
assert.equal(at(140).length,2,'Two similar expressions in one sentence both need teaching');
assert(at(140).every(a=>a.sense==='appearance'&&a.steps.at(-1).why.includes('并不是说现在')));
assert.match(at(1707)[0].note,/没有扇过/);assert.equal(at(618)[0].sense,'passive');assert.equal(at(2034)[0].sense,'wearing');
assert.match(at(1311)[0].steps.find(s=>s.form==='した').why,/不表示这句话一定在讲过去/,'The た in たり is a connection form, not proof of past time');
assert.equal(at(16).length,0,'Do not apply the action-object explanation to movement through space');
const fake={...B,lines:[{t:[]}],words:[]};assert.equal(S.actionConnections(fake,fake.lines[0]).length,0);
assert.throws(()=>buildActionConnections(B,[{...actionConnectionLessons[0],noun:'不存在的文字'}]),/source/);
assert.equal(JSON.stringify(B),original,'Adding teaching must not rewrite text or dictionary');

for(const native of [false,true]){
 const errors=[],dom=new JSDOM(read('index.html'),{url:'https://umi.local/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let saved=JSON.stringify({index:18,done:[0,18,463],sentenceMode:'chunks',meaning:false,illustrations:false});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.addEventListener('error',e=>errors.push(e.message));
 if(native)w.Android={readState:()=>saved,writeState:s=>{saved=s;},stop:()=>{},speakClip:()=> 'ok',speakRoleClip:()=> 'ok'};
 else w.localStorage.setItem('umi-progress-v1',saved);
 for(const e of d.querySelectorAll('script[src]'))w.eval(read(e.getAttribute('src')));
 const click=s=>{const el=d.querySelector(s);assert(el,s);el.click();};
 const jump=n=>{d.querySelector('#jump-number').value=String(n);d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 click('[data-sentence-chunk="3"]');let a=d.querySelector('#word-dialog .action-lesson');assert(a);
 assert(!a.closest('details'),'Basic explanations are not hidden as optional notes');
 assert.equal(a.querySelector('.action-source').nextElementSibling.textContent,'大多数事情都做了');
 assert.match(a.textContent,/を → お o/);assert.match(a.textContent,/不是保留す、只删る/);
 assert.deepEqual([...a.querySelectorAll('.action-form-steps b')].map(n=>n.textContent),['する','し','した']);
 click('#word-dialog [data-close]');click('[data-tab="walk"]');click('[data-walk-step="3"]');assert(d.querySelector('#walk-details .action-lesson'));
 click('[data-sentence-mode="words"]');
 const particle=[...d.querySelectorAll('[aria-label="查看 を"]')].find(el=>Number(el.dataset.zoomWord)===23)||d.querySelector('[aria-label="查看 を"]');
 assert(particle);particle.click();assert(d.querySelector('#word-dialog .action-lesson'),'Clicking を opens the connected phrase explanation');
 click('#word-dialog [data-close]');click('[aria-label="查看 した"]');assert(d.querySelector('#word-dialog .action-lesson'));
 click('#word-dialog [data-close]');
 for(const n of [464,1138]){
  jump(n);click('[aria-label="查看 した"]');a=d.querySelector('#word-dialog .action-lesson');assert(a);assert.equal(a.querySelector('.action-meaning').textContent,'打了电话');assert.equal(a.querySelectorAll('.action-form-steps>li').length,3);click('#word-dialog [data-close]');
 }
 jump(140);click('[data-tab="grammar"]');assert.equal(d.querySelectorAll('#learning-panel .action-lesson').length,2);
 click('[data-tab="quiz"]');assert.equal(d.querySelectorAll('#learning-panel .action-lesson').length,0,'Keep explanations out of quiz answers');
 const state=JSON.parse(native?saved:w.localStorage.getItem('umi-progress-v1'));assert.deepEqual(state.done,[0,18,463]);assert.deepEqual(errors,[]);dom.window.close();
}
console.log(JSON.stringify({actionConnections:'PASS',reviewedOccurrences:total,alwaysRepeated:true,wordAndChunkPopups:true,webAndNative:true,sourceAndProgressPreserved:true,distinctMeanings:true,quizIsolation:true}));
