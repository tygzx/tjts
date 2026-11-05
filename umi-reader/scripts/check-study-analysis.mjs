import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const b=c.window.BOOK,s=c.window.STUDY_GROUPS,before=JSON.stringify(b),counts={};let covered=0;
for(const line of b.lines){
 const groups=s.create(b,line),source=line.t.map(id=>b.words[id].s).join(''),a=s.analyses(b,line,groups);
 assert.equal(groups.map(g=>g.s).join(''),source);
 if(a.items.length)covered++;
 for(const item of a.items){assert.equal(source.slice(item.start,item.end),item.quote);assert(item.base&&item.meaning&&item.steps.length);assert(item.steps.every(x=>x.form&&x.why));counts[item.kind]=(counts[item.kind]||0)+1;}
}
assert.equal(JSON.stringify(b),before,'No dictionary or original text mutations');
const at=n=>s.analyses(b,b.lines[n-1]);
assert.deepEqual(Array.from(at(11).items.find(a=>a.quote==='気もした').steps,x=>x.form),['気がする','気がした','気もした']);
assert.equal(s.describe(s.create(b,b.lines[10]).find(g=>g.s==='気もした')).base,'気がする');
for(const [n,q,re] of [[15,'窓からは',/叠加/],[23,'親の金くって',/省去/],[33,'生活するのに',/不是表示/],[47,'学生の多い',/交替/],[106,'受けといて',/てお缩成と/],[114,'考えないこともなかった',/两层否定/],[164,'里伽子には会えない',/可能动词/]]){
 const a=at(n).items.find(x=>x.quote===q);assert(a,q);assert.match(JSON.stringify(a),re);
}
const synth=(surface,base,ct)=>{const book={words:[{s:surface,b:base,ct,p:'动词',k:surface,d:'例',f:'基本形'}]},line={t:[0]};return s.analyses(book,line).items;};
assert.equal(synth('書いた','書く','五段・カ行イ音便').length,1);
assert.equal(synth('行いた','行く','五段・カ行促音便').length,0,'Do not invent an incorrect 行く conjugation');
assert.equal(synth('書いていた','書く','五段・カ行イ音便')[0].steps.at(-2).form,'書いている');
assert.equal(synth('食べさせられた','食べる','一段').length,0,'Unimplemented multi-auxiliary chains must not receive an invented explanation');
const negBook={words:[{s:'気がしなかった',b:'気がする',p:'固定表达',k:'きがしなかった',d:'test'}]},negLine={t:[0]};
assert.match(s.describe(s.create(negBook,negLine)[0]).definition,/不觉得/);
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:10,illustrations:false}));
for(const f of ['book.js','wanakana.min.js','grammar.js','lesson-notes.js','playback.js','illustrations.js','sentence-art.js','sentence-illustrations.js','role-audio.js','learning-audio.js','chinese-emotion.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','web-tools.js','app.js'])if(fs.existsSync(path.join(root,'dist',f)))w.eval(read(f));
const word=[...d.querySelectorAll('[data-select]')].find(e=>e.getAttribute('aria-label')==='查看 気もした');assert(word);word.click();
const dialog=d.querySelector('#word-dialog');assert(dialog.open);assert.match(dialog.textContent,/気がする/);assert.match(dialog.textContent,/も替换が/);assert.match(dialog.textContent,/变时态的是する/);assert(dialog.querySelectorAll('details[open]').length>0);
dialog.close();d.querySelector('[data-tab="grammar"]').click();assert.match(d.querySelector('.sentence-guide').textContent,/第 10 句/);assert.match(d.querySelector('.sentence-analysis').textContent,/けれど转折/);
assert(d.querySelector('.sentence-analysis details').open);
dom.window.close();console.log(JSON.stringify({studyAnalysis:'passed',covered,counts,sourcePreserved:true,popup:true,grammarGuide:true}));
