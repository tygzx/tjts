import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),context={window:{}};
vm.createContext(context);
for(const file of ['book.js','lesson-notes.js','study-morphology.js','study-expressions.js','study-groups.js','sentence-quiz.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const book=context.window.BOOK,create=context.window.SENTENCE_QUIZ.create,before=JSON.stringify(book);
const study=context.window.STUDY_GROUPS;
for(const line of book.lines)assert.equal(study.create(book,line).map(g=>g.s).join(''),line.t.map(id=>book.words[id].s).join(''),'Learning groups preserve every original character');
const opening=study.create(book,book.lines[1]);
assert.equal(opening.filter(g=>g.s==='というか').length,1);
assert.equal(opening.find(g=>g.s==='というか').p,'固定表达');
assert(opening.some(g=>g.s==='というわけだ'&&g.p==='固定表达'),'The whole explanatory expression is a learning unit');
for(const n of [296,431,1808])assert(!study.create(book,book.lines[n-1]).some(g=>g.audioTitle==='というか'),'Different contexts are not assigned the correction sense: '+n);
for(const n of [538,975])assert(!study.create(book,book.lines[n-1]).some(g=>g.s==='なんというか'&&g.audioTitle),'Hesitation is not played as correction: '+n);
const seed=initial=>{let state=initial>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
const plain=value=>value.normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu,'');
const kana=value=>value.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s/g,'');
const grouped=line=>study.create(book,line);
const openingRounds=Array.from({length:12},(_,i)=>create(book,1,{limit:20,rng:seed(i+1)})).flat();
const answerOf=q=>q.choices.find(c=>c.id===q.answerId).text;
assert(openingRounds.some(q=>q.focus==='二度目'&&q.kind==='meaning'&&answerOf(q)==='第 2 次'),'Counters are tested as complete meanings');
assert(openingRounds.some(q=>q.focus==='合格して'&&q.kind==='base'&&answerOf(q)==='合格する'),'Suru verbs use their whole base');
assert(!openingRounds.some(q=>q.focus==='二度目'&&q.kind==='meaning'&&answerOf(q)==='二；两个'),'A grouped counter must not be reduced to its first digit');
const surfaceReadings=new Map();
for(const line of book.lines)for(const g of grouped(line)){if(!surfaceReadings.has(g.s))surfaceReadings.set(g.s,new Set());surfaceReadings.get(g.s).add(kana(g.k));}
const kinds=new Set(),positions=new Set(),fallbackIndices=[];let count=0,shortRounds=0;
for(let index=0;index<book.lines.length;index++){
 const groups=grouped(book.lines[index]),jp=book.lines[index].t.map(id=>book.words[id].s).join(''),round=create(book,index,{rng:seed(index+1)});
 assert(round.length>0&&round.length<=5,'Every line has a nonempty bounded quiz: '+(index+1));
 assert.equal(new Set(round.map(q=>q.id)).size,round.length,'No repeated question');if(round.length<5)shortRounds++;
 for(const q of round){
  count++;kinds.add(q.kind);assert(q.prompt&&q.explanation&&q.focus);assert.match(q.id,/^q-[a-f0-9]{8}$/);
  assert.equal(q.choices.length,4);assert.equal(new Set(q.choices.map(c=>c.id)).size,4);
  assert.equal(new Set(q.choices.map(c=>q.kind==='reading'?kana(c.text):plain(c.text))).size,4,'Choices cannot repeat equivalent text or kana');
  assert(q.choices.every(c=>c.text&&/^c-[a-f0-9]{8}$/.test(c.id)));
  const correct=q.choices.filter(c=>c.id===q.answerId);assert.equal(correct.length,1);positions.add(q.choices.findIndex(c=>c.id===q.answerId));
  if(q.kind==='translation'){fallbackIndices.push(index);assert.equal(q.focus,jp);assert.equal(correct[0].text,book.lines[index].zh);assert.match(q.explanation,/机器参考/);}
  else{
   const matches=groups.filter(g=>g.s===q.focus);assert(matches.length,'A word question must refer to this sentence');
   if(q.kind==='reading'){
    assert(matches.some(g=>kana(g.k)===correct[0].text),'Reading includes the complete inflected group');
    assert(q.choices.filter(c=>c.id!==q.answerId).every(c=>!surfaceReadings.get(q.focus).has(kana(c.text))),'Other known readings of the same spelling are not marked incorrect');
   }
   else if(q.kind==='meaning')assert(matches.some(g=>(!g.words[0].auto||(['counter','number'].includes(g.rule)&&g.definition))&&(g.definition||g.words[0].d)===correct[0].text),'Only reviewed glossary or reviewed group meanings are scored');
   else if(q.kind==='base')assert(matches.some(g=>(g.base||g.words[0].b)===correct[0].text&&['动词','形容词'].includes(g.p)),'Base form comes from the displayed learning group');
   else assert.fail('Unexpected quiz kind: '+q.kind);
  }
 }
}
assert.equal(JSON.stringify(book),before,'Creating quizzes never mutates book data');
assert.deepEqual([...kinds].sort(),['base','meaning','reading','translation']);assert.equal(positions.size,4,'The correct option appears in every position');
const first=create(book,0,{rng:seed(123)}),repeat=create(book,0,{rng:seed(123)}),another=create(book,0,{rng:seed(456)});
assert.equal(JSON.stringify(first),JSON.stringify(repeat),'The same seed reproduces a round');
assert.notEqual(JSON.stringify(first.map(q=>q.id)),JSON.stringify(another.map(q=>q.id)),'Different seeds change question selection/order');
const shared=first.filter(q=>another.some(other=>other.id===q.id));assert(shared.length,'Sample rounds share a question to compare stable answers');
for(const q of shared){const other=another.find(item=>item.id===q.id);assert.equal(other.answerId,q.answerId);assert.equal(other.choices.find(c=>c.id===q.answerId).text,q.choices.find(c=>c.id===q.answerId).text);}
const allRounds=Array.from({length:8},(_,i)=>create(book,51,{rng:seed(i+3)}));
assert(new Set(allRounds.map(round=>JSON.stringify(round.map(q=>q.choices.map(c=>c.id))))).size>1,'New rounds reshuffle choices even for a short sentence');
assert.equal(create(book,-1).length,0);assert.equal(create(book,book.lines.length).length,0);assert.equal(create(book,0,{limit:0}).length,0);
assert.equal(create(book,0,{limit:1,rng:seed(3)}).length,1);
const fallbackIndex=fallbackIndices[0],curated={[fallbackIndex]:{zh:'校订后的学习参考。'}},curatedBefore=JSON.stringify(curated);
const revised=create(book,fallbackIndex,{curated,rng:seed(55)})[0];
assert.equal(revised.kind,'translation');assert.equal(revised.choices.find(c=>c.id===revised.answerId).text,curated[fallbackIndex].zh);
assert.match(revised.explanation,/学习参考/);assert.doesNotMatch(revised.explanation,/机器参考/);assert.equal(JSON.stringify(curated),curatedBefore);
const fixture={words:['……','――','？','！'].map(s=>({s,k:s,b:s,p:'标点',d:'',auto:false})),lines:['沉默','停顿','疑问','惊讶'].map((zh,i)=>({t:[i],zh}))};
const overrides={0:{zh:'片刻无言'},1:{zh:'话头中断'}};
const fixtureQuiz=create(fixture,0,{curated:overrides,rng:seed(8)})[0];
assert.equal(fixtureQuiz.kind,'translation');assert.equal(fixtureQuiz.choices.find(c=>c.id===fixtureQuiz.answerId).text,'片刻无言');
assert(fixtureQuiz.choices.some(c=>c.text==='话头中断'),'Distractors use the displayed curated translation');assert(fixtureQuiz.choices.every(c=>c.text!=='沉默'&&c.text!=='停顿'),'Stale original translations are not options after correction');
console.log(`PASS sentence quizzes: ${book.lines.length} nonempty rounds, ${count} questions; ${shortRounds} shorter rounds, source answers, four unique options, seeded randomization, stable IDs and immutable book verified.`);
