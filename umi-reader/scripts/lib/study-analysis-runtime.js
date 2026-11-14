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
  const p=g.s[1],tail=g.s.slice(2),steps=[step('気がする','常用基本表达：觉得……；「気」是感觉，「が」连接主语和谓语，「する」在整个表达里理解。')];
  const past=tail==='した',neg=tail==='しない'||tail==='しなかった';
  if(p!=='が')steps.push(step('気'+p+'する',p==='も'?'用「も」占据原来「が」的位置，添加“也”的意味；这是助词替换，不是「が」的活用。':'用「は」占据「が」的位置，把这种感觉提出来作话题或对比。'));
  if(tail!=='する')steps.push(step(g.s,past?'する是不规则动词：し＋た＝した，用过去形表示当时有这种感觉。':neg?'する → しない；若为「しなかった」，再把ない变成过去否定なかった。':'する → して：用て形连接后文。'+(tail==='してきた'?'再接くる的过去形きた，表示逐渐产生这种感觉。':'')));
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
  const renHow=`${base} → ${ren}。${ct.startsWith('五段')?'词尾换到い段。':ct==='一段'?'去掉最后的る。':'使用不规则的连接形式。'}「连用形」就是此处为接ます、たい等准备的形式，不是一个新的动作。`;
  const volHow=ct.startsWith('五段')?`词尾换到お段，再加う：${base} → ${vol}。`:ct==='一段'?`去る，再加よう：${base} → ${vol}。`:`此词的不规则意志形是${vol}。`;
  const volSense=['ある','できる','出来る','わかる','分かる','見える','聞こえる'].includes(base)?'这个词通常不表示可主动决定的动作；此形式常表达推测，不能机械译成“打算”。':'通常表达自己的打算或“来……吧”的提议，接か可自问或商量。';
  const condHow=ct.startsWith('五段')?`词尾换到え段，再加ば：${base} → ${cond}。`:ct==='一段'?`去る，再加れば：${base} → ${cond}。`:`此词的不规则条件形是${cond}。`;
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
  add(cond,[initial,step(cond,condHow+' 把前项设为条件：“如果……”，接下来应找后项结果。')],'ba');
  add(ren+'たい',[initial,step(ren,renHow),step(ren+'たい','接たい表示想做；愿望不等于动作已经发生。たい也能继续变たかった（以前想）或たくない（不想）。')],'desire');
  add(ren+'ながら',[initial,step(ren,renHow),step(ren+'ながら','接ながら可表示一边做前项一边做后项，主要动作在后面；若有预期落差，也可能是让步。')],'nagara');
  for(const ending of ['ます','ました','ません','ませんでした'])add(ren+ending,[initial,step(ren,renHow),step(ren+ending,{'ます':'接ます，增加礼貌程度。非过去肯定，可说习惯或将来，不等于正在。','ました':'接ました，把动作说成礼貌的过去肯定。','ません':'接ません，表示礼貌的非过去否定：“不……”。','ませんでした':'接ませんでした，表示礼貌的过去否定：“没有……”。'}[ending])],'polite');
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
    const head=derived.slice(0,-1),chain=[initial,step(derived.slice(0,-aux.length),`${base}要接「${aux}」，先形成「${derived.slice(0,-aux.length)}」这个连接部分。${ct.includes('カ変')?'这里的来读こ。':''}`),step(derived,`${derived.slice(0,-aux.length)} ＋ ${aux} ＝ ${derived}。${causative?'使役形式让别人执行动作，可以是要求或允许。':'这是れる／られる形式；被动、可能、尊敬或自发须看角色与上下文。'}后接的${aux}按一段式变化，不能继续套原动词的五段词尾。`)];
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
    [stem+'かった',[[base,'い形容词的基本形式。'],[stem+'かった','去最后的い，接かった，表达过去的状态。']]],
    [stem+'くない',[[base,'い形容词的基本形式。'],[stem+'く','去最后的い，接く，准备连接否定。'],[stem+'くない','再接ない，否定这个性质或状态。']]],
    [stem+'くなかった',[[base,'い形容词的基本形式。'],[stem+'くない','い变く，再接ない，先否定。'],[stem+'くなかった','把ない变なかった，表示过去不是这种状态。']]],
    [stem+'くて',[[base,'い形容词的基本形式。'],[stem+'くて','い变くて，连接后面的特点、结果或原因关系；不单独决定时态。']]],
    [stem+'く',[[base,'い形容词的基本形式。'],[stem+'く','い变く，常修饰后面的动作，或接なる／する表达状态变化。具体关系要看后面的词。']]],
    [stem+'ければ',[[base,'い形容词的基本形式。'],[stem+'ければ','い换成ければ，表达如果处于这个状态。']]]
   ];
   const found=entries.find(([s])=>s===g.s);if(!found)return null;
   if(base==='いい')found[1][0][1]+='いい的这些变形通常使用よい的词干よ，不是いかった。';
   return {quote:g.s,base,steps:found[1].map(([f,w])=>step(f,w)),meaning:original.describe(g).definition,meaningLabel:'词语意思（不等于完整语法）',kind:'形容词活用拆解',lessonKeys:['i-adjective']};
  }
  if(base==='だ'&&g.words.some(w=>w.b==='だ'&&w.ct==='特殊・ダ')){
   const forms={だった:['copula','だ先变成连接た的だっ，再接た：だっ＋た＝だった。表示过去的判断，不是动词する。'],で:['copula','だ变成连接形式で，把名词或な形容词的判断接向后文。这里的で不是地点助词。'],であった:['copula','だ可用较书面的である表达；ある→あった，得到であった，表示过去的判断。'],だろう:['darou','だ变だろ＋う，形成推测或确认的だろう，不是过去时。'],なら:['nara','判断だ的条件形式なら，把前面所说的身份、状态当作话题或假定。']};
   const found=forms[g.s];if(found)return {quote:g.s,base,steps:[step('だ','名词或な形容词后使用的普通体判断形式。'),step(g.s,found[1])],meaning:original.describe(g).definition,meaningLabel:'词语意思（不等于完整语法）',kind:'判断表达的变形',lessonKeys:[found[0]]};
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
