/* Embedded into study-groups.js by build-study-analysis.mjs. */
(() => {
 'use strict';
 const DATA=null; // @data
 const original=window.STUDY_GROUPS;
 const readingIndexes=new WeakMap();
 function formReading(book,form,words=[]){
  if(!form||!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(form))return '';
  if(!/\p{Script=Han}/u.test(form))return form;
  const special={来る:'くる',来て:'きて',来た:'きた',来ない:'こない',来なかった:'こなかった',来ます:'きます',来よう:'こよう',来れば:'くれば',気がする:'きがする'};
  if(special[form])return special[form];
  // Restore a kana ending using the same token's reading, preserving homograph context.
  const candidates=new Set();
  for(const w of words){
   if(w.s===form&&w.k)candidates.add(w.k);
   if(!w.b||!w.k||!w.ct||!['动词','形容词','助动词'].includes(w.p))continue;
   let n=0;while(n<Math.min(w.s.length,w.b.length)&&w.s[n]===w.b[n])n++;
   const head=w.s.slice(0,n),tail=w.s.slice(n);
   if(!head||!form.startsWith(head)||!/^[\p{Script=Hiragana}ー]*$/u.test(tail)||!w.k.endsWith(tail)||!/^[\p{Script=Hiragana}ー]*$/u.test(form.slice(n)))continue;
   candidates.add((tail?w.k.slice(0,-tail.length):w.k)+form.slice(n));
  }
  if(candidates.size===1)return [...candidates][0];
  if(candidates.size>1)return '';
  if(!readingIndexes.has(book)){const map=new Map();for(const w of book.words){if(!w.k)continue;if(!map.has(w.s))map.set(w.s,new Set());map.get(w.s).add(w.k);}readingIndexes.set(book,map);}
  const exact=readingIndexes.get(book).get(form);if(exact?.size===1)return [...exact][0];
  // A compound する verb may have a separate, unchanged noun token.
  if(form.endsWith('する')){const noun=form.slice(0,-2),parts=words.filter(w=>w.s===noun);if(parts.length&&parts.every(w=>w.k===parts[0].k))return parts[0].k+'する';}
  return DATA.formReadings?.[form]||'';
 }
 const reviewed=new Map(DATA.sentences.map(s=>[s.jp,s]));
 const walkthroughs=new Map((DATA.walkthroughs||[]).map(s=>[s.jp,s]));
 const grammarLessons=new Map((DATA.grammarTeaching?.lessons||[]).map(g=>[g.key,g]));
 function lessonsFor(keys){return [...new Set(keys||[])].map(k=>grammarLessons.get(k)).filter(Boolean);}
 function grammarTeaching(title){return lessonsFor(DATA.grammarTeaching?.titleKeys?.[title]||[]);}
 function walkthrough(book,line){return walkthroughs.get(line.t.map(i=>book.words[i].s).join(''))||null;}
 const combinations=new Map((DATA.particleCombinations?.guides||[]).map(x=>[x.key,x]));
 const combinationContexts=new Map();
 for(const x of DATA.particleCombinations?.contexts||[]){if(!combinationContexts.has(x.jp))combinationContexts.set(x.jp,[]);combinationContexts.get(x.jp).push(x);}
 function combineParticles(groups,source){
  const out=[],contexts=combinationContexts.get(source)||[],lesson=walkthroughs.get(source);let offset=0;
  const eligible=g=>(g.parts||g.words).every(w=>w.p==='助词'||w.p==='语气词'&&w.s==='と'||w.p==='名词'&&w.s==='の'||w.p==='助动词'&&w.s==='で');
  for(let i=0;i<groups.length;i++){
   let surface='',found=null;
   for(let j=i;j<Math.min(groups.length,i+3);j++){
    if(!eligible(groups[j]))break;
    surface+=groups[j].s;if(surface.length>4)break;
    const entry=combinations.get(surface);
    // A single とも (両親とも, both parents) is not と + も.
    if(entry&&!(surface==='とも'&&j===i))found={entry,end:j,surface};
   }
   if(!found){out.push(groups[i]);offset+=groups[i].s.length;continue;}
   const chunk=groups.slice(i,found.end+1),end=offset+found.surface.length;
   const context=contexts.find(x=>x.key===found.surface&&x.start<=offset&&x.end>=end)||null;
   const block=lesson?.blocks.find(x=>x.start<=offset&&x.end>=end);
   const parts=chunk.flatMap(g=>g.parts||g.words);
   // The interlinear gloss describes only this combination, never the whole clause.
   let gloss=found.entry.short,localGloss=false;
   if(context&&found.surface==='でも'){
    gloss=context.sense.includes('举例')?'……之类（随口举例）':context.sense.includes('让步')?'即使是……也……':context.sense.includes('否定')?'也并非……（与后面的否定连读）':'连……也……';localGloss=true;
   }
   if(context&&found.surface==='のに'){
    gloss=context.sense.includes('察觉')?'把前面的事实接作察觉内容':context.sense.includes('用途')?'在……方面；用于……':'明明……却……';localGloss=true;
   }
   out.push({s:found.surface,k:chunk.map(g=>g.k).join(''),p:'组合表达',words:chunk.flatMap(g=>g.words),parts,audioParts:chunk.flatMap(g=>g.audioParts||[]),base:found.surface,rule:'particle-combination',definition:gloss,definitionReviewed:true,definitionScope:localGloss?'context':'general',combination:{...found.entry,start:offset,end,context,nearby:!context&&block?{quote:block.quote,meaning:block.meaning,why:block.why}:null}});
   offset=end;i=found.end;
  }
  return out;
 }
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
  const p=g.s[1],tail=g.s.slice(2),steps=[step('気がする','先整块记成“有这种感觉／觉得……”。前面那段话告诉你，到底觉得什么。不要按“气＋做”逐字翻。')];
  const past=tail==='した',neg=tail==='しない'||tail==='しなかった';
  if(p!=='が')steps.push(step('気'+p+'する',p==='も'?'把中间的が换成も，就像中文在“觉得”前加了一个“也”。只是换掉这一个字，后面的动作还没改。':'把中间的が换成は，先提起“这种感觉”，常带“至少我是这么觉得／倒是有这种感觉”的对比口气。'));
  if(tail!=='する')steps.push(step(g.s,past?'最后把する换成した，就在说“那时候有这种感觉”。其中し＋た＝した；如果前面还用了も，就把“也”一起读进去。':neg?'する → しない，变成“不觉得”。如果写成しなかった，再把ない换成なかった，就是“当时不觉得”。':'把最后的する换成して，说明话还要往下接。'+(tail==='してきた'?'再接きた，整段说这种感觉渐渐出现了。':'')));
  return {quote:g.s,base:'気がする',steps,meaning:original.describe(g).definition,meaningLabel:'表达整体意思',lessonKeys:['feeling'],warning:'整个表达的基本形式是「気がする」，其中动词的词典形才是「する」。变化顺序用于帮助理解，并不是说说话时必须依次造出这些句子。',kind:'表达结构'};
 }
 function regular(g){
  if(g.p!=='动词'||g.rule==='reviewed-context'&&g.words.length===1&&!g.words[0].ct)return null;
  const base=original.describe(g).base;if(!base||base===g.s)return null;
  const w=g.words.find(w=>w.b===base)||g.words.find(w=>base.endsWith('する')&&w.b==='する');
  if(!w)return null;
  const ct=w.ct||'',stem=base.slice(0,-1);let te,past,ren,neg,vol,cond,how;
  // These honorific verbs have special polite stems; do not publish a regular-form table.
  if(ct.includes('ラ行特殊')||['くださる','下さる','なさる','いらっしゃる','おっしゃる','仰る','ござる'].includes(base))return null;
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
  const verbClass=ct.includes('サ変')?{name:'不规则动词（サ变）',rule:`“不规则”就是这个词需要单独记接法。眼前这个词是${base}，过去说${past}，连接后文说${te}。先记这两个完整写法即可。`}:ct.includes('カ変')?{name:'不规则动词（カ变）',rule:'来る读くる，来た读きた，来ない读こない。写的都是来，读音却会随用法变；这几个写法要一起记。'}:ct==='一段'?{name:'一段动词',rule:`这是一组常见的变形规则：拿${base}来说，先去掉最后的る，保留${stem}；加た得到${past}，加ない得到${neg}。先照这个具体词看，不必先背类别名称。`}:{name:'五段动词',rule:'“五段”是一类动词的变形规则名称：词尾会随用法，在あ(a)、い(i)、う(u)、え(e)、お(o)五组元音之间变化。不是五个单词，也不是五种时态。先看本次需要的完整写法，下面的五格对照可慢慢查。'};
  if(ct.startsWith('五段'))verbClass.rows=[['あ段 a',neg,'否定：不……'],['い段 i',ren+'ます','用礼貌的方式说……'],['う段 u',base,'词典收录的原形'],['え段 e',cond,'如果……'],['お段 o',vol,'打算……／……吧；有时表推测']].map(([label,form,meaning])=>({label,form,meaning}));
  if(ct.startsWith('五段'))verbClass.note=base.endsWith('う')?`这里的原形以う结尾。说“不……”时用わない：${base} → ${neg}；わ读wa，也归在a这一组。`:'上面按元音分五格。て形、た形还要用专门的词尾写法，不能仅靠这五格直接相加。';
  const negHow=base==='ある'?'ある的否定是例外，直接用ない，不说あらない。':ct.startsWith('五段')?`把词尾「${base.at(-1)}」换成「${neg.slice(stem.length,-2)}」，再加ない：${base} → ${neg}。`:`${base} → ${neg.slice(0,-2)} ＋ ない → ${neg}。${ct==='一段'?'先去掉る。':'这是不规则动词要单独记的接法。'}`;
  const renHow=`${base} → ${ren}。${ct.startsWith('五段')?`保留「${stem}」，把最后的「${base.at(-1)}」换成「${ren.slice(stem.length)}」。`:ct==='一段'?'先拿掉最后的る。':`这个词要用「${ren}」来接后面的字，先把这一对写法记在一起。`}这里还没接完，接下来要加ます、たい等字，才知道要表达客气、想做，还是别的意思。`;
  const volHow=ct.startsWith('五段')?`保留「${stem}」，把结尾「${base.at(-1)}」换成「${vol.slice(stem.length)}」：${base} → ${vol}。`:ct==='一段'?`拿掉最后的る，再接よう：${base} → ${vol}。`:`这个词用${vol}来表达这一层意思，和${base}一起记。`;
  const volSense=['ある','できる','出来る','わかる','分かる','見える','聞こえる'].includes(base)?'这个词通常不表示可主动决定的动作；此形式常表达推测，不能机械译成“打算”。':'通常表达自己的打算或“来……吧”的提议，接か可自问或商量。';
  const condHow=ct.startsWith('五段')?`保留「${stem}」，把结尾「${base.at(-1)}」换成「${cond.slice(stem.length)}」：${base} → ${cond}。`:ct==='一段'?`拿掉最后的る，再接れば：${base} → ${cond}。`:`这个词说“如果……”时，写作${cond}。`;
  const candidates=[];
  const add=(surface,steps,key)=>candidates.push({surface,steps,lessonKeys:[key]});
  const initial=step(base,'这是查词典时用的完整写法，也叫“原形”。先认出这个词，再看为了表达不同意思，末尾怎样改变。'),teStep=step(te,`${te.slice(0,-1)} ＋ ${te.at(-1)} ＝ ${te}。这是用来连接后文的完整写法。例如后接いる时，要把整个表达一起读；单独的て不表示“正在”。`);
  const targetForm=g.s===past||g.s===past+'ら'?past:te;
  const replaceEnding=ct.startsWith('五段')?`保留「${stem}」，把最后的「${base.at(-1)}」换成「${targetForm.slice(stem.length)}」：${base} → ${targetForm}。`:how;
  const connecting=step(te.slice(0,-1),ct==='一段'?`先去掉${base}最后的る，剩下${te.slice(0,-1)}。这一步只展示还没接完的部分。`:ct.includes('サ変')?`する在接${targetForm.at(-1)}时先写成し。这里还没接完，要和下一步的${targetForm.at(-1)}一起看。`:ct.includes('カ変')?'来る在接た／て时，来读き；这里展示还没接完的部分。':`${replaceEnding}这里单列「${te.slice(0,-1)}」只是为了展示变化，它不是另一个可以单独使用的词。${te.endsWith('って')?`小っ不读成つ（tsu）；读完整的${targetForm}时，在${targetForm.at(-1)}前短暂停一拍。`:te.endsWith('んで')?'词尾变成ん，再接だ／で；例如読む的过去写作読んだ。':te.slice(0,-1)===ren?'这个词接ます与接た之前，剩下的部分相同。':'这种词尾发音的变化叫“音变”，先记完整写法即可。'}`);
  const pastStep=step(past,`${past.slice(0,-1)} ＋ ${past.at(-1)} ＝ ${past}。这就是完整的写法；在一般叙述中，可以用来讲过去做了什么或当时是什么状态。教材把这种写法叫“た形”。${base==='思う'?'思う是“想／认为”，思った在回顾中是“当时想／当时觉得”。':''}`);
  add(te,[initial,connecting,teStep],'te');add(past,[initial,connecting,pastStep],'past');
  add(neg,[initial,step(neg,negHow+' ない增加否定意思：“不……”，它本身不是过去否定。')],'negative');
  add(neg.slice(0,-1)+'かった',[initial,step(neg,negHow),step(neg.slice(0,-1)+'かった','保留ない前面的部分，把ない的い换成かった：ない → なかった。这样得到“过去没有……”；不是把原动词先变た形再加ない。')],'negative-past');
  add(vol,[initial,step(vol,volHow+volSense)],'volitional');
  add(cond,[initial,step(cond,condHow+' 先把这一段读成“如果……”，再往后找“会怎么样”。')],'ba');
  add(ren+'たい',[initial,step(ren,renHow),step(ren+'たい','接たい表示想做；愿望不等于动作已经发生。たい也能继续变たかった（以前想）或たくない（不想）。')],'desire');
  add(ren+'ながら',[initial,step(ren,renHow),step(ren+'ながら','再接ながら，常是“一边做这件事，一边做后面的事”。如果后文与前面说的矛盾，也可能是“明明……却……”，要读到后面再判断。')],'nagara');
  for(const ending of ['ます','ました','ません','ませんでした'])add(ren+ending,[initial,step(ren,renHow),step(ren+ending,{'ます':'最后接ます，把话说得客气些。可以说平常做或将来会做，不是只要有ます就表示正在做。','ました':'最后接ました，客气地说“那时候做了”。','ません':'最后接ません，客气地说“不做”。','ませんでした':'最后接ませんでした，客气地说“那时候没有做”。'}[ending])],'polite');
  add(past+'ら',[initial,connecting,pastStep,step(past+'ら','在整个た形后加ら，形成たら条件：“如果……／等……以后”。即使涉及明天未发生的事也能用，不是单纯过去叙述。')],'tara');
  const endings={いる:'表示动作进行中，或动作结束后留下的状态。',いた:'いる → いた：把进行或持续的状态放到过去。',いて:'いる → いて：用て形继续连接后文。',いない:'いる → いない：否定这种进行或持续状态。',しまう:'接しまう，表示做完；也可能带遗憾、不由自主等语气。',しまった:'しまう → しまった，表示已经完成；具体感情色彩看上下文。',おく:'接おく，表示事先做好或保留某状态。',おいて:'おく → おいて，用て形继续连接。',おこう:'おく → おこう（意志形），表示打算先做好。',くる:'接くる，表示朝说话者这边来，或变化发展到说话时。',きた:'くる → きた，用过去形表达上述动作或变化。',いく:'接いく，表示离开说话者方向，或变化继续发展下去。',みる:'接みる，表示试着做，或经历以后看看结果。',みた:'みる → みた，表示试着做了。',もらう:'接もらう，主语接受别人为自己做这件事。',もらった:'もらう → もらった，表示过去接受了帮助。',くれる:'接くれる，别人为说话者或说话者一方做事。',くれた:'くれる → くれた，表示过去给说话者一方的帮助。'};
  for(const [ending,why] of Object.entries(endings)){
   const steps=[initial,connecting,teStep];
   if(['いた','いて','いない'].includes(ending))steps.push(step(te+'いる',endings.いる));
   if(ending==='しまった')steps.push(step(te+'しまう',endings.しまう));
   if(['おこう','おいて'].includes(ending))steps.push(step(te+'おく',endings.おく));
   const prior={きた:'くる',みた:'みる',もらった:'もらう',くれた:'くれる'}[ending];
   if(prior)steps.push(step(te+prior,endings[prior]));
   steps.push(step(te+ending,why));add(te+ending,steps,{いる:'progressive',いた:'progressive',いて:'progressive',いない:'progressive',しまう:'completion',しまった:'completion',おく:'preparation',おいて:'preparation',おこう:'preparation',くる:'approach',きた:'approach',いく:'away',みる:'trial',みた:'trial',もらう:'receive',もらった:'receive',くれる:'give',くれた:'give'}[ending]);
  }
  // One token-confirmed voice auxiliary, optionally followed by a state/tense ending.
  // Do not guess from a substring or publish multi-voice chains such as させられる.
  const voices=g.words.filter((x,i)=>i>0&&['助动词','动词'].includes(x.p)&&['れる','られる','せる','させる'].includes(x.b));
  if(voices.length===1){
   const causative=['せる','させる'].includes(voices[0].b),key=causative?'causative':'passive-potential';
   const derived=ct.includes('サ変')?base.slice(0,-2)+(causative?'させる':'される'):ct.includes('カ変')?(base==='来る'?'来':'こ')+(causative?'させる':'られる'):ct==='一段'?stem+(causative?'させる':'られる'):neg.slice(0,-2)+(causative?'せる':'れる');
   const aux=ct.includes('サ変')?(causative?'せる':'れる'):ct.startsWith('五段')?(causative?'せる':'れる'):(causative?'させる':'られる');
   const beforeVoice=g.words.slice(0,g.words.indexOf(voices[0])).map(x=>x.s).join('');
   if(voices[0].b===aux&&beforeVoice===derived.slice(0,-aux.length)){
    const head=derived.slice(0,-1),chain=[initial,step(derived.slice(0,-aux.length),`先把「${base}」改成「${derived.slice(0,-aux.length)}」，等着接下面的「${aux}」。这一截还没接完。${ct.includes('カ変')?'这里的来读こ。':''}`),step(derived,`${derived.slice(0,-aux.length)} ＋ ${aux} ＝ ${derived}。${causative?'现在多了“让别人做”的意思。谁要求或允许，谁真正做动作，要分别找出来。':'现在可能在说“被别人做”“自己能做”，也可能是在尊敬别人或说感受自然出现。先看前后人物关系，再选意思。'}接下来如果还要说“不、当时”等，就改这个新写法最后的る。`)];
    const voiceForms=[['',[],null],['た',[[head,'后接成分去最后的る，准备接た。'],[head+'た',`${head} ＋ た：把整个表达放到过去。`]],'past'],['て',[[head,'后接成分去最后的る。'],[head+'て','接て，准备连接后面的状态或动作。']],'te'],['ない',[[head+'ない','后接成分去る，加ない，否定整个表达。']],'negative'],['なかった',[[head+'ない','先去る，加ない，否定。'],[head+'なかった','ない变なかった，得到过去否定。']],'negative-past'],['ている',[[head+'て','后接成分去る＋て，把整个动作交给いる。'],[head+'ている','再接いる，表达这个动作的进行或结果状态。']],'progressive'],['ていた',[[head+'て','后接成分去る＋て，连接状态成分。'],[head+'ている','接いる，表示整个动作的进行或持续状态。'],[head+'ていた','いる→いた，把这种状态放到过去。']],'progressive'],['ていない',[[head+'ている','先用て形＋いる表示状态。'],[head+'ていない','いる→いない，否定这种状态。']],'progressive'],['ていて',[[head+'ている','先用て形＋いる表示状态。'],[head+'ていて','いる→いて，用て形继续连接后文。']],'progressive'],['ます',[[head+'ます','后接成分去る＋ます，成为礼貌非过去形式。']],'polite'],['ました',[[head+'ます','后接成分去る＋ます。'],[head+'ました','ます→ました，成为礼貌过去形式。']],'polite']];
    for(const [ending,steps,extra] of voiceForms)candidates.push({surface:ending?head+ending:derived,steps:[...chain,...steps.map(([f,w])=>step(f,w))],lessonKeys:[key,...extra?[extra]:[]]});
   }
  }
  // Only publish an explanation if its whole reconstructed form exactly matches.
  const found=candidates.find(x=>x.surface===g.s);if(!found)return null;
  const formTable=[['辞书形',base,'基本形式；非过去肯定'],['て形',te,'连接后项，本身不定时态'],['た形',past,'常表过去；也用于连接其他句型'],['ない形',neg,'非过去否定'],['过去否定',neg.slice(0,-1)+'かった','过去没做／当时不是这种状态'],['ます形',ren+'ます','礼貌的非过去肯定'],['意志／推量形',vol,volSense.includes('推测')?'常表达推测，需结合语境':'自己的打算／提议'],['ば条件形',cond,'如果……']].map(([label,form,meaning])=>({label,form,meaning}));
  return {quote:g.s,base,steps:found.steps,meaning:original.describe(g).definition,meaningLabel:'词语意思（不等于完整语法）',kind:'常见活用拆解',lessonKeys:found.lessonKeys,verbClass,formTable,warning:'词形按词典类别与实际写法核对。下面的通用讲解不替代本句的语境判断；例句是教学示例，不是小说原文。'};
 }
 function adjectiveOrCopula(g){
  const base=original.describe(g).base;
  const adjective=g.words.find(w=>w.b===base&&w.p==='形容词'&&w.ct?.startsWith('形容詞'));
  if(adjective&&base.endsWith('い')&&g.s!==base){
   const stem=base==='いい'?'よ':base.slice(0,-1),entries=[
    [stem+'かった',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'かった','拿掉最后的い，接かった。这样就在回顾“那时候是这个样子”。']]],
    [stem+'くない',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'く','把最后的い换成く，准备往后接。'],[stem+'くない','再加ない，变成“不这样”。比如寒くない，就是不冷。']]],
    [stem+'くなかった',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'くない','把い换成く，再加ない，先说“不这样”。'],[stem+'くなかった','把最后的ない换成なかった，再加上“当时”的意思：那时候不这样。']]],
    [stem+'くて',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'くて','把最后的い换成くて，说明后面还要接话。可能接另一个特点，也可能说因为这样，才发生了后面的事。']]],
    [stem+'く',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'く','把最后的い换成く，往后看：比如早く起きる，是“早早地起床”；寒くなる，是“变冷”。后面的词决定整段怎么读。']]],
    [stem+'ければ',[[base,'先认这个词原来的写法，它是在说某个特点或状态。'],[stem+'ければ','把最后的い换成ければ，说的是“如果是这个样子……”，再往后找结果。']]]
   ];
   const found=entries.find(([s])=>s===g.s);if(!found)return null;
   if(base==='いい')found[1][0][1]+='いい要特别记：这里先按よい来改，所以“那时好”说よかった。';
   return {quote:g.s,base,steps:found[1].map(([f,w])=>step(f,w)),meaning:original.describe(g).definition,meaningLabel:'词语意思（不等于完整语法）',kind:'形容词活用拆解',lessonKeys:['i-adjective']};
  }
  if(base==='だ'&&g.words.some(w=>w.b==='だ'&&w.ct==='特殊・ダ')){
   const forms={だった:['copula','把だ换成だった，就在说“那时候是……／那时候很……”。比如学生だ→学生だった，是“是学生→那时是学生”，不是做了一个动作。'],で:['copula','把だ换成で，是把“是怎样”的这段话接到后面继续说。这里的で不是在交代动作发生的地点。'],であった:['copula','书里也常用である来说“是……”。其中ある换成あった，就得到であった，讲“那时候是……”。'],だろう:['darou','把だ换成だろう，加上“大概是吧／是这样吧”的口气。这里不是在交代过去。'],なら:['nara','用なら接住前面说的事情，类似中文“如果你说的是……／要是这样的话……”，再看后面要说什么。']};
   const found=forms[g.s];if(found)return {quote:g.s,base,steps:[step('だ','先看前面的词。比如学生だ是“是学生”，静かだ是“安静”；だ接在它们后面把话说完整。'),step(g.s,found[1])],meaning:original.describe(g).definition,meaningLabel:'词语意思（不等于完整语法）',kind:'判断表达的变形',lessonKeys:[found[0]]};
  }
  return null;
 }
 function create(book,line){
  const text=line.t.map(id=>book.words[id].s).join(''),groups=combineParticles(feeling(original.create(book,line)),text),entry=reviewed.get(text);
  let offset=0;
  for(const g of groups){
   const start=offset;offset+=g.s.length;
   const details=(entry?.items||[]).filter(a=>a.start<offset&&a.end>start).map(a=>({...a,kind:'本句逐项讲解'}));
   const own=feelingAnalysis(g)||regular(g)||adjectiveOrCopula(g);
   const block=walkthroughs.get(text)?.blocks.find(x=>x.start<=start&&x.end>=offset);
   const contextLesson=block?{quote:block.quote,meaning:block.meaning,why:block.why}:null;
   g.analyses=details.length?details.map(a=>({...a,meaningLabel:'本句理解',grammarLessons:lessonsFor(a.quote===g.s?own?.lessonKeys:[]),verbClass:a.quote===g.s?own?.verbClass:null,formTable:a.quote===g.s?own?.formTable:null})):own?[{...own,start,end:offset,contextLesson,grammarLessons:lessonsFor(own.lessonKeys)}]:[];
   g.baseKana=formReading(book,original.describe(g).base,g.words);
   for(const a of g.analyses){a.baseKana=formReading(book,a.base,g.words);a.steps=a.steps.map(s=>({...s,kana:formReading(book,s.form,g.words)}));if(a.verbClass?.rows)a.verbClass={...a.verbClass,rows:a.verbClass.rows.map(r=>({...r,kana:formReading(book,r.form,g.words)}))};}
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
 window.STUDY_GROUPS=Object.freeze({...original,create,analyses,grammarHints,walkthrough,formReading,grammarTeaching,grammarGlossary:()=>DATA.grammarTeaching?.glossary||[],grammarLessonReferences:()=>DATA.grammarTeaching?.references||[],particleHandbook:()=>DATA.particleHandbook||[],particlePrinciples:()=>DATA.particlePrinciples||[],particleReferences:()=>DATA.references||[]});
})();
