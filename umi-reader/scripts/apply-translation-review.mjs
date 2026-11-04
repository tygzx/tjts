import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
export function loadTranslationReview(){return JSON.parse(fs.readFileSync(path.join(root,'data/translation-review.json'),'utf8'));}

// Validate every source span before changing anything. A changed source must be re-reviewed.
export function applyTranslationReview(book,data=loadTranslationReview()){
 const [first,last]=data.range||[];
 if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last>book.lines.length||data.entries.length!==last-first+1)throw new Error('Invalid translation review range');
 const source=[];
 for(const [i,e] of data.entries.entries()){
  if(e.sentence!==first+i||!e.zh?.trim())throw new Error('Missing translation at '+(first+i));
  const actual=book.lines[e.sentence-1].t.map(id=>book.words[id].s).join('');
  if(actual!==e.jp)throw new Error('Translation source mismatch at '+e.sentence);
  source.push(actual);
 }
 if(sha(source.join('\n'))!==data.sourceSha256)throw new Error('Translation review source checksum mismatch');
 for(const e of data.entries){const line=book.lines[e.sentence-1];line.zh=e.zh;line.translationReview={revision:data.revision,...(e.note?{note:e.note}:{})};}
 return {reviewed:data.entries.length,revision:data.revision};
}

export function reviewedGrammar(source,data){
 const start='/* BEGIN GENERATED TRANSLATION REVIEW */',end='/* END GENERATED TRANSLATION REVIEW */';
 const a=source.indexOf(start),b=source.indexOf(end);
 if((a===-1)!==(b===-1)||a!==-1&&b<a)throw new Error('Malformed translation block');
 if(a!==-1)source=source.slice(0,a)+source.slice(b+end.length);
 const entries=data.entries.map(e=>[e.sentence-1,e.zh,{revision:data.revision,...(e.note?{note:e.note}:{})}]);
 return source.trimEnd()+'\n\n'+start+'\n// Keep existing grammar explanations; only replace reviewed translations.\nfor(const [index,zh,translationReview] of '+JSON.stringify(entries)+'){\n window.CURATED[index]={...window.CURATED[index],zh,translationReview};\n}\n'+end+'\n';
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=path.join(root,'dist/book.js'),grammarFile=path.join(root,'dist/grammar.js');
 const book=JSON.parse(fs.readFileSync(file,'utf8').slice(12,-1)),data=loadTranslationReview();
 const report=applyTranslationReview(book,data),grammar=reviewedGrammar(fs.readFileSync(grammarFile,'utf8'),data);
 fs.writeFileSync(file,'window.BOOK='+JSON.stringify(book)+';');
 fs.writeFileSync(grammarFile,grammar);
 console.log(JSON.stringify(report));
}
