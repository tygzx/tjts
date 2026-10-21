import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx={window:{},setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('dist/playback.js','utf8'),ctx);
let jobs=[],calls=[],status,clock=0,haltCount=0;
const p=ctx.window.createSentencePlayer({play:(clip,token)=>{calls.push({...clip,token});return null;},halt:()=>haltCount++,changed:s=>status=s,schedule:(fn,ms)=>{const job={fn,ms,id:++clock};jobs.push(job);return job.id;},cancel:id=>jobs=jobs.filter(j=>j.id!==id)});
const done=()=>p.ended('done',calls.at(-1).token),tick=()=>{assert(jobs.length);jobs.shift().fn();};
const clips=[{lang:'ja',text:'海がきこえる。',roleId:'026-taku'},{lang:'zh',text:'听到涛声。',roleId:'zh-026-taku-v1'}];
p.start(clips,{count:3,pause:2});
for(let round=1;round<=3;round++){
 assert.equal(calls.at(-1).lang,'ja');assert.equal(status.round,round);done();assert.equal(jobs[0].ms,650);tick();assert.equal(calls.at(-1).lang,'zh');done();
 if(round<3){assert.equal(jobs[0].ms,2000);tick();}
}
assert.equal(calls.length,6);assert.equal(status,null);assert.equal(jobs.length,0);
assert(calls.filter(c=>c.lang==='ja').every(c=>c.roleId==='026-taku'),'Every repeat keeps the selected character audio');
assert(calls.filter(c=>c.lang==='zh').every(c=>c.roleId==='zh-026-taku-v1'),'Every repeat keeps the exact Chinese emotion recording too');
p.start(clips,{count:0,pause:1});for(let n=0;n<8;n++){done();tick();}assert(status);p.stop();assert.equal(status,null);assert.equal(jobs.length,0);
p.start(clips);const stale=calls.at(-1).token;p.stop();p.start(clips);p.ended('done',stale);assert.equal(jobs.length,0);assert.equal(status.phase,'ja');
done();p.stop();assert.equal(jobs.length,0);p.ended('done',calls.at(-1).token);assert.equal(status,null);
p.start([{lang:'ja',text:'……'}]);assert(status.error);assert.equal(jobs.length,0);
p.start([{lang:'ja',text:'ー'}]);assert(status.error);assert.equal(jobs.length,0);
p.start([{lang:'ja',text:'っ'}]);assert(status.error);assert.equal(jobs.length,0);
p.start(clips);p.ended('error',calls.at(-1).token);assert(status.error);assert.equal(jobs.length,0);
p.start([clips[0]],{count:1});done();assert.equal(status,null);
p.start([{lang:'zh',text:'听到涛声。'}],{count:1});assert.equal(calls.at(-1).roleId,undefined,'Baseline translation is still supported without a new recording');done();assert.equal(status,null);
assert(haltCount>5);
console.log('PASS: Japanese→Chinese order, 3 complete cycles, infinite repetition, pauses, cancellation, stale callbacks, punctuation, errors and single-language completion.');
