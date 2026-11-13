import {sentenceWalkthroughs} from '../content/sentence-walkthroughs.mjs';
export function buildWalkthroughs(book,lessons=sentenceWalkthroughs){
 const seen=new Set();
 return lessons.map(lesson=>{
  if(seen.has(lesson.sentence))throw new Error('Duplicate walkthrough '+lesson.sentence);seen.add(lesson.sentence);
  const line=book.lines[lesson.sentence-1];if(!line)throw new Error('Missing sentence '+lesson.sentence);
  const jp=line.t.map(i=>book.words[i].s).join('');let offset=0;
  const punctuationOnly=s=>/^[\p{P}\p{Z}\s]*$/u.test(s);
  const blocks=lesson.blocks.map(b=>{
   const start=jp.indexOf(b.quote,offset),end=start+b.quote.length;
   if(start<0||!punctuationOnly(jp.slice(offset,start)))throw new Error('Uncovered or changed Japanese at '+lesson.sentence+' '+b.quote);
   if(!b.role||!b.meaning||!b.why)throw new Error('Incomplete teaching block '+lesson.sentence);
   offset=end;return {...b,start,end};
  });
  if(!punctuationOnly(jp.slice(offset))||!blocks.length)throw new Error('Uncovered ending '+lesson.sentence);
  for(const n of lesson.links)if(n<1||n>book.lines.length)throw new Error('Invalid contextual link '+n);
  return {...lesson,jp,blocks};
 });
}
