import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'../dist/study-morphology.js'),'utf8'),ctx);
const morph=ctx.window.STUDY_MORPHOLOGY;
let checked=0;
function sameWords(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((w,i)=>assert.equal(w,expected[i],'original word identity/order'));}
function test(parts,s,k){
 const words=parts.map(([s,k='x',p='名词',d='保留已校订词义'])=>({s,k,b:s,p,d,auto:false}));
 const groups=morph.create({words},{t:words.map((_,i)=>i)});
 assert.equal(groups.map(g=>g.s).join(''),words.map(w=>w.s).join(''),'source');
 sameWords(groups.flatMap(g=>Array.from(g.words)),words);
 sameWords(groups.flatMap(g=>Array.from(g.parts)),words);
 assert.equal(groups.flatMap(g=>Array.from(g.audioParts)).map(p=>p.s).join(''),words.map(w=>w.s).join(''),'recording spans');
 const g=groups.find(g=>g.s===s);assert.ok(g,s);assert.equal(g.k,k,s);checked++;return g;
}
for(const [num,c,k] of [
 ['１','分','いっぷん'],['6','分','ろっぷん'],['10','分','じゅっぷん'],['30','分','さんじゅっぷん'],
 ['９','時','くじ'],['７','時','しちじ'],['4','時半','よじはん'],['一','人','ひとり'],['二','人','ふたり'],['４','人','よにん'],['21','人','にじゅういちにん'],
 ['四','年生','よねんせい'],['一','階','いっかい'],['三','階','さんがい'],['六','回','ろっかい'],['一','週間','いっしゅうかん'],
 ['四','日','よっか'],['三','日間','みっかかん'],['十','日','とおか'],['一','月','いちがつ'],['12','月','じゅうにがつ'],
 ['一九九一','年','せんきゅうひゃくきゅうじゅういちねん'],['二〇二四','年','にせんにじゅうよねん'],['６万８０００','円','ろくまんはっせんえん'],
 ['１５５','センチ','ひゃくごじゅうごせんち'],['4','畳半','よじょうはん'],['一','本','いっぽん'],['一','曲','いっきょく'],['10','コ','じゅっこ']
])test([[num],[c]],num+c,k);
for(const [s,k] of [['一週間','いっしゅうかん'],['四年生','よねんせい'],['９時半','くじはん'],['一人前','いちにんまえ'],['一番','いちばん']]){
 const g=test([[s]],s,k);assert.equal(g.words[0].d,'保留已校订词义');assert.equal(g.definition,undefined,'lexical meaning not replaced');
}
test([['十一月','じゅういちがつ'],['一日','いちにち']],'一日','ついたち');
test([['一月','いちがつ'],['に','に','助词'],['二回','にかい']],'一月','ひとつき');
test([['一月','ひとつき'],['も','も','助词']],'一月','ひとつき');
test([['一','いち'],['月','がつ'],['に','に','助词'],['二','に'],['回','かい']],'一月','ひとつき');
test([['二分','にぶん']],'二分','にぶん');
test([['三四人','さんよにん']],'三四人','さんよにん');
test([['0月','ぜろがつ']],'0月','ぜろがつ');
// Apply only the isolated reading patches to a copy, then exercise actual novel lines.
const book=JSON.parse(fs.readFileSync(path.join(here,'../dist/book.js'),'utf8').slice(12,-1));
for(const [n,s,k] of [[335,'９時','くじ'],[987,'９時','くじ'],[108,'一週間','いっしゅうかん'],[121,'４人','よにん'],[176,'高知城','こうちじょう'],[2092,'一月','ひとつき'],[2329,'一日','ついたち']]){
 const groups=morph.create(book,book.lines[n-1]);assert.equal(groups.find(x=>x.s===s)?.k,k,`${n} ${s}`);checked++;
}
for(const line of book.lines){const groups=morph.create(book,line),words=line.t.map(i=>book.words[i]);assert.equal(groups.map(g=>g.s).join(''),words.map(w=>w.s).join(''));sameWords(groups.flatMap(g=>Array.from(g.words)),words);}
console.log(JSON.stringify({cases:checked,sourceAndOriginalWordsPreservedAcross:book.lines.length}));
