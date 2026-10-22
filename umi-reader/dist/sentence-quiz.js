/* Local multiple-choice practice from the existing book and glossary. No DOM or network. */
(() => {
 'use strict';
 const cache=new WeakMap();
 const text=value=>typeof value==='string'?value.trim():'';
 const kana=value=>text(value).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s/g,'');
 const plain=value=>text(value).normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu,'');
 const hasLetters=value=>/[\p{L}\p{N}]/u.test(value);
 const isReading=value=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(value)&&!/^[ーっッ]+$/.test(value);
 function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function shuffle(values,rng){const result=values.slice();for(let i=result.length-1;i>0;i--){const random=Math.max(0,Math.min(.999999999,Number(rng())||0)),j=Math.floor(random*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
 function add(map,key,value){if(!map.has(key))map.set(key,new Set());map.get(key).add(value);}
 function groupsFor(book,line){
  return window.STUDY_GROUPS.create(book,line);
 }
 // A learning group keeps its source words for audio and traceability. Reviewed
 // group-level overrides, however, are what the learner sees in its explanation.
 function lexeme(g){
  const w=g.words[0],baseOverride=!!text(g.base),meaningOverride=!!text(g.definition);
  return {w,p:g.p||w.p,base:text(g.base)||text(w.b),meaning:text(g.definition)||text(w.d),baseOverride,meaningOverride,
   reviewed:!w.auto||(['counter','number'].includes(g.rule)&&meaningOverride)};
 }
 function prepare(book){
  if(cache.has(book))return cache.get(book);
  const data={groups:book.lines.map(line=>groupsFor(book,line)),readings:new Map(),meanings:new Map(),bases:new Map(),surfaceReadings:new Map(),surfaceBases:new Map(),baseReadings:new Map(),lexemeMeanings:new Map(),surfaceMeanings:new Map(),translations:[],lineTranslations:new Map(),curatedTranslations:new WeakMap()};
  const readingRows=new Map(),meaningRows=new Map(),baseRows=new Map(),translations=new Map();
  // Repaired spans keep old IDs stable; unused, incorrect dictionary entries
  // must not return as distractors in a later quiz.
  const activeWords=new Set(book.lines.flatMap(line=>line.t));
  for(const id of activeWords){
   const w=book.words[id];
   const b=text(w.b),d=text(w.d);
   if(b&&hasLetters(b)){add(data.surfaceBases,w.p+'\0'+w.s,b);add(baseRows,w.p,b);}
   if(w.s===b&&isReading(w.k))add(data.baseReadings,w.p+'\0'+b,kana(w.k));
   if(d){add(data.lexemeMeanings,w.p+'\0'+b,d);add(data.surfaceMeanings,w.p+'\0'+w.s,d);}
   // Do not turn the machine glossary's unreviewed meanings into scored facts.
   if(!w.auto&&d&&hasLetters(d)&&w.p!=='标点')add(meaningRows,w.p,d);
  }
  data.groups.forEach((groups,index)=>{
   for(const g of groups){
    if(g.p!=='标点'&&isReading(g.k)){add(readingRows,g.p,kana(g.k));add(data.surfaceReadings,g.s,kana(g.k));}
    const item=lexeme(g),{p,base,meaning}=item;
    if(base&&hasLetters(base)){add(data.surfaceBases,p+'\0'+g.s,base);add(baseRows,p,base);}
    if(g.s===base&&isReading(g.k))add(data.baseReadings,p+'\0'+base,kana(g.k));
    if(meaning){add(data.lexemeMeanings,p+'\0'+base,meaning);add(data.surfaceMeanings,p+'\0'+g.s,meaning);}
    if(item.reviewed&&meaning&&hasLetters(meaning)&&p!=='标点')add(meaningRows,p,meaning);
   }
   const jp=groups.map(g=>g.s).join(''),zh=text(book.lines[index].zh);
   if(zh&&hasLetters(zh)){if(!translations.has(plain(zh)))translations.set(plain(zh),zh);add(data.lineTranslations,jp,plain(zh));}
  });
  for(const [key,values] of readingRows)data.readings.set(key,[...values]);
  for(const [key,values] of meaningRows)data.meanings.set(key,[...values]);
  for(const [key,values] of baseRows)data.bases.set(key,[...values]);
  data.translations=[...translations.values()];cache.set(book,data);return data;
 }
 function meaningOverlap(a,b){
  const aa=text(a).split(/[；;，,、（）()]/).map(plain).filter(Boolean),bb=text(b).split(/[；;，,、（）()]/).map(plain).filter(Boolean);
  return aa.some(x=>bb.some(y=>x.includes(y)||y.includes(x)));
 }
 function options(kind,answer,candidates,rng){
  const normalize=kind==='reading'?kana:plain,correct=normalize(answer),seen=new Set([correct]),other=[];
  for(const value of candidates){const key=normalize(value);if(!key||seen.has(key))continue;seen.add(key);other.push(value);}
  if(other.length<3)return null;
  const selected=[answer,...shuffle(other,rng).slice(0,3)];
  const choices=shuffle(selected,rng).map(value=>({id:'c-'+hash(kind+'\0'+normalize(value)),text:value}));
  if(new Set(choices.map(choice=>choice.id)).size!==4)return null;
  return {choices,answerId:'c-'+hash(kind+'\0'+correct)};
 }
 function buildWord(data,index,g,groupIndex,kind,rng){
  const item=lexeme(g),{w,p,base}=item,question={id:'q-'+hash(index+'\0'+groupIndex+'\0'+kind),kind,focus:g.s};
  let answer,candidates;
  if(kind==='reading'){
   answer=kana(g.k);const alternatives=data.surfaceReadings.get(g.s)||new Set([answer]);
   candidates=(data.readings.get(g.p)||[]).filter(value=>!alternatives.has(value)&&Math.abs(value.length-answer.length)<=Math.max(3,Math.ceil(answer.length*.6)));
   question.prompt='这个词组在本句中的读音是？';
   question.explanation=`本句「${g.s}」的学习注音是「${answer}」。注音来自现有分词词典；专名、多音字与方言请结合上下文核对。`;
  }else if(kind==='meaning'){
   answer=item.meaning;const alternatives=[answer,...(data.lexemeMeanings.get(p+'\0'+base)||[]),...(data.surfaceMeanings.get(p+'\0'+g.s)||[]),...(!item.meaningOverride?(data.surfaceMeanings.get(w.p+'\0'+w.s)||[]):[])];
   candidates=(data.meanings.get(p)||[]).filter(value=>!alternatives.some(other=>meaningOverlap(value,other)));
   question.prompt=item.meaningOverride?'这个词组的基本词义是？':g.words.length>1?`其中核心词「${base}」的词典释义是？`:'这个词语的词典释义是？';
   question.explanation=item.meaningOverride?`「${g.s}」的学习释义：${answer}。${text(g.note)}`:`「${base||w.s}」的现有词典释义：${answer}。${g.words.length>1?'这题只考核心词义，完整表达还需结合后面的语法。'+text(g.note):'本句的具体含义还需结合上下文。'}`;
  }else{
   answer=base;const alternatives=new Set([base,...(data.surfaceBases.get(p+'\0'+g.s)||[]),...(!item.baseOverride?(data.surfaceBases.get(w.p+'\0'+w.s)||[]):[])]),readings=data.baseReadings.get(p+'\0'+base)||new Set();
   candidates=(data.bases.get(p)||[]).filter(value=>!alternatives.has(value)&&![...(data.baseReadings.get(p+'\0'+value)||[])].some(k=>readings.has(k)));
   question.prompt='这个词组中核心词的原形是？';
   question.explanation=item.baseOverride?`「${g.s}」中核心词的原形是「${base}」。${text(g.note)}`:`「${g.s}」中核心词的原形是「${base}」。${text(g.note)||'基本形来自分词词典自动分析；方言和省略表达请结合上下文核对。'}`;
  }
  const result=options(kind,answer,candidates,rng);return result?{...question,...result}:null;
 }
 function translationSources(data,book,curated){
  if(!curated||typeof curated!=='object'||!Object.keys(curated).length)return data;
  if(data.curatedTranslations.has(curated))return data.curatedTranslations.get(curated);
  const translations=new Map(),lineTranslations=new Map();
  book.lines.forEach((line,index)=>{const jp=data.groups[index].map(g=>g.s).join(''),zh=text(curated[index]?.zh||line.zh);if(zh&&hasLetters(zh)){if(!translations.has(plain(zh)))translations.set(plain(zh),zh);add(lineTranslations,jp,plain(zh));}});
  const result={translations:[...translations.values()],lineTranslations};data.curatedTranslations.set(curated,result);return result;
 }
 function translation(data,book,index,curated,rng){
  const sources=translationSources(data,book,curated),focus=data.groups[index].map(g=>g.s).join(''),answer=text(curated?.[index]?.zh||book.lines[index].zh),alternatives=sources.lineTranslations.get(focus)||new Set();
  const candidates=sources.translations.filter(value=>!alternatives.has(plain(value))&&!meaningOverlap(answer,value)&&Math.abs(value.length-answer.length)<=Math.max(24,answer.length));
  const result=options('translation',answer,candidates,rng);
  const explanation=curated?.[index]?.zh?`本句页面中的学习参考译文：${answer}。请结合原文与上下文理解；此题只帮助复习当前学习资料。`:`本句资料中的机器参考译文：${answer}。机器参考可能有误，尤其是短句、方言与省略；此题只帮助复习现有资料。`;
  return result?{id:'q-'+hash(index+'\0sentence\0translation'),kind:'translation',prompt:'当前学习资料给这一行的中文参考是哪一项？',focus,...result,explanation}:null;
 }
 function create(book,index,{limit=5,rng=Math.random,curated={}}={}){
  if(!book||!Array.isArray(book.words)||!Array.isArray(book.lines)||!Number.isInteger(index)||index<0||index>=book.lines.length)return [];
  const count=Number.isFinite(Number(limit))?Math.max(0,Math.min(20,Math.floor(Number(limit)))):5;if(!count)return [];
  const random=typeof rng==='function'?rng:Math.random,data=prepare(book),descriptors=[];
  data.groups[index].forEach((g,groupIndex)=>{
   const item=lexeme(g),{w,p,base}=item;if(g.p==='标点'||!hasLetters(g.s))return;
   if(isReading(g.k)&&kana(g.s)!==kana(g.k))descriptors.push({g,groupIndex,kind:'reading'});
   if(item.reviewed&&item.meaning&&['名词','动词','形容词','副词','连体词','感叹词'].includes(p))descriptors.push({g,groupIndex,kind:'meaning'});
   if(['动词','形容词'].includes(p)&&base&&base!==g.s&&(!w.auto||item.baseOverride))descriptors.push({g,groupIndex,kind:'base'});
  });
  // Prefer different words before asking a second skill about the same word.
  const shuffled=shuffle(descriptors,random),used=new Set(),first=[],remaining=[];
  for(const item of shuffled){if(used.has(item.g.s))remaining.push(item);else{first.push(item);used.add(item.g.s);}}
  const result=[],questionKeys=new Set();
  for(const item of [...first,...remaining]){
   const key=item.kind+'\0'+item.g.s;if(questionKeys.has(key))continue;
   const question=buildWord(data,index,item.g,item.groupIndex,item.kind,random);
   if(question){result.push(question);questionKeys.add(key);}if(result.length===count)break;
  }
  if(!result.length){const question=translation(data,book,index,curated,random);if(question)result.push(question);}
  return shuffle(result,random);
 }
 window.SENTENCE_QUIZ=Object.freeze({create});
})();
