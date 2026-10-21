/* Learning chunks, not a replacement for the source tokens or dictionary.
 * `words` keeps the original objects in order. `audioParts` keeps the former
 * reader's complete chunks so older, bundled recordings remain usable.
 * Display-only overrides live in `base`, `definition`, `note` and `rule`.
 */
(() => {
 'use strict';
 const SAHEN=new Set(('合格 発見 掃除 感激 上京 正座 生活 入学 増殖 納得 紹介 電話 感心 直行 後悔 フォロー ドキドキ びっくり クロス 連絡 断言 想像 約束 出発 盗み撮り 再会 編入 交際 突入 手招き 案内 興奮 熱中 根まわし 発表 返上 体得 説明 確認 整列 通用 宣誓 脱落 暗示 無視 感動 卒業 高揚 満足 感謝 反抗 決心 勉強 転校 失恋 気乗り 圧倒 対戦 噂 出現 弁解 苦笑い 素通り 進学 離婚 参加 肩入れ 下宿 反射 出入り 散歩 挨拶 どぎまぎ 説教 さばさば 禁止 共有 デート 報告 口出し 狼狽 おたおた 気疲れ 我慢 誤解 利用 登校 一致 チェック 仰天 直感 用意 準備 行動 緊張 手続き 旅行 判断 心配 転換 混乱 同情 計算 失神 反省 絶句 移動 いいわけ 確保 突進 関係 味方 外出 ひと眠り 結婚 洗練 同棲 深呼吸 整理 対処 動揺 実感 同居 意気投合 ひとり決め 真似 合点 決意 沈黙 同席 再婚 受験 合宿 告白 確信 所属 安心 結論 勘弁 相談 補給 指名 講義 交叉 手入れ 出席 受講 解釈 入居 一変 動員 理解 化粧 放置 回収 補充 労働 観察 孤立 ダウン 駐車 崩壊 浮気 妊娠 下車 出没 気晴らし 歓迎 落馬 看病 追及 承知 仮設 メイク 同意 解説 運転 推移 爆発 設定 アレンジ 行列 ふり 反論 平手打ち 仲裁 直撃 ドライブ 遠慮 熟睡 返事 集中 力負け 疾走 上気 絶望 ビックリ 連載 威圧 旅 経験 '+
  // Productive する nouns/expressions in this book that the local tokenizer
  // labels general nouns. Avoid こと, なに, 顔, names and broken ruby stems.
  'バイト 寝坊 里帰り ぼんやり しんみり しょんぼり どきどき 目配せ 長話 待ち合わせ 一泊 告げ口 なぐり書き ごろごろ 模様替え 居候 スカウト セット 値踏み セッティング リハビリ フィーバー 総動員 リクエスト 手拍子 迷惑 邪魔 じゃま プレイ タッチ').split(/\s+/));
 const SUPPLEMENT={
  いる:'「ている／でいる」表示动作正在进行，或动作之后的状态持续。',
  おる:'「ておる」对应「ている」，表示进行或持续状态；语气依人物和方言而异。',
  ある:'「てある」表示有人做了某事后，结果或准备好的状态仍然保留。',
  くる:'「てくる」把动作或变化与说话时、说话者这一方联系起来。',
  来る:'「てくる」表示动作朝这边发展，或变化持续到现在。',
  いく:'「ていく」表示动作朝离开的方向进行，或变化继续发展。',
  行く:'「ていく」表示动作朝离开的方向进行，或变化继续发展。',
  ゆく:'「てゆく」与「ていく」相近，表示动作或变化继续发展。',
  しまう:'「てしまう」表示做完、发生了某事；也常带遗憾或不由自主的语气。',
  おく:'「ておく」表示事先做好，或让某种状态保留。',
  みる:'「てみる」表示试着做某事。',
  もらう:'「てもらう」表示请别人做某事，或接受别人为自己做的事。',
  くれる:'「てくれる」表示别人为自己或自己一方做某事。',
  あげる:'「てあげる」表示为别人做某事。',
  やる:'「てやる」可表示为别人做某事，也可能表示带有强烈意愿地做。',
  くださる:'「てくださる」是「てくれる」的尊敬表达。',
  いただく:'「ていただく」是「てもらう」的谦逊表达。',
  いただける:'「ていただける」是委婉地表达可以请对方做某事。',
  みせる:'「てみせる」表示做给别人看，或表现出一定要做到的决心。'
 };
 const SUFFIX={
  れる:'「れる」接未然形；可表示被动、可能、自发或尊敬，要结合本句判断。',
  られる:'「られる」接未然形；可表示被动、可能、自发或尊敬，要结合本句判断。',
  せる:'「せる」接未然形，表示使某人做某事，或允许某人做。',
  させる:'「させる」接未然形，表示使某人做某事，或允许某人做。'
 };
 const CONTRACT={てる:'「てる」是「ている」省略了「い」的口语形式。',でる:'这里的「でる」是「でいる」的口语缩约。',ちゃう:'「ちゃう」是「てしまう」的口语缩约。',じゃう:'「じゃう」是「でしまう」的口语缩约。',ちまう:'「ちまう」是「てしまう」的随意口语缩约。',じまう:'「じまう」是「でしまう」的随意口语缩约。',とく:'「とく」是「ておく」的口语缩约。',どく:'「どく」是「でおく」的口语缩约。'};
 const COMPOUND={はじめる:'开始做……',始める:'开始做……',続ける:'持续做……',つづける:'持续做……',すぎる:'做得过多／过分……',過ぎる:'做得过多／过分……',だす:'开始做……，或向外……；具体含义依前面的动词而定',出す:'开始做……，或向外……；具体含义依前面的动词而定',こむ:'向里……，或深入、充分地做……',込む:'向里……，或深入、充分地做……',かける:'开始做但尚未完成，或朝某个对象做；需结合前面的动词理解'};
 const COMPOUND_MEANINGS={
  '思う/だす':['思いだす','想起；回忆起来'],
  '思う/出す':['思い出す','想起；回忆起来'],
  '通る/すぎる':['通りすぎる','经过；走过'],
  '通る/過ぎる':['通り過ぎる','经过；走过'],
  '呼ぶ/だす':['呼びだす','叫出来；叫到某处'],
  'ひっぱる/だす':['ひっぱりだす','拉出来；拖出来'],
  '引っぱる/だす':['引っぱりだす','拉出来；拖出来'],
  '放る/こむ':['放りこむ','扔进；投进'],
  '黙る/こむ':['黙りこむ','沉默下来；闷声不说话'],
  '寝る/こむ':['寝こむ','卧床；睡熟，具体依上下文判断']
 };
 const COUNTERS={年:['ねん','年'],年間:['ねんかん','年（持续时间）'],年生:['ねんせい','年级'],人:['にん','人'],人前:['にんまえ','人份'],度:['ど','度／次（结合温度、角度或次数的语境理解）'],度目:['どめ','次（序数）'],回:['かい','次'],枚:['まい','张／片'],円:['えん','日元'],時:['じ','点（时刻）'],時半:['じはん','点半'],時間:['じかん','小时'],日:['にち','日／天'],日間:['にちかん','天（持续时间）'],月:['がつ','月（月份）'],ヵ月:['かげつ','个月'],ヶ月:['かげつ','个月'],か月:['かげつ','个月'],週間:['しゅうかん','周'],週:['しゅう','周'],分:['ふん','分钟'],分間:['ふんかん','分钟'],秒:['びょう','秒'],本:['ほん','根／支（细长物的数量）'],階:['かい','楼'],歳:['さい','岁'],才:['さい','岁'],泊:['はく','晚（住宿）'],組:['くみ','组／班'],学期:['がっき','学期'],番:['ばん','号／第几'],番手:['ばんて','位'],センチ:['せんち','厘米'],メートル:['めーとる','米'],キロ:['きろ','千米／公斤，依语境判断'],ドル:['どる','美元'],歩:['ほ','步'],杯:['はい','杯'],冊:['さつ','册'],曲:['きょく','首（曲目）'],畳:['じょう','叠（榻榻米面积单位）'],畳半:['じょうはん','叠半'],講:['こう','节课'],時限:['じげん','节课'],点:['てん','分／点'],秒間:['びょうかん','秒'],コ:['こ','个']};
 const digit={〇:0,零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 const kana=['ぜろ','いち','に','さん','よん','ご','ろく','なな','はち','きゅう'];
 const numberRE=/^[〇零一二三四五六七八九十百千万億0-9０-９]+$/;
 function kanji(n){if(n===0)return '〇';let s='';for(const [v,u]of [[100000000,'億'],[10000,'万'],[1000,'千'],[100,'百'],[10,'十']]){if(n>=v){const q=Math.floor(n/v);s+=(q===1&&v<10000?'':kanji(q))+u;n%=v;}}return s+(n?'〇一二三四五六七八九'[n]:'');}
 function numberValue(surface){
  const ascii=surface.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10));
  if(/^\d+$/.test(ascii)){const n=Number(ascii);return Number.isSafeInteger(n)&&n<=99999999?n:null;}
  const s=ascii.replace(/\d+/g,x=>kanji(Number(x)));
  if(s==='〇'||s==='零')return 0;
  // Consecutive kanji digits (三四人) usually mean an approximate range, not 34.
  if(!/^(?:[一二三四五六七八九十百千]+万)?(?:[一二三四五六七八九]?千)?(?:[一二三四五六七八九]?百)?(?:[一二三四五六七八九]?十)?[一二三四五六七八九]?$/.test(s))return null;
  let n=0,part=0,d=0;for(const x of s){if(x in digit)d=digit[x];else if(x==='万'){n+=(part+d||1)*10000;part=0;d=0;}else{part+=(d||1)*({十:10,百:100,千:1000}[x]);d=0;}}n+=part+d;
  return n>0&&kanji(n)===s?n:null;
 }
 function numberKana(n){
  if(n===0)return kana[0];let s='';
  if(n>=10000){s=numberKana(Math.floor(n/10000))+'まん';n%=10000;}
  if(n>=1000){const d=Math.floor(n/1000);s+=({1:'せん',3:'さんぜん',8:'はっせん'}[d]||kana[d]+'せん');n%=1000;}
  if(n>=100){const d=Math.floor(n/100);s+=({1:'ひゃく',3:'さんびゃく',6:'ろっぴゃく',8:'はっぴゃく'}[d]||kana[d]+'ひゃく');n%=100;}
  if(n>=10){const d=Math.floor(n/10);s+=(d===1?'':kana[d])+'じゅう';n%=10;}
  return s+(n?kana[n]:'');
 }
 function counterKana(n,c,previous){
  let reading=numberKana(n),tail=COUNTERS[c][0],ones=n%10;
  const replaceLast=(from,to)=>{if(reading.endsWith(from))reading=reading.slice(0,-from.length)+to;};
  if(['年','年間','年生','畳','畳半'].includes(c)&&ones===4)replaceLast('よん','よ');
  if(c==='人'&&n===1)return 'ひとり';if(c==='人'&&n===2)return 'ふたり';
  if(['人','人前'].includes(c)&&ones===4)replaceLast('よん','よ');
  if(['時','時半','時間'].includes(c)){if(ones===4)replaceLast('よん','よ');if(ones===7)replaceLast('なな','しち');if(ones===9)replaceLast('きゅう','く');}
  if(c==='月'){if(n<1||n>12)return null;reading=({4:'し',7:'しち',9:'く'}[n]||reading);}
  if(c==='日'||c==='日間'){
   const special={1:previous&&/月$/.test(previous.s)?'ついたち':'いちにち',2:'ふつか',3:'みっか',4:'よっか',5:'いつか',6:'むいか',7:'なのか',8:'ようか',9:'ここのか',10:'とおか',14:'じゅうよっか',20:'はつか',24:'にじゅうよっか'};
   if(special[n])return special[n]+(c==='日間'?'かん':'');
   if(ones===7)replaceLast('なな','しち');if(ones===9)replaceLast('きゅう','く');
  }
  if(c==='歳'||c==='才'){if(n===20)return 'はたち';if(ones===1)replaceLast('いち','いっ');if(ones===8)replaceLast('はち','はっ');if(ones===0)replaceLast('じゅう','じゅっ');}
  if(['分','分間'].includes(c)){
   if([1,6,8].includes(ones))replaceLast({1:'いち',6:'ろく',8:'はち'}[ones],{1:'いっ',6:'ろっ',8:'はっ'}[ones]);
   if(ones===0&&n>0){replaceLast('じゅう','じゅっ');replaceLast('ひゃく','ひゃっ');replaceLast('びゃく','びゃっ');replaceLast('ぴゃく','ぴゃっ');}if([0,1,3,4,6,8].includes(ones)&&n>0)tail=tail.replace(/^ふ/,'ぷ');
  }
  if(['本','杯','泊','歩'].includes(c)){
   if([1,6,8].includes(ones))replaceLast({1:'いち',6:'ろく',8:'はち'}[ones],{1:'いっ',6:'ろっ',8:'はっ'}[ones]);
   if(ones===0&&n>0){replaceLast('じゅう','じゅっ');replaceLast('ひゃく','ひゃっ');replaceLast('びゃく','びゃっ');replaceLast('ぴゃく','ぴゃっ');}
   if([0,1,6,8].includes(ones)&&n>0)tail=tail.replace(/^ほ/,'ぽ').replace(/^は/,'ぱ');
   if(ones===3||/[せぜま]ん$/.test(reading))tail=tail.replace(/^[ほぽ]/,'ぼ').replace(/^[はぱ]/,'ば');
   if((c==='歩'||c==='泊')&&(ones===3||/[せぜま]ん$/.test(reading)))tail=tail.replace(/^ぼ/,'ぽ').replace(/^ば/,'ぱ');
  }
  if(['回','階','週間','週','ヵ月','ヶ月','か月','冊','曲','コ','講','点'].includes(c)){
   if(ones===1)replaceLast('いち','いっ');
   if(ones===6&&['回','階','ヵ月','ヶ月','か月','曲','コ','講'].includes(c))replaceLast('ろく','ろっ');
   if(ones===8)replaceLast('はち','はっ');if(ones===0)replaceLast('じゅう','じゅっ');
   if(ones===0&&['回','階','ヵ月','ヶ月','か月','曲','コ','講'].includes(c)){replaceLast('ひゃく','ひゃっ');replaceLast('びゃく','びゃっ');replaceLast('ぴゃく','ぴゃっ');}
   if(c==='階'&&(ones===3||/[せぜ]ん$/.test(reading)))tail='がい';
  }
  // 組 is used for numbered school classes here (１組＝いちくみ), not
  // an arbitrary pair/set (ひとくみ／ふたくみ).
  return reading+tail;
 }
 function legacy(book,line){
  const out=[];for(const id of line.t){const w=book.words[id],last=out.at(-1);if(!w)continue;
   const join=last&&/动词|形容词/.test(last.words[0].p)&&(w.p==='助动词'||w.p==='助词'&&['て','で','ば'].includes(w.s));
   if(join){last.words.push(w);last.s+=w.s;last.k+=w.k;}else out.push({words:[w],s:w.s,k:w.k,p:w.p});
  }
  return out.map(g=>({...g,audioParts:[{s:g.s,k:g.k}],parts:g.words.slice()}));
 }
 function merge(items,rule,note,extra={}){
  const words=items.flatMap(g=>g.words);
  return {words,parts:words.slice(),s:items.map(g=>g.s).join(''),k:items.map(g=>g.k).join(''),p:items[0].p,
   audioParts:items.flatMap(g=>g.audioParts),rule,
   note:[...new Set(items.map(g=>g.note).filter(Boolean).concat(note||[]))].join(' '),
   ...(items[0].base?{base:items[0].base}:{}),...(items[0].definition?{definition:items[0].definition}:{}),...extra};
 }
 function create(book,line){
  let groups=legacy(book,line);
  for(let i=0;i<groups.length;i++){
   if(!numberRE.test(groups[i].s))continue;
   let end=i+1;while(end<groups.length&&numberRE.test(groups[end].s))end++;
   const raw=groups.slice(i,end).map(g=>g.s).join(''),n=numberValue(raw);
   if(n===null){i=end-1;continue;}
   const c=groups[end]?.s;
   if(Object.hasOwn(COUNTERS,c)){
    // 分 can instead be a share (ぶん); never silently relabel that as minutes.
    if(c==='分'&&groups[end].k==='ぶん'){i=end-1;continue;}
    const k=counterKana(n,c,groups[i-1]);if(k===null){i=end-1;continue;}
    let finish=end+1,isOrdinal=c==='度目';
    if(groups[finish]?.s==='目'&&groups[finish].k==='め'){finish++;isOrdinal=true;}
    const s=groups.slice(i,finish).map(g=>g.s).join('');
    const definition=isOrdinal?`第 ${n} ${COUNTERS[c][1].replace('（序数）','')}`:`${n} ${COUNTERS[c][1]}`;
    groups.splice(i,finish-i,merge(groups.slice(i,finish),'counter',`数字和量词作为一个单位学习。${c==='日'&&n===1?'这里若表示一天，读「いちにち」；每月一号读「ついたち」，依上下文区分。':''}`,{k:k+(finish>end+1?'め':''),base:s,definition,p:'名词'}));
   }else if(end>i+1){groups.splice(i,end-i,merge(groups.slice(i,end),'number','把组成数值的数字连起来读。',{k:numberKana(n),base:raw,definition:String(n),p:'名词'}));}
  }
  // Fold only across a known grammatical boundary. Punctuation, lexical nouns,
  // topic/case particles and a verb's finite form cannot enter these rules.
  const out=[];
  for(const g of groups){
   const a=out.at(-1),first=g.words[0],last=a?.words.at(-1);let rule='',note='',extra={};
   if(a&&a.p==='名词'&&SAHEN.has(a.s)&&first.p==='动词'&&first.b==='する'){
    rule='suru-verb';note=`「${a.s}＋する」构成动词，后面的词尾一起表示时态或语气。`;extra={p:'动词',base:a.s+'する',definition:a.definition||a.words[0].d};
   }else if(a&&a.p==='动词'&&first.p==='动词'&&Object.hasOwn(SUFFIX,first.b)&&/^未然/.test(last.f)){
    rule='verb-suffix';note=SUFFIX[first.b];
   }else if(a&&a.p==='动词'&&last.p==='助词'&&['て','で'].includes(last.s)&&first.p==='动词'&&Object.hasOwn(SUPPLEMENT,first.b)){
    rule='te-supplement';note=SUPPLEMENT[first.b];
   }else if(a&&a.p==='动词'&&/^連用/.test(last.f)&&first.p==='动词'&&Object.hasOwn(CONTRACT,first.b)&&
     (first.b!=='でる'||last.f==='連用タ接続'&&/[んい]$/.test(last.s))){
    rule='verb-contraction';note=CONTRACT[first.b];
   }else if(a&&a.p==='动词'&&last.f==='連用形'&&!['いる','おる','ある'].includes(last.b)&&first.p==='动词'&&Object.hasOwn(COMPOUND,first.b)){
    rule='compound-verb';note=`「${first.b}」接在动词连用形后，表示${COMPOUND[first.b]}。`;
    const meaning=COMPOUND_MEANINGS[last.b+'/'+first.b];
    if(meaning){extra={base:meaning[0],definition:meaning[1]};note=`「${meaning[0]}」作为复合动词表示“${meaning[1]}”，这里把它的词尾一同学习。`;}
   }
   if(rule)out[out.length-1]=merge([a,g],rule,note,extra);else out.push(g);
  }
  return out;
 }
 window.STUDY_MORPHOLOGY=Object.freeze({create});
})();
