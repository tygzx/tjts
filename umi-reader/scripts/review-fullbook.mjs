import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {applyFullbookReview} from './apply-fullbook-review.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function reviewFullbook(book){
 const data=JSON.parse(fs.readFileSync(path.join(root,'data/fullbook-review.json'),'utf8'));
 const text=book.lines.map(l=>l.t.map(id=>book.words[id].s).join('')).join('\n');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 if(hash!==data.sourceSha256)throw Error('The novel source changed; the full-book review must be reconciled before rebuilding.');
 const result=applyFullbookReview(book,data);
 if(!result.report.ok)throw Error('Full-book review could not be applied: '+JSON.stringify(result.report.issues.filter(x=>x.severity==='error')));
 const revised=result.book;
 revised.reviewSummary={version:data.version,...data.coverage,sourceIssues:data.sourceIssues.length};
 for(const issue of data.sourceIssues){
  const line=revised.lines[issue.sentence-1],note=issue.issue||issue.reason;
  line.editorialNotes=[...new Set([...(line.editorialNotes||[]),note])];
  line.notes=[...new Set([...(line.notes||[]),'校勘提示：'+note])];
 }
 Object.assign(book,revised);
 return result.report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const target=path.join(root,'dist/book.js');
 const book=JSON.parse(fs.readFileSync(target,'utf8').slice(12,-1));
 const report=reviewFullbook(book);
 fs.writeFileSync(target,'window.BOOK='+JSON.stringify(book)+';');
 console.log(JSON.stringify({ok:report.ok,...report.stats}));
}
