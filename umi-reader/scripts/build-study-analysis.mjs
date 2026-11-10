import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/grammar-analysis.json'),'utf8')),c={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'dist/book.js'),'utf8'),c);
for(const e of data.sentences){
 const line=c.window.BOOK.lines[e.sentence-1],source=line.t.map(id=>c.window.BOOK.words[id].s).join('');
 if(source!==e.jp)throw new Error('Grammar source changed: '+e.sentence);
 for(const item of e.items)if(source.slice(item.start,item.end)!==item.quote||!item.steps.length)throw new Error('Grammar span mismatch: '+e.sentence+' '+item.quote);
 if(e.guide&&!e.guide.trim())throw new Error('Empty guide: '+e.sentence);
}
const keys=new Set((data.particleHandbook||[]).map(x=>x.key));
for(const entry of data.sentences)for(const item of entry.items)for(const key of item.particleKeys||[])if(!keys.has(key))throw new Error('Missing handbook entry: '+key);
const file=path.join(root,'dist/study-groups.js'),marker='/* BEGIN GENERATED STUDY ANALYSIS */';
const base=fs.readFileSync(file,'utf8').split(marker)[0].trimEnd();
const runtime=fs.readFileSync(path.join(root,'scripts/lib/study-analysis-runtime.js'),'utf8').replace('const DATA=null; // @data','const DATA='+JSON.stringify(data)+';');
new vm.Script(runtime);
fs.writeFileSync(file,base+'\n\n'+marker+'\n'+runtime);
console.log('Built',data.sentences.length,'contextual sentence analyses');
