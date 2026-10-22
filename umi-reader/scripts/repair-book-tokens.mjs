import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

// Reviewed repairs for unknown kana spans that swallowed particles. Match the
// exact original token sequence, never a generic の/に suffix or a line number.
// 勤め / -づとめ: NINJAL IPAL つとめる #03 (会社づとめ).
const word=(s,k,r,p,d,extra={})=>({s,k,r,b:s,p,f:'',ct:'',d,auto:false,...extra});
const particle=(s,r,d)=>word(s,s,r,'助词',d);
const no=particle('の','no','连接前后两个名词，表示“……的”。');
const ni=particle('に','ni','标记地点、方向等；接在形容动词词干后可修饰动作，具体看本句。');
const ga=particle('が','ga','标记主语；这里把前面的「むなくそ」接到「悪い」。');
const to=particle('と','to','引用前面的声音或话语；这里引出「ふぅん」这一回应。');
const wo=word('を','お','o','助词','标记动作或判断涉及的对象；读 o。');
const match=(...items)=>items.map(([s,p,b=s])=>({s,p,b}));
export const TOKEN_REPAIRS=[
 {id:'workplace-zutome',from:match(['市役所','名词'],['づとめの','名词']),to:[word('市役所づとめ','しやくしょづとめ','shiyakushozutome','名词','在市役所（市政府）工作、任职。「づとめ」是「勤め」接在工作单位后面的形式。'),no]},
 {id:'hesitant-reply',from:match(['ふ','动词','ふる'],['ぅんとあやふやに','名词']),to:[word('ふぅん','ふうん','fuun','感叹词','嗯；哦。表示回应，语气依上下文；这里是含糊地应声。'),to,word('あやふや','あやふや','ayafuya','名词','模糊；含糊；不确定。接「に」修饰动作，这里指含含糊糊地回答。'),ni]},
 {id:'perfunctory',from:match(['お','前缀'],['ざなりに','名词']),to:[word('おざなり','おざなり','ozanari','名词','敷衍；草率应付。「おざなりに」表示敷衍地、随意地。'),ni]},
 {id:'unexpected-entrant',from:match(['と','语气词'],['びいりの','名词']),to:[word('とびいり','とびいり','tobiiri','名词','飛び入り：临时参加；半途加入。这里指中途转来的里伽子。'),no]},
 {id:'disgust-particle',from:match(['むなくそが','名词']),to:[word('むなくそ','むなくそ','munakuso','名词','「むなくそが悪い」表示令人恶心、气愤或心里很不痛快，是较粗俗的说法。'),ga]},
 {id:'way-of-speaking',from:match(['いい','形容词'],['ぐさだということを','名词']),to:[word('いいぐさ','いいぐさ','iigusa','名词','言い草：说法；说辞；说话的口气。常带责备或不满。'),word('だ','だ','da','助动词','是；表示判断的普通体。',{f:'基本形',ct:'特殊・ダ'}),word('という','という','toiu','助词','引用或说明前面的内容；「だということ」把前面的判断作为一件事。'),word('こと','こと','koto','名词','事；把前面的内容作为一件事。'),wo]},
 {id:'wall-side-ni',from:match(['壁','名词'],['ぎわに','名词']),to:[word('壁ぎわ','かべぎわ','kabegiwa','名词','墙边；靠墙的地方（壁際）。'),ni]},
 {id:'wall-side-no',from:match(['壁','名词'],['ぎわの','名词']),to:[word('壁ぎわ','かべぎわ','kabegiwa','名词','墙边；靠墙的地方（壁際）。'),no]},
];

export function repairBookTokens(book){
 const text=line=>line.t.map(id=>book.words[id].s).join('');
 const before=book.lines.map(text),changes=[];
 const ids=new Map(book.words.map((w,i)=>[JSON.stringify(w),i]));
 const idFor=w=>{const key=JSON.stringify(w);if(!ids.has(key)){ids.set(key,book.words.length);book.words.push({...w});}return ids.get(key);};
 book.lines.forEach((line,index)=>{
  const result=[];
  for(let i=0;i<line.t.length;){
   const rule=TOKEN_REPAIRS.find(r=>r.from.every((expected,j)=>{
    const actual=book.words[line.t[i+j]];
    return actual&&actual.s===expected.s&&actual.p===expected.p&&actual.b===expected.b;
   }));
   if(!rule){result.push(line.t[i++]);continue;}
   assert.equal(rule.from.map(w=>w.s).join(''),rule.to.map(w=>w.s).join(''),'Repair must preserve original characters: '+rule.id);
   result.push(...rule.to.map(idFor));i+=rule.from.length;
   changes.push({sentence:index+1,rule:rule.id});
  }
  if(result.length!==line.t.length||result.some((id,i)=>id!==line.t[i]))line.t=result;
 });
 assert.deepEqual(book.lines.map(text),before,'Token repairs cannot change the original novel text');
 return changes;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/book.js');
 const original=fs.readFileSync(file,'utf8');
 const book=JSON.parse(original.slice('window.BOOK='.length).trim().replace(/;$/,''));
 const changes=repairBookTokens(book);
 if(changes.length)fs.writeFileSync(file,'window.BOOK='+JSON.stringify(book)+';');
 console.log(JSON.stringify({repaired:changes.length,changes}));
}
