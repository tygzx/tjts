/* Learning units preserve the source text; reviewed expressions take precedence. */
(() => {
 'use strict';
 // Context glosses are matched against the source sentence, not copied from
 // the Chinese translation. They do not modify shared dictionary entries.
 const CONTEXT_GLOSSES=[
  ['えらく疲れてしまった','えらく','非常；很。这里修饰「疲れてしまった」，意思是“累得够呛”。'],
  ['えらく呑気','えらく','格外；相当。这里强调对方的反应十分悠闲、不慌不忙。'],
  ['えらく怒りだして','えらく','非常；很。这里表示对方发了很大的火。'],
  ['階段をのぼりおりした','おり','下来；下楼。与前面的「のぼり」一起表示上下楼梯。','おりる','动词'],
  ['管理費こみで','こみで','连同……一起算；包含在内。这里是“包括管理费在内”。','こみ','名词'],
  ['クロス張り','張り','贴上、铺上某种材料。这里指墙面贴着壁纸。'],
  ['そのむこうに７畳','むこう','那边；再往里。这里指厨房另一边的房间。','むこう','名词'],
  ['東むきの窓','むき','朝向；朝着……。这里「東むき」是“朝东”。'],
  ['月６万円台','月','每月；一个月。这里说的是每月的房租，不是月亮。'],
  ['メゾン英』にうつって','うつって','搬到；迁入。这里是从会馆搬进公寓。','うつる','动词'],
  ['銀行にいって、カードで','引きだしてくる','去取出（存款）再回来。这里是在银行取钱。','引きだす','动词'],
  ['駅まえの銀行','まえ','前面。这里是“车站前面的银行”。','まえ','名词'],
  ['高知にかえるという夜','かえる','返回；回去。这里指母亲回高知。','かえる','动词'],
  ['明日は母親が高知にかえるという夜','さげた','低下（头）；鞠躬。这里是低头向母亲致谢。','さげる','动词'],
  ['お金つこうたら','つこうたら','花了这么多钱的话。「つこうたら」是方言形式，相当于「使ったら」。','使う','动词'],
  ['淋しげに笑った','げ','接在形容词词干后，表示“看起来……的样子”；淋しげ＝显得有些寂寞。'],
 ];
 function contextualize(groups,book,line){
  const text=line.t.map(id=>book.words[id].s).join('');
  return groups.map(g=>{
   const found=CONTEXT_GLOSSES.find(([anchor,s])=>g.s===s&&text.includes(anchor));
   if(!found)return g;
   return {...g,definition:found[2],definitionReviewed:true,definitionScope:'context',
    base:found[3]||g.base||g.words[0].b,p:found[4]||g.p,glossNote:'本句释义按日文上下文校订；其他句子中的同形词可能有不同含义。'};
  });
 }
 function describe(g){
  const w=g.words[0],override=typeof g.definition==='string'&&g.definition.length>0;
  return {definition:override?g.definition:w.d,base:g.base||w.b,
   reviewed:override?g.definitionReviewed===true:!w.auto,contextual:g.definitionScope==='context'};
 }
 function create(book,line){
  if(window.STUDY_MORPHOLOGY&&window.STUDY_EXPRESSIONS)
   return contextualize(window.STUDY_EXPRESSIONS.merge(window.STUDY_MORPHOLOGY.create(book,line),{book,line}),book,line);
  const groups=[];
  for(const id of line.t){
   const w=book.words[id],last=groups.at(-1);if(!w)continue;
   const join=last&&/动词|形容词/.test(last.words[0].p)&&(w.p==='助动词'||w.p==='助词'&&['て','で','ば'].includes(w.s));
   if(join){last.words.push(w);last.s+=w.s;last.k+=w.k;}
   else groups.push({words:[w],s:w.s,k:w.k,p:w.p});
  }
  // Sentence-initial というか introduces a correction, not an isolated question か.
  // Limit this reviewed sense to a clause boundary; e.g. 何というか is different.
  for(let i=0;i<groups.length;i++){
   const previous=groups[i-1];
   if(previous&&!/^[。！？!?「『（(]$/.test(previous.s))continue;
   let surface='',end=i;
   while(end<groups.length&&surface.length<4){surface+=groups[end].s;end++;}
   if(surface!=='というか')continue;
   const parts=groups.slice(i,end).flatMap(g=>g.words);
   const word={s:surface,k:'というか',b:surface,p:'固定表达',d:'或者说；更确切地说。用后面的说法修正、补充前面的表达。',f:'基本形',auto:false};
   groups.splice(i,end-i,{s:surface,k:word.k,p:word.p,words:[word],parts,audioTitle:'というか',note:'这里把「と＋いう＋か」作为一个表达来学。句末的疑问语气和这个用法不同；这里是在换一种更准确的说法。'});
  }
  return contextualize(groups,book,line);
 }
 window.STUDY_GROUPS=Object.freeze({create,describe});
})();
