import {sentenceWalkthroughs} from '../content/sentence-walkthroughs.mjs';
import {chunkGrammarDetails} from '../content/chunk-grammar-details.mjs';
import {connectionLessons} from '../content/connection-lessons.mjs';
export function buildWalkthroughs(book,lessons=sentenceWalkthroughs){
 const seen=new Set();
 return lessons.map(lesson=>{
  if(seen.has(lesson.sentence))throw new Error('Duplicate walkthrough '+lesson.sentence);seen.add(lesson.sentence);
  const line=book.lines[lesson.sentence-1];if(!line)throw new Error('Missing sentence '+lesson.sentence);
  const connections=connectionLessons.filter(c=>c.sentence===lesson.sentence);
  for(const note of connections){
   if(!note.meaning?.trim()||!note.why?.trim()||!lesson.blocks.some(b=>b.quote.includes(note.quote)))throw new Error('Missing or changed phrase explanation at '+lesson.sentence+' '+note.quote);
  }
  const jp=line.t.map(i=>book.words[i].s).join('');let offset=0;
  const punctuationOnly=s=>/^[\p{P}\p{Z}\s]*$/u.test(s);
  const blocks=lesson.blocks.map(b=>{
   const start=jp.indexOf(b.quote,offset),end=start+b.quote.length;
   if(start<0||!punctuationOnly(jp.slice(offset,start)))throw new Error('Uncovered or changed Japanese at '+lesson.sentence+' '+b.quote);
   if(!b.role||!b.meaning||!b.why)throw new Error('Incomplete teaching block '+lesson.sentence);
   const detail=chunkGrammarDetails.find(d=>d.sentence===lesson.sentence&&d.quote===b.quote);
   if(detail){
    if(!detail.structure||!detail.rebuild||!detail.parts.length)throw new Error('Incomplete detailed chunk '+lesson.sentence);
    for(const p of detail.parts){
     if(!b.quote.includes(p.quote)||!p.kana||!p.title||!p.meaning?.trim()||!p.paragraphs.length||p.paragraphs.some(x=>!x.trim())||p.forms.some(f=>!f.form||!f.kana||!f.why))throw new Error('Invalid detailed grammar span '+lesson.sentence+' '+p.quote);
    }
   }
   offset=end;return {...b,start,end,connections:connections.filter(c=>b.quote.includes(c.quote)),...detail?{detail}:{} };
  });
  if(!punctuationOnly(jp.slice(offset))||!blocks.length)throw new Error('Uncovered ending '+lesson.sentence);
  for(const n of lesson.links)if(n<1||n>book.lines.length)throw new Error('Invalid contextual link '+n);
  return {...lesson,jp,blocks};
 });
}
