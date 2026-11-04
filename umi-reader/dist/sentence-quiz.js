/* Local multiple-choice practice from the existing book and glossary. No DOM or network. */
(() => {
 'use strict';
 const cache=new WeakMap();
 const text=value=>typeof value==='string'?value.trim():'';
 const kana=value=>text(value).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s/g,'');
 const plain=value=>text(value).normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu,'');
 const hasLetters=value=>/[\p{L}\p{N}]/u.test(value);
 const isReading=value=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(value)&&!/^[ーっッ]+$/.test(value);
 const quizUnit=w=>!/(?:标点|记号|片段)/.test(w.p||'')&&!/录入|需对照|需核对纸|原文.*疑/.test(w.d||w.definition||'');
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
   reviewed:window.STUDY_GROUPS.describe(g).reviewed};
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
   if(!quizUnit(w))continue;
   const b=text(w.b),d=text(w.d);
   if(b&&hasLetters(b)){add(data.surfaceBases,w.p+'\0'+w.s,b);add(baseRows,w.p,b);}
   if(w.s===b&&isReading(w.k))add(data.baseReadings,w.p+'\0'+b,kana(w.k));
   if(d){add(data.lexemeMeanings,w.p+'\0'+b,d);add(data.surfaceMeanings,w.p+'\0'+w.s,d);}
   // Do not turn the machine glossary's unreviewed meanings into scored facts.
   if(!w.auto&&d&&hasLetters(d)&&w.p!=='标点')add(meaningRows,w.p,d);
  }
  data.groups.forEach((groups,index)=>{
   for(const g of groups){
    if(!quizUnit(g)||g.words.some(w=>!quizUnit(w)))continue;
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
 const meaningPartsCache=new Map();
 function meaningParts(value){
  const key=text(value);
  if(!meaningPartsCache.has(key))meaningPartsCache.set(key,key.split(/[；;，,、（）()]/).map(plain).filter(Boolean));
  return meaningPartsCache.get(key);
 }
 function meaningOverlap(a,b){
  const aa=meaningParts(a),bb=meaningParts(b);
  return aa.some(x=>bb.some(y=>x.includes(y)||y.includes(x)));
 }
 function distance(a,b){
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}
  return row[b.length];
 }
 function near(answer,values,kind){
  const a=kind==='reading'?kana(answer):plain(answer);
  return values.map(value=>{const b=kind==='reading'?kana(value):plain(value);return {value,score:['reading','surface'].includes(kind)?distance(a,b):Math.abs(a.length-b.length)/Math.max(1,a.length,b.length)-[...new Set(a)].filter(c=>b.includes(c)).length/Math.max(1,new Set(a).size)};}).sort((a,b)=>a.score-b.score).slice(0,8).map(x=>x.value);
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
 function buildWord(data,index,g,groupIndex,kind,rng,hard=false){
  const item=lexeme(g),{w,p,base}=item,question={id:'q-'+hash(index+'\0'+groupIndex+'\0'+kind),kind,focus:g.s};
  let answer,candidates;
  if(kind==='reading'){
   answer=kana(g.k);const alternatives=data.surfaceReadings.get(g.s)||new Set([answer]);
   candidates=(data.readings.get(g.p)||[]).filter(value=>!alternatives.has(value)&&Math.abs(value.length-answer.length)<=Math.max(3,Math.ceil(answer.length*.6)));
   question.prompt='这个词组在本句中的读音是？';
   question.explanation=`本句「${g.s}」的学习注音是「${answer}」，与页面中的完整词组一致。专名、多音字与方言请结合原文注音和上下文理解。`;
  }else if(kind==='meaning'){
   answer=item.meaning;const alternatives=[answer,...(data.lexemeMeanings.get(p+'\0'+base)||[]),...(data.surfaceMeanings.get(p+'\0'+g.s)||[]),...(!item.meaningOverride?(data.surfaceMeanings.get(w.p+'\0'+w.s)||[]):[])];
   candidates=(data.meanings.get(p)||[]).filter(value=>!alternatives.some(other=>meaningOverlap(value,other)));
   question.prompt=g.definitionScope==='context'?'这个词语在本句中的意思是？':item.meaningOverride?'这个词组的基本词义是？':g.words.length>1?`其中核心词「${base}」的词典释义是？`:'这个词语的词典释义是？';
   question.explanation=item.meaningOverride?`「${g.s}」的学习释义：${answer}。${text(g.glossNote||g.note)}`:`「${base||w.s}」的现有词典释义：${answer}。${g.words.length>1?'这题只考核心词义，完整表达还需结合后面的语法。'+text(g.note):'本句的具体含义还需结合上下文。'}`;
  }else{
   answer=base;const alternatives=new Set([base,...(data.surfaceBases.get(p+'\0'+g.s)||[]),...(!item.baseOverride?(data.surfaceBases.get(w.p+'\0'+w.s)||[]):[])]),readings=data.baseReadings.get(p+'\0'+base)||new Set();
   candidates=(data.bases.get(p)||[]).filter(value=>!alternatives.has(value)&&![...(data.baseReadings.get(p+'\0'+value)||[])].some(k=>readings.has(k)));
   question.prompt='这个词组中核心词的原形是？';
   question.explanation=item.baseOverride?`「${g.s}」中核心词的原形是「${base}」。${text(g.glossNote||g.note)}`:`「${g.s}」中核心词的原形是「${base}」。${text(g.note)||'基本形来自分词词典自动分析；方言和省略表达请结合上下文核对。'}`;
  }
  const result=options(kind,answer,hard?near(answer,candidates,kind):candidates,rng);return result?{...question,...result}:null;
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
 function excerpt(groups,start,end,replacement){
  const before=groups.slice(0,start).map(g=>g.s).join(''),after=groups.slice(end).map(g=>g.s).join('');
  return (before.length>36?'…':'')+before.slice(-36)+replacement+after.slice(0,36)+(after.length>36?'…':'');
 }
 function challengeData(data){
  if(data.challenge)return data.challenge;
  const forms=new Map();
  for(const groups of data.groups)for(const g of groups){const item=lexeme(g);if(quizUnit(g)&&g.words.every(quizUnit)&&completeForm(g)&&item.reviewed&&['动词','形容词'].includes(item.p))add(forms,item.p+'\0'+item.base,g.s);}
  return data.challenge={forms};
 }
 function completeForm(g){
  const last=(g.parts||g.words).at(-1);
  return !/[っッ]$/.test(g.s)&&!/特殊・(?:ヤ|ジャ)/.test(last?.ct||'')&&!(last&&['动词','形容词','助动词'].includes(last.p)&&/^(未然|連用|仮定)/.test(last.f||'')&&!/^(たら|だら)$/.test(last.s));
 }
 function challenge(book,index,count,random,curated){
  const data=prepare(book),groups=data.groups[index],{forms}=challengeData(data),buckets=new Map();
  const addTask=(kind,groupIndex,make)=>{if(!buckets.has(kind))buckets.set(kind,[]);buckets.get(kind).push({groupIndex,make});};
  groups.forEach((g,i)=>{
   const item=lexeme(g);if(!quizUnit(g)||g.words.some(w=>!quizUnit(w))||!hasLetters(g.s))return;
   const context=excerpt(groups,i,i+1,'【'+g.s+'】');
   if(isReading(g.k)&&kana(g.s)!==kana(g.k))addTask('reading',i,()=>{const q=buildWord(data,index,g,i,'reading',random,true);return q&&{...q,context};});
   if(item.reviewed&&item.meaning&&['名词','动词','形容词','副词','连体词','感叹词','固定表达'].includes(item.p)){
    const kind=item.p==='固定表达'?'grammar':'meaning';
    addTask(kind,i,()=>{const q=buildWord(data,index,g,i,'meaning',random,true);return q&&{...q,id:'q-'+hash(index+'\0'+i+'\0challenge-'+kind),kind,context,...(kind==='grammar'?{prompt:'结合上下文，这个完整表达应怎样理解？'}:{})};});
   }
   const particle=['は','が','を','に','で','と','へ','も','の','から','まで','より'];
   const kind=g.p==='助词'&&particle.includes(g.s)?'particle':['动词','形容词'].includes(item.p)&&item.reviewed&&completeForm(g)?'form':null;
   if(kind){
    const candidates=kind==='particle'?particle.filter(s=>s!==g.s):[...(forms.get(item.p+'\0'+item.base)||[])].filter(s=>s!==g.s);
    if(candidates.length>=3)addTask(kind,i,()=>{
     const result=options(kind,g.s,near(g.s,candidates,'surface'),random);if(!result)return null;
     return {id:'q-'+hash(index+'\0'+i+'\0'+kind),kind,focus:excerpt(groups,i,i+1,'【　？　】'),
      prompt:kind==='particle'?'回忆刚读过的原文：空格处使用了哪个助词？':'回忆原文：这里使用了这个词的哪一种形式？',...result,
      source:{start:i,end:i+1,text:g.s},explanation:`原文是「${excerpt(groups,i,i+1,'【'+g.s+'】')}」。${kind==='form'?'核心词原形为「'+item.base+'」。'+text(g.glossNote||g.note):item.meaning} 本题按原文用法作答，不表示其他选项在任何语境下都不成立。`};
    });
   }
   const span=groups.slice(i,i+3);
   if(span.length===3&&span.every(x=>quizUnit(x)&&x.words.every(quizUnit)&&hasLetters(x.s))&&new Set(span.map(x=>x.s)).size===3&&span.map(x=>x.s).join('').length<=28&&span.some(x=>['动词','形容词','名词','固定表达'].includes(x.p))){
    addTask('order',i,()=>{
     const pieces=span.map(x=>x.s),answer=pieces.join(' → '),permutations=[[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].map(order=>order.map(n=>pieces[n]).join(' → '));
     const result=options('order',answer,permutations,random);if(!result)return null;
     return {id:'q-'+hash(index+'\0'+i+'\0order'),kind:'order',focus:excerpt(groups,i,i+3,'【① → ② → ③】'),prompt:'按原文还原这三个词组的顺序，应该选哪一项？',...result,
      source:{start:i,end:i+3,text:pieces.join('')},explanation:`原文词序：${answer}。放回句子是「${excerpt(groups,i,i+3,'【'+pieces.join('')+'】')}」。本题复习原文的表达顺序。`};
    });
   }
  });
  // Guarantee a mix of skills before repeating a type; no invented inflections
  // or automatically guessed grammar rules become answer keys.
  const queues=shuffle([...buckets.keys()],random).map(kind=>shuffle(buckets.get(kind),random)),result=[],used=new Set();
  for(let pass=0;pass<2&&result.length<count;pass++){
   let changed=true;
   while(changed&&result.length<count){changed=false;for(const queue of queues){
    const at=queue.findIndex(task=>pass||!used.has(task.groupIndex));if(at<0)continue;
    const [task]=queue.splice(at,1),q=task.make();changed=true;if(q){result.push(q);used.add(task.groupIndex);}if(result.length===count)break;
   }}
  }
  if(!result.length){const q=translation(data,book,index,curated,random);if(q)result.push(q);}
  return shuffle(result,random);
 }
 function create(book,index,{limit=5,rng=Math.random,curated={},difficulty='basic'}={}){
  if(!book||!Array.isArray(book.words)||!Array.isArray(book.lines)||!Number.isInteger(index)||index<0||index>=book.lines.length)return [];
  const count=Number.isFinite(Number(limit))?Math.max(0,Math.min(20,Math.floor(Number(limit)))):5;if(!count)return [];
  const random=typeof rng==='function'?rng:Math.random;
  if(difficulty==='challenge')return challenge(book,index,count,random,curated);
  const data=prepare(book),descriptors=[];
  data.groups[index].forEach((g,groupIndex)=>{
   const item=lexeme(g),{w,p,base}=item;if(!quizUnit(g)||g.words.some(w=>!quizUnit(w))||!hasLetters(g.s))return;
   if(isReading(g.k)&&kana(g.s)!==kana(g.k))descriptors.push({g,groupIndex,kind:'reading'});
   if(item.reviewed&&item.meaning&&['名词','动词','形容词','副词','连体词','感叹词','固定表达'].includes(p))descriptors.push({g,groupIndex,kind:'meaning'});
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
