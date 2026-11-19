import {syntaxRoleSpecs,roleTerms} from '../content/syntax-roles.mjs';

const punctuationOnly=value=>/^[\p{P}\p{Z}\s]*$/u.test(value);
export function buildSyntaxRoles(lesson,block,index){
 const specs=syntaxRoleSpecs.get(lesson.sentence);
 if(!specs||specs.length!==lesson.blocks.length)throw new Error('Uncovered syntax roles at sentence '+lesson.sentence);
 let at=0;
 const rows=specs[index].split('|').map(item=>{
  const type=item[0],equal=item.indexOf('='),ja=item.slice(1,equal),zh=item.slice(equal+1),term=roleTerms[type];
  if(!term||equal<2||!zh.trim())throw new Error('Invalid syntax row at '+lesson.sentence+' '+item);
  const omitted=type==='s';let start=null,end=null;
  if(!omitted){
   start=block.quote.indexOf(ja,at);end=start+ja.length;
   if(start<0||!punctuationOnly(block.quote.slice(at,start)))throw new Error('Changed or uncovered syntax span at '+lesson.sentence+' block '+index+': '+ja+' (after '+block.quote.slice(0,at)+')');
   at=end;
  }
  return {role:term[0],hint:term[1],type,ja,zh,omitted,start,end};
 });
 if(!punctuationOnly(block.quote.slice(at)))throw new Error('Uncovered syntax ending at '+lesson.sentence+' block '+index+': '+block.quote.slice(at));
 const summary=lesson.sentence===68&&index===1?'连起来：打电话来的人 → 是 → 从前的同班同学山尾忠志。这是身份判断，没有宾语。「かつての」修饰“同班同学”，不是主句的时间状语。':'';
 return {sentence:lesson.sentence,quote:block.quote,summary,context:lesson.who,rows};
}
