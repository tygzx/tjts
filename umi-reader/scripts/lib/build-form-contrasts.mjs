import {formContrastGuides} from '../content/form-contrast-guides.mjs';
export function buildFormContrasts(){
 for(const [key,g] of Object.entries(formContrastGuides)){
  if(g.key!==key||![g.title,g.change,g.time,g.trap].every(x=>typeof x==='string'&&x.trim())||g.examples.length<3)throw new Error('Incomplete form contrast '+key);
  for(const e of g.examples)if(!['scene','ja','kana','zh','why'].every(k=>typeof e[k]==='string'&&e[k].trim())||/\p{Script=Han}/u.test(e.kana))throw new Error('Missing example reading or explanation '+key);
 }
 return formContrastGuides;
}

export function buildMakuruAnalyses(book){
 const step=(form,kana,why)=>({form,kana,why});
 return [19,1318,2346].map(sentence=>{
  const line=book.lines[sentence-1],jp=line.t.map(i=>book.words[i].s).join(''),dance=sentence!==19;
  const quote=dance?'踊りまくる':'しまくった',start=jp.indexOf(quote),end=start+quote.length;
  if(start<0||jp.indexOf(quote,start+1)!==-1)throw new Error('Changed makuru source '+sentence);
  const base=dance?'踊りまくる':'しまくる',baseKana=dance?'おどりまくる':'しまくる';
  const steps=dance?[
   step('踊る','おどる','踊る＝跳舞。这里先不要急着改过去，先加“尽情、不停地”。'),
   step('踊り','おどり','保留踊，把最后る换成り，准备接まくる。这一截还没说完。'),
   step('踊りまくる','おどりまくる','踊り＋まくる＝尽情地、不停地跳舞。这里的まくる在说动作的劲头，不是在卷袖子。'+(sentence===2346?'本句后面ことになっていた说“当时已经安排好要这样做”，不能据此说舞已经跳完了。':'这里概括庆典中人们怎样跳舞，没有说是眼前这一刻才开始跳。'))
  ]:[
   step('する','する','する＝做。買物をする就是买东西。'),
   step('し','し','要接まくる，する换成し。只看这一步还不是过去；现在只是准备加“不停做”的意思。'),
   step('しまくる','しまくる','し＋まくる＝不停地做。買物をしまくる就是大买特买；接下来才改变时间。'),
   step('しまくっ','しまくっ','前面しまく保留。まくる属于五段这一组，接た时把最后る换成小っ。这一步不是完整单词，不单独朗读。'),
   step('しまくった','しまくった','再加た：しまく＋っ＋た＝しまくった。小说在回忆之前发生的采购，所以是“大买特买了一番”。小っ在た前停一拍，不读つ。')
  ];
  return {sentence,jp,quote,start,end,base,baseKana,steps,lessonKeys:['makuru'],kind:'反复动作的接法',meaning:dance?'尽情地、不停地跳舞':'不停地做了一通；本句是大买特买了一番',meaningLabel:'这一整段动作',warning:sentence===2346?'动作本身的原形与整句的时间要分开看；本句是在回顾当时的安排。':'下面是教学例句，用来比较接法和时间，不是新增的小说情节。'};
 });
}
