import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const b=c.window.BOOK,s=c.window.STUDY_GROUPS,data=JSON.parse(fs.readFileSync(path.join(root,'data/grammar-analysis.json'),'utf8')),keys=new Set(s.particleHandbook().map(x=>x.key));
assert.equal(data.sentences.length,173);assert.equal(keys.size,s.particleHandbook().length);
for(let n=1;n<=173;n++){
 const a=s.analyses(b,b.lines[n-1]);assert(a.guide.length>30,'Missing useful clause guide '+n);
}
assert.equal(s.analyses(b,b.lines[173]).guide,'','Do not label the rest of the book context-reviewed');
for(const e of s.particleHandbook()){assert(e.question&&e.contrast&&e.caution);assert(e.patterns.length>=3);}
let occurrences=0,contextNotes=0;
for(const line of b.lines){
 const gs=s.create(b,line);assert.equal(gs.map(g=>g.s).join(''),line.t.map(i=>b.words[i].s).join(''));
 for(const g of gs)for(const key of g.particleKeys){assert(keys.has(key));occurrences++;}
}
for(const e of data.sentences)for(const item of e.items)if(item.particleKeys?.length)contextNotes++;
const sourceCases=[
 [2,'その年の三月に',/时间点/],[2,'羽田についた',/终点/],[3,'人波に押されて',/被动/],
 [5,'ぼくらが最終的に降りたのは',/从句/],[10,'東京は物価がたかい',/物价/],
 [14,'アパートでは落ちつかないから',/场所/],[31,'万札が30枚は消えていった',/至少/],
 [33,'生活するのに',/用途/],[41,'送っていくつもりでいたのに',/转折/],
 [145,'腹がすいているのに急に気がついて',/名词化/],[171,'里伽子には、なんの意味もなかった',/对比|比较/]
];
for(const [n,q,re] of sourceCases){const a=s.analyses(b,b.lines[n-1]).items.find(x=>x.quote===q);assert(a,q);assert.match(JSON.stringify(a),re);}
// Standalone dictionary particles may open a lookup, lexical substrings must not.
for(const word of [{s:'その',p:'连体词'},{s:'かなり',p:'副词'},{s:'し',b:'する',p:'动词'}]){
 const book={words:[{...word,k:word.s,d:'test',b:word.b||word.s}]};assert.equal(s.create(book,{t:[0]})[0].particleKeys.length,0);
}
const synth={words:[{s:'読ん',b:'読む',p:'动词',ct:'五段・マ行',f:'連用タ接続',k:'よん',d:'读'},{s:'で',b:'で',p:'助词',k:'で',d:'连接'}]};
const teGroup=s.create(synth,{t:[0,1]}).find(g=>g.s==='読んで');assert(teGroup);assert(teGroup.particleKeys.includes('て'));assert(!teGroup.particleKeys.includes('で'));
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:144,illustrations:false}));
for(const f of ['book.js','wanakana.min.js','grammar.js','lesson-notes.js','playback.js','illustrations.js','sentence-art.js','sentence-illustrations.js','role-audio.js','learning-audio.js','chinese-emotion.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','web-tools.js','app.js'])if(fs.existsSync(path.join(root,'dist',f)))w.eval(read(f));
d.querySelector('[data-tab="grammar"]').click();assert.match(d.querySelector('.sentence-guide').textContent,/不是转折/);
assert(![...d.querySelectorAll('.grammar-item')].some(el=>/のに/.test(el.textContent)&&/虽然|明明/.test(el.textContent)),'Do not show a contradictory generic のに card');
assert(![...d.querySelectorAll('.grammar-item h3')].some(el=>el.textContent==='〜って（口语）'),'買って is not a quote particle');
d.querySelector('.particle-study [data-particle-guide="のに"]').click();
const modal=d.querySelector('#particle-dialog');assert(modal.open);assert.match(modal.textContent,/雨が降っているのに気づいた/);assert.match(modal.textContent,/不等于本句用法判定/);
modal.querySelector('[data-particle-guide=""]').click();assert.equal(d.querySelectorAll('.particle-picker button').length,keys.size);
d.querySelector('#particle-dialog [data-close]').click();assert(!d.querySelector('#particle-dialog').open);
const jump=d.querySelector('#jump-number');jump.value='145';d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
d.querySelector('[data-select]').click();assert.match(d.querySelector('#word-dialog').textContent,/连接关系|本句为什么这样用/);
assert(d.querySelector('#word-dialog [data-particle-guide="に"]'));
// A fragment with no automatic conjugation still displays its contextual guide.
d.querySelector('#word-dialog').close();d.querySelector('#jump-number').value='22';d.querySelector('#jump').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));d.querySelector('[data-tab="grammar"]').click();
assert.match(d.querySelector('.sentence-guide').textContent,/第23、24句/);
const saved=JSON.parse(w.localStorage.getItem('umi-progress-v1'));assert.equal(saved.index,21);
const hints=(words,pattern,title)=>{const book={words:words.map(([s,p,b=s])=>({s,p,b}))};return s.grammarHints(book,{t:words.map((_,i)=>i)},[[pattern,title,'check']],[]);};
assert.equal(hints([['買っ','动词','買う'],['て','助词'],['、','标点'],['彼','名词'],['って','助词']],'って','〜って（口语）')[0].at,5,'Skip early verb form, retain later quote particle');
assert.equal(hints([['ふん','动词','ふむ'],['だ','助动词','た']],'んだ','のだ／んだ').length,0);
assert.equal(hints([['の','名词'],['だ','助动词']],'のだ','のだ／んだ').length,1);
assert.equal(hints([['くれる','动词']],'れる|られる','〜れる／〜られる（形式候选）').length,0);
assert.equal(hints([['食べ','动词','食べる'],['られる','助动词']],'れる|られる','〜れる／〜られる（形式候选）').length,1);
assert.equal(hints([['のせる','动词']],'せる|させ','使役形式（候选）').length,0);
assert.equal(hints([['食べ','动词','食べる'],['させる','助动词']],'せる|させ','使役形式（候选）').length,1);
dom.window.close();console.log(JSON.stringify({particleLessons:'passed',guides:173,contextNotes,handbookEntries:keys.size,lookupOccurrences:occurrences,ambiguityRegression:true,originalPreserved:true,clickOnly:true}));
