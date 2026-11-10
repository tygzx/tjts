/* Embedded into study-groups.js by build-study-analysis.mjs. */
(() => {
 'use strict';
 const DATA=null; // @data
 const original=window.STUDY_GROUPS;
 const reviewed=new Map(DATA.sentences.map(s=>[s.jp,s]));
 const handbook=new Map((DATA.particleHandbook||[]).map(x=>[x.key,x]));
 const aliases={けど:'けれど',けれども:'けれど',なんて:'なんか',など:'なんか',ぐらい:'くらい',ねえ:'ね',ねぇ:'ね',なあ:'な',なぁ:'な',ぞ:'よ',ぜ:'よ',って:'という'};
 function particleKeys(g,details){
  const keys=new Set(details.flatMap(a=>a.particleKeys||[]));
  for(const w of g.parts||g.words){
   // Consult actual function words, never substrings of lexical words (その, かなり...).
   if(w.p!=='助词'&&!(w.p==='语气词'&&w.s==='と'))continue;
   let key=aliases[w.s]||w.s;
   if(w.s==='で'&&g.p==='动词')key='て';
   if(handbook.has(key))keys.add(key);
  }
  if(handbook.has(g.s)&&(g.p==='助词'||g.s==='こと'))keys.add(g.s);
  return [...keys];
 }
 const step=(form,why)=>({form,why});
 function feeling(groups){
  const out=[];
  for(let i=0;i<groups.length;i++){
   let s='',end=i,match=null;
   if(groups[i].s.startsWith('気'))for(;end<Math.min(groups.length,i+4);end++){
    s+=groups[end].s;
    if(/^気[がもは](?:する|した|して|しない|しなかった|してきた)$/.test(s)){match={s,end};break;}
   }
   if(!match){out.push(groups[i]);continue;}
   const chunk=groups.slice(i,match.end+1),words=chunk.flatMap(g=>g.words),particle=match.s[1];
   const negative=/しない$|しなかった$/.test(match.s);
   out.push({s:match.s,k:chunk.map(g=>g.k).join(''),p:'固定表达',words,parts:chunk.flatMap(g=>g.parts||g.words),audioParts:chunk.flatMap(g=>g.audioParts||[]),base:'気がする',rule:'feeling-expression',definition:negative?(particle==='も'?'也没有……的感觉；也不觉得……。':'没有……的感觉；不觉得……。'):particle==='も'?'也有……的感觉；也觉得……。':particle==='は'?'倒是觉得……；至少有这样的感觉（带对比）。':'觉得……；有……的感觉。',definitionReviewed:true});
   i=match.end;
  }
  return out;
 }
 function feelingAnalysis(g){
  if(g.rule!=='feeling-expression')return null;
  const p=g.s[1],tail=g.s.slice(2),steps=[step('気がする','常用基本表达：觉得……；「気」是感觉，「が」连接主语和谓语，「する」在整个表达里理解。')];
  const past=tail==='した',neg=tail==='しない'||tail==='しなかった';
  if(p!=='が')steps.push(step('気'+p+'する',p==='も'?'用「も」占据原来「が」的位置，添加“也”的意味；这是助词替换，不是「が」的活用。':'用「は」占据「が」的位置，把这种感觉提出来作话题或对比。'));
  if(tail!=='する')steps.push(step(g.s,past?'する是不规则动词：し＋た＝した，用过去形表示当时有这种感觉。':neg?'する → しない；若为「しなかった」，再把ない变成过去否定なかった。':'する → して：用て形连接后文。'+(tail==='してきた'?'再接くる的过去形きた，表示逐渐产生这种感觉。':'')));
  return {quote:g.s,base:'気がする',steps,meaning:original.describe(g).definition,warning:'整个表达的基本形式是「気がする」，其中动词的词典形才是「する」。变化顺序用于帮助理解，并不是说说话时必须依次造出这些句子。',kind:'表达结构'};
 }
 function regular(g){
  if(g.p!=='动词'||g.rule==='reviewed-context'&&g.words.length===1&&!g.words[0].ct)return null;
  const base=original.describe(g).base;if(!base||base===g.s)return null;
  const w=g.words.find(w=>w.b===base)||g.words.find(w=>base.endsWith('する')&&w.b==='する');
  if(!w)return null;
  const ct=w.ct||'',stem=base.slice(0,-1);let te,past,ren,neg,vol,cond,how;
  if(ct.includes('サ変')&&base.endsWith('する')){const a=base.slice(0,-2);te=a+'して';past=a+'した';ren=a+'し';neg=a+'しない';vol=a+'しよう';cond=a+'すれば';how='サ变动词「する」：て形是「して」，た形是「した」。';}
  else if(ct==='一段'&&base.endsWith('る')){te=stem+'て';past=stem+'た';ren=stem;neg=stem+'ない';vol=stem+'よう';cond=stem+'れば';how='一段动词去掉末尾「る」，接「て／た」。';}
  else if(ct.includes('カ変')&&base==='くる'){te='きて';past='きた';ren='き';neg='こない';vol='こよう';cond='くれば';how='「くる」是不规则动词：て形「きて」、た形「きた」。';}
  else if(ct.includes('カ変')&&base==='来る'){te='来て';past='来た';ren='来';neg='来ない';vol='来よう';cond='来れば';how='「来る」是不规则动词；来て、来た中的「来」读き，来ない读こない。';}
  else if(ct.startsWith('五段')&&!ct.includes('ウ音便')){
   const table={う:['って','った','い','わ','お','え'],つ:['って','った','ち','た','と','て'],る:['って','った','り','ら','ろ','れ'],む:['んで','んだ','み','ま','も','め'],ぶ:['んで','んだ','び','ば','ぼ','べ'],ぬ:['んで','んだ','に','な','の','ね'],く:['いて','いた','き','か','こ','け'],ぐ:['いで','いだ','ぎ','が','ご','げ'],す:['して','した','し','さ','そ','せ']};
   const end=base.at(-1),a=table[end];if(!a)return null;
   te=stem+a[0];past=stem+a[1];ren=stem+a[2];neg=stem+a[3]+'ない';vol=stem+a[4]+'う';cond=stem+a[5]+'ば';
   how=`五段动词词尾「${end}」接て／た时用「${a[0]}／${a[1]}」，不是直接把る删掉。`;
   if(ct.includes('促音便')&&end==='く'){te=stem+'って';past=stem+'った';how='「行く／いく」的て形、た形是例外：いって／いった，用促音っ。';}
   if(base==='ある')neg='ない';
  }else return null;
  const candidates=[];
  const add=(surface,steps)=>candidates.push({surface,steps});
  const initial=step(base,'动词词典形（基本形式）。'),teStep=step(te,how+' て形用于连接后面的成分。');
  add(te,[initial,teStep]);add(past,[initial,step(past,how+' 本处是た形；可表示过去或已经完成，具体时序看整句。')]);
  add(neg,[initial,step(neg,'变成否定形式，表示“不……”。')]);
  add(neg.slice(0,-1)+'かった',[initial,step(neg,'先变成否定形式。'),step(neg.slice(0,-1)+'かった','否定词尾ない → なかった，表示过去否定。')]);
  add(vol,[initial,step(vol,'意志形：表示“打算……／来……吧”。接か时常表示自问“要不要……”。')]);
  add(cond,[initial,step(cond,'ば条件形：表示“如果……”。五段词尾转え段＋ば；一段去る＋れば。')]);
  add(ren+'たい',[initial,step(ren,'用于连接たい的连用形。'),step(ren+'たい','加たい表示想做这件事。')]);
  add(ren+'ながら',[initial,step(ren,'用于连接ながら的连用形。'),step(ren+'ながら','接ながら表示一边做此动作、一边做后面的动作。')]);
  for(const ending of ['ます','ました','ません','ませんでした'])add(ren+ending,[initial,step(ren,'连接礼貌词尾的连用形。'),step(ren+ending,{'ます':'礼貌表达。','ました':'礼貌的过去表达。','ません':'礼貌的否定表达。','ませんでした':'礼貌的过去否定表达。'}[ending])]);
  add(past+'ら',[initial,step(past,'先找到た形。'),step(past+'ら','再接ら构成たら条件：“如果……／等……以后”。这里的た不必译成“过去”。')]);
  const endings={いる:'表示动作进行中，或动作结束后留下的状态。',いた:'いる → いた：把进行或持续的状态放到过去。',いて:'いる → いて：用て形继续连接后文。',いない:'いる → いない：否定这种进行或持续状态。',しまう:'接しまう，表示做完；也可能带遗憾、不由自主等语气。',しまった:'しまう → しまった，表示已经完成；具体感情色彩看上下文。',おく:'接おく，表示事先做好或保留某状态。',おいて:'おく → おいて，用て形继续连接。',おこう:'おく → おこう（意志形），表示打算先做好。',くる:'接くる，表示朝说话者这边来，或变化发展到说话时。',きた:'くる → きた，用过去形表达上述动作或变化。',いく:'接いく，表示离开说话者方向，或变化继续发展下去。',みる:'接みる，表示试着做，或经历以后看看结果。',みた:'みる → みた，表示试着做了。',もらう:'接もらう，主语接受别人为自己做这件事。',もらった:'もらう → もらった，表示过去接受了帮助。',くれる:'接くれる，别人为说话者或说话者一方做事。',くれた:'くれる → くれた，表示过去给说话者一方的帮助。'};
  for(const [ending,why] of Object.entries(endings)){
   const steps=[initial,teStep];
   if(['いた','いて','いない'].includes(ending))steps.push(step(te+'いる',endings.いる));
   if(ending==='しまった')steps.push(step(te+'しまう',endings.しまう));
   if(['おこう','おいて'].includes(ending))steps.push(step(te+'おく',endings.おく));
   steps.push(step(te+ending,why));add(te+ending,steps);
  }
  // Only publish an explanation if its whole reconstructed form exactly matches.
  const found=candidates.find(x=>x.surface===g.s);if(!found)return null;
  return {quote:g.s,base,steps:found.steps,meaning:original.describe(g).definition,kind:'常见活用拆解',warning:'此处依据词典类型和实际词形拆解；时态、动作状态和说话人的态度仍须连同整句判断。'};
 }
 function create(book,line){
  const groups=feeling(original.create(book,line)),text=line.t.map(id=>book.words[id].s).join(''),entry=reviewed.get(text);
  let offset=0;
  for(const g of groups){
   const start=offset;offset+=g.s.length;
   const details=(entry?.items||[]).filter(a=>a.start<offset&&a.end>start).map(a=>({...a,kind:'本句逐项讲解'}));
   const own=feelingAnalysis(g)||regular(g);
   g.analyses=details.length?details:own?[{...own,start,end:offset}]:[];
   g.particleKeys=particleKeys(g,details);
  }
  return groups;
 }
 function analyses(book,line,groups=create(book,line)){
  const seen=new Set(),items=[];
  for(const g of groups)for(const a of g.analyses||[]){const key=a.start+':'+a.end+':'+a.base;if(!seen.has(key)){seen.add(key);items.push(a);}}
  return {guide:reviewed.get(line.t.map(id=>book.words[id].s).join(''))?.guide||'',items:items.sort((a,b)=>a.start-b.start)};
 }
 function grammarHints(book,line,patterns,groups=create(book,line)){
  const source=line.t.map(i=>book.words[i].s).join(''),explained=reviewed.get(source)?.items||[];
  let offset=0;const tokens=line.t.map(i=>{const w=book.words[i],start=offset;offset+=w.s.length;return {...w,start,end:offset};});
  function valid(m,title){
   const a=m.index,z=a+m[0].length,first=tokens.find(t=>t.start===a);
   if(explained.some(x=>a>=x.start&&z<=x.end))return false;
   if(title==='〜って（口语）')return !!first&&first.s==='って'&&['助词','语气词'].includes(first.p);
   if(title==='のだ／んだ')return !!first&&['の','ん'].includes(first.s)&&['名词','助词'].includes(first.p);
   if(title==='〜れる／〜られる（形式候选）')return tokens.some(t=>t.start<=a&&t.end>=z&&t.p==='助动词'&&['れる','られる'].includes(t.b));
   if(title==='使役形式（候选）')return tokens.some(t=>t.start<=a&&t.end>=z&&t.p==='助动词'&&['せる','させる'].includes(t.b));
   return true;
  }
  return patterns.flatMap(([pattern,title,body])=>{
   // Check every occurrence: an early lexical false match must not hide a later real particle.
   const m=[...source.matchAll(new RegExp(pattern,'g'))].find(m=>valid(m,title));
   return m?[{at:m.index,quote:m[0],title,body}]:[];
  }).sort((a,b)=>a.at-b.at);
 }
 window.STUDY_GROUPS=Object.freeze({...original,create,analyses,grammarHints,particleHandbook:()=>DATA.particleHandbook||[],particlePrinciples:()=>DATA.particlePrinciples||[],particleReferences:()=>DATA.references||[]});
})();
