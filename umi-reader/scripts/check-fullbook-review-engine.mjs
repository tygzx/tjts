import assert from 'node:assert/strict';
import {applyFullbookReview} from './apply-fullbook-review.mjs';

const word=(s,extra={})=>({s,k:s,r:'',b:s,p:'名词',d:'machine',auto:true,...extra});
const fixture=surfaces=>({title:'fixture',words:surfaces.map(s=>word(s)),lines:[{t:surfaces.map((_,i)=>i),zh:'unchanged'}]});
const text=(book,line=book.lines[0])=>line.t.map(id=>book.words[id].s).join('');
const reviewed=(s,extra={})=>({s,k:s,b:s,p:'固定表达',d:'reviewed',...extra});
let checks=0;
function check(name,run){run();checks++;console.log(`ok ${checks} - ${name}`);}

check('pure, append-only, exact matching of every occurrence, and idempotent',()=>{
 const source=fixture(['と','いう','か','。','と','いう','か']);
 const input=JSON.stringify(source),review={repairs:[{sentence:1,old:'というか',tokens:[reviewed('というか')]}]};
 const reviewInput=JSON.stringify(review),first=applyFullbookReview(source,review);
 assert.equal(first.report.ok,true);assert.equal(first.report.applied.repairs.length,2);
 assert.equal(first.report.stats.appendedWords,1);assert.equal(text(first.book),text(source));
 assert.deepEqual(first.book.words.slice(0,source.words.length),source.words);
 assert.equal(JSON.stringify(source),input);assert.equal(JSON.stringify(review),reviewInput);
 assert.equal(first.book.lines[0].zh,'unchanged');
 const second=applyFullbookReview(first.book,review);
 assert.deepEqual(second.book,first.book);assert.equal(second.report.applied.repairs.length,0);
 assert.equal(second.report.unchanged.repairs.length,2);assert.equal(second.report.stats.appendedWords,0);
});

check('a whole erroneous token can be split only with explicit reviewed readings',()=>{
 const source=fixture(['づとめの']);
 const result=applyFullbookReview(source,{repairs:[{sentence:1,old:'づとめの',tokens:[reviewed('づとめ',{k:'づとめ'}),reviewed('の',{p:'助词'})]}]});
 assert.equal(result.report.ok,true);assert.deepEqual(result.book.lines[0].t.map(id=>result.book.words[id].s),['づとめ','の']);
 const incomplete=applyFullbookReview(source,{repairs:[{sentence:1,old:'づとめの',tokens:[{s:'づとめの',p:'名词',d:'reviewed'}]}]});
 assert.equal(incomplete.report.ok,false);assert.deepEqual(incomplete.book,source);
 assert(incomplete.report.issues.some(x=>x.code==='unreviewed_or_incomplete_token'));
});

check('partial boundaries and missing surfaces are explicit, never guessed',()=>{
 const source=fixture(['そのもの']);
 const result=applyFullbookReview(source,{repairs:[{sentence:1,old:'もの',tokens:[reviewed('もの')]},{sentence:1,old:'別',tokens:[reviewed('別')]}]});
 assert.deepEqual(result.book,source);assert.equal(result.report.ok,false);
 assert(result.report.issues.some(x=>x.code==='boundary_mismatch'&&x.touched[0].s==='そのもの'));
 assert(result.report.issues.some(x=>x.code==='source_not_found'));
});

check('conflicting overlapping repairs both fail independent of input order',()=>{
 const source=fixture(['あ','い','う']);
 const rules=[{sentence:1,old:'あい',tokens:[reviewed('あい')]},{sentence:1,old:'いう',tokens:[reviewed('いう')]}];
 for(const repairs of [rules,[...rules].reverse()]){
  const result=applyFullbookReview(source,{repairs});assert.deepEqual(result.book,source);
  assert(result.report.issues.some(x=>x.code==='overlapping_rules'));
 }
 const overlap=applyFullbookReview(fixture(['あ','あ','あ']),{repairs:[{sentence:1,old:'ああ',tokens:[reviewed('ああ')]}]});
 assert.equal(overlap.report.ok,false);assert.equal(overlap.report.stats.appendedWords,0);
});

check('duplicates collapse, conflicting same-span definitions do not overwrite',()=>{
 const source=fixture(['あ']);const a={sentence:1,old:'あ',tokens:[reviewed('あ')]};
 const duplicate=applyFullbookReview(source,{repairs:[a,structuredClone(a)]});
 assert.equal(duplicate.report.ok,true);assert.equal(duplicate.report.applied.repairs.length,1);assert.equal(duplicate.report.duplicates.length,1);
 const conflict=applyFullbookReview(source,{repairs:[a,{sentence:1,old:'あ',tokens:[reviewed('あ',{d:'different'})]}]});
 assert.deepEqual(conflict.book,source);assert.equal(conflict.report.ok,false);
});

check('glossary updates only active matching POS/lemma references, preserving old IDs',()=>{
 const source={words:[word('かえる',{b:'かえる',p:'动词'}),word('かえる',{b:'かえる',p:'名词'}),word('unused')],lines:[{t:[0,1,0]}]};
 const result=applyFullbookReview(source,{glosses:[{p:'动词',b:'かえる',d:'返回'}]});
 assert.equal(result.report.ok,true);assert.deepEqual(result.book.words.slice(0,3),source.words);
 assert.equal(result.book.words[result.book.lines[0].t[0]].d,'返回');assert.equal(result.book.words[result.book.lines[0].t[0]].auto,false);
 assert.equal(result.book.words[result.book.lines[0].t[1]].d,'machine');assert.equal(result.book.words[result.book.lines[0].t[1]].auto,true);
 assert.deepEqual(result.report.activeWordIds,[1,3]);assert.deepEqual(result.report.inactiveWordIds,[0,2]);
 assert.deepEqual(applyFullbookReview(result.book,{glosses:[{p:'动词',b:'かえる',d:'返回'}]}).book,result.book);
});

check('explicit repair meaning wins over lemma gloss without leaking to another sentence',()=>{
 const source={words:[word('重い',{p:'形容词'})],lines:[{t:[0]},{t:[0]}]};
 const data={glosses:[{p:'形容词',b:'重い',d:'分量重'}],repairs:[{sentence:1,old:'重い',tokens:[reviewed('重い',{p:'形容词',k:'おもい',d:'症状严重'})]}]};
 const first=applyFullbookReview(source,data);assert.equal(first.report.ok,true);
 assert.equal(first.book.words[first.book.lines[0].t[0]].d,'症状严重');assert.equal(first.book.words[first.book.lines[1].t[0]].d,'分量重');
 assert.deepEqual(applyFullbookReview(first.book,data).book,first.book);
});

check('multiword context spans are local, repeated, nonmutating and idempotent',()=>{
 const source=fixture(['目','が','ない','。','目','が','ない']);
 source.lines.push({t:[0,1,2]});
 const data={contexts:[{sentence:1,s:'目がない',definition:'特别喜欢',base:'目がない'}]};
 const first=applyFullbookReview(source,data);
 assert.equal(first.report.ok,true);assert.deepEqual(first.book.words,source.words);
 assert.deepEqual(first.book.lines[0].t,source.lines[0].t);
 assert.deepEqual(first.book.lines[0].studyGlosses.map(x=>[x.start,x.end]),[[0,4],[5,9]]);
 assert(!own(first.book.lines[0].studyGlosses[0],'k'),'No pronunciation is inferred');
 assert(!first.book.lines[1].studyGlosses);assert.deepEqual(applyFullbookReview(first.book,data).book,first.book);
});
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}

check('context boundary errors and conflicting contexts are explicit',()=>{
 const source=fixture(['目','が','ない']);
 const conflict=applyFullbookReview(source,{contexts:[{sentence:1,s:'目がない',definition:'好き'},{sentence:1,s:'目',definition:'眼睛'}]});
 assert.equal(conflict.report.ok,false);assert(!conflict.book.lines[0].studyGlosses);
 const first=applyFullbookReview(source,{contexts:[{sentence:1,s:'目がない',definition:'好き'}]});
 const second=applyFullbookReview(first.book,{contexts:[{sentence:1,s:'目がない',definition:'different'}]});
 assert.deepEqual(second.book,first.book);assert(second.report.issues.some(x=>x.code==='conflicting_existing_context'));
 const boundary=applyFullbookReview(fixture(['そのもの']),{contexts:[{sentence:1,s:'もの',definition:'物'}]});
 assert.equal(boundary.report.ok,false);assert(boundary.report.issues.some(x=>x.code==='boundary_mismatch'));
});

check('occurrence selector, Unicode offsets and invalid operations preserve source',()=>{
 const source=fixture(['😀','金','金']);
 const selected=applyFullbookReview(source,{repairs:[{sentence:1,old:'金',occurrence:2,tokens:[reviewed('金',{k:'かね'})]}],contexts:[{sentence:1,s:'金',occurrence:2,definition:'钱'}]});
 assert.equal(selected.report.ok,true);assert.equal(text(selected.book),'😀金金');
 assert.equal(selected.book.lines[0].t[1],1);assert.deepEqual(selected.book.lines[0].studyGlosses.map(x=>[x.start,x.end]),[[3,4]]);
 const invalid=applyFullbookReview(source,{repairs:[{sentence:1,old:'金',tokens:[reviewed('銀')]},{sentence:0,old:'金',tokens:[reviewed('金')]}],glosses:[{p:'名词',b:'金',d:'A'},{p:'名词',b:'金',d:'B'}]});
 assert.deepEqual(invalid.book,source);assert.equal(invalid.report.ok,false);
 assert(invalid.report.issues.some(x=>x.code==='source_would_change'));assert(invalid.report.issues.some(x=>x.code==='invalid_rule'));assert(invalid.report.issues.some(x=>x.code==='conflicting_glosses'));
});

console.log(`Passed ${checks} full-book review engine checks; no production files read or written.`);
