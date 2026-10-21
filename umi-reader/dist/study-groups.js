/* Learning units preserve the source text; reviewed expressions take precedence. */
(() => {
 'use strict';
 function create(book,line){
  if(window.STUDY_MORPHOLOGY&&window.STUDY_EXPRESSIONS)
   return window.STUDY_EXPRESSIONS.merge(window.STUDY_MORPHOLOGY.create(book,line),{book,line});
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
  return groups;
 }
 window.STUDY_GROUPS=Object.freeze({create});
})();
