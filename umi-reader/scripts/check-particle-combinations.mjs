import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {JSDOM} from 'jsdom';
import {buildParticleCombinations} from './lib/build-particle-combinations.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const b=c.window.BOOK,s=c.window.STUDY_GROUPS,before=JSON.stringify(b),data=buildParticleCombinations(b),at=n=>s.create(b,b.lines[n-1]),find=(n,key)=>at(n).find(g=>g.s===key&&g.combination);
let occurrences=0,contextual=0;const matched=new Set();
for(const [index,line] of b.lines.entries()){
 const gs=s.create(b,line),raw=line.t.map(i=>b.words[i]);assert.equal(gs.map(g=>g.s).join(''),raw.map(w=>w.s).join(''));
 const parts=gs.flatMap(g=>g.parts||g.words);assert.equal(parts.length,raw.length);parts.forEach((p,i)=>assert.strictEqual(p,raw[i]));
 for(const g of gs.filter(g=>g.combination)){
  occurrences++;const cc=g.combination;assert.equal(raw.map(w=>w.s).join('').slice(cc.start,cc.end),g.s);
  if(index<173)assert(cc.context,'Opening combination needs actual context: '+(index+1)+' '+g.s);
  assert.equal(g.k,g.parts.map(w=>w.k).join(''),'Combined reading retains each source reading');
  if(cc.context){contextual++;assert.equal(cc.context.sentence,index+1);matched.add(cc.context.sentence+'|'+cc.context.quote);}
 }
}
for(const x of data.contexts)assert(matched.has(x.sentence+'|'+x.quote),'Unreachable context: '+x.sentence+' '+x.quote);
assert.match(find(165,'からは').combination.context.left,/来源/);assert.equal(find(165,'からは').k,'からわ');
assert(!find(165,'からは').definition.includes('没有任何联系'),'Particle gloss must not contain the full predicate');
assert.match(find(15,'からは').combination.context.left,/视线/);
assert.match(find(14,'では').combination.context.sense,/场所/);assert.match(find(42,'では').combination.context.sense,/判断否定/);
assert.match(find(38,'でも').combination.context.sense,/举例/);assert.match(find(25,'でも').combination.context.sense,/让步/);
assert.match(find(113,'とは').combination.context.sense,/相交对象/);assert.match(find(126,'とは').combination.context.sense,/引用/);
assert.equal(at(171).filter(g=>g.s==='には'&&g.combination.context).length,2);
assert.match(find(145,'のに').combination.context.sense,/察觉/);assert.match(find(33,'のに').combination.context.sense,/用途/);
assert(!at(25).find(g=>g.s==='とも').combination,'両親とも is not と plus も');
assert(!at(113).find(g=>g.s==='耳にはいる').combination,'Lexical expression must not split at a substring');
const fixture=words=>{const book={words:words.map(([s,p,b=s])=>({s,p,b,k:s,d:s}))};return s.create(book,{t:words.map((_,i)=>i)});};
assert(!fixture([['でも','接续词']])[0].combination,'Conjunction でも is not stacked particles');
assert(!fixture([['その','连体词'],['はず','名词']]).some(g=>g.combination));
const fresh=fixture([['学校','名词'],['から','助词'],['は','助词']]).find(g=>g.s==='からは');assert(fresh.combination&&!fresh.combination.context);assert.equal(fresh.definitionScope,'general');
assert.equal(JSON.stringify(b),before);
const stale=structuredClone(b);stale.lines[164]={...stale.lines[164],t:stale.lines[0].t};assert.throws(()=>buildParticleCombinations(stale),/Stale/);
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:164,illustrations:false}));
for(const f of ['book.js','wanakana.min.js','grammar.js','lesson-notes.js','playback.js','illustrations.js','sentence-art.js','sentence-illustrations.js','role-audio.js','learning-audio.js','chinese-emotion.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','web-tools.js','app.js'])if(fs.existsSync(path.join(root,'dist',f)))w.eval(read(f));
const button=d.querySelector('[aria-label="查看 からは"]');assert(button);button.click();
const popup=d.querySelector('#word-dialog');assert(popup.open);assert(popup.querySelector('.combination-lesson[open]'));assert.match(popup.textContent,/里伽子那一方/);assert.match(popup.textContent,/方向相反/);assert.equal(popup.querySelectorAll('.combination-parts dt').length,2);
popup.querySelector('.combination-examples').open=true;assert.match(popup.querySelector('.combination-examples').textContent,/妹からは/);
popup.close();d.querySelector('[data-tab="grammar"]').click();assert(d.querySelector('.combination-study .combination-lesson'));
d.querySelector('[data-tab="walk"]').click();d.querySelector('.walk-chunk[data-walk-step="3"]').click();assert(d.querySelector('#walk-details .combination-lesson'));
d.querySelector('[data-tab="quiz"]').click();assert.equal(d.querySelectorAll('#learning-panel .combination-lesson, dialog[open] .combination-lesson').length,0);
dom.window.close();console.log(JSON.stringify({particleCombinations:'passed',guides:data.guides.length,reviewedContexts:data.contexts.length,occurrences,contextual,sourcePreserved:true,ambiguity:true,popup:true,walkthrough:true,quizIsolation:true}));
