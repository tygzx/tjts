import {actionConnectionLessons} from '../content/action-connection-lessons.mjs';
import {actionContrastKeys} from '../content/form-contrast-guides.mjs';

const step=(form,why)=>({form,kana:form,why});
function verbSteps(x){
 const state=['appearance','wearing'].includes(x.sense);
 const base=step('する',state?'原来的说法。这里表示带有某种样貌、打扮，要和前面的词一起理解。':x.sense==='experience'?'原来的说法。和思い连用，是“有过某种感受或经历”。':'する＝“做”，这是查词典时找的形式。接上电话、会议等不同的事情，中文就自然说“打电话”“开会”等。');
 const shi=step('し','为了接后面的字，する要换成し。这只是中间一步，还没说完；不是保留す、只删る。');
 const te=step('して','し＋て。て把这个动作或状态接到后面；它自己不等于“过去”。');
 const ing=step('している',state?'して＋いる：保持着前面说的样子，不是“正在做一张脸”。':'して＋いる：在做这件事，或保持做了以后留下的状态；具体看这句话。');
 const past=step('した',state&&x.form==='した'&&[140,2034].includes(x.sentence)?'し＋た。这里在名词前描述人的特征或留下的状态；并不是说现在已经没有这种特征。':x.sense==='action'?'し＋た＝した，也就是“做了”。这句里的た把事情放到过去；“了”的意思来自这个结尾，不是前面的を。接上具体事情，中文可以说“打了电话”“做了事情”。':'し＋た＝した。这里把前面的表情、感受放回当时，具体意思是“'+x.meaning+'”。');
 const done=step('していた',state?'している的最后いる换成いた：当时就是那个样子。':'把している末尾的いる换成いた，回到“那时候”。本句具体是：'+x.meaning+'。');
 const passive=step('される','する换成される：事情由别人做，句中谈的那个人或东西承受这件事。不是するれる。');
 const passiveTe=step('されて','される去掉最后る，再加て，成为されて；接着还可以讲后面的反应或状态。');
 const passiveIng=step('されている','されて＋いる：处在被别人这样对待、评价或议论的状态。');
 const endings={
  'する':[base], 'した':[base,shi,past], 'して':[base,shi,te],
  'している':[base,shi,te,ing], 'していた':[base,shi,te,ing,done],
  'してる':[base,shi,te,ing,step('してる','口语把している中的い省掉。意思仍是している，不是新的动词。')],
  'していて':[base,shi,te,ing,step('していて','把最后的いる换成いて，接着说后面的情况：……而且／接着……。')],
  'します':[base,shi,step('します','し＋ます，换成礼貌的说法。这里是“要开说明会”，不是“开过了”。')],
  'するなら':[base,step('するなら','する保持原样，再加なら：如果要这样做的话。')],
  'すれば':[base,step('すれば','する换成すれば：如果做的话。不是するれば；接上いい时常说“怎样做才好”。')],
  'しながら':[base,shi,step('しながら','し＋ながら：一边做这件事，一边做后面的事。前后是同一个人在做。')],
  'したり':[base,shi,step('した','为了接后面的り，先把する换成した。这一步是接法，不表示这句话一定在讲过去。'),step('したり','した＋り，举出一件有代表性的事。接在这里是“做做……之类”，不是只有这一件事。')],
  'しあう':[base,shi,step('しあう','し＋あう（合う）：互相做。这里是彼此打电话，不是单向联系。')],
  'しあった':[base,shi,step('しあう','し＋あう（合う）：互相做，双方都向对方示意。'),step('しあった','あう的最后う变成った，得到しあった：互相打了招呼。')],
  'していれば':[base,shi,te,ing,step('していれば','末尾いる换成いれば，变成条件：如果一直这样聊着的话。')],
  'してくる':[base,shi,te,step('してくる','して＋くる：这件事朝说话人这边来。本句是向“我”提出请求。')],
  'してみせた':[base,shi,te,step('してみせる','して＋みせる：做出某种样子给别人看。'),step('してみせた','みせる的る换成た：特意摆出了那副表情。')],
  'してしまい':[base,shi,te,step('してしまう','して＋しまう：不由得做了，或做完了；本句是不由得露出了呆愣的表情。'),step('してしまい','最后しまう换成しまい，后面继续说发生了什么。这里还没把话说完。')],
  'してなくて':[base,shi,te,ing,step('していない','いる换成いない：没有保持那种样子。'),step('していなくて','いない的最后い换成くて，把否定接到后面。'),step('してなくて','口语省掉していなくて中、紧挨て后面的い：没有那样，而是……。')],
  'してから':[base,shi,te,step('してから','して＋から：做完这件事以后，再做后面的事。')],
  'すべき':[base,step('すべき','する接べき可以写するべき，也可以缩成すべき，意思是“应该做”。不是“已经做了”。')],
  'したらしい':[base,shi,past,step('したらしい','した＋らしい：看来做过了。这里是从房间状况作推测，不是亲眼看见整个过程。')],
  'しまくった':[base,shi,step('しまくる','し＋まくる＝不停地、使劲地做。这里先加“大量反复”的意思，还没有变成过去。'),step('しまくっ','保留前面的しまく。まくる属于五段这一组，接た时最后る换成小っ；这是中间一步，不是完整的词。'),step('しまくった','再加た：しまく＋っ＋た＝しまくった。这里在回忆，所以是“大买特买了一番”。小っ不读つ，而是在た前停一拍。不是しまった，也不是把る直接删掉写成しまくた。')],
  'されて':[base,passive,passiveTe],
  'されていて':[base,passive,passiveTe,passiveIng,step('されていて','最后いる换成いて，继续说明后面的情况。')],
  'されてる':[base,passive,passiveTe,passiveIng,step('されてる','口语省掉されている中、紧挨て后面的い；被别人议论的方向没有变。')],
  'されていた':[base,passive,passiveTe,passiveIng,step('されていた','末尾いる换成いた：当时被人这样指责。')]
 };
 if(!endings[x.form])throw new Error('Missing action form teaching: '+x.form);
 return endings[x.form];
}

export function buildActionConnections(book,rows=actionConnectionLessons){
 const seen=new Set();
 return rows.map(x=>{
  const line=book.lines[x.sentence-1];if(!line)throw new Error('Missing action sentence '+x.sentence);
  let offset=0;
  const tokens=line.t.map(id=>{const w=book.words[id],start=offset;offset+=w.s.length;return {...w,start,end:offset};});
  const jp=tokens.map(t=>t.s).join(''),quote=x.noun+x.gap+'を'+x.form,start=jp.indexOf(quote),end=start+quote.length;
  if(start<0||jp.indexOf(quote,start+1)!==-1)throw new Error('Missing or ambiguous action source '+x.sentence+' '+quote);
  const particleStart=start+x.noun.length+x.gap.length,verbStart=particleStart+1;
  const particle=tokens.find(t=>t.start===particleStart&&t.s==='を'&&t.p==='助词');
  const verb=tokens.find(t=>t.start===verbStart&&['する','しまくる'].includes(t.b));
  if(!particle||!verb||!tokens.some(t=>t.start===start)||!tokens.some(t=>t.end===end))throw new Error('Action token boundary mismatch '+x.sentence+' '+quote);
  const key=x.sentence+':'+particleStart;if(seen.has(key))throw new Error('Duplicate action lesson '+key);seen.add(key);
  if(!x.nounMeaning||!x.meaning||!['action','appearance','wearing','experience','passive'].includes(x.sense))throw new Error('Incomplete action lesson '+key);
  const nounKana=tokens.filter(t=>t.start>=start&&t.end<=start+x.noun.length).map(t=>t.k||t.s).join('');
  const relation={
   action:'を读作お（o）。前面的“'+x.nounMeaning+'”就是做的内容。を负责把这个内容交给后面的动作；它自己不表示“做”，也不表示“了”，中文里通常不用单独译出一个字。',
   appearance:'を读作お（o）。这里把“'+x.nounMeaning+'”接到する这一套说法上，表示人带着这样的外貌、表情或打扮。不是把一张脸“做出来”。',
   wearing:'を读作お（o）。这里连接的是“'+x.nounMeaning+'”和する，整套在说涂着、戴着的状态，不能机械地译成“做”。',
   experience:'を读作お（o）。它把前面的“'+x.nounMeaning+'”接到する上。思いをする是一套说法：有这种感受或经历；不是“做一个想法”。',
   passive:'を读作お（o）。它标出别人做出的“'+x.nounMeaning+'”；后面的される再说明这件事是由别人施加的。不是把を直接翻译成“被”。'
  }[x.sense];
  const recall=x.sense==='action'?'再遇到时，先看を前面做的是什么，再看后面的结尾有没有“了、正在、如果、应该”等意思。':x.sense==='passive'?'再遇到される，先分清谁在做、谁承受；不要把被别人做的事读成自己主动做。':'再遇到这套说法，先把外貌、打扮或感受和する合起来理解，再看结尾怎样变化。';
  return {...x,jp,quote,start,end,particleStart,verbStart,nounKana,relation,steps:verbSteps(x),contrastKeys:actionContrastKeys(x.form),recall};
 });
}
