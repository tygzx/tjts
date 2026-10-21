/* Reviewed learning expressions. Match complete groups, never substrings or punctuation. */
(() => {
 'use strict';
 const rules=[];
 const add=(id,pattern,base,definition,note,guard)=>rules.push({id,re:new RegExp('^(?:'+pattern+')$'),base,definition,note,guard});
 const copula='(?:だ|だった|だろう|でしょう|でした|です|である|であった)';
 const negative='(?:ない|なかった|なく|なくて|ないだろう|ないです|ありません|ありませんでした|ないらしかった)';
 const predicate=g=>!!g&&(/動詞|动词|形容詞|形容词|助动词|固定表达/.test(g.p)||/^(?:だ|だった|です|でした|な|らしい|みたい)$/.test(g.s));
 const nominal=g=>!!g&&/名词|代名词/.test(g.p);
 const firstWord=g=>(g.parts||g.words||[])[0];
 const explanatory=(gs,i)=>predicate(gs[i-1])||(gs[i]?.s==='な'&&nominal(gs[i-1]));
 const quote='(?:という|っていう|とゆう)';

 add('rephrase','というか','というか','或者说；更确切地说。用后面的说法修正、补充前面的说法。','这是完整的改口表达。不要把它拆成「と」「いう」「か」逐字理解；「何というか」「というから」另有结构。',(gs,i,j)=>!['なん','何','なに'].includes(gs[i-1]?.s)&&!['ら','どう','どうか'].includes(gs[j]?.s));
 add('explanatory-copula','(?:な)?(?:ん|の)'+copula,'のだ／んだ','用来解释情况、说明原因，或强调自己得出的结论。','「ん」是「の」的口语缩略。だった／でした是过去形，だろう／でしょう带有推测语气；这里不必硬译成“是”。',explanatory);
 add('explanatory-negative','(?:な)?(?:ん|の)(?:じゃ|では)'+negative,'のではない／んじゃない','对前面的解释加以否定；在问句中也可委婉确认“是不是……”。','这是解释句型的否定形式。是不是反问、猜测，需看后面的「か」「の」和语境。',explanatory);

 add('conclusion',quote+'わけ'+copula,'というわけだ','也就是说……；这么一来便是……。把前面的情况归结成一个结论。','「という」承接前面的内容，「わけだ」说明由此得出的结论。整个表达一起理解。');
 add('reason-conclusion','わけ'+copula,'わけだ','也就是说……；难怪……。表示从已知情况得出的结论。','わけ本来是“缘由、道理”。接在前面的说明后，表示说话人理解了事情为何如此。');
 add('not-necessarily','(?:'+quote+')?わけ(?:では|でも|じゃ)'+negative,'わけではない','并不是说……；并非……。否定前面那种解释或结论。','「わけでもない」常带“也并不是”的语气。与「わけがない」（不可能）不同。');
 add('impossible','わけ(?:が|は|も)'+negative,'わけがない','不可能……；不可能有这种道理。','表示说话人认为前面的事情没有可能。は、も是强调或补充的说法。');
 add('cannot-do','(?:'+quote+')?わけに(?:は|も)?(?:いかない|いかなかった|いかないです|いかず|いかん)','わけにはいかない','不能就这样做……；由于情理、责任或处境，不能做某事。','这里的「いかない」不是单纯“不能去”。若前面本身是否定，如「来ないわけにはいかない」，整体就表示“不能不来／必须来”。');

 add('possibility','かも(?:しれない|しれなかった|しれません|しれませんでした|しれん|知れない|知れなかった)','かもしれない','也许……；说不定……。表示一种不太确定的可能性。','「かも」「しれない」合起来是推测表达；しれなかった是过去形式，しれん是口语否定。');
 add('report-conclusion',quote+'こと'+copula,'ということだ','意思是……；也就是说……；据说……。把前面的内容当作一件事来说明。','如果是转述消息，可以理解为“据说”；如果是归纳前文，可以理解为“也就是说”。');
 add('quote-topic',quote+'のは','というのは','所谓……是指……；说到……。把前面提到的内容作为话题。','后面通常继续解释、评价，或说明前面所说的事情。');

 add('hesitation','(?:なん|何|なに)というか','なんというか','该怎么说呢；怎么形容才好呢。','说话人正在寻找合适的词来表达感受，语气犹豫。这里不等于直接改口的「というか」。');
 add('nothing-special','(?:なん|何|なに)ということも(?:ない|なく|なかった)','なんということもない','没什么特别的；没什么大不了的。','以否定形式表示并没有值得特别在意的事情。「なく」用于连接后面的叙述。');
 add('rhetorical-conclusion','(?:'+quote+')?わけじゃないか','わけじゃないか','不正是……吗；这不就意味着……吗。','用反问形式提醒对方承认前面的结论，语气常是确认或强调。');

 // The predicate may already include tense/aspect from the morphology pass.
 const naru='(?:なる|なった|なって|なっている|なっていた|なっていて|なってる|なってた|なってしまう|なってしまった|なっちゃう|なっちゃって|なっちまった|ならない|ならなかった|なれば|なり)';
 const suru='(?:する|した|して|している|していた|していて|してる|してた|しない|しなかった|しよう|します|しました|すれば)';
 add('arrangement','(?:'+quote+')?ことに'+naru,'ことになる','结果成为……；事情被安排为……；决定要……。','与「ことにする」不同，重点是结果或安排如此，不突出自己主动决定。若前面是“这件事／那件事”，也可指事情变成某种情况。',(gs,i)=>gs[i-1]?.s!=='の');
 add('decision','ことに'+suru,'ことにする','决定做……；把……作为自己的决定或做法。','「ことにした」是“决定了”；「ことにしている」常表示自己一直遵守的做法。前面通常接动作或否定形式。');
 add('ability','こと(?:が|も|は|の)(?:できる|できた|できない|できなかった|できて|できず|出来る|出来た|出来ない)','ことができる','能够做……；可以做……。','前面的动作经「こと」名词化，再接「できる」。できない表示“不能”，できた表示“做到了”；も带“也”，は带强调或对比。');
 add('experience','こと(?:が|は|も)(?:ある|あった|ない|なかった)','ことがある','曾经做过……；有时会……。','前面是动词过去形时，通常表示经历；是原形时，常表示偶尔发生。否定形式表示没有相应经历或情况。',(gs,i,j)=>{const previous=gs[i-1],last=(previous?.parts||previous?.words||[]).at(-1);return !!previous&&((last?.b==='た')||(/动词/.test(previous.p)&&/る$/.test(previous.s)&&!/[なか]った$|ない$/.test(previous.s)&&/ある|あった/.test(gs.slice(i,j).map(g=>g.s).join(''))));});

 add('expectation','はず'+copula,'はずだ','按理应该……；照已知的情况，本来应当……。','是基于依据的判断，不是命令别人“应该做”。「はずだった」表示本来应当如此，结果可能不如预期。');
 add('expectation-negative','はず(?:が|は|も)?'+negative,'はずがない','按理不可能……；应该不会……。','依据已知的情况作出否定判断。不能译成“没有打算”。');
 add('expectation-contrast','はずなのに','はずなのに','本来应该……，却……。','はず表示有根据的预期，なのに表示实际情况与预期不一致。');
 add('intention','つもり'+copula,'つもりだ','打算……；自认为……。','前面是动词原形或否定形时，通常表示打算；前面是过去形，或名词＋の时，也可能表示“自以为／当作”。');
 add('intention-negative','つもり(?:が|は|じゃ|では)'+negative,'つもりはない','没有打算……；并不是想要……。','也可能是在否定自己的用意或认知；结合前面是计划、言行还是误会来理解。');
 add('intention-state','つもりで(?:いる|いた|いて)','つもりでいる','打算……；一直以为……。','「いる」表示保持这种想法；「いた」是过去的想法。前面的内容决定是计划还是自我认定。');

 add('appearance','よう'+copula,'ようだ','好像……；似乎……；像……一样。','根据眼前的情况或自己的感觉作判断。不是把「よう」理解为“要做”的意志形。',(gs,i)=>firstWord(gs[i])?.p==='名词');
 add('likeness-adverb','ように','ように','像……一样；为了能够……；让……。','比喻时修饰后面的动作；接可能形或否定形时常表示目的；也可配合“说、请求”等转述要求。需要结合前后文判断。',(gs,i)=>firstWord(gs[i])?.p==='名词');
 add('likeness-noun','ような','ような','像……一样的……；……那样的……。','后面接名词，整体一起修饰它，例如「夢のような話」是“像梦一样的事情”。',(gs,i)=>firstWord(gs[i])?.p==='名词');
 add('likeness-change','ように'+naru,'ようになる','变得会……；逐渐能够……；开始出现某种状态。','表示能力、习惯或状态发生变化。前面接否定形式时，可表示“变得不再……”。',(gs,i)=>firstWord(gs[i])?.p==='名词');
 add('likeness-effort','ように'+suru,'ようにする','尽量做到……；也可表示做出……的样子或姿势。','表示努力或安排时，可理解为“设法让……”。描写动作时，如「顎をしゃくるようにして」，则是“做出抬下巴的动作”，不一定是在努力做到。',(gs,i)=>firstWord(gs[i])?.p==='名词');
 add('likeness-colloquial','みたい(?:だ|だった|です|でした|な|に)','みたいだ','像……；好像……。较口语的比喻或推测表达。','みたいな后面接名词，みたいに修饰动作，みたいだ用于句末判断。');
 add('purpose','ために','ために','为了……；由于……。','前面是有意实现的目标时，通常表示目的；前面是已发生的事实或状态时，也可表示原因。');
 add('during','うちに','うちに','趁着……；在……期间。','表示某种状态持续时做一件事，或在这段时间中自然发生变化。',(gs,i)=>predicate(gs[i-1])||['の','みるみる'].includes(gs[i-1]?.s));
 add('before-long','そのうちに','そのうちに','过一会儿；不久；随后。','不指定精确时间，表示过了一段时间后发生的事情。');
 add('certainty','に(?:違い|ちがい)(?:ない|なかった)','に違いない','一定……；肯定……。表示很有把握的推测。','整体是推测句型，不要逐字理解成“没有差异”。');
 add('only','に(?:すぎ|過ぎ)(?:ない|なかった)','にすぎない','只不过……；仅仅是……。','把前面的数量、身份或事实限定在较小的范围内。');
 add('advice','(?:ほう|方)が(?:いい|よい|よかった|良い)','ほうがいい','……比较好；最好……。','用于建议时，前面通常是动词过去形或否定形；比较不同选择时，也可理解为“这一方更好”。');
 add('together','とともに','とともに','和……一起；伴随着……。','既可表示人一起行动，也可表示某种感受、变化与另一件事同时出现。');

 // The corpus also contains 目について / ホテルについて / 手にとって;
 // their tokens were incorrectly tagged as compound particles. Do not teach
 // those literal verbs as “about” or “for”. Guards apply to single tokens too.
 add('about','について','について','关于……；就……而言。','提示接下来谈论、调查或评价的内容。',(gs,i)=>nominal(gs[i-1])&&!['目','ホテル','席','机'].includes(gs[i-1].s));
 add('for-person','にとって','にとって','对于……来说；站在……的立场看。','用来说明某件事对前面的人或群体具有怎样的意义或评价。',(gs,i)=>nominal(gs[i-1])&&!['手','手元'].includes(gs[i-1].s));
 add('as-role','として(?:は|も)?','として','作为……；以……的身份或立场。','は可强调这种立场，も可表示“也”。「〜ようとして」是“正要／试图做”，不是这里的身份用法。',(gs,i)=>nominal(gs[i-1])&&!/(?:然|よう|ろう|そう|こう|ごう|とう|どう|のう|ぼう|もう|おう)$/.test(gs[i-1].s)&&!['しん','ホロリ'].includes(gs[i-1].s));
 add('regarding','に関する','に関する','关于……的；涉及……的。','后面通常接名词，用来说明它所涉及的范围。');
 add('toward','に対する','に対する','对于……的；面向……的。','后面接名词，表示态度、行为等所针对的对象。');
 add('according-to','によると|によれば','によると／によれば','根据……；据……所说。','提示消息来源或判断的依据。');

 function merge(groups){
  const out=[];
  for(let i=0;i<groups.length;){
   let surface='',match=null;
   for(let j=i;j<groups.length&&j<i+10;j++){
    const g=groups[j];
    if(g.p==='标点'||/[\s。、，,！？!?「」『』（）()〈〉《》“”〝〟―—…]/u.test(g.s))break;
    surface+=g.s;if(surface.length>32)break;
    for(const rule of rules){
     if(rule.re.test(surface)&&(!rule.guard||rule.guard(groups,i,j+1))){match={rule,end:j+1,s:surface};break;}
    }
   }
   if(!match){out.push(groups[i++]);continue;}
   const chunk=groups.slice(i,match.end),rule=match.rule;
   const k=chunk.map(g=>g.k).join('');
   const word={s:match.s,k,b:rule.base,p:'固定表达',d:rule.definition,f:'基本形',auto:false};
   out.push({s:word.s,k,p:word.p,words:[word],parts:chunk.flatMap(g=>g.parts||g.words),audioParts:chunk.flatMap(g=>g.audioParts||[{s:g.s,k:g.k,p:g.p}]),definition:word.d,base:word.b,note:rule.note,rule:rule.id});
   if(rule.id==='rephrase'&&window.LESSON_NOTES?.some(n=>n[0]==='というか'&&n[1]===k+'。'))out.at(-1).audioTitle='というか';
   i=match.end;
  }
  return out;
 }
 window.STUDY_EXPRESSIONS=Object.freeze({merge});
})();
