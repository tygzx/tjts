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
const match=(...items)=>items.map(([s,p,b=s,k])=>({s,p,b,...(k?{k}:{})}));
const verb=(s,k,r,b,d,f='基本形')=>word(s,k,r,'动词',d,{b,f});
const always=word('いつまでも','いつまでも','itsumademo','副词','一直；久久地；无论到什么时候。');
const money=word('金','かね','kane','名词','钱；金钱。这里读「かね」，不是表示黄金的「きん」。');
export const TOKEN_REPAIRS=[
 {id:'workplace-zutome',from:match(['市役所','名词'],['づとめの','名词']),to:[word('市役所づとめ','しやくしょづとめ','shiyakushozutome','名词','在市役所（市政府）工作、任职。「づとめ」是「勤め」接在工作单位后面的形式。'),no]},
 {id:'hesitant-reply',from:match(['ふ','动词','ふる'],['ぅんとあやふやに','名词']),to:[word('ふぅん','ふうん','fuun','感叹词','嗯；哦。表示回应，语气依上下文；这里是含糊地应声。'),to,word('あやふや','あやふや','ayafuya','名词','模糊；含糊；不确定。接「に」修饰动作，这里指含含糊糊地回答。'),ni]},
 {id:'perfunctory',from:match(['お','前缀'],['ざなりに','名词']),to:[word('おざなり','おざなり','ozanari','名词','敷衍；草率应付。「おざなりに」表示敷衍地、随意地。'),ni]},
 {id:'unexpected-entrant',from:match(['と','语气词'],['びいりの','名词']),to:[word('とびいり','とびいり','tobiiri','名词','飛び入り：临时参加；半途加入。这里指中途转来的里伽子。'),no]},
 {id:'disgust-particle',from:match(['むなくそが','名词']),to:[word('むなくそ','むなくそ','munakuso','名词','「むなくそが悪い」表示令人恶心、气愤或心里很不痛快，是较粗俗的说法。'),ga]},
 {id:'way-of-speaking',from:match(['いい','形容词'],['ぐさだということを','名词']),to:[word('いいぐさ','いいぐさ','iigusa','名词','言い草：说法；说辞；说话的口气。常带责备或不满。'),word('だ','だ','da','助动词','是；表示判断的普通体。',{f:'基本形',ct:'特殊・ダ'}),word('という','という','toiu','助词','引用或说明前面的内容；「だということ」把前面的判断作为一件事。'),word('こと','こと','koto','名词','事；把前面的内容作为一件事。'),wo]},
 {id:'wall-side-ni',from:match(['壁','名词'],['ぎわに','名词']),to:[word('壁ぎわ','かべぎわ','kabegiwa','名词','墙边；靠墙的地方（壁際）。'),ni]},
 {id:'wall-side-no',from:match(['壁','名词'],['ぎわの','名词']),to:[word('壁ぎわ','かべぎわ','kabegiwa','名词','墙边；靠墙的地方（壁際）。'),no]},
 // Opening review: preserve the author's ruby (母子《おやこ》,
 // 釣《つ》り舟《ぶね》, 淋《さび》しい) and repair its broken boundaries.
 {id:'up-down-stairs',from:match(['のぼり','动词','のぼる'],['おり','动词','おる'],['し','动词','する'],['た','助动词']),to:[verb('のぼりおりした','のぼりおりした','noboriorishita','のぼりおりする','上上下下；上下楼梯。「した」表示过去。')]},
 {id:'one-go',from:match(['いっ','动词','いう'],['ぱつで','名词']),to:[word('いっぱつ','いっぱつ','ippatsu','名词','一回；一次。「いっぱつで」表示一次就、一下子就。'),particle('で','de','表示方式或次数范围；这里「いっぱつで」是“一次就”。')]},
 {id:'management-fee-included',from:match(['管理','名词'],['費','名词'],['こみ','动词','こむ'],['で','助词']),to:[word('管理費','かんりひ','kanrihi','名词','管理费；公寓维护管理等的费用。'),word('こみ','こみ','komi','名词','包含在内；込み。这里指房租包含管理费。'),particle('で','de','表示按前面的条件计算；这里是“包括管理费在内，共……”。')]},
 {id:'renovate-again',from:match(['内装','名词'],['し','动词','する'],['直し','动词','直す'],['た','助动词']),to:[verb('内装し直した','ないそうしなおした','naisoushinaoshita','内装し直す','重新装修了室内。「し直す」表示重新做一遍。')]},
 {id:'beyond-room',prefix:'その',from:match(['むこ','动词','むく'],['う','助动词']),to:[word('むこう','むこう','mukou','名词','那边；对面；另一侧（向こう）。')]},
 {id:'wallpaper',from:match(['クロス','名词'],['張り','名词']),to:[word('クロス張り','くろすばり','kurosubari','名词','贴着壁纸；贴壁纸的装修。「クロス」在室内装修中指壁纸。')]},
 {id:'eel-bed',from:match(['ウナギ','名词'],['の','助词'],['寝床','名词']),to:[word('ウナギの寝床','うなぎのねどこ','unaginonedoko','固定表达','像鳗鱼窝一样狭长的地方；比喻宽度窄、纵深很长的房屋或房间。')]},
 {id:'east-facing',from:match(['東','名词'],['むき','名词']),to:[word('東むき','ひがしむき','higashimuki','名词','朝东；朝向东方（東向き）。')]},
 {id:'modern-style',from:match(['イマ','名词'],['ふう','名词']),to:[word('イマふう','いまふう','imafuu','名词','现代风格；时下流行的样式（今風）。')]},
 {id:'lying-around',prefix:'中',from:match(['にごろ','动词','にごる'],['ん','助动词']),suffix:'と置か',to:[ni,word('ごろん','ごろん','goron','副词','滚一下或躺倒的样子；这里形容行李随意搁在房间里。')]},
 {id:'appearance-noun',from:match(['み','动词','みる'],['た','助动词'],['目','名词']),to:[word('みた目','みため','mitame','名词','外观；看上去的样子（見た目）。')]},
 {id:'city-hotel',from:match(['シティ','名词'],['ホテル','名词']),to:[word('シティホテル','してぃほてる','shitihoteru','名词','城市酒店；这里指设施齐全、较为体面的城市宾馆。')]},
 {id:'bath-towel',from:match(['バス','名词'],['タオル','名词']),to:[word('バスタオル','ばすたおる','basutaoru','名词','浴巾；洗澡后擦身用的大毛巾。')]},
 {id:'eat-ruby',from:match(['喰','名词'],['って','助词']),to:[verb('喰っ','くっ','ku','喰う','吃；「喰う」是较随意的说法。','連用タ接続'),particle('て','te','连接前后两个动作；这里是“吃过饭，再……”。')]},
 // FIX window: https://www.lixil.co.jp/reform/yougo/shizai/window/18.htm
 {id:'fixed-window',from:match(['ハメ','名词'],['殺し','名词']),to:[word('ハメ殺し','はめごろし','hamegoroshi','名词','固定嵌装、不能开合；这里指打不开的固定窗。')]},
 {id:'tail-lamp',from:match(['テール','名词'],['ランプ','名词']),to:[word('テールランプ','てーるらんぷ','teeruranpu','名词','汽车尾灯。')]},
 {id:'through-window',from:match(['窓','名词'],['ご','前缀'],['しに','动词','しぬ']),to:[word('窓ごし','まどごし','madogoshi','名词','隔着窗户；透过窗户（窓越し）。'),ni]},
 {id:'gaze-ruby',from:match(['眺','名词'],['め','名词']),to:[verb('眺め','ながめ','nagame','眺める','眺望；凝望；看着。','連用形')]},
 {id:'fishing-boat-ruby',from:match(['釣','名词'],['り','助动词'],['舟','名词']),to:[word('釣り舟','つりぶね','tsuribune','名词','钓鱼用的小船；钓鱼船。')]},
 {id:'lonely-ruby',from:match(['淋','名词'],['しい','动词','しいる']),to:[word('淋しい','さびしい','sabishii','形容词','寂寞的；孤单的；冷清的。',{f:'基本形'})]},
 {id:'beauty-noun',from:match(['美し','形容词','美しい'],['さ','名词']),to:[word('美しさ','うつくしさ','utsukushisa','名词','美；美丽的程度。「美しい」去掉「い」加「さ」变成名词。')]},
 {id:'always',from:match(['いつ','名词'],['まで','助词'],['も','助词']),to:[always]},
 {id:'always-broken',from:match(['い','动词','いる'],['つ','助动词'],['まで','助词'],['も','助词']),to:[always]},
 {id:'do-incessantly',from:match(['し','动词','する'],['まくっ','动词','まくる'],['た','助动词']),to:[verb('しまくった','しまくった','shimakutta','しまくる','一个劲儿地做；不停地做。「まくる」在这里强调动作反复，不是卷起东西。')]},
 {id:'station-front',from:match(['駅','名词'],['まえ','动词','まえる']),to:[word('駅まえ','えきまえ','ekimae','名词','车站前；车站前面的地方（駅前）。')]},
 {id:'two-withdrawal-amounts',prefix:'カードで',from:match(['５','名词'],['万','名词'],['10','名词'],['万','名词']),to:[word('５万','ごまん','goman','名词','五万；这里是五万日元。'),word('10万','じゅうまん','juuman','名词','十万；这里是十万日元，与前面的五万分别列举。')]},
 {id:'anyway',from:match(['なん','名词'],['に','助词'],['せよ','动词','する']),to:[word('なんにせよ','なんにせよ','nanniseyo','固定表达','不管怎样；总之；无论如何。')]},
 {id:'parents-money-reading',prefix:'親の',from:match(['金','名词','金','きん']),to:[money]},
 {id:'money-not-gold-reading',prefix:'そんなに',from:match(['金','名词','金','きん']),to:[money]},
 // ～ちゅう = ～ている: https://kochikc.co.jp/ohashidori/tosaben/tosaben.html
 {id:'living-tosa',from:match(['生','前缀'],['きち','名词'],['ゅうがやなぁ','名词']),to:[word('生きちゅうがやなぁ','いきちゅうがやなあ','ikichuugayanaa','固定表达','原来是这样活着的啊。土佐方言，对应「生きているんだなあ」；本句感叹孩子是靠父母的钱生活的。')]},
 {id:'deeply-impressed',from:match(['感じ','名词'],['いっ','动词','いく'],['た','助动词']),to:[verb('感じいった','かんじいった','kanjiitta','感じいる','深有感触；深深感受到（感じ入る）。')]},
 {id:'several-years',from:match(['数','名词'],['年','名词']),to:[word('数年','すうねん','suunen','名词','几年；数年。没有指出确切年数。')]},
 // 御の字: https://www.bunka.go.jp/seisaku/kokugo_nihongo/kokugo_shisaku/kotoba_shokudo/pdf/kotoba_13.pdf
 {id:'more-than-thankful',from:match(['オン','名词'],['の','助词'],['字','名词']),to:[word('オンの字','おんのじ','onnoji','固定表达','已经非常值得庆幸、感激了（御の字）；本句表示有这样的住处就很知足了。')]},
 {id:'polite-register',from:match(['デスマス','名词'],['体','名词']),to:[word('デスマス体','ですますたい','desumasutai','名词','です・ます体；使用「です」「ます」等句尾的礼貌体。')]},
 {id:'spend-tosa',prefix:'お金',from:match(['つこ','动词','つく'],['う','助动词'],['たら','助动词','た']),to:[verb('つこうたら','つこうたら','tsukoutara','使う','方言中的「使ったら」：花了、用了……的话。')]},
 {id:'tired-of-spending',prefix:'、',from:match(['使い','名词'],['疲れ','名词'],['する','动词']),suffix:'ねぇ',to:[verb('使い疲れする','つかいつかれする','tsukaitsukaresuru','使い疲れする','花钱花得累了。母亲带着玩笑口气说，一下子花这么多钱也会累。')]},
];

export function repairBookTokens(book){
 const text=line=>line.t.map(id=>book.words[id].s).join('');
 const before=book.lines.map(text),changes=[];
 const ids=new Map(book.words.map((w,i)=>[JSON.stringify(w),i]));
 const idFor=w=>{const key=JSON.stringify(w);if(!ids.has(key)){ids.set(key,book.words.length);book.words.push({...w});}return ids.get(key);};
 book.lines.forEach((line,index)=>{
  const result=[];
  for(let i=0,offset=0;i<line.t.length;){
   const rule=TOKEN_REPAIRS.find(r=>(!r.prefix||before[index].slice(0,offset).endsWith(r.prefix))&&
    (!r.suffix||before[index].slice(offset+r.from.reduce((n,w)=>n+w.s.length,0)).startsWith(r.suffix))&&r.from.every((expected,j)=>{
    const actual=book.words[line.t[i+j]];
    return actual&&Object.entries(expected).every(([key,value])=>actual[key]===value);
   }));
   if(!rule){offset+=book.words[line.t[i]].s.length;result.push(line.t[i++]);continue;}
   assert.equal(rule.from.map(w=>w.s).join(''),rule.to.map(w=>w.s).join(''),'Repair must preserve original characters: '+rule.id);
   result.push(...rule.to.map(idFor));i+=rule.from.length;
   offset+=rule.from.reduce((n,w)=>n+w.s.length,0);
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
