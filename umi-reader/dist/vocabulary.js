/* Personal lookup history and practice. Stored with reading progress on this device. */
(()=>{
 'use strict';
 const threshold=3;
 const key=(s,k)=>encodeURIComponent(s.normalize('NFKC'))+'|'+encodeURIComponent(k.normalize('NFKC'));
 const integer=(v,max=100000000)=>Number.isInteger(v)&&v>=0?Math.min(v,max):0;
 const active=e=>!!e&&(e.pinned||e.lookups-e.masteredAt>=threshold);
 function clean(value,total){
  const entries=new Map();
  for(const e of (Array.isArray(value)?value:[]).slice(0,50000)){
   if(!e||typeof e.s!=='string'||!e.s||e.s.length>400||typeof e.k!=='string'||!e.k||e.k.length>600)continue;
   const lookups=integer(e.lookups),seen=[];
   for(const p of Array.isArray(e.seen)?e.seen:[]){
    if(!p||!Number.isInteger(p.line)||p.line<0||p.line>=total||!Number.isInteger(p.offset)||p.offset<0||p.offset>100000||seen.some(x=>x.line===p.line&&x.offset===p.offset))continue;
    seen.push({line:p.line,offset:p.offset});if(seen.length===12)break;
   }
   if(!seen.length)continue;
   const item={s:e.s,k:e.k,lookups,pinned:e.pinned===true,masteredAt:Math.min(lookups,integer(e.masteredAt)),lastSeen:integer(e.lastSeen,8640000000000000),correct:integer(e.correct),wrong:integer(e.wrong),seen};
   const id=key(item.s,item.k);if(!entries.has(id)||entries.get(id).lookups<lookups)entries.set(id,item);
  }
  return [...entries.values()];
 }
 function visit(entries,line,offset,g,count=true,now=Date.now()){
  const id=key(g.s,g.k);let e=entries.find(x=>key(x.s,x.k)===id);
  if(!e){e={s:g.s,k:g.k,lookups:0,pinned:false,masteredAt:0,lastSeen:0,correct:0,wrong:0,seen:[]};entries.push(e);}
  if(count){e.lookups++;e.lastSeen=now;}
  e.seen=[{line,offset},...e.seen.filter(p=>p.line!==line||p.offset!==offset)].slice(0,12);
  return e;
 }
 function master(e){e.pinned=false;e.masteredAt=e.lookups;}
 function answer(e,correct){if(correct)e.correct++;else{e.wrong++;e.pinned=true;}}
 function resolve(book,e){
  for(const p of e.seen){
   const line=book.lines[p.line];if(!line)continue;
   let offset=0;
   for(const g of window.STUDY_GROUPS.create(book,line)){
    if(offset===p.offset&&key(g.s,g.k)===key(e.s,e.k))return {line:p.line,offset,g};
    offset+=g.s.length;
   }
  }
  return null;
 }
 window.UMI_VOCABULARY=Object.freeze({threshold,key,active,clean,visit,master,answer,resolve});
 window.createVocabularyNotebook=function({book,getState,save,showDialog,openSource,stop}){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entries=()=>getState().vocabulary;
  const find=id=>entries().find(e=>key(e.s,e.k)===id);
  const text=line=>book.lines[line].t.map(n=>book.words[n].s).join('');
  let filter='active',order='frequency',limit=40,round=null,preparing=false;
  function counts(){return {tracked:entries().length,active:entries().filter(active).length,lookups:entries().reduce((n,e)=>n+e.lookups,0)};}
  function updateBadges(){document.querySelectorAll('[data-vocab-count]').forEach(el=>{el.textContent=counts().active||'';});}
  function changed(){save();updateBadges();}
  function control(e){
   return '<div class="vocab-word-control" data-vocab-control="'+esc(key(e.s,e.k))+'"><div class="vocab-word-actions"><button class="outline '+(active(e)?'vocab-marked':'')+'" data-vocab-action="toggle" data-vocab-key="'+esc(key(e.s,e.k))+'" aria-pressed="'+active(e)+'">'+(active(e)?'已加入 · 移出复习':'不熟悉，加入生词本')+'</button><button class="vocab-link" data-vocab-action="open">生词本</button></div><small>已查 '+e.lookups+' 次'+(e.pinned?' · 手动加入复习':active(e)?' · 反复查词，已自动加入':' · '+(e.masteredAt?'移出后再查 3 次，会重新加入':'查满 3 次自动加入复习'))+'</small></div>';
  }
  function record(line,offset,g,count=true){const e=visit(entries(),line,offset,g,count);changed();return control(e);}
  function updateControls(){document.querySelectorAll('[data-vocab-control]').forEach(el=>{const e=find(el.dataset.vocabControl);if(e)el.outerHTML=control(e);});}
  function render(body){
   showDialog('vocabulary-dialog','我的生词本',body);
   document.querySelector('#vocabulary-dialog').classList.add('vocabulary-dialog');
  }
  function status(e){return e.pinned?'手动加入':active(e)?'反复查词':e.masteredAt?'已移出复习':'查词记录';}
  function row(e){
   const id=esc(key(e.s,e.k)),source=resolve(book,e),info=source?window.STUDY_GROUPS.describe(source.g):null;
   const sentence=source?text(source.line):'';
   const context=source?esc(sentence.slice(0,source.offset))+'<mark>'+esc(source.g.s)+'</mark>'+esc(sentence.slice(source.offset+source.g.s.length)):'';
   return '<article class="vocab-row"><div class="vocab-row-top"><div><strong lang="ja">'+esc(e.s)+'</strong><span lang="ja">'+esc(e.k)+'</span></div><b class="vocab-frequency">查了 '+e.lookups+' 次</b></div><p class="vocab-meta">'+status(e)+(e.correct||e.wrong?' · 练习答对 '+e.correct+' 次 / 答错 '+e.wrong+' 次':'')+'</p><details><summary>原句与释义</summary>'+(source?'<p lang="ja" class="vocab-source">'+context+'</p><p>'+esc(info.definition)+'</p><button class="outline" data-vocab-action="source" data-vocab-key="'+id+'">回到第 '+(source.line+1)+' 句</button>':'<p>这条记录的原文位置已变化，暂时无法定位。</p>')+'</details><div class="vocab-row-actions"><button class="vocab-link" data-vocab-action="toggle" data-vocab-key="'+id+'">'+(active(e)?'已熟悉，移出复习':'加入重点复习')+'</button></div></article>';
  }
  function list(){
   const c=counts(),all=entries().filter(e=>filter==='all'||active(e)).slice().sort((a,b)=>order==='recent'?b.lastSeen-a.lastSeen:b.lookups-a.lookups||b.wrong-a.wrong||b.lastSeen-a.lastSeen);
   render('<p class="vocab-intro">继续往后读就好。点开一个词的释义记 1 次，同词同读音合并计数；查满 3 次自动加入重点复习，也能手动加入。</p><div class="vocab-stats"><span><b>'+c.active+'</b> 个待复习</span><span><b>'+c.tracked+'</b> 个查过的词</span><span><b>'+c.lookups+'</b> 次查词</span></div><div class="vocab-list-tools"><div role="group" aria-label="生词本范围"><button class="toggle '+(filter==='active'?'on':'')+'" aria-pressed="'+(filter==='active')+'" data-vocab-action="active">重点复习</button><button class="toggle '+(filter==='all'?'on':'')+'" aria-pressed="'+(filter==='all')+'" data-vocab-action="all">全部查词记录</button></div><label>排序 <select data-vocab-order aria-label="生词排序"><option value="frequency" '+(order==='frequency'?'selected':'')+'>查词次数最多</option><option value="recent" '+(order==='recent'?'selected':'')+'>最近查过</option></select></label></div><button class="primary vocab-practice-start" data-vocab-action="practice" '+(!c.active?'disabled':'')+'>只练不熟悉的词</button><p class="hint">每轮最多 10 题，全是点击选择；题目与选项随机。答错的词保留复习，答对不会自动替你移出。</p><div class="vocab-list">'+(all.length?all.slice(0,limit).map(row).join(''):'<p class="vocab-empty">'+(filter==='active'?'还没有待复习的词。读书时点「不熟悉，加入生词本」，或重复查同一个词 3 次。':'从本次更新开始记录。先回小说点开一个不认识的词吧。')+'</p>')+'</div>'+(all.length>limit?'<button class="outline" data-vocab-action="more">再显示 40 个</button>':'')+'<p class="vocab-storage-note">统计从本次更新开始，保存在当前设备。悬停、朗读和复习答题不增加查词次数；导出进度时会一并备份。</p>');
  }
  function open(){stop();document.querySelector('#word-dialog[open]')?.close();filter='active';limit=40;round=null;list();}
  function start(only=null){
   if(preparing)return;
   const target=entries().filter(e=>active(e)&&(!only||only.has(key(e.s,e.k))));if(!target.length){list();return;}
   preparing=true;render('<p role="status">正在准备你的复习题…</p>');
   setTimeout(()=>{
    preparing=false;if(!document.querySelector('#vocabulary-dialog[open]'))return;
    const questions=window.SENTENCE_QUIZ.vocabulary(book,target,{limit:10});
    round={questions,at:0,answers:{}};
    if(!questions.length){render('<p>这些词暂时没有合适的选择题，可以先查看原句和释义。</p><button class="outline" data-vocab-action="list">回到生词本</button>');return;}
    practice();
   },20);
  }
  function practice(){
   const q=round.questions[round.at],answered=q&&Object.hasOwn(round.answers,q.id);
   if(!q){
    const asked=round.questions.filter(q=>Object.hasOwn(round.answers,q.id)),correct=asked.filter(q=>round.answers[q.id]===q.answerId),wrong=asked.length-correct.length;
    render('<div class="vocab-round-end"><p class="hint">这一轮完成了</p><h3>答对 '+correct.length+' / '+asked.length+' 题</h3><p>继续读书也可以。需要时再回来练一轮。</p></div><div class="vocab-end-actions"><button class="primary" data-vocab-action="practice">再随机练一组</button>'+(wrong?'<button class="outline" data-vocab-action="retry">只练本轮错词</button>':'')+'<button class="outline" data-vocab-action="list">回到生词本</button></div>');return;
   }
   const e=find(q.vocabKey),answerText=q.choices.find(c=>c.id===q.answerId).text;
   render('<div class="quiz-topline"><span>第 '+(round.at+1)+' / '+round.questions.length+' 题 · '+({reading:'读音',meaning:'词义',base:'原形',recall:'原句回忆'}[q.kind]||'理解')+'</span><button class="vocab-link" data-vocab-action="list">回到生词本</button></div><p class="vocab-meta">这个词查过 '+(e?.lookups||0)+' 次</p><h3 class="vocab-question">'+esc(q.prompt)+'</h3><p class="quiz-focus" lang="ja">'+esc(q.focus)+'</p><p class="quiz-context" lang="ja">'+esc(q.context)+'</p><div class="quiz-choices">'+q.choices.map((c,i)=>'<button class="quiz-choice '+(answered?(c.id===q.answerId?'correct':c.id===round.answers[q.id]?'incorrect':''):'')+'" data-vocab-action="answer" data-vocab-answer="'+esc(c.id)+'" '+(answered?'disabled':'')+'><span class="quiz-letter">'+String.fromCharCode(65+i)+'</span><span>'+esc(c.text)+'</span></button>').join('')+'</div><div class="quiz-feedback" role="status" aria-live="polite">'+(answered?'<strong>'+ (round.answers[q.id]===q.answerId?'答对了':'这题再记一下')+'</strong><p>正确答案：'+esc(answerText)+'</p><p>'+esc(q.explanation)+'</p>':'')+'</div><div class="vocab-practice-actions">'+(answered?'<button class="outline" data-vocab-action="master-next">这个词已熟悉，移出</button>':'')+'<button class="primary" data-vocab-action="next" '+(!answered?'disabled':'')+'>'+(round.at===round.questions.length-1?'查看结果':'下一题')+'</button></div>');
  }
  function next(){
   do{round.at++;}while(round.at<round.questions.length&&!active(find(round.questions[round.at].vocabKey)));
   practice();
  }
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-vocab-action]');if(!button||button.disabled)return;
   const action=button.dataset.vocabAction,e=find(button.dataset.vocabKey);
   if(action==='open'){open();return;}
   if(action==='toggle'&&e){if(active(e))master(e);else e.pinned=true;changed();updateControls();if(button.closest('#vocabulary-dialog'))list();return;}
   if(action==='source'&&e){const source=resolve(book,e);if(source){document.querySelector('#vocabulary-dialog')?.close();openSource(source);}return;}
   if(action==='active'||action==='all'){filter=action;limit=40;list();return;}
   if(action==='more'){limit+=40;list();return;}
   if(action==='list'){round=null;list();return;}
   if(action==='practice'){start();return;}
   if(action==='retry'&&round){start(new Set(round.questions.filter(q=>Object.hasOwn(round.answers,q.id)&&round.answers[q.id]!==q.answerId).map(q=>q.vocabKey)));return;}
   const q=round?.questions[round.at];if(!q)return;
   if(action==='answer'&&!Object.hasOwn(round.answers,q.id)&&q.choices.some(c=>c.id===button.dataset.vocabAnswer)){
    round.answers[q.id]=button.dataset.vocabAnswer;const entry=find(q.vocabKey);if(entry)answer(entry,button.dataset.vocabAnswer===q.answerId);changed();practice();return;
   }
   if((action==='next'||action==='master-next')&&Object.hasOwn(round.answers,q.id)){
    if(action==='master-next'){const entry=find(q.vocabKey);if(entry)master(entry);changed();}next();
   }
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-vocab-order]')){order=e.target.value==='recent'?'recent':'frequency';list();}});
  return {record,open,counts,updateBadges};
 };
})();
