import {particleCombinations,combinationContexts} from '../content/particle-combinations.mjs';
export function buildParticleCombinations(book){
 const keys=new Set();
 for(const guide of particleCombinations){
  if(keys.has(guide.key)||guide.parts.length<2||!guide.joined||guide.pairs.length<2)throw new Error('Invalid combination guide '+guide.key);
  keys.add(guide.key);
 }
 const contexts=combinationContexts.map(([sentence,quote,key,sense,meaning,left,right,contrast])=>{
  const line=book.lines[sentence-1];if(!line)throw new Error('Missing combination sentence '+sentence);
  const jp=line.t.map(i=>book.words[i].s).join(''),start=jp.indexOf(quote);
  if(start<0||jp.indexOf(quote,start+1)>=0||!keys.has(key)||!quote.includes(key)||![sense,meaning,left,right,contrast].every(Boolean))throw new Error('Stale/ambiguous combination context '+sentence+' '+quote);
  return {sentence,jp,quote,key,start,end:start+quote.length,sense,meaning,left,right,contrast};
 });
 return {guides:particleCombinations,contexts,references:[{title:'东京外国语大学：副助词与格助词的叠加',url:'https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/095.html'}]};
}
