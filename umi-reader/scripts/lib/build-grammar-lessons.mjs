import {grammarLessons,grammarTitleKeys,grammarGlossary,grammarLessonReferences} from '../content/grammar-lessons.mjs';
export function buildGrammarLessons(patterns,curated={}){
 const keys=new Set();
 for(const g of grammarLessons){
  if(keys.has(g.key)||![g.key,g.title,g.connection,g.role,g.contrast].every(Boolean)||g.examples.length<2||g.examples.some(e=>!e.ja||!e.zh))throw new Error('Incomplete grammar lesson: '+g.key);
  keys.add(g.key);
 }
 for(const [title,ids] of Object.entries(grammarTitleKeys))if(!ids.length||ids.some(k=>!keys.has(k)))throw new Error('Missing lesson for '+title);
 for(const [,title] of patterns)if(!grammarTitleKeys[title])throw new Error('Grammar pattern without explanation: '+title);
 for(const item of Object.values(curated))for(const [,title] of item.g||[])if(!grammarTitleKeys[title])throw new Error('Curated grammar without explanation: '+title);
 return {lessons:grammarLessons,titleKeys:grammarTitleKeys,glossary:grammarGlossary,references:grammarLessonReferences};
}
