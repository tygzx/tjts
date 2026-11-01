import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {reviewFullbook} from './review-fullbook.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c={window:{}};vm.createContext(c);
for(const name of ['book','study-morphology','study-expressions','study-groups'])vm.runInContext(fs.readFileSync(path.join(root,'dist',name+'.js'),'utf8'),c);
const {BOOK:book,STUDY_GROUPS:study}=c.window,data=JSON.parse(fs.readFileSync(path.join(root,'data/fullbook-review.json'),'utf8'));
const source=book.lines.map(l=>l.t.map(id=>book.words[id].s).join('')).join('\n');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),data.sourceSha256,'Every original character and line boundary must survive');
assert.equal(book.lines.length,2640);assert.equal(data.coverage.lemmaDecisions,4974);
let units=0,contexts=0;
const chunks=book.lines.map(l=>study.create(book,l));
for(const [i,gs] of chunks.entries()){
 for(const g of gs){
  if(g.p==='标点')continue;units++;
  assert(study.describe(g).reviewed,`Unreviewed meaning at ${i+1}: ${g.s}`);
  assert(!/机器参考|此处分词错误|可能是词尾或分词片段|分词可能有误/.test(study.describe(g).definition),`Stale placeholder at ${i+1}: ${g.s}`);
 }
 for(const gloss of book.lines[i].studyGlosses||[]){
  contexts++;
  assert(gs.some(g=>g.s===gloss.s&&study.describe(g).definition===gloss.definition),`Context missing from popup data at ${i+1}: ${gloss.s}`);
 }
}
const check=(n,s,reading,meaning)=>{
 const g=chunks[n-1].find(g=>g.s===s);assert(g,`${n}: ${s}`);
 if(reading)assert.equal(g.k,reading,`${n}: ${s}`);
 assert.match(study.describe(g).definition,meaning,`${n}: ${s}`);
};
check(138,'えらく','えらく',/格外|相当/);
check(218,'映画ずき','えいがずき',/爱看电影/);
check(113,'耳にはいる','みみにはいる',/听到/);
check(112,'ことがなかった','ことがなかった',/从来没有|从未/);
check(114,'考えないこともなかった',null,/也不是完全没想过/);
check(382,'書くこともない',null,/可写的内容/);
check(2372,'大嫌い','だいきらい',/非常讨厌/);
check(2626,'忌ま忌ましいような','いまいましいような',/恼火/);
const old=JSON.stringify(book),report=reviewFullbook(book);
assert(report.ok);assert.equal(JSON.stringify(book),old,'Rebuild must be idempotent, including notes and word IDs');
for(const issue of data.sourceIssues)assert(book.lines[issue.sentence-1].notes.some(x=>x.startsWith('校勘提示：')));
console.log(JSON.stringify({fullbookReview:'passed',sentences:book.lines.length,learningUnits:units,contextualMeanings:contexts,sourceIssues:data.sourceIssues.length}));
