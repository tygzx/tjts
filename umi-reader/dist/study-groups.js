/* Learning units preserve the source text; reviewed expressions take precedence. */
(() => {
 'use strict';
 // Context glosses are matched against the source sentence, not copied from
 // the Chinese translation. They do not modify shared dictionary entries.
 const CONTEXT_GLOSSES=[
  ['えらく疲れてしまった','えらく','非常；很。这里修饰「疲れてしまった」，意思是“累得够呛”。'],
  ['えらく呑気','えらく','格外；相当。这里强调对方的反应十分悠闲、不慌不忙。'],
  ['えらく怒りだして','えらく','非常；很。这里表示对方发了很大的火。'],
  ['母親が有休をとって、ついてきた','ついてきた','跟着一起来；陪同前来。这里是母亲请假陪我来东京。','つく','动词'],
  ['羽田についた','ついた','抵达；到达。这里指到了羽田机场。','つく','动词'],
  ['東京の土をふんだ','ふんだ','踏上；来到。这里「東京の土をふむ」指来到东京这片土地。','ふむ','动词'],
  ['階段をのぼりおりした','のぼりおりした','上上下下；上下楼梯。这里说反复换乘、上下楼梯，很累。','のぼりおりする','动词'],
  ['管理費こみで','こみ','连同……一起算；包含在内。这里是“包括管理费在内”。','こみ','名词'],
  ['クロス張り','クロス張り','贴着壁纸；贴壁纸的装修。这里说的是厨房墙面的装修。'],
  ['そのむこうに７畳','むこう','那边；再往里。这里指厨房另一边的房间。','むこう','名词'],
  ['東むきの窓','東むき','朝东；朝向东方。这里说明窗户的朝向。'],
  ['月６万円台','月','每月；一个月。这里说的是每月的房租，不是月亮。'],
  ['メゾン英』にうつって','うつって','搬到；迁入。这里是从会馆搬进公寓。','うつる','动词'],
  ['銀行にいって、カードで','引きだしてくる','去取出（存款）再回来。这里是在银行取钱。','引きだす','动词'],
  ['駅まえの銀行','駅まえ','车站前面。这里是“车站前面的银行”。','駅まえ','名词'],
  ['高知にかえるという夜','かえる','返回；回去。这里指母亲回高知。','かえる','动词'],
  ['明日は母親が高知にかえるという夜','さげた','低下（头）；鞠躬。这里是低头向母亲致谢。','さげる','动词'],
  ['お金つこうたら','つこうたら','花了这么多钱的话。「つこうたら」是方言形式，相当于「使ったら」。','使う','动词'],
  ['淋しげに笑った','げ','接在形容词词干后，表示“看起来……的样子”；淋しげ＝显得有些寂寞。'],
  ['こんなものだろうという気もした','だろう','大概……吧；表示推测。这里是“想来大概也就是这样吧”。','だ','助动词'],
  ['と内心あきれたけれど','と','引用前一句括号中的内心想法，并连接「内心あきれた」。不是并列的“和”。','と','助词'],
  ['としみじみ感じいった','と','引用前一句括号中的感叹，并连接「感じいった」。不是并列的“和”。','と','助词'],
  ['豪華な会館','な','把形容动词「豪華」接到名词「会館」前，表示“豪华的会馆”。不是表示禁止的语气词。','だ','助动词'],
  ['猛烈な勢い','な','把形容动词「猛烈」接到「勢い」前，表示“非常猛的势头”。','だ','助动词'],
  ['買物をしまくった','しまくった','不停地买东西；大买特买。「しまくる」表示一个劲儿地做某事。','しまくる','动词'],
  ['炊飯器だトースターだ鍋だベッドだと','だ','反复放在名词后列举物品，类似“电饭锅啦、烤面包机啦……”。这里不是过去时。','だ','助动词'],
  ['掃除機をかけた','かけた','使用；开动。这里「掃除機をかける」是“用吸尘器打扫”。','かける','动词'],
  ['尾をひくようなテールランプ','ひく','拖着；拖出。「尾をひく」这里比喻汽车尾灯像拖着一条光的尾巴。','ひく','动词'],
  ['親の金くって','くって','吃；耗费。这里指靠父母的钱维持生活，是随意的口语表达。','くう','动词'],
 ];
 function contextualize(groups,book,line){
  const text=line.t.map(id=>book.words[id].s).join('');
  return reviewedSpans(groups.map(g=>{
   const found=CONTEXT_GLOSSES.find(([anchor,s])=>g.s===s&&text.includes(anchor));
   if(!found)return g;
   return {...g,definition:found[2],definitionReviewed:true,definitionScope:'context',
    base:found[3]||g.base||g.words[0].b,p:found[4]||g.p,glossNote:'本句释义按日文上下文校订；其他句子中的同形词可能有不同含义。'};
  }),book,line);
 }
 // Reviewed multiword senses belong to an exact character span in this line.
 // Split a previous display-only merge when necessary; source words/IDs survive.
 function reviewedSpans(groups,book,line){
  if(!line.studyGlosses?.length)return groups;
  const words=line.t.map(id=>book.words[id]),boundary=new Map([[0,0]]);let length=0;
  words.forEach((w,i)=>{length+=w.s.length;boundary.set(length,i+1);});
  const spans=[];
  for(const c of [...line.studyGlosses].sort((a,b)=>(b.end-b.start)-(a.end-a.start))){
   if(!boundary.has(c.start)||!boundary.has(c.end)||spans.some(x=>c.start<x.end&&x.start<c.end))continue;
   spans.push(c);
  }
  spans.sort((a,b)=>a.start-b.start);
  for(const c of spans){
   let offset=0,first=-1,last=-1;
   const positions=groups.map(g=>{const start=offset;offset+=g.s.length;return {start,end:offset};});
   positions.forEach((p,i)=>{if(p.end>c.start&&p.start<c.end){if(first<0)first=i;last=i;}});
   if(first<0)continue;
   const start=positions[first].start,end=positions[last].end;
   const raw=(a,b)=>words.slice(boundary.get(a),boundary.get(b));
   const simple=w=>({s:w.s,k:w.k,p:w.p,words:[w],audioParts:[{s:w.s,k:w.k,words:[w]}]});
   const selected=raw(c.start,c.end),exact=start===c.start&&end===c.end;
   const k=c.k||(exact?groups.slice(first,last+1).map(g=>g.k).join(''):selected.map(w=>w.k).join(''));
   const group={s:c.s,k,p:c.p||(selected.length===1?selected[0].p:'固定表达'),words:selected,parts:selected,
    audioParts:exact?groups.slice(first,last+1).flatMap(g=>g.audioParts):selected.map(w=>({s:w.s,k:w.k,words:[w]})),
    base:c.base||(selected.length===1?selected[0].b:c.s),definition:c.definition,
    definitionReviewed:true,definitionScope:'context',rule:'reviewed-context',
    glossNote:'本句释义按日文上下文校订；其他句子中的同形词可能有不同含义。'};
   groups.splice(first,last-first+1,...raw(start,c.start).map(simple),group,...raw(c.end,end).map(simple));
  }
  return groups;
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

/* BEGIN GENERATED STUDY ANALYSIS */
/* Embedded into study-groups.js by build-study-analysis.mjs. */
(() => {
 'use strict';
 const DATA={"version":1,"method":"按原句语境逐项编写；仅覆盖列出的表达，其他常见动词形式由保守的词形规则展开。","references":[{"title":"东京外国语大学：副助词","url":"https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/095.html"},{"title":"东京外国语大学：助词","url":"https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/052.html"}],"sentences":[{"sentence":11,"jp":"と内心あきれたけれど、まあ、こんなものだろうという気もした。","items":[{"quote":"気もした","start":25,"end":29,"base":"気がする","steps":[{"form":"気がする","why":"常用表达：“有……的感觉／觉得……”。动词的词典形是する，整个表达的基本形式是気がする。"},{"form":"気がした","why":"する是不规则动词，接表示过去／完成的た时用し：し＋た＝した。这里表示当时产生了这种感觉。"},{"form":"気もした","why":"用も替换が，增加“也”的意味。前面觉得房租高、房间却小；与此同时，也觉得东京大概就是这样。"}],"meaning":"但也觉得，大概就是这么回事吧。","warning":"这里不是「が」变成过去式，也不是无缘无故漏了が；变时态的是する，添加另一种感受的是も。不要写成「気がもした」。"},{"quote":"こんなものだろうという","start":14,"end":25,"base":"こんなものだ ＋ だろう ＋ という","steps":[{"form":"こんなものだ","why":"“也就是这样的程度／情况”。もの在这里不必译成某一件物品。"},{"form":"こんなものだろう","why":"判断词だ改成推测形式だろう：“大概就是这样吧”。"},{"form":"こんなものだろうという気","why":"という把前面整个想法接到名词気前，说明“是什么样的感觉”。"}],"meaning":"“大概就是这么回事吧”这样的感觉。","warning":"という不一定表示真的开口说话；这里介绍心里的想法。"},{"quote":"と内心あきれたけれど","start":0,"end":10,"base":"引用内容 ＋ と ＋ あきれる ＋ けれど","steps":[{"form":"（第 10 句的内心话）＋と","why":"と引用前一句括号里的想法，不是“和”。"},{"form":"あきれる → あきれた","why":"一段动词去る接た，表示当时的惊讶、无奈。内心说明是在心里。"},{"form":"あきれたけれど","why":"けれど把前半句与后面的另一种想法连接起来：“虽然……不过……”。"}],"meaning":"心里虽觉得这房租与房间不相称，不过又觉得大概也就是这样。","warning":""}],"guide":"先找主干：［第 10 句的想法］と内心あきれたけれど、［こんなものだろう］という気もした。前半是对房租与房间的惊讶；けれど转折，后半补充“但也觉得大概就是这样”。两种感受都属于叙述者拓。"},{"sentence":1,"jp":"いろいろ問題はあったけれど、やっぱりすべては里伽子に戻ってゆくんだと思う。","items":[{"quote":"戻ってゆくんだ","start":26,"end":33,"base":"戻る ＋ てゆく ＋ のだ","steps":[{"form":"戻る → 戻って","why":"五段る结尾发生促音便：る → って。"},{"form":"戻ってゆく","why":"てゆく是ていく的另一种写法，表示事情继续向某个方向发展。"},{"form":"戻ってゆくのだ → 戻ってゆくんだ","why":"のだ表示解释；口语把の缩成ん。"}],"meaning":"到头来，一切还是会回到里伽子身上。","warning":""}]},{"sentence":2,"jp":"その年の三月に、ぼくはうまれて二度目の東京の土をふんだ。というか羽田についた。ある私大に合格して、〝上京〟したというわけだ。","items":[{"quote":"というわけだ","start":55,"end":61,"base":"という ＋ わけだ","steps":[{"form":"ある私大に合格して、上京した","why":"前面先交代考上私立大学、来到东京的经过。"},{"form":"（前述经过）というわけだ","why":"という把内容接到わけ前；わけだ归纳前文：“也就是说，事情就是这么回事”。"}],"meaning":"所以我就这样“上京”了。","warning":"不是逐字的“说的理由”。"}]},{"sentence":3,"jp":"市役所づとめの母親が有休をとって、ついてきた。田舎出の母子ふたり、人波に押されてモノレールにのった。電車にのりかえた。","items":[{"quote":"人波に押されて","start":33,"end":40,"base":"押す","steps":[{"form":"押す → 押される","why":"五段す → さ＋れる，变成被动形“被推”。"},{"form":"押される → 押されて","why":"被动助动词れる按一段动词变化：去る接て，连接后面的“上车”。"},{"form":"人波に押されて","why":"に标出推挤的来源：人潮；被推挤的是母子二人。"}],"meaning":"被人潮推挤着上车。","warning":"此处れる表示被动，不是可能或尊敬；要结合谁推谁判断。"}]},{"sentence":4,"jp":"あまりのぎゅうぎゅうぶりに唖然としているうちに、池袋でおりた。また電車をのりかえた。なんども階段をのぼりおりしたので、えらく疲れてしまった。","items":[{"quote":"疲れてしまった","start":62,"end":69,"base":"疲れる","steps":[{"form":"疲れる → 疲れて","why":"一段动词去る接て。"},{"form":"疲れてしまう","why":"てしまう带有“累坏了”的语气。"},{"form":"疲れてしまう → 疲れてしまった","why":"しまう是五段动词，う → った，把结果放在过去。"}],"meaning":"上下楼梯太多，累得够呛。","warning":""}]},{"sentence":7,"jp":"東京に住んでいる遠縁のオバサン（父さんの姉の夫の妹、らしい）に、金額とか条件なんかの希望を伝えて、探してもらったアパートだった。","items":[{"quote":"探してもらった","start":49,"end":56,"base":"探す ＋ てもらう","steps":[{"form":"探す → 探して","why":"五段す → して。"},{"form":"探してもらう","why":"请别人帮自己找，自己是接受帮助的一方。"},{"form":"もらう → もらった","why":"五段う → った，说明已经得到这种帮助。"}],"meaning":"请那位远房阿姨帮我们找到的公寓。","warning":"に在这里标记提供帮助的阿姨；不是阿姨请我们找房。"}]},{"sentence":14,"jp":"バスタオルもないアパートでは落ちつかないから、初日だけは、ちゃんとした設備のところに泊まろうという母親の判断だったのだけれど、それは正しくて、メシを喰ってシャワーを浴びたころには、どっと疲れがでていた。","items":[{"quote":"バスタオルもない","start":0,"end":8,"base":"バスタオルがない","steps":[{"form":"バスタオルがない","why":"“没有浴巾”，ない表示不存在。"},{"form":"バスタオルもない","why":"も占据が的位置，强调连浴巾这种基本用品都没有。"}],"meaning":"公寓里连浴巾都没有。","warning":"这里的も不能只机械译为“也”；语境突出了最低限度的东西也缺少。"}]},{"sentence":15,"jp":"ハメ殺しの大きめの窓からは、森のようなこんもりした皇居の緑が、遠くにみえた。そのまわりを尾をひくようなテールランプがぷかぷかと浮かんで、光っていた。","items":[{"quote":"窓からは","start":9,"end":13,"base":"窓から","steps":[{"form":"窓から","why":"から表示视线出发的位置：从窗户看出去。"},{"form":"窓からは","why":"在から后叠加は，把“从这扇窗看去”作为话题；から的来源意义仍保留。"}],"meaning":"从这扇窗望出去，可以看见……。","warning":"这是叠加，不是用は替换から。"}]},{"sentence":17,"jp":"春の海にぽっかり浮かぶ釣り舟のあかりみたいに、それは淋しい美しさに満ちていた。ひっきりなしの車の音は、波の音のようにも聞こえた。ぼくはなつかしいものに触れたように、いつまでもいつまでも窓ぎわに立って、外を眺めていた。","items":[{"quote":"ようにも聞こえた","start":55,"end":63,"base":"ように聞こえる","steps":[{"form":"波の音のように","why":"の把波の音接到よう；ように修饰“听起来”，表示像海浪声一样。"},{"form":"ようにも","why":"に后面叠加も，表示也可以听成那样。"},{"form":"聞こえる → 聞こえた","why":"一段动词去る接た，是过去的听觉印象。"}],"meaning":"不断的车声，听起来也像海浪声。","warning":""}]},{"sentence":23,"jp":"（あー、子どもってのは、親の金くって生きちゅうがやなぁ）","items":[{"quote":"子どもってのは","start":4,"end":11,"base":"子どもというのは","steps":[{"form":"子どもというのは","why":"把“孩子这种存在”作为话题。"},{"form":"子どもっていうのは → 子どもってのは","why":"这里って对应という，口语进一步省去いう，后面保留のは。"}],"meaning":"说到孩子啊……。","warning":"って在不同句子里还可能是引用助词と的口语形式；本句是提示话题。"},{"quote":"親の金くって","start":12,"end":18,"base":"親の金をくう","steps":[{"form":"親の金をくう","why":"を标出耗用的对象：父母的钱。くう本义“吃”，这里是口语比喻“花父母的钱”。"},{"form":"くう → くって","why":"五段う → って，接后面的“生活”。"},{"form":"親の金をくって → 親の金くって","why":"随意口语中省去宾语助词を，但父母的钱仍是耗用的对象。"}],"meaning":"靠花父母的钱过日子。","warning":"为解释省略而补出的を不是原文文字，不会添加到小说里。"}]},{"sentence":25,"jp":"うちは両親とも公務員で、そんなに金がないわけでもない。しかし、このあと、ふたつ年下の弟もいることだし、これから数年の息子どもの教育費をおもうと、たとえ駅から歩いて15分でも、築13年のアパートでもオンの字というものだ。","items":[{"quote":"ないわけでもない","start":18,"end":26,"base":"ない ＋ わけではない","steps":[{"form":"金がない","why":"内层否定：“没有钱”。"},{"form":"金がないわけではない","why":"外层わけではない否定整个“没有钱”的判断：并不是没钱。"},{"form":"わけではない → わけでもない","why":"判断结构で后，も替换は，带有“也并不是”的补充语气。"}],"meaning":"家里倒也不算没钱。","warning":"双重否定是有所保留的肯定，不能译成“家里很有钱”。"},{"quote":"弟もいることだし","start":42,"end":50,"base":"弟がいる ＋ ことだし","steps":[{"form":"弟がいる → 弟もいる","why":"も替换が：除了自己，还另有弟弟。"},{"form":"弟もいることだし","why":"こと把前述情况作为一件事提出；し列举原因，暗示还要考虑其他因素。"}],"meaning":"何况还有一个弟弟，今后的教育费也得考虑。","warning":""}]},{"sentence":29,"jp":"「まあ、これだけ、いちどきにお金つこうたら、使い疲れするねぇ」","items":[{"quote":"お金つこうたら","start":14,"end":21,"base":"お金を使う","steps":[{"form":"お金を使う","why":"花钱；口语省去を后，仍是“花钱”的宾语关系。"},{"form":"使う → 使ったら（つかったら）","why":"标准语的たら条件形：如果花了这么多钱。"},{"form":"つかったら → つこうたら","why":"此处土佐方言使用乌音便；这是与标准语的对应关系。"}],"meaning":"一下子花掉这么多钱的话。","warning":"不能把つこう当作一个新的词典动词，也不能对所有う结尾动词套用这种方言变化。"}]},{"sentence":33,"jp":"「これだけ揃うたら、ひととおり、生活するのに不便もないろう。もっとえいトコに移りたいとか、えい家具そろえたいとか思うたら、あとは自分でやんなさいよ。遊んでもなにしてもかまんけど、仕送りは12万やきね。あとは、自分でするがぞね」","items":[{"quote":"生活するのに","start":16,"end":22,"base":"生活する ＋ の ＋ に","steps":[{"form":"生活する → 生活するの","why":"の把“生活”这个动作变成可供后面说明的事项。"},{"form":"生活するのに","why":"に表示用途、方面：在日常生活上。后面的不便说明是否方便。"}],"meaning":"日常生活上不会有什么不方便。","warning":"这里不是表示“明明……却……”的转折のに。"},{"quote":"揃うたら","start":5,"end":9,"base":"揃う","steps":[{"form":"揃う → 揃ったら","why":"标准语：“东西备齐的话”。"},{"form":"揃ったら → 揃うたら","why":"方言中使用乌音便，保留たら的条件意义。"}],"meaning":"东西置办到这个程度的话。","warning":""},{"quote":"不便もないろう","start":22,"end":29,"base":"不便がないだろう","steps":[{"form":"不便がない → 不便もない","why":"も替换が，将“不便”也放进否定范围。"},{"form":"ないだろう → ないろう","why":"此处方言中的推测说法，对应标准语“应该不会……吧”。"}],"meaning":"也就不会有什么不方便了吧。","warning":""},{"quote":"遊んでもなにしてもかまんけど","start":74,"end":88,"base":"遊ぶ／何をする ＋ ても ＋ かまわない","steps":[{"form":"遊ぶ → 遊んで → 遊んでも","why":"动词て形（这里为で）＋も，表示即使、无论；不是把が换成も。"},{"form":"何をする → 何しても","why":"口语省去を，する变して，接も：“不管做什么”。"},{"form":"かまわない → かまん","why":"方言／口语否定：“没关系、都可以”；けど连接后面的限制条件。"}],"meaning":"玩也好，做什么也好，都随你，不过……。","warning":""}]},{"sentence":38,"jp":"入学するまではヒマだし、バイトやって、軍資金でもためておこうかとウキウキしながら、その夜、ぼくはすこやかな眠りについた。","items":[{"quote":"軍資金でも","start":19,"end":24,"base":"軍資金 ＋ でも","steps":[{"form":"軍資金をためる","why":"攒活动经费；軍資金是叙述者开的玩笑。"},{"form":"軍資金でもためる","why":"用でも举出一个随口想到的选择：“攒点活动经费什么的”。"}],"meaning":"不如先攒点活动经费吧。","warning":"此处でも表示举例，不是“在军费里面也”，也不是转折“但是”。"}]},{"sentence":42,"jp":"息子べったりの母親ではないのは助かるけれど、困ったのは、ひとり残された息子のほうだ。ひとりになってみると、","items":[{"quote":"残された","start":31,"end":35,"base":"残す","steps":[{"form":"残す → 残される","why":"五段动词す → さ＋れる，被动形：“被留下”。"},{"form":"残される → 残された","why":"れる去る接た，表示已经被留下。"}],"meaning":"被母亲独自留在东京的儿子。","warning":"根据本句母亲已走、儿子独留的语境，れる是被动。"}]},{"sentence":45,"jp":"ぼくは、おのれの住んでいるアパートが、東京という都市のどこらへんにあるのかさえ、知らんかった。知っちゅうのは、羽田と池袋と、石神井公園だけや。","items":[{"quote":"知らんかった","start":40,"end":46,"base":"知る","steps":[{"form":"知る → 知らない","why":"五段る变ら，再接ない：“不知道”。"},{"form":"知らない → 知らなかった","why":"ない → なかった，过去否定。"},{"form":"知らなかった → 知らんかった","why":"口语／方言用ん表达否定，接かった表示过去。"}],"meaning":"当时甚至不知道公寓在东京什么位置。","warning":""},{"quote":"知っちゅう","start":47,"end":52,"base":"知る","steps":[{"form":"知る → 知っている","why":"五段る → って；知っている表示“已经知道”的状态。"},{"form":"知っている → 知っちゅう","why":"本句土佐方言中，ちゅう对应已经形成并持续的状态。"}],"meaning":"自己知道的地方只有那几个。","warning":"这里不是“正在获取知识”。"}]},{"sentence":47,"jp":"ひとりになって初めて歩く街は、こぢんまりした、学生の多い、住みやすそうな街に思えた。食べもの屋がやたらと目について、まあ栄養方面だけは安心やと、ヘンなことを思ったりした。","items":[{"quote":"学生の多い","start":23,"end":28,"base":"学生が多い","steps":[{"form":"学生が多い","why":"“学生很多”，が标出多的对象。"},{"form":"学生の多い街","why":"修饰名词街的从句里，这个主语助词が可以用の表达。"}],"meaning":"学生很多的街区。","warning":"这是连体修饰里的が／の交替，不是表示所属的“学生的”；也不能把任意句子里的が都换成の。"}]},{"sentence":69,"jp":"山尾はアサシオとよばれていた。郷土がほこる関取、アサシオの体型によく似た肥満体だったからだ。ばかばかしいほど呆気ないけど、しかしリアルなあだ名や。","items":[{"quote":"よばれていた","start":8,"end":14,"base":"よぶ","steps":[{"form":"よぶ → よばれる","why":"五段ぶ → ば＋れる，被动形“被称为”。"},{"form":"よばれる → よばれている","why":"れる去る接て＋いる，表示持续使用这个称呼。"},{"form":"よばれている → よばれていた","why":"いる → いた，回忆过去同学们一直这样叫他。"}],"meaning":"山尾当时被大家叫作“朝潮”。","warning":""}]},{"sentence":106,"jp":"「リカちゃんはさ。母親の手前、高知大受けといて、ウラで、東京の父親とツーツーだったらしいで。国立の試験のあと、友達と卒業旅行にいくとかなんとかゆうて、東京にきてさ。こっちの大学うけてたんやと。母親になんもかも隠しておいて、卒業式のあとのドサクサで、サーッとこっちに来たらしい」","items":[{"quote":"受けといて","start":18,"end":23,"base":"受ける","steps":[{"form":"受ける → 受けておく","why":"去る接て＋おく；这里指先报考高知大学，给母亲一个交代。"},{"form":"受けておく → 受けておいて","why":"おく → おいて，用て形接后文。"},{"form":"受けておいて → 受けといて","why":"口语把てお缩成と。"}],"meaning":"先报考高知大学，背地里却另作安排。","warning":"不是受ける直接变成一个名叫“受けとく”的基本动词。"},{"quote":"うけてた","start":88,"end":92,"base":"うける","steps":[{"form":"うける → うけている","why":"一段动词て形＋いる。"},{"form":"うけている → うけていた","why":"いる变过去形いた；此处回头说明她已经参加考试这件事。"},{"form":"うけていた → うけてた","why":"口语省掉い。"}],"meaning":"原来是来考这边的大学。","warning":""}]},{"sentence":114,"jp":"そう、ぼくもこっちに発つ前に、里伽子に連絡をとろうかと考えないこともなかった。いやいや、正直いうたら、連絡しようかとちらっと考えたりもしたけれど。","items":[{"quote":"考えないこともなかった","start":27,"end":38,"base":"考える ＋ ないことはない","steps":[{"form":"考える → 考えない","why":"内层否定：“不考虑”。"},{"form":"考えないことはない","why":"外层ない否定“完全不考虑”这件事：不是完全没考虑过。"},{"form":"ことはない → こともなかった","why":"は换成も，补充一种曾有的念头；末尾ない → なかった，把这一判断放到过去。"}],"meaning":"来东京以前，也不是完全没想过联系她。","warning":"有两层否定，不能读成“从未考虑过”。这种委婉肯定也不等于已经决定联系。"}]},{"sentence":164,"jp":"好きでもなんでもなかったというのが、今さらながら身にしみてきて、ぼくはふと、もう二度と、里伽子には会えないだろうなという予感がした。","items":[{"quote":"里伽子には会えない","start":44,"end":53,"base":"里伽子に会う","steps":[{"form":"会う → 会える","why":"五段う → え＋る，变成可能动词：“能够见面”。"},{"form":"会える → 会えない","why":"可能动词按一段方式，去る接ない：“不能见到”。"},{"form":"里伽子に → 里伽子には","why":"に保留见面的对象，再叠加は，把里伽子特别提出。"}],"meaning":"恐怕再也见不到里伽子了。","warning":"不是用は替换に，也不是会う的普通否定会わない；后面的だろう说明这是拓的推测。"}]},{"sentence":165,"jp":"春から、おなじ街（というか大都市だけども）に住むとわかっていて、里伽子からはなんの連絡もない。","items":[{"quote":"里伽子からは","start":32,"end":38,"base":"里伽子から","steps":[{"form":"里伽子から","why":"から标出联系的来源：从里伽子那边。"},{"form":"里伽子からは","why":"保留から，加は，把“她那边”作为话题。"}],"meaning":"里伽子那边却没有任何联系。","warning":""},{"quote":"なんの連絡もない","start":38,"end":46,"base":"何の連絡もない","steps":[{"form":"何の連絡","why":"何の在这里是“什么样的联系／任何联系”。"},{"form":"何の連絡もない","why":"疑问词所带的范围＋も＋否定，表示全面否定：任何联系都没有。"}],"meaning":"一点联系也没有。","warning":"这里的も要连同何和ない理解，不能只译为“也没有某一条联系”。"}]},{"sentence":167,"jp":"連絡がないのはつまり、連絡するつもりがないからだ。","items":[{"quote":"連絡がないのは","start":0,"end":7,"base":"連絡がない ＋ の ＋ は","steps":[{"form":"連絡がない","why":"没有联系。"},{"form":"連絡がないの","why":"の把“没有联系”整件事名词化。"},{"form":"連絡がないのは","why":"は把这件事提出来；后面用からだ解释原因。"}],"meaning":"之所以没有联系，是因为……。","warning":""}]}]};
 const original=window.STUDY_GROUPS;
 const reviewed=new Map(DATA.sentences.map(s=>[s.jp,s]));
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
  }
  return groups;
 }
 function analyses(book,line,groups=create(book,line)){
  const seen=new Set(),items=[];
  for(const g of groups)for(const a of g.analyses||[]){const key=a.start+':'+a.end+':'+a.base;if(!seen.has(key)){seen.add(key);items.push(a);}}
  return {guide:reviewed.get(line.t.map(id=>book.words[id].s).join(''))?.guide||'',items:items.sort((a,b)=>a.start-b.start)};
 }
 window.STUDY_GROUPS=Object.freeze({...original,create,analyses});
})();
