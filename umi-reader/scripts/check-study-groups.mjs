import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context={window:{}};
vm.createContext(context);
for(const file of ['book.js','lesson-notes.js','study-morphology.js','study-expressions.js','study-groups.js']){
 vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
}
const {BOOK:book,STUDY_GROUPS:study,STUDY_MORPHOLOGY:morphology}=context.window;
const before=JSON.stringify(book),checks=[];
function check(name,run){run();checks.push(name);}
const groupsAt=sentence=>study.create(book,book.lines[sentence-1]);
const surfaces=groups=>Array.from(groups,g=>g.s);
const word=(s,p='名词',b=s,f='',k=s)=>({s,p,b,f,k,d:s});
const fixture=words=>study.create({words},{t:words.map((_,i)=>i)});
function expectChunk(sentence,s,k){
 const found=groupsAt(sentence).find(g=>g.s===s);
 assert(found,`Sentence ${sentence} needs the whole learning chunk ${s}`);
 if(k)assert.equal(found.k,k,`Reading of ${s}`);
 return found;
}

check('every original character and source word survives the full pipeline',()=>{
 for(const [index,line] of book.lines.entries()){
  const source=line.t.map(id=>book.words[id]),groups=study.create(book,line);
  assert.equal(groups.map(g=>g.s).join(''),source.map(w=>w.s).join(''),`Text at sentence ${index+1}`);
  const parts=groups.flatMap(g=>g.parts||g.words);
  assert.equal(parts.length,source.length,`Source word count at sentence ${index+1}`);
  parts.forEach((w,i)=>assert.strictEqual(w,source[i],`Original word reference at sentence ${index+1}, token ${i}`));
  for(const g of groups){
   assert.equal(g.audioParts.map(p=>p.s).join(''),g.s,'Fallback recordings cover the same source span');
   if(g.rule)assert(!g.parts.some(w=>w.p==='标点'),'New chunks never consume punctuation');
  }
 }
 assert.equal(JSON.stringify(book),before,'Grouping must not edit the book or its dictionary');
});
check('morphology keeps original dictionary words for quizzes',()=>{
 for(const line of book.lines){
  const words=morphology.create(book,line).flatMap(g=>g.words);
  assert.equal(words.length,line.t.length);
  words.forEach((w,i)=>assert.strictEqual(w,book.words[line.t[i]]));
 }
});
check('opening compound, aspect and explanatory expressions work together',()=>{
 expectChunk(1,'戻ってゆく','もどってゆく');
 expectChunk(1,'んだ','んだ');
 expectChunk(2,'二度目','にどめ');
 expectChunk(2,'合格して','ごうかくして');
 expectChunk(2,'というか','というか');
 const conclusion=expectChunk(2,'というわけだ','というわけだ');
 assert.equal(conclusion.p,'固定表达');
 assert.match(conclusion.definition,/结论|也就是说/);
});
check('passive and continuing past form stay together',()=>{
 const g=expectChunk(181,'いわれていた','いわれていた');
 assert.equal(g.words[0].b,'いう');
 assert.equal(g.audioParts.map(p=>p.s).join('|'),'いわ|れて|いた');
 expectChunk(181,'六年間','ろくねんかん');
});
check('quoted 上京 stays separate from the following した',()=>{
 const parts=surfaces(groupsAt(2)),i=parts.indexOf('上京');
 assert.deepEqual(parts.slice(i-1,i+3),['〝','上京','〟','した']);
});

// These are language expectations, not values calculated from the merger.
for(const [n,c,k] of [
 ['一','人','ひとり'],['二','人','ふたり'],['三','人','さんにん'],['四','人','よにん'],
 ['四','年','よねん'],['十八','年','じゅうはちねん'],['六','年間','ろくねんかん'],
 ['二','度目','にどめ'],['二十九','日','にじゅうくにち'],['三','泊','さんぱく'],
 ['一','学期','いちがっき'],['１','組','いちくみ'],['２','組','にくみ'],
 ['一','講','いっこう'],['四','畳半','よじょうはん'],['一','点','いってん'],
 ['15','分','じゅうごふん'],['10','分','じゅっぷん']
])check(`counter ${n+c} is pronounced ${k}`,()=>{
 const groups=fixture([word(n),word(c)]);
 assert.equal(groups.length,1);
 assert.equal(groups[0].s,n+c);
 assert.equal(groups[0].k,k);
});

check('ordinary nouns are not all attached to する',()=>{
 assert.deepEqual(surfaces(fixture([word('顔'),word('する','动词','する','基本形') ])),['顔','する']);
});
check('case particles remain between a noun and its action',()=>{
 assert.deepEqual(surfaces(fixture([word('勉強'),word('を','助词'),word('する','动词','する','基本形')])),['勉強','を','する']);
});
check('unrelated adjacent nouns remain separate',()=>{
 assert.deepEqual(surfaces(fixture([word('里伽子'),word('東京')])),['里伽子','東京']);
});
check('a finite verb cannot acquire a passive suffix',()=>{
 assert.deepEqual(surfaces(fixture([word('食べる','动词','食べる','基本形','たべる'),word('れる','动词','れる','基本形')])),['食べる','れる']);
});
check('sequential lexical verbs remain separate',()=>{
 assert.deepEqual(surfaces(fixture([word('食べ','动词','食べる','連用形','たべ'),word('て','助词'),word('寝る','动词','寝る','基本形','ねる')])),['食べて','寝る']);
});
check('a comma stops the aspect construction',()=>{
 assert.deepEqual(surfaces(fixture([word('食べ','动词','食べる','連用形','たべ'),word('て','助词'),word('、','标点'),word('いる','动词','いる','基本形')])),['食べて','、','いる']);
});
check('a comma also stops a fixed expression',()=>{
 assert.deepEqual(surfaces(fixture([word('という','助词'),word('、','标点'),word('わけ'),word('だ','助动词','だ','基本形')])),['という','、','わけだ']);
});
check('three or four people is not converted into thirty-four',()=>{
 assert.deepEqual(surfaces(fixture([word('三'),word('四'),word('人')])),['三','四','人']);
});
check('a share pronounced ぶん is not changed into minutes',()=>{
 assert.deepEqual(surfaces(fixture([word('一'),word('分','名词','分','','ぶん')])),['一','分']);
});
check('proper name 四万十 keeps its dictionary reading',()=>{
 assert.equal(fixture([word('四万十','名词','四万十','','しまんと')])[0].k,'しまんと');
});
check('long negative expression is not truncated to its affirmative prefix',()=>{
 const groups=fixture([word('という','助词'),word('わけ'),word('で','助动词','だ','連用形'),word('は','助词','は','','わ'),word('ない','形容词','ない','基本形')]);
 assert.deepEqual(surfaces(groups),['というわけではない']);
 assert.match(groups[0].definition,/并不是|并非/);
});
check('何というか expresses hesitation, not a correction',()=>{
 const groups=fixture([word('何'),word('と','助词'),word('いう','动词','いう','基本形'),word('か','助词')]);
 assert.deepEqual(surfaces(groups),['何というか']);
 assert.match(groups[0].definition,/怎么说|怎么形容/);
});
check('the か in というから is not the end of というか',()=>{
 const groups=fixture([word('と','助词'),word('いう','动词','いう','基本形'),word('から','助词')]);
 assert(!groups.some(g=>g.s==='というか'));
});
check('literal 手にとって is not taught as for somebody',()=>{
 const groups=fixture([word('手'),word('にとって','助词')]);
 assert(!groups.some(g=>g.rule==='for-person'));
});
check('literal 目について is not taught as about something',()=>{
 const groups=fixture([word('目'),word('について','助词')]);
 assert(!groups.some(g=>g.rule==='about'));
});
check('lexical compounds show their meaning instead of a generic suffix gloss',()=>{
 const remembered=fixture([word('思い','动词','思う','連用形','おもい'),word('だし','动词','だす','連用形'),word('た','助动词','た','基本形')]);
 assert.equal(remembered[0].s,'思いだした');assert.match(remembered[0].definition,/想起|回忆/);
 const passed=fixture([word('通り','动词','通る','連用形','とおり'),word('すぎ','动词','すぎる','連用形'),word('た','助动词','た','基本形')]);
 assert.equal(passed[0].s,'通りすぎた');assert.match(passed[0].definition,/经过|走过/);
});
console.log(`Study groups: ${checks.length} checks passed; ${book.lines.length} sentences retain their exact text and original word references.`);
