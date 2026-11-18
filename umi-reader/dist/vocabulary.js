/* Personal lookup history and practice. Stored with reading progress on this device. */
(()=>{
 'use strict';
 const threshold=9;
 const noteLimit=2000;
 const screenshots=window.UMI_NOTE_IMAGES;
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
   const item={s:e.s,k:e.k,lookups,pinned:e.pinned===true,masteredAt:Math.min(lookups,integer(e.masteredAt)),lastSeen:integer(e.lastSeen,8640000000000000),correct:integer(e.correct),wrong:integer(e.wrong),note:typeof e.note==='string'?e.note.slice(0,noteLimit):'',seen};
   if(screenshots&&Array.isArray(e.noteImages)){
    const ids=[...new Set(e.noteImages.filter(screenshots.isId))].slice(0,screenshots.maxPerNote);
    if(ids.length)item.noteImages=ids;
   }
   const id=key(item.s,item.k);if(!entries.has(id)||entries.get(id).lookups<lookups)entries.set(id,item);
  }
  return [...entries.values()];
 }
 function visit(entries,line,offset,g,count=true,now=Date.now()){
  const id=key(g.s,g.k);let e=entries.find(x=>key(x.s,x.k)===id);
  if(!e){e={s:g.s,k:g.k,lookups:0,pinned:false,masteredAt:0,lastSeen:0,correct:0,wrong:0,note:'',seen:[]};entries.push(e);}
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
 window.UMI_VOCABULARY=Object.freeze({threshold,noteLimit,key,active,clean,visit,master,answer,resolve});
 window.createVocabularyNotebook=function({book,getState,save,showDialog,openSource,stop,notify=()=>{}}){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const markdown=typeof window.markdownit==='function'
   ? window.markdownit({html:false,linkify:false,breaks:true}).disable(['image','link','autolink'])
   : null;
  const entries=()=>getState().vocabulary;
  const find=id=>entries().find(e=>key(e.s,e.k)===id);
  const text=line=>book.lines[line].t.map(n=>book.words[n].s).join('');
  let filter='active',order='frequency',limit=40,round=null,preparing=false,noteId=0;
  const unsavedNotes=new Set();
  const addingImages=new Set();
  let pendingPicker=null;
  function counts(){return {tracked:entries().length,active:entries().filter(active).length,lookups:entries().reduce((n,e)=>n+e.lookups,0)};}
  function updateBadges(){document.querySelectorAll('[data-vocab-count]').forEach(el=>{el.textContent=counts().active||'';});}
  function persist(){const saved=save()!==false;if(saved)unsavedNotes.clear();return saved;}
  function changed(){persist();updateBadges();}
  function control(e){
   const inReview=active(e);
   let reviewMessage='查满 '+threshold+' 次自动加入复习';
   if(e.pinned)reviewMessage='手动加入复习';
   else if(inReview)reviewMessage='反复查词，已自动加入';
   else if(e.masteredAt)reviewMessage='移出后再查 '+threshold+' 次，会重新加入';
   const wordKey=esc(key(e.s,e.k));
   return '<div class="vocab-word-control" data-vocab-control="'+wordKey+'">'+
    '<div class="vocab-word-actions"><button class="outline '+(inReview?'vocab-marked':'')+'" data-vocab-action="toggle" data-vocab-key="'+wordKey+'" aria-pressed="'+inReview+'">'+(inReview?'已加入 · 移出复习':'不熟悉，加入生词本')+'</button>'+
    '<button class="vocab-link" data-vocab-action="open">生词本</button></div>'+
    '<small>已查 '+e.lookups+' 次 · '+reviewMessage+'</small></div>';
  }
  function record(line,offset,g,count=true){const e=visit(entries(),line,offset,g,count);changed();return control(e);}
  function hasNote(e){return !!(e?.note?.trim()||e?.noteImages?.length);}
  function noteSummary(e){
   const count=e.noteImages?.length||0,hasText=!!e.note?.trim();
   return count?(hasText?'已写笔记 · ':'')+count+' 张截图':hasText?'已写笔记':'写下自己的理解';
  }
  function renderNote(note,withImages=false){
   if(!note.trim())return withImages?'':'<p class="vocab-note-empty">还没有笔记。</p>';
   return markdown?markdown.render(note):'<p class="vocab-note-plain">'+esc(note)+'</p>';
  }
  function galleryHTML(e,editable=false){
   if(!screenshots||!editable&&!e.noteImages?.length)return '';
   return '<div class="vocab-note-gallery" data-note-gallery="'+esc(key(e.s,e.k))+'"'+(editable?' data-note-gallery-editable':'')+'></div>';
  }
  function imageControls(e){
   const full=e.noteImages?.length>=screenshots.maxPerNote;
   const help=full?'已附 '+screenshots.maxPerNote+' 张':window.Android?.chooseNoteImage?'':'也可在编辑框中粘贴截图';
   return '<div class="vocab-image-tools"><button type="button" class="outline" data-vocab-action="pick-image" '+(full?'disabled':'')+'>添加截图</button>'+
    '<input type="file" accept="'+screenshots.accepted+'" multiple data-note-file hidden>'+
    '<small data-note-image-status role="status">'+help+'</small></div>';
  }
  function noteEditor(e,expanded=false){
   const note=e.note||'',id='vocab-note-'+(++noteId),wordKey=key(e.s,e.k);
   const filled=hasNote(e),unsaved=unsavedNotes.has(wordKey),showPreview=filled&&!unsaved;
   const status=unsaved?'未能保存，请先复制笔记或重试':filled?'已保存到本机':'输入后自动保存到本机';
   return '<details class="vocab-note-editor" data-note-mode="'+(showPreview?'preview':'edit')+'" '+(expanded&&filled?'open':'')+'>'+
    '<summary><span>我的笔记</span><small data-note-summary>'+noteSummary(e)+'</small></summary>'+
    '<div class="vocab-note-body"><div class="vocab-note-toolbar">'+
    '<div class="vocab-note-switch" role="group" aria-label="笔记显示方式">'+
    '<button type="button" data-vocab-action="note-view" data-note-view="edit" aria-pressed="'+!showPreview+'">编辑</button>'+
    '<button type="button" data-vocab-action="note-view" data-note-view="preview" aria-pressed="'+showPreview+'">预览</button></div>'+
    '<small>支持 Markdown</small></div>'+
    '<div data-note-edit '+(showPreview?'hidden':'')+'>'+
    '<label class="screen-only" for="'+id+'">我的笔记：'+esc(e.s)+'</label>'+
    '<textarea id="'+id+'" data-vocab-note="'+esc(wordKey)+'" rows="4" maxlength="'+noteLimit+'" spellcheck="false" placeholder="写笔记或粘贴 Markdown，例如 **加粗**、- 列表。">\n'+esc(note)+'</textarea></div>'+
    '<div class="vocab-note-markdown study-prose" data-note-preview '+(showPreview?'':'hidden')+'>'+(showPreview?renderNote(note,!!e.noteImages?.length):'')+'</div>'+
    galleryHTML(e,true)+(screenshots?imageControls(e):'')+
    '<div class="vocab-note-footer"><span data-note-status role="status" aria-live="polite" class="'+(unsaved?'note-save-error':'')+'">'+status+'</span>'+
    '<span data-note-count>'+note.length+' / '+noteLimit+'</span></div>'+
    '<button class="vocab-link" data-vocab-action="retry-note" '+(unsaved?'':'hidden')+'>重试保存</button></div></details>';
  }
  function showNoteView(button){
   const editor=button.closest('.vocab-note-editor');
   const previewing=button.dataset.noteView==='preview';
   const input=editor.querySelector('[data-vocab-note]');
   const preview=editor.querySelector('[data-note-preview]');
   if(previewing)preview.innerHTML=renderNote(input.value,!!find(input.dataset.vocabNote)?.noteImages?.length);
   editor.dataset.noteMode=button.dataset.noteView;
   editor.querySelector('[data-note-edit]').hidden=previewing;
   preview.hidden=!previewing;
   for(const toggle of editor.querySelectorAll('[data-note-view]')){
    toggle.setAttribute('aria-pressed',String(toggle===button));
   }
   if(!previewing)input.focus();
  }
  function noteHTML(s,k){const e=find(key(s,k));return e?noteEditor(e,true):'';}
  function saveNote(input){
   const e=find(input.dataset.vocabNote);if(!e)return;
   e.note=input.value.slice(0,noteLimit);
   // Save each input immediately: closing the dialog or leaving the app must
   // not discard the last keystrokes or a completed Chinese IME composition.
   const saved=persist(),editor=input.closest('.vocab-note-editor'),message=saved?'已保存到本机':'未能保存，请先复制笔记或重试';
   if(!saved)unsavedNotes.add(key(e.s,e.k));
   const status=editor.querySelector('[data-note-status]');if(status.textContent!==message)status.textContent=message;
   status.classList.toggle('note-save-error',!saved);
   editor.querySelector('[data-note-count]').textContent=e.note.length+' / '+noteLimit;
   editor.querySelector('[data-note-summary]').textContent=noteSummary(e);
   editor.querySelector('[data-vocab-action="retry-note"]').hidden=saved;
  }
  function practiceNote(e,answered){
   if(!hasNote(e))return '';
   return '<details class="vocab-practice-note" '+(answered?'open':'')+'><summary>'+(answered?'我的笔记':'看我的笔记（提示）')+'</summary>'+
    '<div class="study-prose">'+renderNote(e.note||'',!!e.noteImages?.length)+'</div>'+galleryHTML(e)+'</details>';
  }
  async function renderGallery(gallery){
   const entry=find(gallery.dataset.noteGallery);
   const ids=entry?.noteImages;
   if(!ids?.length){gallery.replaceChildren();return;}
   let records=[];
   try{records=await screenshots.read(ids);}catch{}
   if(!gallery.isConnected||find(gallery.dataset.noteGallery)?.noteImages!==ids)return;
   const data=new Map(records.map(record=>[record.id,record.data]));
   gallery.innerHTML=ids.map((id,index)=>{
    const number=index+1;
    const image=data.get(id);
    const preview=image
     ? '<button type="button" class="vocab-image-preview" data-vocab-action="view-image" data-image-id="'+id+'" aria-label="放大截图 '+number+'"><img src="'+image+'" alt="截图 '+number+'"></button>'
     : '<p class="hint">这张截图暂时无法读取。</p>';
    const remove=gallery.hasAttribute('data-note-gallery-editable')
     ? '<button type="button" class="vocab-link vocab-image-remove" data-vocab-action="remove-image" data-image-id="'+id+'" aria-label="移除截图 '+number+'">移除</button>'
     : '';
    return '<figure>'+preview+remove+'</figure>';
   }).join('');
  }
  function loadImages(container){
   if(screenshots)for(const gallery of container.querySelectorAll('[data-note-gallery]'))renderGallery(gallery);
  }
  function refreshImages(entry){
   const wordKey=key(entry.s,entry.k);
   for(const gallery of document.querySelectorAll('[data-note-gallery]')){
    if(gallery.dataset.noteGallery!==wordKey)continue;
    const editor=gallery.closest('.vocab-note-editor');
    if(editor){
     editor.querySelector('[data-note-summary]').textContent=noteSummary(entry);
     editor.querySelector('[data-vocab-action="pick-image"]').disabled=entry.noteImages?.length>=screenshots.maxPerNote;
     if(!entry.note?.trim()){
      editor.querySelector('[data-note-preview]').innerHTML=renderNote('',!!entry.noteImages?.length);
      if(!unsavedNotes.has(wordKey))editor.querySelector('[data-note-status]').textContent=hasNote(entry)?'已保存到本机':'输入后自动保存到本机';
     }
    }
    renderGallery(gallery);
   }
  }
  function imageStatus(editor,message,error=false){
   if(editor.isConnected&&editor.closest('dialog')?.open){
    const status=editor.querySelector('[data-note-image-status]');
    status.textContent=message;
    status.classList.toggle('note-image-error',error);
   }else if(error)notify(message);
  }
  async function attachImages(editor,files){
   const wordKey=editor.querySelector('[data-vocab-note]').dataset.vocabNote,entry=find(wordKey);
   if(!entry||addingImages.has(wordKey)||!files.length)return;
   const remaining=screenshots.maxPerNote-(entry.noteImages?.length||0);
   if(files.length>remaining){
    imageStatus(editor,remaining?'这条笔记还可以添加 '+remaining+' 张截图。':'一条笔记最多附 8 张截图。',true);
    return;
   }
   addingImages.add(wordKey);
   imageStatus(editor,'正在保存截图…');
   const records=[];
   let wroteImages=false;
   try{
    for(const file of files){
     const data=typeof file==='string'?file:await screenshots.prepare(file);
     if(!screenshots.validData(data))throw new Error('无法读取这张截图。');
     records.push({id:screenshots.createId(),data});
    }
    await screenshots.save(records);
    wroteImages=true;
    if(find(wordKey)!==entry)throw new Error('这条笔记已经更换，请重新添加截图。');
    const previous=entry.noteImages;
    entry.noteImages=[...(previous||[]),...records.map(record=>record.id)];
    if(!persist()){
     entry.noteImages=previous;
     throw new Error('截图未能保存，请检查设备存储空间。');
    }
   }catch(error){
    if(wroteImages)await screenshots.remove(records.map(record=>record.id)).catch(()=>{});
    const message=error instanceof DOMException?'截图未能保存，请检查设备存储空间。':error.message;
    imageStatus(editor,message,true);
    return;
   }finally{
    addingImages.delete(wordKey);
   }
   refreshImages(entry);
   imageStatus(editor,'截图已保存到本机');
  }
  function chooseImage(editor){
   if(typeof window.Android?.chooseNoteImage!=='function'){
    editor.querySelector('[data-note-file]').click();
    return;
   }
   if(pendingPicker)return;
   const token=screenshots.createId();
   pendingPicker={editor,token};
   window.Android.chooseNoteImage(token);
  }
  window.onNativeNoteImage=(token,data,error)=>{
   if(pendingPicker?.token!==token)return;
   const {editor}=pendingPicker;
   pendingPicker=null;
   if(error)imageStatus(editor,error,true);
   else if(data)attachImages(editor,[data]);
  };
  function removeImage(button){
   const gallery=button.closest('[data-note-gallery]'),entry=find(gallery.dataset.noteGallery);
   const id=button.dataset.imageId,previous=entry?.noteImages;
   if(!previous?.includes(id)||addingImages.has(gallery.dataset.noteGallery))return;
   entry.noteImages=previous.filter(value=>value!==id);
   if(!persist()){
    entry.noteImages=previous;
    return;
   }
   if(!entries().some(e=>e.noteImages?.includes(id)))screenshots.remove([id]).catch(()=>{});
   refreshImages(entry);
   imageStatus(gallery.closest('.vocab-note-editor'),'已移除截图');
  }
  function viewImage(button){
   const image=button.querySelector('img');
   if(!image)return;
   showDialog('note-image-dialog','笔记截图','<img class="vocab-image-full" src="'+esc(image.src)+'" alt="'+esc(image.alt)+'">');
  }
  function updateControls(){document.querySelectorAll('[data-vocab-control]').forEach(el=>{const e=find(el.dataset.vocabControl);if(e)el.outerHTML=control(e);});}
  function render(body){
   showDialog('vocabulary-dialog','我的生词本',body);
   const dialog=document.querySelector('#vocabulary-dialog');
   dialog.classList.add('vocabulary-dialog');
   loadImages(dialog);
  }
  function status(e){return e.pinned?'手动加入':active(e)?'反复查词':e.masteredAt?'已移出复习':'查词记录';}
  function row(e){
   const id=esc(key(e.s,e.k)),source=resolve(book,e),info=source?window.STUDY_GROUPS.describe(source.g):null;
   const sentence=source?text(source.line):'';
   const context=source?esc(sentence.slice(0,source.offset))+'<mark>'+esc(source.g.s)+'</mark>'+esc(sentence.slice(source.offset+source.g.s.length)):'';
   return '<article class="vocab-row"><div class="vocab-row-top"><div><strong lang="ja">'+esc(e.s)+'</strong><span lang="ja">'+esc(e.k)+'</span></div><b class="vocab-frequency">查了 '+e.lookups+' 次</b></div><p class="vocab-meta">'+status(e)+(e.correct||e.wrong?' · 练习答对 '+e.correct+' 次 / 答错 '+e.wrong+' 次':'')+'</p><details><summary>原句与释义</summary>'+(source?'<p lang="ja" class="vocab-source">'+context+'</p><p>'+esc(info.definition)+'</p><button class="outline" data-vocab-action="source" data-vocab-key="'+id+'">回到第 '+(source.line+1)+' 句</button>':'<p>这条记录的原文位置已变化，暂时无法定位。</p>')+'</details>'+noteEditor(e,filter==='notes')+'<div class="vocab-row-actions"><button class="vocab-link" data-vocab-action="toggle" data-vocab-key="'+id+'">'+(active(e)?'已熟悉，移出复习':'加入重点复习')+'</button></div></article>';
  }
  function list(){
   const c=counts(),all=entries().filter(e=>filter==='all'||(filter==='notes'?hasNote(e):active(e))).slice().sort((a,b)=>order==='recent'?b.lastSeen-a.lastSeen:b.lookups-a.lookups||b.wrong-a.wrong||b.lastSeen-a.lastSeen);
   render('<p class="vocab-intro">继续往后读就好。点开一个词的释义记 1 次，同词同读音合并计数；查满 '+threshold+' 次自动加入重点复习，也能手动加入。</p><div class="vocab-stats"><span><b>'+c.active+'</b> 个待复习</span><span><b>'+c.tracked+'</b> 个查过的词</span><span><b>'+c.lookups+'</b> 次查词</span></div><div class="vocab-list-tools"><div role="group" aria-label="生词本范围"><button class="toggle '+(filter==='active'?'on':'')+'" aria-pressed="'+(filter==='active')+'" data-vocab-action="active">重点复习</button><button class="toggle '+(filter==='all'?'on':'')+'" aria-pressed="'+(filter==='all')+'" data-vocab-action="all">全部查词记录</button><button class="toggle '+(filter==='notes'?'on':'')+'" aria-pressed="'+(filter==='notes')+'" data-vocab-action="notes">有笔记</button></div><label>排序 <select data-vocab-order aria-label="生词排序"><option value="frequency" '+(order==='frequency'?'selected':'')+'>查词次数最多</option><option value="recent" '+(order==='recent'?'selected':'')+'>最近查过</option></select></label></div><button class="primary vocab-practice-start" data-vocab-action="practice" '+(!c.active?'disabled':'')+'>只练不熟悉的词</button><p class="hint">每轮最多 10 题，全是点击选择；题目与选项随机。答错的词保留复习，答对不会自动替你移出。</p><div class="vocab-list">'+(all.length?all.slice(0,limit).map(row).join(''):'<p class="vocab-empty">'+(filter==='active'?'还没有待复习的词。读书时点「不熟悉，加入生词本」，或重复查同一个词 '+threshold+' 次。':filter==='notes'?'还没有自己的笔记。查词时展开「我的笔记」，写下你自己的理解吧。':'从本次更新开始记录。先回小说点开一个不认识的词吧。')+'</p>')+'</div>'+(all.length>limit?'<button class="outline" data-vocab-action="more">再显示 40 个</button>':'')+'<p class="vocab-storage-note">统计从本次更新开始，保存在当前设备。悬停、朗读和复习答题不增加查词次数；导出进度时会一并备份。</p>');
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
   render('<div class="quiz-topline"><span>第 '+(round.at+1)+' / '+round.questions.length+' 题 · '+({reading:'读音',meaning:'词义',base:'原形',recall:'原句回忆'}[q.kind]||'理解')+'</span><button class="vocab-link" data-vocab-action="list">回到生词本</button></div><p class="vocab-meta">这个词查过 '+(e?.lookups||0)+' 次</p><h3 class="vocab-question">'+esc(q.prompt)+'</h3><p class="quiz-focus" lang="ja">'+esc(q.focus)+'</p><p class="quiz-context" lang="ja">'+esc(q.context)+'</p>'+practiceNote(e,answered)+'<div class="quiz-choices">'+q.choices.map((c,i)=>'<button class="quiz-choice '+(answered?(c.id===q.answerId?'correct':c.id===round.answers[q.id]?'incorrect':''):'')+'" data-vocab-action="answer" data-vocab-answer="'+esc(c.id)+'" '+(answered?'disabled':'')+'><span class="quiz-letter">'+String.fromCharCode(65+i)+'</span><span>'+esc(c.text)+'</span></button>').join('')+'</div><div class="quiz-feedback" role="status" aria-live="polite">'+(answered?'<strong>'+ (round.answers[q.id]===q.answerId?'答对了':'这题再记一下')+'</strong><p>正确答案：'+esc(answerText)+'</p><p>'+esc(q.explanation)+'</p>':'')+'</div><div class="vocab-practice-actions">'+(answered?'<button class="outline" data-vocab-action="master-next">这个词已熟悉，移出</button>':'')+'<button class="primary" data-vocab-action="next" '+(!answered?'disabled':'')+'>'+(round.at===round.questions.length-1?'查看结果':'下一题')+'</button></div>');
  }
  function next(){
   do{round.at++;}while(round.at<round.questions.length&&!active(find(round.questions[round.at].vocabKey)));
   practice();
  }
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-vocab-action]');if(!button||button.disabled)return;
   const action=button.dataset.vocabAction;
   if(action==='note-view'){showNoteView(button);return;}
   if(action==='pick-image'){chooseImage(button.closest('.vocab-note-editor'));return;}
   if(action==='view-image'){viewImage(button);return;}
   if(action==='remove-image'){removeImage(button);return;}
   const e=find(button.dataset.vocabKey);
   if(action==='retry-note'){saveNote(button.closest('.vocab-note-editor').querySelector('[data-vocab-note]'));return;}
   if(action==='open'){open();return;}
   if(action==='toggle'&&e){if(active(e))master(e);else e.pinned=true;changed();updateControls();if(button.closest('#vocabulary-dialog'))list();return;}
   if(action==='source'&&e){const source=resolve(book,e);if(source){document.querySelector('#vocabulary-dialog')?.close();openSource(source);}return;}
   if(['active','all','notes'].includes(action)){filter=action;limit=40;list();return;}
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
  document.addEventListener('change',e=>{
   if(e.target.matches('[data-vocab-order]')){order=e.target.value==='recent'?'recent':'frequency';list();}
   if(e.target.matches('[data-note-file]')){
    const files=Array.from(e.target.files);
    e.target.value='';
    attachImages(e.target.closest('.vocab-note-editor'),files);
   }
  });
  document.addEventListener('paste',event=>{
   if(!screenshots||!event.target.matches('[data-vocab-note]'))return;
   const files=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/'));
   if(!files.length)return;
   event.preventDefault();
   attachImages(event.target.closest('.vocab-note-editor'),files);
  });
  for(const type of ['input','compositionend'])document.addEventListener(type,e=>{if(e.target.matches('[data-vocab-note]'))saveNote(e.target);});
  return {record,open,counts,updateBadges,noteHTML,loadImages};
 };
})();
