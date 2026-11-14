import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8'),c={window:{}};
for(const f of ['book.js','study-morphology.js','study-expressions.js','study-groups.js'])vm.runInNewContext(read(f),c);
const b=c.window.BOOK,s=c.window.STUDY_GROUPS;
const thought=s.create(b,b.lines[15]).find(g=>g.s==='思った');assert.equal(thought.baseKana,'おもう');
const a=thought.analyses.find(a=>a.base==='思う');assert.equal(a.baseKana,'おもう');assert.match(a.steps[1].why,/う.*った/);assert.match(a.steps[1].why,/単独|单独/);assert.match(a.steps[1].why,/tsu/);assert(!a.steps[1].why.includes('る删掉'));
assert.deepEqual(Array.from(a.verbClass.rows,r=>r.form),['思わない','思います','思う','思えば','思おう']);
assert.deepEqual(Array.from(a.verbClass.rows,r=>r.kana),['おもわない','おもいます','おもう','おもえば','おもおう']);
assert.equal(s.formReading(b,'来る',[]),'くる');assert.equal(s.formReading(b,'気がする',[]),'きがする');assert.equal(s.formReading(b,'私大に ＋ 合格する',[]),'');
const fixture=(base,surface,kana)=>[{s:surface,k:kana,b:base,p:'动词',ct:'五段・ワ行促音便'}];
assert.equal(s.formReading(b,'行う',fixture('行う','行っ','おこなっ')),'おこなう');assert.equal(s.formReading(b,'行く',fixture('行く','行っ','いっ')),'いく');
const teBook={words:[{s:'思って',k:'おもって',b:'思う',p:'动词',ct:'五段・ワ行促音便'}]};
const teAnalysis=s.analyses(teBook,{t:[0]}).items[0];assert.match(teAnalysis.steps[1].why,/思う → 思って/);assert.match(teAnalysis.steps[1].why,/て前/);assert(!teAnalysis.steps[1].why.includes('た前'));
// The full version must have a local file for every exposed lemma sound, not just a new button.
let audioBases=0;
const textOnly=fs.existsSync(path.join(root,'dist/media-mode.js'));
const hasAudio=!textOnly&&fs.existsSync(path.join(root,'dist/audio-index.js'));
if(hasAudio){vm.runInNewContext(read('audio-index.js'),c);for(const line of b.lines)for(const g of s.create(b,line))for(const kana of [...g.analyses.map(a=>a.baseKana),...(s.describe(g).base!==g.s?[g.baseKana]:[])].filter(Boolean)){const id=c.window.UMI_AUDIO_INDEX['ja\n'+kana];assert(id,'Missing index: '+kana);assert(fs.statSync(path.join(root,'dist/neural-audio',id+'.mp3')).size>500);audioBases++;}}
const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost:4173/',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];let halted=0;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.localStorage.setItem('umi-progress-v1',JSON.stringify({index:15,illustrations:false}));
w.createRecordedAudio=()=>({play:(clip,token)=>{calls.push({clip,token});return null;},halt:()=>{halted++;}});
w.UMI_AUDIO_INDEX={'ja\nおもう':'dummy'};
if(textOnly)w.eval(read('media-mode.js'));
for(const f of ['book.js','wanakana.min.js','grammar.js','lesson-notes.js','playback.js','illustrations.js','sentence-art.js','sentence-illustrations.js','role-audio.js','learning-audio.js','chinese-emotion.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js','web-tools.js','app.js'])if(fs.existsSync(path.join(root,'dist',f)))w.eval(read(f));
d.querySelector('[aria-label="查看 思った"]').click();const dialog=d.querySelector('#word-dialog'),button=dialog.querySelector('.analysis-base [data-form-reading]');assert.match(dialog.querySelector('.analysis-base').textContent,/おもう.*omou/);
if(textOnly){assert.equal(button,null);assert.equal(calls.length,0);}else{assert(button&&!button.disabled);button.click();assert.equal(calls.at(-1).clip.text,'おもう');assert.equal(calls.at(-1).clip.lang,'ja');assert.equal(button.getAttribute('aria-pressed'),'true');const beforeStop=halted;button.click();assert(halted>beforeStop);assert.equal(button.getAttribute('aria-pressed'),'false');}
assert.equal(dialog.querySelectorAll('[data-form-reading="おもっ"]').length,0,'Do not read an unfinished small-tsu stem alone');
const category=dialog.querySelector('.grammar-verb-class');assert.equal(category.open,false);category.querySelector('summary').click();assert(category.open);
dialog.querySelector('.godan-examples summary').click();assert(dialog.querySelector('.godan-examples').open);assert.match(dialog.querySelector('.godan-examples').textContent,/わ读wa/);
dialog.close();d.querySelector('[data-tab="grammar"]').click();assert([...d.querySelectorAll('.analysis-base')].some(el=>/おもう.*omou/.test(el.textContent)));assert.equal(!!d.querySelector('.analysis-base [data-form-reading="おもう"]'),!textOnly);
d.querySelector('[data-tab="quiz"]').click();assert.equal(d.querySelectorAll('#learning-panel [data-form-reading],dialog[open] [data-form-reading]').length,0);
dom.window.close();console.log(JSON.stringify({baseReading:'passed',thought:'おもう / omou',sameTokenHomographs:true,playAndStop:textOnly?'hidden in text-only edition':true,unfinishedStemNotSpoken:true,godanExamples:true,audioBases}));
