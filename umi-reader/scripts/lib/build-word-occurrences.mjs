import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Use the same complete learning groups and identity as the clickable reader.
// Build once so a phone never has to analyse the whole novel on a word tap.
export function buildWordOccurrences(root){
 const context=vm.createContext({window:{}});
 for(const file of ['book.js','lesson-notes.js','study-morphology.js','study-expressions.js','study-groups.js','vocabulary.js']){
  vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
 }
 const {BOOK:book,STUDY_GROUPS:study,UMI_VOCABULARY:vocabulary}=context.window;
 const counts=new Map();
 const occurrences=book.lines.map(line=>study.create(book,line).map(group=>{
  if(group.p==='标点')return 0;
  const id=vocabulary.key(group.s,group.k),n=(counts.get(id)||0)+1;
  counts.set(id,n);return n;
 }));
 fs.writeFileSync(path.join(root,'dist/word-occurrences.js'),'window.UMI_WORD_OCCURRENCES='+JSON.stringify(occurrences)+';\n');
 return occurrences;
}
