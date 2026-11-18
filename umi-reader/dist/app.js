/* Shared Android and web reader. Local content and recordings; no analytics. */
(() => {
 'use strict';
 const B=window.BOOK, W=B.words, $=s=>document.querySelector(s), native=window.Android, textOnly=window.UMI_TEXT_ONLY===true;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={book:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z M12 6v15',audio:'M11 4 6 8H3v8h3l5 4z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14',play:'m8 4 12 8-12 8z',stop:'M5 5h14v14H5z',next:'m9 5 7 7-7 7',prev:'m15 5-7 7 7 7',check:'m5 12 4 4L19 6',close:'m6 6 12 12 M6 18 18 6',menu:'M4 6h16 M4 12h16 M4 18h16',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',down:'m6 9 6 6 6-6'};
 const icon=(n)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]||icons.book}"/></svg>`;
 let novelReader=null,vocabulary=null;
 let state={readingMode:'study',novelRuby:false,novelFont:22,novelPosition:null,index:0,done:[],ruby:true,romaji:true,kana:false,meaning:true,quizDifficulty:'challenge',segmented:false,sentenceMode:'chunks',illustrations:true,roleVoices:true,rate:1,voice:'',sentencePlayback:{}}, storageOK=true;
 try {Object.assign(state,JSON.parse(native?native.readState():localStorage.getItem('umi-progress-v1'))||{});}catch(e){storageOK=false;}
 state.index=Math.max(0,Math.min(B.lines.length-1,Number(state.index)||0));
 state.readingMode=state.readingMode==='novel'?'novel':'study';
 state.novelRuby=state.novelRuby===true;
 state.novelFont=[18,20,22,24,26,28,30].includes(state.novelFont)?state.novelFont:22;
 state.vocabulary=window.UMI_VOCABULARY?.clean(state.vocabulary,B.lines.length)||[];
 state.segmented=state.segmented===true;
 state.sentenceMode=state.sentenceMode==='words'?'words':'chunks';
 state.meaning=state.meaning!==false;
 state.quizDifficulty=state.quizDifficulty==='basic'?'basic':'challenge';
 state.done=Array.isArray(state.done)?[...new Set(state.done.filter(n=>Number.isInteger(n)&&n>=0&&n<B.lines.length))]:[];
 state.rate=[.6,.8,1].includes(Number(state.rate))?Number(state.rate):.8;
 if(state.audioVersion!==2){state.rate=1;state.voice='';state.audioVersion=2;}
 if(!state.sentencePlayback||typeof state.sentencePlayback!=='object'||Array.isArray(state.sentencePlayback))state.sentencePlayback={};
 let playbackStatus='',pendingImport=null,activePlayback=null,quizRound=null;
 let walkAt=0,walkAll=false;
 let tab='words',selected=-1,translation=false,sidebar=false,playing=false,voiceMessage='',kanaTab='basic',contextPage=null,toastTimer,groups=[];
 const recorded=!textOnly&&!native&&window.createRecordedAudio?window.createRecordedAudio({getRate:()=>state.rate,ended:(status,token)=>player.ended(status,token)}):null;
 const save=()=>{try {const s=JSON.stringify(state);if(native)native.writeState(s);else localStorage.setItem('umi-progress-v1',s);}catch(e){storageOK=false;toast('无法保存进度，请检查设备存储空间。');}};
 const lineText=i=>B.lines[i].t.map(n=>W[n].s).join('');
 const section=()=>B.sections.findLast?B.sections.findLast(s=>s.start<=state.index):[...B.sections].reverse().find(s=>s.start<=state.index);
 function makeGroups(line){
  const result=window.STUDY_GROUPS.create(B,line);
  result.forEach((g,i)=>{g.r=wanakana.toRomaji(g.k)||'（促音停顿）';g.i=i;});return result;
 }
 // Resolve hover and click against the same expression boundaries. Build only
 // the paragraph being inspected, not every paragraph in a reading section.
 let novelWordCache=null;
 function novelWordAt(line,offset){
  if(novelWordCache?.line!==line){
   let start=0;
   const words=makeGroups(B.lines[line]);
   novelWordCache={line,words,ranges:words.map(g=>{const range={g,start,end:start+g.s.length};start=range.end;return range;})};
  }
  const found=novelWordCache.ranges.find(r=>offset>=r.start&&offset<r.end);
  return found?{...found,words:novelWordCache.words}:null;
 }
 function meaningHTML(g){
  if(!state.meaning)return '';
  const {definition}=window.STUDY_GROUPS.describe(g);
  return `<span class="jp-reading jp-meaning" lang="zh-CN" title="${esc(definition)}">${esc(definition||'点击查看解释')}</span>`;
 }

 function sentenceChunks(){return window.STUDY_GROUPS.readingChunks(B,B.lines[state.index],groups);}
 function usingChunks(){return state.sentenceMode==='chunks'&&!!sentenceChunks();}
 function sentenceModeHTML(){
  const lesson=sentenceChunks(),active=state.sentenceMode==='chunks';
  const hint=active?(lesson?'先读懂一整块。点开看它怎样连接、怎样变形；里面仍可查单词。':'本句的句意分块还未校订，暂按词语显示。已有句型可在“语法笔记”查看。'):'按词查看读音和词义；想看词语怎样连成句子，可以切到“按句意”。';
  return '<div class="sentence-reading-mode" role="group" aria-label="正文拆分方式"><span>正文读法</span><button data-sentence-mode="chunks" aria-pressed="'+active+'">按句意</button><button data-sentence-mode="words" aria-pressed="'+!active+'">按词语</button></div><p class="sentence-mode-hint">'+hint+'</p>';
 }
 function chunkSurfaceHTML(block){
  return block.pieces.map(({group:g})=>g.p==='标点'?esc(g.s):'<span class="chunk-piece"><span class="chunk-piece-jp"><ruby>'+esc(g.s)+'<rt>'+(/[\p{Script=Han}]/u.test(g.s)?esc(g.k):'')+'</rt></ruby></span>'+(state.kana?'<span class="jp-reading jp-kana">'+esc(g.k)+'</span>':'')+(state.romaji?'<span class="jp-reading jp-romaji" lang="en">'+esc(g.r||wanakana.toRomaji(g.k))+'</span>':'')+'</span>').join('');
 }
 function sentenceChunksHTML(lesson){
  return lesson.blocks.map((b,i)=>'<span class="sentence-chunk-unit">'+(i===0?'<span class="chunk-punctuation">'+esc(lesson.jp.slice(0,b.start))+'</span>':'')+'<button class="sentence-chunk" data-sentence-chunk="'+i+'" aria-label="第 '+(i+1)+' 块：'+esc(b.role)+'，'+esc(b.quote)+'" aria-haspopup="dialog"><span class="chunk-role" lang="zh-CN">'+(i+1)+' · '+esc(b.role)+'</span><span class="chunk-surface">'+chunkSurfaceHTML(b)+'</span>'+(state.meaning?'<span class="chunk-meaning" lang="zh-CN">'+esc(b.meaning)+'</span>':'')+'</button><span class="chunk-punctuation">'+esc(lesson.jp.slice(b.end,lesson.blocks[i+1]?.start??lesson.jp.length))+'</span></span>').join('');
 }

 function grammarVariantHTML(v){
  if(!v)return '';
  return '<section class="grammar-variants" data-grammar-variants="1"><h4>'+esc(v.title)+'</h4><p>'+esc(v.intro)+'</p>'+v.variants.map(x=>'<article class="grammar-variant"><h5 lang="ja">'+esc(x.form)+'</h5>'+formReadingHTML(x.form,x.kana)+'<strong>'+esc(x.task)+'</strong><p class="variant-example" lang="ja">'+esc(x.example)+'</p>'+formReadingHTML(x.example,x.reading)+'<p class="variant-chinese">'+esc(x.chinese)+'</p><p>'+esc(x.explanation)+'</p><p class="variant-change">'+esc(x.change)+'</p></article>').join('')+'<h5>先这样选，不用先背术语</h5><ol>'+v.checks.map(s=>'<li>'+esc(s)+'</li>').join('')+'<h5>这几处要分清</h5>'+v.cautions.map(s=>'<p>'+esc(s)+'</p>').join('')+'</section>';
 }
 function chunkDetailedHTML(block){
  const d=block.detail;if(!d)return '';
  return '<section class="chunk-deep-lesson"><h3>把这里的语法一步步讲清楚</h3><div class="chunk-structure"><small>方括号只是帮助看关系，没有改写小说</small><p lang="ja">'+esc(d.structure)+'</p></div><ol class="chunk-explanation-steps">'+d.parts.map((p,i)=>'<li data-chunk-focus="'+esc(p.quote)+'"><div class="chunk-step-heading"><span>'+(i+1)+'</span><h4>'+esc(p.title)+'</h4></div><p class="chunk-step-japanese" lang="ja">'+esc(p.quote)+'</p><p class="chunk-step-meaning" lang="zh-CN">'+esc(p.meaning)+'</p>'+formReadingHTML(p.quote,p.kana)+p.paragraphs.map(t=>'<p>'+esc(t)+'</p>').join('')+(p.forms.length?'<ol class="chunk-form-steps">'+p.forms.map((f,j)=>'<li><b lang="ja">'+esc(f.form)+'</b>'+formReadingHTML(f.form,f.kana,j===0)+'<p>'+esc(f.why)+'</p></li>').join('')+'</ol>':'')+'</li>').join('')+'</ol><div class="chunk-rebuild"><h4>最后连回一句中文</h4><p>'+esc(d.rebuild)+'</p></div></section>';
 }
 function chunkConnectionNotesHTML(block){
  if(block.detail)return '';
  const notes=window.STUDY_GROUPS.chunkConnections(block);
  return notes.length?'<section class="chunk-connection-notes"><h3>合起来是什么意思</h3>'+notes.map(n=>'<article data-connection-quote="'+esc(n.quote)+'"><p class="chunk-step-japanese" lang="ja">'+esc(n.quote)+'</p><p class="chunk-connection-translation" lang="zh-CN">'+esc(n.meaning)+'</p><p class="chunk-connection-explanation">'+esc(n.why)+'</p></article>').join('')+'</section>':'';
 }

 function actionLessonsHTML(lessons=[]){
  return lessons.map(a=>'<section class="action-lesson" data-action-start="'+a.start+'" data-action-quote="'+esc(a.quote)+'"><h3>「を」和后面的词，再一起读一遍</h3><p class="action-source" lang="ja">'+esc(a.noun)+' <b>を</b> '+esc(a.form)+'</p><p class="action-meaning" lang="zh-CN">'+esc(a.meaning)+'</p><ol class="action-parts"><li><h4>前面说的是什么</h4><p lang="ja">'+esc(a.noun)+'</p><p class="action-chinese">'+esc(a.nounMeaning)+'</p>'+formReadingHTML(a.noun,a.nounKana)+'</li><li><h4>中间的「を」在做什么</h4><p class="action-particle-reading" lang="ja">を → お <small lang="en">o</small></p><p>'+esc(a.relation)+'</p></li><li><h4>后面的「'+esc(a.form)+'」怎么来的</h4><ol class="action-form-steps">'+a.steps.map((s,i)=>'<li><b lang="ja">'+esc(s.form)+'</b>'+formReadingHTML(s.form,s.kana,i===0)+'<p>'+esc(s.why)+'</p></li>').join('')+'</ol></li></ol>'+(a.note?'<p class="action-context">'+esc(a.note)+'</p>':'')+window.STUDY_GROUPS.formContrasts(a.contrastKeys).map(formContrastHTML).join('')+'<div class="action-rebuild"><b>合起来读：</b><span lang="ja">'+esc(a.noun)+' ＋ を ＋ '+esc(a.form)+'</span><p>'+esc(a.meaning)+'</p></div><p class="action-recall">'+esc(a.recall)+'</p></section>').join('');
 }

 function openSentenceChunk(n){
  const lesson=sentenceChunks(),block=lesson?.blocks[n];if(!block||!Number.isInteger(n))return;
  const details=window.STUDY_GROUPS.analyses(B,B.lines[state.index],groups).items.filter(a=>a.start<block.end&&a.end>block.start);
  const taught=new Set(details.flatMap(a=>(a.grammarLessons||[]).map(l=>l.key)));
  const hints=grammarFor().filter(a=>a.at>=block.start&&a.at<block.end&&!window.STUDY_GROUPS.grammarTeaching(a.title).every(l=>taught.has(l.key)));
  const variants=[...new Map(details.flatMap(a=>a.grammarLessons||[]).filter(l=>l.variantGuide).map(l=>[l.key,l.variantGuide])).values()];
  const excludedContrasts=new Set((block.actionLessons||[]).flatMap(a=>a.contrastKeys||[]));
  const directContrasts=block.detail?[...new Map(details.flatMap(a=>a.grammarLessons||[]).filter(g=>g.contrastGuide&&!excludedContrasts.has(g.key)).map(g=>[g.key,g.contrastGuide])).values()]:[];
  for(const g of directContrasts)excludedContrasts.add(g.key);
  const explanations=analysisCardsHTML(details,true,excludedContrasts)+hints.map(a=>'<section class="chunk-pattern-explanation"><h4>'+esc(a.title)+' · '+esc(a.quote)+'</h4><p>'+esc(a.body)+'</p>'+window.STUDY_GROUPS.grammarTeaching(a.title).map(g=>grammarLessonHTML(g,excludedContrasts)).join('')+'</section>').join('');
  const extra=block.detail?variants.map(grammarVariantHTML).join('')+directContrasts.map(formContrastHTML).join('')+(explanations?'<details class="chunk-extra-patterns"><summary>再对照同类词形与接法（选看）</summary>'+explanations+'</details>':''):explanations;
  const combinations=block.pieces.filter(x=>x.group.combination).map(x=>combinationHTML(x.group,true)).join('');
  const words=block.pieces.filter(x=>x.group.p!=='标点').map(({group:g,index})=>'<button class="outline" data-chunk-word="'+index+'" data-chunk-origin="'+n+'"><span lang="ja">'+esc(g.s)+'</span><small>'+esc(g.k)+'</small></button>').join('');
  dialog('word-dialog','句意与句型','<p class="chunk-dialog-role">第 '+(n+1)+' / '+lesson.blocks.length+' 块 · '+esc(block.role)+'</p><p class="chunk-dialog-quote" lang="ja">'+esc(block.quote)+'</p><p class="jp-reading jp-kana">'+esc(block.pieces.map(x=>x.group.k||x.group.s).join(' '))+'</p><p class="jp-reading jp-romaji">'+esc(block.pieces.map(x=>x.group.r||wanakana.toRomaji(x.group.k||x.group.s)).join(' '))+'</p><section class="chunk-dialog-meaning"><h3>这一整块是什么意思</h3><p>'+esc(block.meaning)+'</p></section>'+plainBlockHTML(block)+'<details class="plain-more chunk-more"><summary>详细语法、变形与更多例句</summary>'+actionLessonsHTML(block.actionLessons)+'<details class="chunk-sentence-context"><summary>放回整句里看</summary><p><b>先抓主干：</b>'+esc(lesson.spine)+'</p><p><b>谁在做：</b>'+esc(lesson.who)+'</p><p><b>容易混淆：</b>'+esc(lesson.pitfall)+'</p></details>'+chunkDetailedHTML(block)+chunkConnectionNotesHTML(block)+(extra||combinations?'<section class="chunk-grammar"><h3>原形、变形和句型接法</h3>'+extra+combinations+'</section>':'')+'</details><details class="chunk-words"><summary>查这一块里的词语与读音</summary><div class="chunk-word-buttons">'+words+'</div></details><nav class="chunk-dialog-nav" aria-label="切换句意分块"><button class="outline" data-sentence-chunk="'+(n-1)+'" '+(n===0?'disabled':'')+'>上一块</button><button class="primary" data-sentence-chunk="'+(n+1)+'" '+(n===lesson.blocks.length-1?'disabled':'')+'>下一块</button></nav>');
 }

 function sentenceHTML(){
  const chunks=state.sentenceMode==='chunks'?sentenceChunks():null;if(chunks)return sentenceChunksHTML(chunks);
  // Keep punctuation with its neighbouring word when an annotated unit wraps.
  const units=[];let prefix='';
  for(const g of groups){
   if(g.p==='标点'){
    const punctuation=`<span class="jp-punctuation">${esc(g.s)}</span>`;
    if(units.length&&!/^[「『（(【〈《［｛“‘]+$/u.test(g.s))units[units.length-1].after+=punctuation;
    else prefix+=punctuation;
    continue;
   }
   units.push({g,before:prefix,after:''});prefix='';
  }
  return units.map(({g,before,after})=>`<span class="jp-unit">${before}<button class="jp-token ${g.combination?'combo-token':''} ${selected===g.i?'selected':''}" data-select="${g.i}" aria-label="查看 ${esc(g.s)}" aria-haspopup="dialog" title="点击查看词语解释"><span class="jp-surface"><ruby>${esc(g.s)}<rt>${/[\p{Script=Han}]/u.test(g.s)?esc(g.k):''}</rt></ruby></span>${state.kana?`<span class="jp-reading jp-kana" lang="ja">${esc(g.k)}</span>`:''}${state.romaji?`<span class="jp-reading jp-romaji" lang="en">${esc(g.r)}</span>`:''}${meaningHTML(g)}</button>${after}</span>`).join('')+prefix;
 }
 function grammarFor(){
  const text=lineText(state.index),cur=CURATED[state.index];
  if(cur?.g)return cur.g.map((g,i)=>({at:text.indexOf(g[0]),quote:g[0],title:g[1],body:g[2]}));
  return window.STUDY_GROUPS.grammarHints(B,B.lines[state.index],GRAMMAR,groups);
 }
 function setIndex(n){stop();$('#word-dialog')?.close();quizRound=null;walkAt=0;walkAll=false;state.index=Math.max(0,Math.min(B.lines.length-1,n));selected=-1;translation=false;contextPage=null;sidebar=false;if(state.readingMode==='novel')state.novelPosition={line:state.index,offset:0};save();render();window.scrollTo(0,0);}
 function toast(text){$('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.role='status';el.textContent=text;document.body.append(el);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),3500);}
 function updatePlay(){document.querySelectorAll('[data-form-reading]').forEach(button=>{const on=playing&&activePlayback?.key==='form:'+button.dataset.formReading;button.setAttribute('aria-pressed',String(on));button.innerHTML=icon(on?'stop':'audio')+(on?'停止':button.disabled?'原形录音准备中':'听原形');});const b=$('#play');if(b){b.innerHTML=icon(playing?'stop':'play')+(playing?'停止朗读':'听这一句');b.setAttribute('aria-label',playing?'停止朗读':'朗读当前句');}const status=$('#playback-status');if(status)status.textContent=playbackStatus;const loop=$('#loop-sentence');if(loop){const on=sentenceOptions().count===0;loop.classList.toggle('on',on);loop.setAttribute('aria-pressed',String(on));}document.querySelectorAll('[data-grammar-audio],[data-particle-audio]').forEach(button=>{const key=button.dataset.grammarAudio!==undefined?'grammar:'+button.dataset.grammarAudio:'particle:'+button.dataset.particleAudio;const on=playing&&activePlayback?.key===key;button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));button.innerHTML=icon(on?'stop':'audio')+(on?'停止讲解':button.disabled?'录音准备中':'听讲解');});}
 function halt(){if(native)native.stop();else recorded?.halt();}
 const player=createSentencePlayer({halt,play:(clip,token)=>{
  if(clip.roleId){
   if(native){if(!native.speakRoleClip)return '请更新应用以播放角色配音。';const result=native.speakRoleClip(clip.roleId,state.rate,token);return result==='ok'?null:result;}
   return recorded?recorded.play(clip,token):'请刷新页面，重新加载录音播放器。';
  }
  if(native){const result=native.speakClip(clip.text,clip.lang,state.rate,token);return result==='ok'?null:result;}
  return recorded?recorded.play(clip,token):'请刷新页面，重新加载录音播放器。';
 },changed:status=>{
  playing=!!status&&!status.error;
  playbackStatus=playing?`${activePlayback?.label||`第 ${status.round}${status.count?' / '+status.count:''} 遍${status.count?'':' · 无限循环'}`} · ${status.phase==='ja'?'日文':status.phase==='zh'?'中文':'停顿中'}`:'';
  if(status?.error){voiceMessage=status.error;toast(status.error);}else voiceMessage='';renderMessage();updatePlay();
 }});
 function stop(){player.stop();activePlayback=null;}
 function startPlayback(clips,options={},key='word',label=''){if(textOnly){toast('此版本不含音频和插图。');return;}activePlayback={clips,options,key,label};player.start(clips,options);}
 function speak(text){if(/^[ーっッ]+$/.test(text.trim())){stop();toast(text.includes('ー')?'长音符号要接着前一个假名，把元音延长一拍；不能单独读。':'小っ表示停顿一拍，需要和前后假名一起读。');return;}startPlayback([{text,lang:'ja'}]);}
 function speakGroup(index){const g=groups[index];if(!g)return;const clip=g.audioTitle&&grammarAudioFor(g.audioTitle);if(clip&&clip.ja.replace(/[。\s]/g,'')===g.k)startPlayback([{lang:'ja',text:clip.ja,roleId:clip.jaId,roleHash:clip.jaSha256}]);else speak(g.k);}
 function sentenceOptions(){const v=state.sentencePlayback[state.index]||{};return {mode:v.mode==='ja'?'ja':'both',count:[0,1,3,5].includes(v.count)?v.count:1,pause:[1,2,3,5].includes(v.pause)?v.pause:2,...([1,3,5].includes(v.finiteCount)?{finiteCount:v.finiteCount}:{})};}
 const validClipId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id);
 const chineseText=index=>CURATED[index]?.zh||B.lines[index].zh;
 function roleFor(index){const clip=window.ROLE_AUDIO?.clips[index];return clip?.text===lineText(index)&&validClipId(clip.id)?clip:null;}
 function chineseRoleFor(index){return [window.CHINESE_EMOTION?.clips?.[index],window.LEARNING_AUDIO?.chinese?.[index]].find(clip=>clip?.text===chineseText(index)&&validClipId(clip.id))||null;}
 function playSentence(){const options=sentenceOptions(),role=state.roleVoices&&roleFor(state.index),zh=state.roleVoices&&chineseRoleFor(state.index),clips=[{lang:'ja',text:lineText(state.index),...(role?{roleId:role.id}:{})}];if(options.mode==='both')clips.push({lang:'zh',text:chineseText(state.index),...(zh?{roleId:zh.id,roleHash:zh.sha256}:{})});startPlayback(clips,options,'sentence');}
 function toggleInfinite(){const options=sentenceOptions();if(options.count===0){options.count=options.finiteCount||1;stop();}else{options.finiteCount=options.count;options.count=0;}state.sentencePlayback[state.index]=options;save();render();if(options.count===0)playSentence();}
 function roleVoiceHTML(){const role=roleFor(state.index),zh=chineseRoleFor(state.index);return role||zh?`<div class="role-voice-row"><span>${state.roleVoices?[role?'日文：'+esc(role.label):'',zh?'中文：'+esc(zh.label||'情感配音'):''].filter(Boolean).join(' · '):'原版合成朗读'}</span><button id="toggle-role-voice" aria-pressed="${state.roleVoices}">${state.roleVoices?'对比原版':'听情感配音'}</button></div>`:'';}
 function grammarAudioFor(title){const clip=window.LEARNING_AUDIO?.grammar?.[title],note=window.LESSON_NOTES?.find(n=>n[0]===title);return clip&&validClipId(clip.jaId)&&validClipId(clip.zhId)&&clip.ja&&clip.zh&&(!note||(clip.ja===note[1]&&clip.zh===note[2]))?clip:null;}
 function particleAudioFor(g){const notes=window.PARTICLE_NOTES||{},base=g.words[0].b,key=Object.hasOwn(notes,base)?base:Object.hasOwn(notes,g.s)?g.s:'*',clip=window.LEARNING_AUDIO?.particles?.[key];return clip&&validClipId(clip.id)&&clip.text&&(!notes[key]||clip.text===notes[key])?clip:null;}
 function lessonButton(kind,key,available){if(textOnly)return '';return `<button class="lesson-audio" data-${kind}-audio="${esc(key)}" aria-pressed="false" ${available?'':'disabled'} aria-label="${available?'听讲解：':'录音准备中：'}${esc(kind==='grammar'?key:groups[Number(key)]?.s)}">${icon('audio')}${available?'听讲解':'录音准备中'}</button>`;}
 function playGrammar(title){if(playing&&activePlayback?.key==='grammar:'+title){stop();return;}const clip=grammarAudioFor(title);if(!clip){stop();toast('这条语法讲解录音还在制作中，完成后即可播放。');return;}startPlayback([{lang:'ja',text:clip.ja,roleId:clip.jaId,roleHash:clip.jaSha256},{lang:'zh',text:clip.zh,roleId:clip.zhId,roleHash:clip.zhSha256}],{},'grammar:'+title,'语法讲解');}
 function playParticle(index){if(playing&&activePlayback?.key==='particle:'+index){stop();return;}const g=groups[index],clip=g&&particleAudioFor(g);if(!clip){stop();toast('这条助词讲解录音还在制作中，完成后即可播放。');return;}startPlayback([{lang:'ja',text:g.k},{lang:'zh',text:clip.text,roleId:clip.id,roleHash:clip.sha256}],{},'particle:'+index,'助词讲解');}
 function playbackHTML(){if(textOnly)return '';const o=sentenceOptions();return `${roleVoiceHTML()}<div class="repeat-controls" aria-label="本句播放设置"><label>朗读顺序<select id="play-mode"><option value="both" ${o.mode==='both'?'selected':''}>日文 → 中文</option><option value="ja" ${o.mode==='ja'?'selected':''}>只听日文</option></select></label><label>播放次数<select id="play-count">${[[1,'1 遍'],[3,'3 遍'],[5,'5 遍'],[0,'一直循环']].map(([v,t])=>`<option value="${v}" ${o.count===v?'selected':''}>${t}</option>`).join('')}</select></label><label>每遍停顿<select id="play-pause">${[1,2,3,5].map(v=>`<option value="${v}" ${o.pause===v?'selected':''}>${v} 秒</option>`).join('')}</select></label></div><p class="playback-status" id="playback-status" role="status" aria-live="polite">${esc(playbackStatus)}</p>`;}
 window.onNativeSpeech=(status,token)=>player.ended(status,token);
 window.onNativePause=()=>stop();
 const renderMessage=()=>{const el=$('#voice-message');if(el){el.textContent=voiceMessage;el.hidden=!voiceMessage;}};
 function wordInfo(g){
  const w=g.words[0],info=window.STUDY_GROUPS.describe(g),extra=g.rule||info.contextual?[]:g.words.slice(1),{base,definition,reviewed,contextual}=info;
  const morph=[g.note,g.glossNote].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' ')||(w.f&&w.f!=='基本形'?FORM_NOTES[w.f]||`此处采用「${w.f}」形式，和后面的词尾一起理解。`:'');
  const parts=g.rule?(g.parts||g.words).map(x=>x.s).join(' ＋ '):'';
  return {w,extra,base,definition,morph,parts,reviewed,contextual};
 }


 function combinationHTML(g,open=false){
  const c=g.combination;if(!c)return '';const ctx=c.context;
  const holistic=!!ctx&&(c.key==='でも'||c.key==='のに'&&!ctx.sense.includes('名词化'));
  const form=c.key==='でも'?'でも（先辨本句用法）':c.key==='のに'&&!ctx?'の ＋ に ／ のに（两种结构）':holistic?'のに（转折表达）':(g.parts||g.words).map(w=>w.s).join(' ＋ ')+' → '+g.s;
  const parts=ctx?c.parts.map((p,i)=>({form:holistic?(i===0?'前项':'整体作用'):p.form,role:i===0?ctx.left:ctx.right})):c.parts;
  return '<details class="form-analysis combination-lesson" '+(open?'open':'')+'><summary><span lang="ja">'+esc(g.s)+'</span> · 合起来怎么用<small>'+(ctx?'本句组合讲解 · '+esc(ctx.sense):'通用组合对照 · 本句具体用法仍需结合上下文')+'</small></summary>'+(ctx?'<div class="combination-context"><strong>放回本句</strong><p lang="ja">'+esc(ctx.quote)+'</p><p>'+esc(ctx.meaning)+'</p></div>':'')+'<p class="combination-form" lang="ja">'+esc(form)+'</p><strong>'+ (holistic?'这个表达怎样连接前后':'各部分负责什么')+'</strong><dl class="combination-parts">'+parts.map(p=>'<dt lang="ja">'+esc(p.form)+'</dt><dd>'+esc(p.role)+'</dd>').join('')+'</dl><div class="combination-joined"><strong>'+(ctx?'合起来读本句':'合起来的作用')+'</strong><p>'+esc(ctx?ctx.meaning:c.joined)+'</p></div>'+(ctx?'<div class="combination-contrast"><strong>少一个或换一个，会怎样</strong><p>'+esc(ctx.contrast)+'</p></div>':'')+(c.nearby?'<div class="combination-nearby"><strong>本句意群提示</strong><p lang="ja">'+esc(c.nearby.quote)+'</p><p>'+esc(c.nearby.meaning)+'</p><p>'+esc(c.nearby.why)+'</p></div>':'')+'<details class="combination-examples"><summary>用短例句比较（教学例句）</summary>'+c.pairs.map(p=>'<p><span lang="ja">'+esc(p.ja)+'</span><br>'+esc(p.zh)+'</p>').join('')+'</details>'+(c.caution?'<p class="analysis-caution">'+esc(c.caution)+'</p>':'')+'<p class="hint">组合讲解为文字；朗读按钮读日文组合。</p></details>';
 }
 function combinationStudyHTML(){
  const found=groups.filter(g=>g.combination);return found.length?'<section class="combination-study"><h3>这些词合起来怎么用</h3><p class="hint">先看组合整体，再看每一部分承担什么作用。点原句中的组合也能直接打开。</p>'+found.map(g=>combinationHTML(g)).join('')+'</section>':'';
 }

 function particleLinksHTML(keys,label='相关助词用法对照'){
  return keys?.length?'<div class="particle-links"><span>'+esc(label)+'</span>'+[...new Set(keys)].map(key=>'<button class="outline" data-particle-guide="'+esc(key)+'">'+esc(key)+'</button>').join('')+'</div>':'';
 }
 function handbookEntryHTML(x){
  return '<article class="particle-entry"><h3>'+esc(x.title)+'</h3><p class="particle-question">先问自己：'+esc(x.question)+'</p><dl>'+x.patterns.map(p=>'<dt lang="ja">'+esc(p.form)+'</dt><dd>'+esc(p.meaning)+'</dd>').join('')+'</dl><div class="particle-comparison"><strong>相近用法怎么分</strong><p>'+esc(x.contrast)+'</p></div><p class="analysis-caution">'+esc(x.caution)+'</p></article>';
 }
 function openParticleGuide(key=''){
  const entries=window.STUDY_GROUPS.particleHandbook?.()||[],item=entries.find(x=>x.key===key);
  const principles=window.STUDY_GROUPS.particlePrinciples?.()||[];
  const content=item?'<button class="outline" data-particle-guide="">查看全部助词</button>'+handbookEntryHTML(item):'<p class="hint">先看句子里的连接关系，再比较相近用法。这里的例句用于讲解，未改动小说原文。</p><div class="particle-picker">'+entries.map(x=>'<button class="outline" data-particle-guide="'+esc(x.key)+'">'+esc(x.key)+'</button>').join('')+'<div class="particle-principles">'+principles.map(x=>'<details class="form-analysis"><summary>'+esc(x.title)+'</summary><p>'+esc(x.body)+'</p></details>').join('')+'</div>';
  const sources=window.STUDY_GROUPS.particleReferences?.()||[];
  dialog('particle-dialog',item?item.key+' · 助词用法对照':'助词指南',content+'<p class="hint particle-scope">通用用法对照不等于本句用法判定。小说里的具体连接关系，请看词语浮窗或语法笔记中标注的“本句逐项讲解”。</p><p class="particle-sources">语法核对参考：'+sources.map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a>').join(' · ')+'</p>');
 }

 function particleAudioHTML(){
  const items=groups.map((g,i)=>({g,i,clip:particleAudioFor(g)})).filter(({g,clip})=>g.p==='助词'&&clip);
  if(!items.length)return '';
  return '<details class="form-analysis particle-audio"><summary>原有助词简述 · 可朗读</summary><p class="hint">这些是已有的通用短讲解，未包含新增的本句关系分析。请以上方本句解释为准。</p>'+items.map(({g,i,clip})=>'<div class="grammar-heading"><h3 lang="ja">'+esc(g.s)+'</h3>'+lessonButton('particle',i,clip)+'</div><p>'+esc(clip.text)+'</p>').join('')+'</details>';
 }

 function particleStudyHTML(){
  const keys=[...new Set(groups.flatMap(g=>g.particleKeys||[]))];
  return particleAudioHTML()+'<section class="particle-study"><div class="grammar-heading"><h3>助词怎么连接句子</h3><button class="outline" data-particle-guide="">打开完整助词指南</button></div><p class="hint">点下面的词可查连接方式、易混用法和对比例句。相同助词在不同句子里可能有不同作用，不能直接套用第一条意思。</p>'+particleLinksHTML(keys,'本句涉及的用法')+'</section>';
 }


 function formContrastHTML(g){
  if(!g)return '';
  return '<section class="form-contrast" data-form-contrast="'+esc(g.key)+'"><h4>'+esc(g.title)+'</h4><p><b>具体怎么变：</b>'+esc(g.change)+'</p><p class="form-time"><b>时间和意思怎样变：</b>'+esc(g.time)+'</p><p class="hint">下面是教学例句；先看中文，再对照日文中改变的部分。</p><div class="form-example-list">'+g.examples.map(e=>'<article class="form-example"><h5>'+esc(e.scene)+'</h5><p class="form-example-ja" lang="ja">'+esc(e.ja)+'</p><p class="form-example-zh" lang="zh-CN">'+esc(e.zh)+'</p>'+formReadingHTML(e.ja,e.kana)+'<p class="form-example-why">'+esc(e.why)+'</p></article>').join('')+'</div><p class="form-trap"><b>别在这里混淆：</b>'+esc(g.trap)+'</p></section>';
 }
 function formChangeHTML(a){
  const c=a.change;if(!c)return '';
  if(a.layered)return '<section class="form-change" aria-label="本词具体改字"><h4>分层看：前面接好以后，只改最后的词</h4><p>先改前面的动作，让它接上后面的词；接好后，要继续说下去，再改最后的那个词。下面每一步都保留完整写法。</p></section>';
  return '<section class="form-change" aria-label="本词具体改字"><h4>对照你点的这个词，改的是哪里</h4><p lang="ja"><span>'+esc(c.keep)+'</span><del>'+esc(c.remove)+'</del><span class="form-change-arrow"> → </span><span>'+esc(c.keep)+'</span><mark>'+esc(c.add)+'</mark></p><p>'+(c.keep?'前面的「'+esc(c.keep)+'」不动，':'')+(c.remove?'把「'+esc(c.remove)+'」换成「'+esc(c.add)+'」。':'在后面加「'+esc(c.add)+'」。')+'每一层意思看下面的步骤和例句。</p></section>';
 }

 function grammarLessonDetailHTML(g,excluded=null){
  const c=g.chineseGuide;
  return '<section class="grammar-lesson" data-grammar-lesson="'+esc(g.key)+'"><h4>'+esc(c?c.title:g.title)+'</h4>'+(c?'<div class="chinese-first-guide"><p><strong>中文里我们会这样说</strong>'+esc(c.chinese)+'</p><p><strong>日语把这个意思放在哪里</strong>'+esc(c.japanese)+'</p><p class="grammar-pitfall"><strong>这里要留意</strong>'+esc(c.watch)+'</p></div>':'')+grammarVariantHTML(g.variantGuide)+formContrastHTML(excluded?.has?.(g.key)?null:g.contrastGuide)+(!g.contrastGuide?'<div class="grammar-teaching-examples"><strong>对比例句 · 教学例句</strong>'+g.examples.map(e=>'<p lang="ja">'+esc(e.ja)+'</p><p>'+esc(e.zh)+'</p>').join('')+'</div>':'')+'<details class="grammar-reference"><summary>再看例句和完整接法（选看）</summary><p class="hint">教材名称：'+esc(g.title)+'</p><dl><dt>具体接法</dt><dd>'+esc(g.connection)+'</dd><dt>表达的意思</dt><dd>'+esc(g.role)+'</dd><dt>换个说法有什么区别</dt><dd>'+esc(g.contrast)+'</dd></dl>'+(g.caution?'<p class="grammar-pitfall"><strong>容易误解的地方：</strong>'+esc(g.caution)+'</p>':'')+'</details></section>';
 }
 function grammarGlossaryHTML(){
  const terms=window.STUDY_GROUPS.grammarGlossary?.()||[];
  return '<details class="grammar-glossary"><summary>零基础术语：原形、五段、连用形是什么意思</summary><dl>'+terms.map(([name,meaning])=>'<dt>'+esc(name)+'</dt><dd>'+(name==='五段动词'?godanPrimerHTML():esc(meaning))+'</dd>').join('')+'</dl></details>';
 }
 function godanPrimerHTML(){
  const g=window.STUDY_GROUPS.godanPrimer?.();if(!g)return '';
  return '<section class="godan-primer"><h4>从你认识的五十音开始</h4><p>'+esc(g.intro)+'</p><h4>1. “五段”的五，是哪五个？</h4><p>'+esc(g.gridIntro)+'</p><div class="form-table-scroll"><table><caption>先看同一行里的 a・i・u・e・o</caption><thead><tr><th>行</th>'+['a','i','u','e','o'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+g.grid.map(row=>'<tr>'+row.map((x,i)=>'<'+(i?'td':'th')+'>'+esc(x)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div><h4>2. 用「とぶ」一步步试</h4><p>'+esc(g.example)+'</p><div class="godan-form-cards">'+g.forms.map(x=>'<article><span class="pos">'+esc(x.group)+' · '+esc(x.sound)+'</span><h5 lang="ja">'+esc(x.form)+'</h5>'+formReadingHTML(x.form,x.form)+'<p><b>'+esc(x.meaning)+'</b></p><p>'+esc(x.how)+'</p></article>').join('')+'</div><p>'+esc(g.why)+'</p><p>'+esc(g.another)+'</p><h4>3. 那“飞了”为什么变成「とんだ」？</h4><p>'+esc(g.pastIntro)+'</p><details class="godan-ending-rules"><summary>展开查：接て／た时，各种结尾怎么换</summary><div class="form-table-scroll"><table><thead><tr><th>原来结尾</th><th>接话的写法</th><th>说过去的写法</th><th>例子</th></tr></thead><tbody>'+g.endings.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details><p>'+esc(g.soundChange)+'</p><h4>4. 这几个地方要另记</h4><ul>'+g.exceptions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><h4>5. 怎么知道一个词是不是五段？</h4><p>'+esc(g.classification)+'</p><h4>读小说时，先按这四步走</h4><ol>'+g.checklist.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p class="hint">用法核对：<a href="'+esc(g.reference.url)+'" target="_blank" rel="noopener noreferrer">'+esc(g.reference.title)+'</a>。例子用于学习，不是小说原句。</p></section>';
 }
 function spellingNotesHTML(notes){
  return (notes||[]).map(x=>'<section class="spelling-note"><h4>先说清楚：这两种写法是什么关系？</h4><div class="spelling-pair"><div><small>原文写法</small><b lang="ja">'+esc(x.source)+'</b></div><span aria-label="本句是同一个词">＝</span><div><small>本句对应的汉字写法</small><b lang="ja">'+esc(x.other)+'</b></div></div><p>都读 '+formReadingHTML(x.source,x.kana)+' · '+esc(x.meaning)+'</p><p>'+esc(x.explanation)+'</p>'+(x.caution?'<details class="grammar-reference"><summary>相同读音还有别的词吗？</summary><p>'+esc(x.caution)+'</p></details>':'')+'</section>').join('');
 }
 function formTableHTML(a){
  return a.formTable?.length?'<details class="grammar-form-table"><summary>对照「'+esc(a.base)+'」的其他形式</summary><div class="form-table-scroll"><table><caption>同一个动词，不同词尾负责不同意思</caption><thead><tr><th>名称</th><th>实际写法</th><th>作用</th></tr></thead><tbody>'+a.formTable.map(x=>'<tr><th>'+esc(x.label)+'</th><td lang="ja">'+esc(x.form)+'</td><td>'+esc(x.meaning)+'</td></tr>').join('')+'</tbody></table></div></details>':'';
 }

 function formReadingHTML(form,kana,play=false){
  if(!kana)return '';
  const unfinished=/っ$/.test(kana),roman=unfinished?'（还没接完，不单独读）':wanakana.toRomaji(kana);
  const canPlay=!window.UMI_TEXT_ONLY&&play&&!unfinished,available=native||window.UMI_AUDIO_INDEX?.['ja\n'+kana];
  return '<span class="form-pronunciation"><span lang="ja">'+esc(kana)+'</span><small lang="en">'+esc(roman)+'</small>'+(canPlay?'<button class="outline form-reading-play" data-form-reading="'+esc(kana)+'" data-form-title="'+esc(form)+'" aria-label="朗读原形 '+esc(form)+'" aria-pressed="false" '+(available?'':'disabled')+'>'+icon('audio')+(available?'听原形':'原形录音准备中')+'</button>':'')+'</span>';
 }
 function verbClassHTML(a){
  const v=a.verbClass;if(!v)return '';
  return '<details class="grammar-verb-class"><summary>这个词属于哪一类？学有余力再看</summary><p><strong>'+esc(v.name)+'</strong></p><p>'+esc(v.rule)+'</p>'+(v.rows?'<details class="godan-examples"><summary>用「'+esc(a.base)+'」看这五格，不用一次背完</summary><p>词尾就是词的末尾。下面是同一个词为了表达不同意思，换了不同的结尾。</p><table><thead><tr><th>元音分组</th><th>完整写法与读音</th><th>用来表达</th></tr></thead><tbody>'+v.rows.map(r=>'<tr><th>'+esc(r.label)+'</th><td><b lang="ja">'+esc(r.form)+'</b>'+formReadingHTML(r.form,r.kana)+'</td><td>'+esc(r.meaning)+'</td></tr>').join('')+'</tbody></table><p>'+esc(v.note)+'</p></details>':'')+(v.rows?'<details class="godan-primer-toggle"><summary>从头学五段：五十音怎么换，为什么还会变成んだ</summary>'+godanPrimerHTML()+'</details>':'')+'</details>';
 }

 function contextApplicationHTML(a){
  if(a.applications?.length>1)return [a.application,...a.applications.filter(n=>n!==a.application)].map(n=>contextApplicationHTML({...a,application:n,applications:[]})).join('');
  const c=a.contextLesson,n=a.application;if(!c&&!n)return '';
  return '<section class="grammar-application" data-context-quote="'+esc(n?.quote||a.quote)+'"><h4>放回本文，这里怎么读</h4><p class="application-quote" lang="ja">'+esc(n?.quote||a.quote)+'</p>'+(n?'<p class="application-meaning">'+esc(n.meaning)+'</p><dl><dt>谁在做什么</dt><dd>'+esc(n.role)+'</dd><dt>为什么这里这样接</dt><dd>'+esc(n.connection)+'</dd><dt>这句是在说什么时候</dt><dd>'+esc(n.time)+'</dd><dt>换一种写法会怎样</dt><dd>'+esc(n.contrast)+'</dd></dl>':'<p class="application-meaning">'+esc(c.meaning)+'</p><p>'+esc(c.why)+'</p>'+(c.next?'<div class="application-next"><h5>原文接着写</h5><p lang="ja">'+esc(c.next.quote)+'</p><p>'+esc(c.next.meaning)+'</p></div>':''))+'</section>';
 }
 function contextRecapHTML(c){
  return c?.whole?'<section class="grammar-context-recap"><h4>学完语法，再把本文连起来读</h4><p>'+esc(c.whole)+'</p><p class="context-roles">'+esc(c.who)+'</p></section>':'';
 }


 function sentencePatternHTML(n,showMeaning=true){
  const p=n.pattern;
  return '<section class="sentence-pattern-lesson" data-pattern-quote="'+esc(n.quote)+'">'+(showMeaning?'<p class="pattern-source" lang="ja">'+esc(n.quote)+'</p><p class="pattern-meaning">'+esc(n.meaning)+'</p>':'')+'<h3>1. 逐词解析</h3><ul class="pattern-words">'+n.parts.map(x=>'<li><b lang="ja">'+esc(x.ja)+'</b>：'+esc(x.zh)+'</li>').join('')+'</ul><h3>2. 核心句型：<span lang="ja">'+esc(p.title)+'</span></h3><p>'+esc(p.meaning)+'</p><ul class="pattern-structure">'+p.structure.map(([ja,zh])=>'<li><b>'+esc(ja)+'</b>：'+esc(zh)+'</li>').join('')+'</ul><p class="pattern-example-label">对照例句</p>'+p.examples.map(e=>'<div class="pattern-example"><p lang="ja">'+esc(e.ja)+'</p><p lang="zh-CN">'+esc(e.zh)+'</p></div>').join('')+'<h3>3. '+esc(n.whyTitle)+'</h3><p class="pattern-why">'+esc(n.why)+'</p><h3>4. 结合本文</h3><p class="pattern-context">'+esc(n.context)+'</p><div class="pattern-recall"><h3>5. 一句话记住</h3><p>'+esc(n.recall)+'</p></div></section>';
 }
 function sentencePatternCardsHTML(notes){
  return notes.map(n=>'<details class="form-analysis sentence-pattern-card"><summary><span lang="ja">'+esc(n.quote)+'</span><small>'+esc(n.meaning)+'</small></summary>'+sentencePatternHTML(n,false)+'</details>').join('');
 }
 function plainExplanationHTML(n,showMeaning=true){
  if(!n)return '';
  return '<section class="plain-explanation" data-plain-quote="'+esc(n.quote)+'">'+(showMeaning?'<div class="plain-meaning"><h4>这句里是什么意思</h4><p>'+esc(n.meaning)+'</p></div>':'')+'<h4>拆开看</h4><ul class="plain-parts">'+n.parts.map(p=>'<li><b lang="ja">'+esc(p.ja)+'</b><span>'+esc(p.zh)+'</span></li>').join('')+(n.forms?.length?'<div class="plain-forms"><h4>怎么变过来的</h4>'+n.forms.map(f=>'<p lang="ja">'+esc(f.ja)+'</p><p>'+esc(f.zh)+'</p>').join('')+'</div>':'')+'<p class="plain-link"><b>合起来：</b>'+esc(n.link)+'</p>'+(n.tip?'<p class="plain-tip">'+esc(n.tip)+'</p>':'')+'</section>';
 }
 function plainRuleHTML(g){
  const brief=window.STUDY_GROUPS.plainPattern(g.key);
  const title=brief?.[0]||g.chineseGuide?.title||g.title,body=brief?.[1]||g.chineseGuide?.chinese||g.role;
  return '<section class="plain-rule" data-plain-rule="'+esc(g.key)+'"><h4>'+esc(title)+'</h4><p>'+esc(body)+'</p>'+(!brief&&g.examples?.[0]?'<p class="plain-example"><span lang="ja">'+esc(g.examples[0].ja)+'</span><br>'+esc(g.examples[0].zh)+'</p>':'')+'</section>';
 }
 function grammarLessonHTML(g,excluded=null){
  return plainRuleHTML(g)+'<details class="plain-more"><summary>展开例句和接法</summary>'+grammarLessonDetailHTML(g,excluded)+'</details>';
 }
 function plainAnalysisHTML(a){
  if(a.plain)return plainExplanationHTML(a.plain);
  const n=a.application,c=a.contextLesson,meaning=n?.meaning||c?.meaning||(a.kind==='本句逐项讲解'?a.meaning:'');
  const rule=a.grammarLessons||[];
  const chosen=rule.filter(g=>g.key!=='te-chain');
  return (meaning?'<section class="grammar-in-context plain-meaning"><h4>这句里是什么意思</h4>'+(c&&!n?'<p class="plain-source" lang="ja">'+esc(c.quote)+'</p>':'')+'<p class="context-chinese">'+esc(meaning)+'</p></section>':'')+(a.change?'<p class="plain-word-change" lang="ja">'+esc(a.base)+' → '+esc(a.quote)+'</p>':'')+(n?'<p class="plain-link">'+esc(n.connection)+'</p>':c?'<p class="plain-link">'+esc(c.why)+'</p>':'')+chosen.map(plainRuleHTML).join('')+(!chosen.length&&!n&&!c?'<p>'+esc(a.meaning)+'</p>':'');
 }
 function analysisCardsHTML(items,open=false,excluded=null){
  return items.filter((a,i)=>!a.plain||!items.slice(i+1).some(b=>b.plain?.quote===a.plain.quote)).map(a=>analysisHTML(a,open,excluded)).join('');
 }
 function analysisHTML(a,open=false,excluded=null){
  const base=a.plainBase||a.base,baseLabel=/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(base)?'原形／基本说法':'句子结构';
  return '<details class="form-analysis" '+(open?'open':'')+'><summary><span lang="ja">'+esc(a.quote)+'</span><small>意思 · 拆开看 · 怎么变</small></summary>'+plainAnalysisHTML(a)+'<div class="analysis-base">'+baseLabel+'：<b lang="ja">'+esc(base)+'</b>'+formReadingHTML(a.plainBase||a.base,a.plainBaseKana||a.baseKana,true)+'</div><details class="plain-more analysis-more"><summary>详细变形、更多例句与读音</summary>'+analysisReferenceHTML(a,true,excluded)+'</details></details>';
 }
 function actionBriefHTML(lessons=[]){
  return lessons.map(a=>'<section class="action-brief plain-explanation"><h4 lang="ja">'+esc(a.noun)+' を '+esc(a.form)+'</h4><p class="plain-link"><b>'+esc(a.meaning)+'</b></p><ul class="plain-parts"><li><b lang="ja">'+esc(a.noun)+'</b><span>'+esc(a.nounMeaning)+'</span></li><li><b lang="ja">を</b><span>'+esc(a.relation)+'</span></li></ul>'+(a.form!=='する'?'<p class="plain-word-change" lang="ja">する → '+esc(a.form)+'</p><p>'+esc(a.steps.at(-1).why)+'</p>':'')+'</section>').join('');
 }
 function plainBlockHTML(block){
  const structured=window.STUDY_GROUPS.sentencePatternLesson(B,B.lines[state.index],block.quote);if(structured)return sentencePatternHTML(structured,false);
  const n=window.STUDY_GROUPS.plainExplanation(B,B.lines[state.index],block.quote);
  if(n)return plainExplanationHTML(n,false);
  // Reuse only reviewed phrase translations, never join dictionary glosses.
  const parts=block.detail?.parts||window.STUDY_GROUPS.chunkConnections(block);
  return (parts.length?'<section class="plain-explanation"><h4>拆开看</h4><ul class="plain-parts">'+parts.map(p=>'<li><b lang="ja">'+esc(p.quote)+'</b><span>'+esc(p.meaning)+'</span></li>').join('')+'</ul></section>':'')+'<p class="plain-link chunk-dialog-connection">'+esc(block.why)+'</p>'+actionBriefHTML(block.actionLessons||window.STUDY_GROUPS.actionConnections(B,B.lines[state.index]).filter(a=>a.start<block.end&&a.end>block.start));
 }
 function analysisReferenceHTML(a,open=false,excluded=null){
  const isContext=a.kind==='本句逐项讲解',ctx=a.contextLesson;
  const context=ctx?'<section class="grammar-in-context"><h4>先看小说这里在说什么</h4><p lang="ja">'+esc(ctx.quote)+'</p><p class="context-chinese">'+esc(ctx.meaning)+'</p></section>':isContext?'<section class="grammar-in-context"><h4>先看小说这里在说什么</h4><p class="context-chinese">'+esc(a.meaning)+'</p></section>':'';
  return '<div class="analysis-reference-body">'+spellingNotesHTML(a.spellings)+context+'<div class="analysis-base">先认出原来的说法：<b lang="ja">'+esc(a.base)+'</b>'+formReadingHTML(a.base,a.baseKana,true)+'</div>'+formChangeHTML(a)+'<h4>'+(isContext?'照着这句话，一步一步看':'一步一步怎么变 · 具体改哪几个字')+'</h4><ol class="form-steps">'+a.steps.map(s=>'<li><b lang="ja">'+esc(s.form)+'</b>'+formReadingHTML(s.form,s.kana)+'<p>'+esc(s.why)+'</p></li>').join('')+'</ol>'+contextApplicationHTML(a)+(a.particleDetails?'<dl class="particle-detail"><dt>这几个字把哪些话接起来</dt><dd>'+esc(a.particleDetails.relation)+'</dd><dt>这里为什么用它</dt><dd>'+esc(a.particleDetails.reason)+'</dd><dt>换个说法，意思有什么不同（教学改写）</dt><dd>'+esc(a.particleDetails.contrast)+'</dd></dl>':'')+particleLinksHTML(a.particleKeys)+'<p class="analysis-meaning"><b>'+esc(a.meaningLabel||(isContext?'本句理解':'表达意思'))+'：</b>'+esc(a.meaning)+'</p>'+(a.grammarLessons||[]).map(g=>grammarLessonDetailHTML(g,excluded)).join('')+contextRecapHTML(ctx)+verbClassHTML(a)+formTableHTML(a)+grammarGlossaryHTML()+(a.warning?'<details class="grammar-reference analysis-caution"><summary>这份讲解的适用范围</summary><p>'+esc(a.warning)+'</p></details>':'')+'</div>';
 }
 function syntaxHTML(){
  const structured=window.STUDY_GROUPS.sentencePatternLessons(B,B.lines[state.index]);
  const structuredHTML=structured.length?'<section class="sentence-analysis"><h3>按五步读懂这句</h3><p class="hint">逐词解析 → 核心句型 → 为什么这样用 → 结合本文 → 一句话记住。点开一块开始读。</p>'+sentencePatternCardsHTML(structured)+'</section>':'';
  const walk=window.STUDY_GROUPS.walkthrough(B,B.lines[state.index]);
  if(structured.length&&walk?.blocks.every(b=>structured.some(n=>n.quote===b.quote)))return structuredHTML;
  const a=window.STUDY_GROUPS.analyses?.(B,B.lines[state.index],groups);if(!a||(!a.items.length&&!a.guide&&!window.STUDY_GROUPS.actionConnections(B,B.lines[state.index]).length))return structuredHTML;
  return structuredHTML+`<section class="sentence-analysis"><h3>本句语法</h3><p class="hint">点开一项，先看本句意思和简短拆解。更多例句、读音与规则可继续展开。</p><details class="chinese-reading-primer"><summary>长句不知道从哪读？先问这四个问题</summary><ol><li>最后在说什么事？先找“去、想、看见”等动作，或“是谁、是什么样”。日语常把它们放在后面。</li><li>这件事是谁做的？人名或“我”可能在前文；不要看见最近的人名就直接填进去。</li><li>对谁、在哪里、从哪里？助词是接在词后面、帮助说明这些关系的小字。比如学校で勉強する，是“在学校学习”，这里学校后的で交代学习地点。</li><li>有没有“不、也、当时、如果”等意思？把这些信息补回整句中文，再核对日文具体是哪一部分负责。</li></ol><p>中文只用来帮你理解。一个中文意思在不同句子里可能用不同日语说法，不能逐字硬套。</p></details>${a.guide?`<div class="sentence-guide"><strong>这句话先这样连起来读</strong><p>${esc(a.guide)}</p></div>`:''}<details class="plain-more"><summary>「を」和动作的接法</summary>${actionLessonsHTML(window.STUDY_GROUPS.actionConnections(B,B.lines[state.index]))}</details>${a.items.map(x=>analysisHTML(x,x.kind==='本句逐项讲解',new Set(window.STUDY_GROUPS.actionConnections(B,B.lines[state.index]).flatMap(x=>x.contrastKeys||[])))).join('')}<p class="hint">“小说这里在说什么”是已有的本句分析，其他说明是通用用法。开篇第 1—173 句已有整句导读，后续仍需逐句补充。新增长讲解目前为文字。</p></section>`;
 }
 function wordsHTML(){
  const meaningful=groups.filter(g=>g.p!=='标点');
  return `<p class="hint">按原句顺序拆解 · 点击下方日文可放大字形${textOnly?'':'，点扬声器听读音'}</p><div class="word-list">${meaningful.map((g,j)=>{
   const {w,extra,base,definition,morph,parts,reviewed,contextual}=wordInfo(g),known=contextual?' <span class="pos">本句释义</span>':!reviewed?' <span class="auto" title="自动生成，尚未按本句核对">词义待核对</span>':'';
   return `<div class="word-row ${selected===g.i?'selected':''}" id="word-${g.i}" data-word="${g.i}"><span class="word-number">${String(j+1).padStart(2,'0')}</span><button type="button" class="word-title word-zoom-trigger" lang="ja" data-zoom-word="${g.i}" aria-label="放大词语：${esc(g.s)}" aria-haspopup="dialog" title="点击放大字形">${esc(g.s)}${base!==g.s?`<small>原形 ${esc(base)}</small>`:''}</button><div class="word-reading" lang="ja">${esc(g.k)}<small lang="en">${esc(g.r)}</small></div><div class="word-definition"><span class="pos">${esc(g.p)}</span>${esc(definition)}${known}</div>${textOnly?'':`<button class="word-audio" data-speak-group="${g.i}" aria-label="朗读 ${esc(g.s)}">${icon('audio')}</button>`}${g.combination?`<div class="word-extra">${combinationHTML(g)}</div>`:''}${g.sentenceLesson?`<div class="word-extra word-analysis">${sentencePatternCardsHTML([g.sentenceLesson])}</div>`:g.analyses?.length?`<div class="word-extra word-analysis">${analysisCardsHTML(g.analyses)}</div>`:''}${morph||extra.length||parts?`<details class="word-extra grammar-reference"><summary>原有词形注记（选看）</summary>${morph?esc(morph):''}${parts?`<br><span class="word-parts" lang="ja">构成：${esc(parts)}</span>`:''}${extra.map(x=>`<br><b>${esc(x.s)}</b>：${esc(x.d||'连接后续表达。')}`).join('')}</details>`:''}</div>`;
  }).join('')}</div><p class="footer-note">读音由分词词典生成，原文注音优先；专名、多音字与方言可能需要结合上下文核对。</p>`;
 }
 function openWord(index,{track=true}={}){
  const g=groups[index];if(!g||g.p==='标点')return;
  const vocabControl=vocabulary?.record(state.index,groups.slice(0,index).reduce((n,x)=>n+x.s.length,0),g,track)||'';
  selected=index;
  document.querySelectorAll('[data-select]').forEach(el=>el.classList.toggle('selected',Number(el.dataset.select)===index));
  document.querySelectorAll('[data-word]').forEach(el=>el.classList.toggle('selected',Number(el.dataset.word)===index));
  const wordSize=Math.max(32,Math.min(80,Math.floor(220/[...g.s].length/4)*4));
  const {w,extra,base,definition:groupDefinition,morph,parts,reviewed,contextual}=wordInfo(g);
  const months=[['一月','いちがつ'],['二月','にがつ'],['三月','さんがつ'],['四月','しがつ'],['五月','ごがつ'],['六月','ろくがつ'],['七月','しちがつ'],['八月','はちがつ'],['九月','くがつ'],['十月','じゅうがつ'],['十一月','じゅういちがつ'],['十二月','じゅうにがつ']];
  const month=months.findIndex(([s,k])=>s===g.s&&k===g.k)+1;
  const definition=month?`${g.s}；${month} 月，一年中的第 ${month} 个月。`:groupDefinition;
  const usage=month?`表示月份时，「月」读作「がつ」。${groups[index+1]?.s==='に'?`本句「${g.s}に」中的「に」表示事情发生的时间，意思是“在${g.s}”。`:''}`:'';
  dialog('word-dialog','词语解释',`<div class="word-zoom-card"><div class="word-zoom-text" lang="ja">${esc(g.s)}</div><p class="word-zoom-kana" lang="ja">${esc(g.k)}</p><p class="word-zoom-romaji" lang="en">${esc(g.r)}</p>${base!==g.s?`<p class="word-zoom-base">原形 <span lang="ja">${esc(base)}</span>${formReadingHTML(base,g.baseKana,true)}</p>`:''}</div>${vocabControl}<div class="word-zoom-size"><label for="word-zoom-size">字形大小</label><span aria-hidden="true">小</span><input id="word-zoom-size" type="range" min="32" max="128" step="4" value="${wordSize}"><span aria-hidden="true">大</span></div><p class="word-zoom-meaning"><span class="pos">${esc(g.p)}</span>${esc(definition)}${contextual?' <span class="pos">本句释义</span>':!reviewed&&!month?' <span class="auto" title="自动生成，尚未按本句核对">词义待核对</span>':''}</p>${g.sentenceLesson||g.analyses?.some(a=>a.plain)?'':actionBriefHTML(g.actionLessons)}${g.analyses?.some(a=>a.layered)?'<p class="word-unit-note">这是一整块动词表达，里面还含有语法变化。下面拆开看。</p>':''}${g.sentenceLesson?sentencePatternHTML(g.sentenceLesson):combinationHTML(g,true)}${g.sentenceLesson?'<details class="plain-more"><summary>更多词形与读音</summary>':''}${g.analyses?.length?`<section class="word-analysis" aria-label="本句形式讲解">${analysisCardsHTML(g.analyses,true,new Set((g.actionLessons||[]).flatMap(x=>x.contrastKeys||[])))}</section>`:''}${g.sentenceLesson?'</details>':''}${g.actionLessons?.length?'<details class="plain-more"><summary>查看「を」和动作的详细接法</summary>'+actionLessonsHTML(g.actionLessons)+'</details>':''}${usage?`<p class="word-zoom-note">${esc(usage)}</p>`:''}${morph||extra.length||parts?`<details class="word-zoom-note grammar-reference"><summary>原有词形注记（选看）</summary>${esc(morph)}${parts?`<p class="word-parts" lang="ja">构成：${esc(parts)}</p>`:''}${extra.map(x=>`<p><b lang="ja">${esc(x.s)}</b>：${esc(x.d||'连接后续表达。')}</p>`).join('')}</details>`:''}${textOnly?'':`${particleLinksHTML(g.particleKeys)}<button class="primary word-zoom-play" data-speak-group="${g.i}" aria-label="朗读 ${esc(g.s)}">${icon('audio')}听这个词</button>`}`);
  $('#word-dialog').style.setProperty('--word-zoom-size',wordSize+'px');
 }
 function grammarHTML(){
  const gs=grammarFor(),cur=CURATED[state.index];
  return `${syntaxHTML()}${combinationStudyHTML()}${particleStudyHTML()}${cur?.note?`<div class="beginner-note"><strong>这一句怎么读</strong>${esc(cur.note)}</div>`:''}<p class="hint">${cur?.g?'本句讲解':'按出现位置排列的句型提示；自动匹配，请结合词语和上下文判断。'}${textOnly?'':' · 下方“听讲解”播放原有句型简述，未包含上方新增的详细分析。'}</p><div class="grammar-list">${gs.map((g,i)=>`<article class="grammar-item"><span class="word-number">${String(i+1).padStart(2,'0')}</span><div><div class="grammar-heading"><h3>${esc(g.title)}</h3>${lessonButton('grammar',g.title,grammarAudioFor(g.title))}</div><details class="grammar-reference"><summary>原有简述（选看）</summary><p>${esc(g.body)}</p></details><span class="grammar-quote" lang="ja">${esc(g.quote)}</span>${(window.STUDY_GROUPS.grammarTeaching?.(g.title)||[]).map(grammarLessonHTML).join('')}${grammarGlossaryHTML()}</div></article>`).join('')}</div>${!gs.length?'<p class="empty-note">本行没有匹配到额外句型。先沿着词语顺序阅读，留意下面的助词以及动词词尾。</p>':''}${B.lines[state.index].notes.length?`<p class="hint">原文编辑注：${esc(B.lines[state.index].notes.join('；'))}</p>`:''}`;
 }
 function contextHTML(){
  const page=contextPage??Math.floor(state.index/12),start=page*12;
  return `<p class="hint">每个非空原文行保留为一个学习单位；一行里可能有不止一个句号。</p><div class="context-list">${B.lines.slice(start,start+12).map((l,j)=>`<button class="context-line ${start+j===state.index?'active':''}" data-goto="${start+j}"><small>第 ${start+j+1} 句 ${state.done.includes(start+j)?'· 已读':''}</small><span lang="ja">${esc(lineText(start+j))}</span></button>`).join('')}</div><div class="context-nav"><button class="outline" data-context="${page-1}" ${page===0?'disabled':''}>${icon('prev')}上一页</button><button class="outline" data-context="${page+1}" ${start+12>=B.lines.length?'disabled':''}>下一页${icon('next')}</button></div>`;
 }
 function currentQuiz(){
  if(!quizRound||quizRound.line!==state.index||quizRound.difficulty!==state.quizDifficulty)quizRound={line:state.index,difficulty:state.quizDifficulty,hints:{},showHint:false,questions:window.SENTENCE_QUIZ?.create(B,state.index,{limit:state.quizDifficulty==='challenge'?6:5,difficulty:state.quizDifficulty,curated:window.CURATED})||[],at:0,answers:{},finished:false};
  return quizRound;
 }
 function quizControlsHTML(){
  return `<div class="quiz-settings" aria-label="测验难度"><span>只需点击作答</span><div><button class="toggle ${state.quizDifficulty==='basic'?'on':''}" data-quiz-level="basic" aria-pressed="${state.quizDifficulty==='basic'}">基础</button><button class="toggle ${state.quizDifficulty==='challenge'?'on':''}" data-quiz-level="challenge" aria-pressed="${state.quizDifficulty==='challenge'}">进阶</button></div></div>`;
 }
 function quizHTML(){
  const round=currentQuiz(),questions=round.questions;
  if(!questions.length)return '<p class="empty-note">测验暂时无法加载，请刷新页面后再试。</p>';
  const score=questions.filter(q=>round.answers[q.id]===q.answerId).length;
  if(round.finished)return `${quizControlsHTML()}<section class="quiz-card" aria-label="本句测验结果"><div class="quiz-topline"><span>第 ${state.index+1} 句 · 本轮完成</span><button class="outline" data-quiz-reset="1">再练一组</button></div><h3 id="quiz-question-title" tabindex="-1">答对 ${score} / ${questions.length} 题</h3><p class="hint">${score===questions.length?'这一组都答对了，可以继续下一句，或换一组巩固。':'看看下面的答案，再读一次对应词语。'}</p><p class="hint">本轮 ${Object.keys(round.hints).length} 题使用过提示。</p><ol class="quiz-review">${questions.map(q=>{const correct=q.choices.find(c=>c.id===q.answerId),chosen=q.choices.find(c=>c.id===round.answers[q.id]),ok=round.answers[q.id]===q.answerId;return `<li><span class="quiz-result-label ${ok?'correct':'incorrect'}">${ok?'答对':'答错'}</span><strong lang="ja">${esc(q.focus)}</strong><p>${esc(q.prompt)}</p>${!ok?`<p>你的选择：${esc(chosen?.text)}</p>`:''}<p>正确答案：<b>${esc(correct?.text)}</b></p><p class="quiz-explanation">${esc(q.explanation)}</p></li>`;}).join('')}</ol></section>`;
  const q=questions[round.at],answered=Object.hasOwn(round.answers,q.id),chosen=round.answers[q.id],correct=q.choices.find(c=>c.id===q.answerId),ok=chosen===q.answerId;
  return `${quizControlsHTML()}<p class="hint">${state.quizDifficulty==='challenge'?'进阶每轮最多 6 题：混合词义、语法、相近读音、助词、动词形式和词序；短句按可用内容出题。':'基础每轮最多 5 题，复习词义、读音和原形。'}题目与选项随机打乱；填空和词序题按原文作答。</p><section class="quiz-card" aria-label="本句选择题"><div class="quiz-topline"><span>第 ${round.at+1} / ${questions.length} 题 · ${{reading:'读音',meaning:'词义',base:'原形',translation:'句意',grammar:'语法理解',particle:'助词填空',form:'形式辨别',order:'词序还原'}[q.kind]||'理解'}</span><button class="outline" data-quiz-reset="1">重新出题</button></div><h3 id="quiz-question-title" tabindex="-1">${esc(q.prompt)}</h3><p class="quiz-focus ${['translation','particle','form','order'].includes(q.kind)?'quiz-sentence':''}" lang="ja">${esc(q.focus)}</p>${q.context?`<p class="quiz-context" lang="ja">${esc(q.context)}</p>`:''}<div class="quiz-help"><button class="outline" data-quiz-hint="1" aria-expanded="${round.showHint}">${round.showHint?'收起提示':'查看原句与注释（提示）'}</button>${round.hints[q.id]?'<span>本题已使用提示</span>':''}</div>${round.showHint?`<div class="quiz-hint"><p lang="ja">${esc(lineText(state.index))}</p><p lang="ja">${esc(groups.map(g=>g.k).join(' '))}</p><p>${esc(chineseText(state.index))}</p><small>本句学习参考；答题后可看具体解释。</small></div>`:''}<div class="quiz-choices">${q.choices.map((c,i)=>`<button class="quiz-choice ${answered?(c.id===q.answerId?'correct':c.id===chosen?'incorrect':''):''}" data-quiz-answer="${esc(c.id)}" ${answered?'disabled':''}><span class="quiz-letter">${String.fromCharCode(65+i)}</span><span>${esc(c.text)}</span>${answered&&(c.id===q.answerId||c.id===chosen)?`<small>${c.id===q.answerId?'正确答案':'你的选择'}</small>`:''}</button>`).join('')}</div><div class="quiz-feedback" role="status" aria-live="polite">${answered?`<strong class="${ok?'correct':'incorrect'}">${ok?'答对了':'这题答错了'}</strong><p>正确答案：${esc(correct?.text)}</p><p class="quiz-explanation">${esc(q.explanation)}</p>`:''}</div><div class="quiz-actions"><span>已答 ${Object.keys(round.answers).length} / ${questions.length}</span><button class="primary" data-quiz-next="1" ${answered?'':'disabled'}>${round.at===questions.length-1?'查看结果':'下一题'}</button></div></section>`;
 }
 function renderQuiz(focus=false){$('#learning-panel').innerHTML=quizHTML();if(focus)$('#quiz-question-title')?.focus();}
 function answerQuiz(id){const round=currentQuiz(),q=round.questions[round.at];if(!q||round.finished||Object.hasOwn(round.answers,q.id)||!q.choices.some(c=>c.id===id))return;round.answers[q.id]=id;renderQuiz();}
 function nextQuiz(){const round=currentQuiz(),q=round.questions[round.at];if(!q||!Object.hasOwn(round.answers,q.id)||round.finished)return;if(round.at===round.questions.length-1)round.finished=true;else round.at++;round.showHint=false;renderQuiz(true);}

 function walkDetailHTML(block,i){
  return '<article class="walk-detail"><div class="walk-detail-heading"><span class="walk-number">'+(i+1)+'</span><h4>'+esc(block.role)+'</h4></div><p class="walk-quote" lang="ja">'+esc(block.quote)+'</p><p class="walk-meaning">'+esc(block.meaning)+'</p>'+plainBlockHTML(block)+'<details class="plain-more"><summary>详细语法与例句</summary>'+actionLessonsHTML(window.STUDY_GROUPS.actionConnections(B,B.lines[state.index]).filter(a=>a.start<block.end&&a.end>block.start))+chunkDetailedHTML(block)+chunkConnectionNotesHTML(block)+groups.filter(g=>g.combination&&g.combination.start>=block.start&&g.combination.end<=block.end).map(g=>combinationHTML(g)).join('')+'</details></article>';
 }
 function walkHTML(){
  const lesson=window.STUDY_GROUPS.walkthrough(B,B.lines[state.index]);
  if(!lesson){
   const guide=window.STUDY_GROUPS.analyses(B,B.lines[state.index],groups).guide;
   return '<section class="walkthrough"><h3>先把句子读通</h3>'+(guide?'<p class="hint">本句已有结构导读，逐块点击讲解尚未补齐。</p><div class="sentence-guide">'+esc(guide)+'</div>':'<p class="hint">本句还没有逐块讲解，可以先结合前后文和现有语法笔记阅读。</p>')+'<div class="walk-links"><button class="outline" data-tab="grammar">查看本句语法笔记</button><button class="outline" data-tab="context">连着前后文读</button><button class="outline" data-goto="20">看第 21 句拆句示例</button></div></section>';
  }
  walkAt=Math.max(0,Math.min(lesson.blocks.length-1,walkAt));
  let offset=0;const chunks=lesson.blocks.map((b,i)=>{const gap=lesson.jp.slice(offset,b.start);offset=b.end;return esc(gap)+'<button class="walk-chunk '+(walkAt===i?'active':'')+'" data-walk-step="'+i+'" aria-pressed="'+(walkAt===i)+'" aria-label="第 '+(i+1)+' 块：'+esc(b.role)+'"><small>'+(i+1)+' · '+esc(b.role)+'</small><span lang="ja">'+esc(b.quote)+'</span></button>';}).join('')+esc(lesson.jp.slice(offset));
  return '<section class="walkthrough" aria-label="按意群拆句"><div class="walk-heading"><h3>带着你读懂这句</h3><span>第 '+(walkAt+1)+' / '+lesson.blocks.length+' 块</span></div><p class="hint">这里按意思分块；点一块，查看它怎样接到整句。上方正文也可切换“按句意”直接查看；需要查词时切到“按词语”。</p><div class="walk-spine"><strong>先抓主干</strong><p>'+esc(lesson.spine)+'</p><strong>谁在说、谁在做</strong><p>'+esc(lesson.who)+'</p></div><div class="walk-chunks" aria-label="原文意群">'+chunks+'</div><div class="walk-controls"><button class="outline" data-walk-step="'+(walkAt-1)+'" '+(walkAt===0?'disabled':'')+'>上一块</button><button class="outline" data-walk-all="1" aria-pressed="'+walkAll+'">'+(walkAll?'逐块看':'一起展开')+'</button><button class="primary" data-walk-step="'+(walkAt+1)+'" '+(walkAt===lesson.blocks.length-1?'disabled':'')+'>下一块</button></div><div id="walk-details" aria-live="polite">'+(walkAll?lesson.blocks.map(walkDetailHTML).join(''):walkDetailHTML(lesson.blocks[walkAt],walkAt))+'</div><p class="walk-pitfall"><strong>这句最容易卡在哪里</strong>'+esc(lesson.pitfall)+'</p>'+ (lesson.links.length?'<div class="walk-links"><span>这句话要接着读：</span>'+lesson.links.map(n=>'<button class="outline" data-goto="'+(n-1)+'">第 '+n+' 句</button>').join('')+'</div>':'')+'<details class="form-analysis walk-translation"><summary>把整句连起来看中文</summary><p>'+esc(chineseText(state.index))+'</p></details><p class="hint">逐块详解已连续覆盖开篇第 1—173 句，以及第 181 句。其余句子按已有导读显示，不自动套成同一种结构；本轮新增内容为文字。</p></section>';
 }
 function highlightWalk(){
  const lesson=tab==='walk'?window.STUDY_GROUPS.walkthrough(B,B.lines[state.index]):null,block=lesson?.blocks[walkAt];let offset=0;
  for(const g of groups){const start=offset;offset+=g.s.length;document.querySelector('[data-select="'+g.i+'"]')?.classList.toggle('walk-focus',!!block&&start<block.end&&offset>block.start);}
  document.querySelectorAll('.sentence-chunk').forEach(el=>el.classList.toggle('walk-focus',!!block&&Number(el.dataset.sentenceChunk)===walkAt));
 }

 function panelHTML(){return tab==='walk'?walkHTML():tab==='words'?wordsHTML():tab==='grammar'?grammarHTML():tab==='quiz'?quizHTML():contextHTML();}
 const unavailableArt=new Set();
 function currentScene(){if(textOnly)return null;return window.SENTENCE_ART?.resolve(B,state.index,window.SENTENCE_ILLUSTRATIONS,unavailableArt)||window.ILLUSTRATIONS?.scenes.find(s=>s.start<=state.index&&state.index<=s.end&&!unavailableArt.has(s.src));}
 function sentenceArtCount(){return window.SENTENCE_ART?.completed(B,window.SENTENCE_ILLUSTRATIONS)||0;}
 function illustrationHTML(){const scene=currentScene();if(!scene)return '';return `<figure class="scene-card" data-scene="${esc(scene.id)}" data-illustration-kind="${scene.kind==='sentence'?'sentence':'scene'}"><figcaption><div><span class="scene-kicker">${scene.kind==='sentence'?'本句插图':'场景插画'}</span><strong>${esc(scene.title)}</strong><small>第 ${scene.start+1}${scene.end===scene.start?'':'–'+(scene.end+1)} 句</small></div><button class="scene-toggle" id="toggle-illustration" aria-expanded="${state.illustrations}">${state.illustrations?'收起':'展开'}</button></figcaption>${state.illustrations?`<button class="scene-image-button" id="open-illustration" aria-label="放大插画：${esc(scene.title)}"><img class="scene-image" src="${esc(scene.src)}" alt="${esc(scene.alt)}" width="${scene.width||1536}" height="${scene.height||1024}" decoding="async"></button>`:''}</figure>`;}
 function openIllustration(){const scene=currentScene();if(!scene)return;dialog('illustration-dialog',scene.title,`<img class="scene-full" src="${esc(scene.src)}" alt="${esc(scene.alt)}" width="${scene.width||1536}" height="${scene.height||1024}"><p class="art-caption">${esc(scene.alt)}</p>`);$('#illustration-dialog').classList.add('art-dialog');}
 function render(){
  document.body.classList.toggle('novel-mode',state.readingMode==='novel'&&!!novelReader);
  if(state.readingMode==='novel'&&novelReader){novelReader.mount($('#app'));vocabulary?.updateBadges();return;}
  novelReader?.destroy();
  if(!B?.lines?.length){$('#app').innerHTML='<p class="loading">书籍数据无法读取，请重新安装应用。</p>';return;}
  groups=makeGroups(B.lines[state.index]);const s=section(),done=state.done.includes(state.index),cur=CURATED[state.index];
  $('#app').innerHTML=`${!storageOK?'<div class="storage-warning">当前设备暂时无法保存进度。</div>':''}<header class="topbar"><div class="brand"><button class="mobile-menu" id="mobile-menu" aria-label="打开阅读目录">${icon('menu')}</button><div class="brand-symbol" aria-hidden="true">海</div><div><strong>听到涛声</strong><small>${native?'日语逐句读':'日语逐句读 · 网页版'}</small></div></div><div class="top-actions"><span class="quiet">一行一行，慢慢读。</span>${native?'':'<button class="outline desktop-only" data-web-open="1">手机打开</button>'}<button class="outline" id="open-novel">竖排阅读</button><button class="outline" data-vocab-action="open">生词本<span data-vocab-count></span></button><button class="outline" id="open-kana" aria-label="五十音图">あ <span>五十音图</span></button><button class="outline" id="open-settings" aria-label="${textOnly?'学习设置':'朗读与学习设置'}">${icon('settings')}<span class="settings-text">设置</span></button></div></header><div class="shell"><aside class="sidebar ${sidebar?'mobile-open':''}"><div class="eyebrow">READING NOTEBOOK</div><div class="book-title" lang="ja">海がきこえる</div><div class="author">氷室冴子 · 第一卷</div><div class="progress-label"><span>已读 ${state.done.length} 句</span><span>${(state.done.length/B.lines.length*100).toFixed(1)}%</span></div><div class="progress-track"><span style="width:${state.done.length/B.lines.length*100}%"></span></div>${textOnly?'<p class="text-only-note">此版本不含音频和插图。</p>':`<p class="illustration-progress" id="illustration-progress">逐句插图 ${sentenceArtCount()} / ${B.lines.length}</p>`}<h2>阅读目录</h2>${B.sections.map((x,i)=>`<button class="section-button ${s===x?'active':''}" data-goto="${x.start}"><span>${String(i+1).padStart(2,'0')}</span><span>${esc(x.name)}</span></button>`).join('')}<h2>跳到指定句</h2><form class="jump" id="jump"><label class="screen-only" for="jump-number">句子编号</label><input id="jump-number" type="number" inputmode="numeric" min="1" max="${B.lines.length}" value="${state.index+1}" required><button type="submit">前往</button></form><p class="sidebar-tip">目录按原帖分段整理，标题为阅读导航，并非原书章节名。<br>阅读位置自动保存。</p></aside><main class="main ${tab==='quiz'?'quiz-mode':''}"><div class="reading-header"><div><h1>${esc(s.name)}</h1><p>遇到长句，点“拆句读”，一步步看懂。</p></div><div class="fraction"><b>${String(state.index+1).padStart(3,'0')}</b> / ${B.lines.length}</div></div>${illustrationHTML()}<section class="sentence-card" aria-label="当前句"><div class="card-top"><span class="line-label"><span class="tiny-rule"></span>第 ${state.index+1} 句</span><div class="display-options"><button class="toggle ${state.ruby?'on':''}" data-toggle="ruby" aria-pressed="${state.ruby}">注音</button><button class="toggle ${state.kana?'on':''}" data-toggle="kana" aria-pressed="${state.kana}">假名</button><button class="toggle ${state.romaji?'on':''}" data-toggle="romaji" aria-pressed="${state.romaji}">罗马音</button><button class="toggle ${state.meaning?'on':''}" data-toggle="meaning" aria-pressed="${state.meaning}" title="显示或隐藏中文意思">${usingChunks()?'中文':'词义'}</button><button class="toggle ${state.segmented?'on':''}" data-toggle="segmented" ${usingChunks()?'hidden':''} aria-pressed="${state.segmented}" title="显示或隐藏词组边界">分词</button></div></div>${sentenceModeHTML()}<div class="japanese ${usingChunks()?'chunk-reading':''} ${state.segmented?'segmented':''} ${state.ruby?'':'no-ruby'} ${state.kana||state.romaji||state.meaning?'with-readings':''} ${state.meaning?'with-meanings':''}" lang="ja">${sentenceHTML()}</div><div class="sentence-footer">${textOnly?'':`<div class="playback"><button class="primary" id="play" aria-label="朗读当前句">${icon(playing?'stop':'play')}${playing?'停止朗读':'听这一句'}</button><label class="screen-only" for="speed">朗读速度</label><select id="speed" class="speed">${[[.6,'0.6×'],[.8,'0.8×'],[1,'1.0×']].map(([n,l])=>`<option value="${n}" ${state.rate===n?'selected':''}>${l}</option>`).join('')}</select><button class="loop-toggle ${sentenceOptions().count===0?'on':''}" id="loop-sentence" aria-pressed="${sentenceOptions().count===0}" title="无限重复本句，按停止可结束播放">∞ 无限循环</button></div>`}<button class="translation-toggle" id="translation-toggle" aria-expanded="${translation}">${translation?'收起中文':'看中文参考'} ${icon('down')}</button></div>${playbackHTML()}<div id="translation" class="translation" ${translation?'':'hidden'}>${esc(cur?.zh||B.lines[state.index].zh)}<small>${cur?.translationReview?'已对照日文校订':cur?'学习参考译文':'机器参考译文，专名、方言和省略句可能有误。'}</small>${cur?.translationReview?.note?`<small class="translation-note">译注：${esc(cur.translationReview.note)}</small>`:''}</div><p id="voice-message" class="voice-message" ${voiceMessage?'':'hidden'}>${esc(voiceMessage)}</p></section><nav class="learning-tabs" aria-label="学习内容"><button data-tab="walk" class="${tab==='walk'?'active':''}">拆句读</button><button data-tab="words" class="${tab==='words'?'active':''}">词语拆解 <span class="badge">${groups.filter(g=>g.p!=='标点').length}</span></button><button data-tab="grammar" class="${tab==='grammar'?'active':''}">语法笔记 <span class="badge">${grammarFor().length+(window.STUDY_GROUPS.analyses?.(B,B.lines[state.index],groups).items.length||0)}</span></button><button data-tab="quiz" class="${tab==='quiz'?'active':''}">句子测验</button><button data-tab="context" class="${tab==='context'?'active':''}">原文对照</button></nav><section id="learning-panel">${panelHTML()}</section>${state.index===B.lines.length-1?'<div class="end-note">已经读到本文件的最后一行。给坚持到这里的自己留一点掌声。</div>':''}</main></div><footer class="bottom-nav"><div class="nav-left"><button class="outline" id="prev" ${state.index===0?'disabled':''} aria-label="上一句">${icon('prev')}上一句</button><span class="kbd-tip">← → 切换句子</span></div><div class="nav-next"><button class="outline done-label" id="mark-done" aria-pressed="${done}">${icon('check')}${done?'已读':'标为已读'}</button><button class="primary" id="next" ${state.index===B.lines.length-1?'disabled':''}>下一句 ${icon('next')}</button></div></footer>`;
  updatePlay();
  highlightWalk();
  vocabulary?.updateBadges();
 }
 document.addEventListener('error',e=>{if(!e.target?.matches?.('.scene-image,.scene-full'))return;const src=e.target.getAttribute('src');if(!src||unavailableArt.has(src))return;unavailableArt.add(src);e.target.closest('dialog')?.close();render();},true);
 document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el||el.disabled)return;
  if(el.dataset.particleGuide!==undefined){openParticleGuide(el.dataset.particleGuide);return;}
  if(el.dataset.goto!==undefined){setIndex(Number(el.dataset.goto));return;}
  if(el.dataset.toggle){state[el.dataset.toggle]=!state[el.dataset.toggle];save();render();return;}
  if(el.dataset.sentenceMode){state.sentenceMode=el.dataset.sentenceMode==='words'?'words':'chunks';save();render();document.querySelector('[data-sentence-mode="'+state.sentenceMode+'"]')?.focus({preventScroll:true});return;}
  if(el.dataset.sentenceChunk!==undefined){openSentenceChunk(Number(el.dataset.sentenceChunk));return;}
  if(el.dataset.chunkWord!==undefined){const origin=Number(el.dataset.chunkOrigin);openWord(Number(el.dataset.chunkWord));$('#word-dialog .drawer-head')?.insertAdjacentHTML('afterend','<button class="outline chunk-word-back" data-sentence-chunk="'+origin+'">返回这一意群</button>');return;}
  if(el.dataset.walkStep!==undefined){const l=window.STUDY_GROUPS.walkthrough(B,B.lines[state.index]),n=Number(el.dataset.walkStep);if(!l||!Number.isInteger(n)||n<0||n>=l.blocks.length)return;walkAt=n;$('#learning-panel').innerHTML=walkHTML();highlightWalk();document.querySelector('.walk-chunk[data-walk-step="'+n+'"]')?.focus({preventScroll:true});return;}
  if(el.dataset.walkAll){walkAll=!walkAll;$('#learning-panel').innerHTML=walkHTML();highlightWalk();document.querySelector('[data-walk-all]')?.focus({preventScroll:true});return;}
  if(el.dataset.tab){if(el.dataset.tab==='quiz')stop();tab=el.dataset.tab;selected=-1;render();highlightWalk();if(tab==='quiz')window.scrollTo(0,0);return;}
  if(el.dataset.select!==undefined){openWord(Number(el.dataset.select));return;}
  if(el.dataset.zoomWord!==undefined){openWord(Number(el.dataset.zoomWord));return;}
  if(el.dataset.quizLevel){if(state.quizDifficulty!==el.dataset.quizLevel){state.quizDifficulty=el.dataset.quizLevel;quizRound=null;save();renderQuiz(true);}return;}
  if(el.dataset.quizHint!==undefined){const round=currentQuiz(),q=round.questions[round.at];round.showHint=!round.showHint;if(round.showHint&&q)round.hints[q.id]=true;renderQuiz();return;}
  if(el.dataset.quizAnswer!==undefined){answerQuiz(el.dataset.quizAnswer);return;}
  if(el.dataset.quizNext!==undefined){nextQuiz();return;}
  if(el.dataset.quizReset!==undefined){quizRound=null;renderQuiz(true);return;}
  if(el.dataset.formReading){const text=el.dataset.formReading;if(!/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(text))return;if(playing&&activePlayback?.key==='form:'+text)stop();else startPlayback([{text,lang:'ja'}],{},'form:'+text,'原形：'+el.dataset.formTitle);return;}
  if(el.dataset.speakGroup!==undefined){speakGroup(Number(el.dataset.speakGroup));return;}
  if(el.dataset.grammarAudio!==undefined){playGrammar(el.dataset.grammarAudio);return;}
  if(el.dataset.particleAudio!==undefined){playParticle(Number(el.dataset.particleAudio));return;}
  if(el.dataset.context!==undefined){contextPage=Number(el.dataset.context);$('#learning-panel').innerHTML=contextHTML();return;}
  if(el.dataset.kanaSpeak){speak(el.dataset.kanaSpeak);el.classList.add('speaking');setTimeout(()=>el.classList.remove('speaking'),900);return;}
  if(el.dataset.kanaTab){kanaTab=el.dataset.kanaTab;$('#kana-content').innerHTML=kanaContent();return;}
  if(el.dataset.close){el.closest('dialog').close();return;}
  if(el.dataset.webOpen){openWebAccess();return;}
  switch(el.id){
   case'prev':setIndex(state.index-1);break;
   case'next':setIndex(state.index+1);break;
   case'mark-done':state.done=state.done.includes(state.index)?state.done.filter(x=>x!==state.index):[...state.done,state.index];save();render();break;
   case'play':if(playing)stop();else playSentence();break;
   case'loop-sentence':toggleInfinite();break;
   case'toggle-role-voice':{const resume=playing&&activePlayback?.key==='sentence';stop();state.roleVoices=!state.roleVoices;save();render();if(resume)playSentence();break;}
   case'go-role-preview':{const first=Number(Object.keys(window.ROLE_AUDIO?.clips||{}).sort((a,b)=>Number(a)-Number(b))[0]);if(Number.isInteger(first)){$('dialog[open]')?.close();setIndex(first);}break;}
   case'translation-toggle':translation=!translation;$('#translation').hidden=!translation;el.innerHTML=(translation?'收起中文':'看中文参考')+' '+icon('down');el.setAttribute('aria-expanded',String(translation));break;
   case'open-illustration':openIllustration();break;
   case'toggle-illustration':state.illustrations=!state.illustrations;save();render();break;
   case'open-novel':if(novelReader){stop();state.readingMode='novel';if(state.novelPosition?.line!==state.index)state.novelPosition={line:state.index,offset:0};save();render();}break;
   case'open-kana':openKana();break;
   case'open-settings':openSettings();break;
   case'export-progress':exportProgress();break;
   case'import-progress':$('#progress-file').click();break;
   case'confirm-import':if(pendingImport){stop();Object.assign(state,pendingImport);pendingImport=null;save();$('dialog[open]')?.close();selected=-1;translation=false;contextPage=null;render();toast('阅读进度已恢复。');}break;
   case'mobile-menu':sidebar=!sidebar;$('.sidebar').classList.toggle('mobile-open',sidebar);break;
   case'tts-settings':if(native)native.openTtsSettings();else toast('请在设备的语言与语音设置里安装日语语音包。');break;
   case'test-voice':speak('こんにちは。いっしょに、にほんごをよみましょう。');break;
  }
 });
 document.addEventListener('submit',e=>{if(e.target.id==='jump'){e.preventDefault();const n=Number($('#jump-number').value);if(Number.isInteger(n)&&n>=1&&n<=B.lines.length)setIndex(n-1);else toast('请输入 1 到 '+B.lines.length+' 之间的句子编号。');}});
 document.addEventListener('input',e=>{if(e.target.id==='word-zoom-size')$('#word-dialog')?.style.setProperty('--word-zoom-size',Math.max(32,Math.min(128,Number(e.target.value)||80))+'px');});
 document.addEventListener('change',e=>{if(['play-mode','play-count','play-pause'].includes(e.target.id)){const options=sentenceOptions();options[{ 'play-mode':'mode','play-count':'count','play-pause':'pause'}[e.target.id]]=e.target.id==='play-mode'?e.target.value:Number(e.target.value);const resume=playing&&activePlayback?.key==='sentence';stop();state.sentencePlayback[state.index]=options;save();render();if(resume)playSentence();}if(e.target.id==='speed'){state.rate=Number(e.target.value);save();if(playing&&activePlayback)startPlayback(activePlayback.clips,activePlayback.options,activePlayback.key,activePlayback.label);}if(e.target.id==='voice-select'){state.voice=e.target.value;save();}});
 document.addEventListener('keydown',e=>{if(state.readingMode==='novel')return;if($('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'){e.preventDefault();setIndex(state.index-1);}if(e.key==='ArrowRight'){e.preventDefault();setIndex(state.index+1);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',()=>stop());
 document.addEventListener('change',async e=>{
  if(e.target.id!=='progress-file'||!e.target.files?.length)return;
  const file=e.target.files[0];e.target.value='';
  try{if(file.size>16*1024*1024)throw new Error('备份文件过大，请选择阅读进度 JSON 文件。');pendingImport=window.UMI_WEB.decode(await file.text(),B.lines.length);$('dialog[open]')?.close();dialog('import-dialog','恢复阅读进度',`<p class="hint">备份停在第 <b>${pendingImport.index+1}</b> 句，已读 <b>${pendingImport.done.length}</b> 句。恢复后会替换当前浏览器的进度、跟读设置、生词本和查词统计。</p><div class="settings-row"><button class="outline" data-close="1">取消</button><button class="primary" id="confirm-import">恢复此备份</button></div>`);}catch(error){pendingImport=null;toast(error.message||'无法读取备份文件。');}
 });
 window.readerBack=()=>{const dialog=$('dialog[open]');if(dialog){dialog.close();return true;}if(sidebar){sidebar=false;$('.sidebar').classList.remove('mobile-open');return true;}if(state.readingMode==='novel'&&novelReader){novelReader.leave();return true;}return false;};
 const kanaRows=['あいうえお','かきくけこ','さしすせそ','たちつてと','なにぬねの','はひふへほ','まみむめも','や ゆ よ','らりるれろ','わ   を','ん    '];
 const voiced=['がぎぐげご','ざじずぜぞ','だぢづでど','ばびぶべぼ','ぱぴぷぺぽ'];
 const contracted=['きゃ','きゅ','きょ','しゃ','しゅ','しょ','ちゃ','ちゅ','ちょ','にゃ','にゅ','にょ','ひゃ','ひゅ','ひょ','みゃ','みゅ','みょ','りゃ','りゅ','りょ','ぎゃ','ぎゅ','ぎょ','じゃ','じゅ','じょ','びゃ','びゅ','びょ','ぴゃ','ぴゅ','ぴょ'];
 function kanaContent(){const cells=kanaTab==='contracted'?contracted:(kanaTab==='voiced'?voiced:kanaRows).flatMap(row=>[...row]);return `<div class="kana-tabs">${[['basic','清音'],['voiced','浊音 / 半浊音'],['contracted','拗音']].map(([id,label])=>`<button class="${kanaTab===id?'active':''}" data-kana-tab="${id}">${label}</button>`).join('')}</div><div class="kana-grid" ${kanaTab==='contracted'?'style="grid-template-columns:repeat(3,1fr)"':''}>${cells.map(k=>k===' '?'<span class="kana-empty"></span>':`${textOnly?'<span class="kana-cell">':`<button class="kana-cell" data-kana-speak="${k}" aria-label="朗读 ${k} ${wanakana.toRomaji(k)}">`}<strong lang="ja">${k}</strong><span lang="ja">${wanakana.toKatakana(k)}</span><small>${wanakana.toRomaji(k)}</small>${textOnly?'</span>':'</button>'}`).join('')}</div><div class="kana-notes"><p><b>怎么用：</b>上面是平假名，下面是片假名和罗马音。${textOnly?'':'点任意格子听读音。'}</p><p><b>助词读音：</b>は 作话题助词时读 wa；へ 作方向助词时读 e；を 读 o。</p><p><b>小っ：</b>停顿一拍，如 きって（kitte）。小ゃ・ゅ・ょ和前一拍合读，如 きゃ（kya）。</p><p><b>长音：</b>多保持一拍。とうきょう写作 toukyou；片假名常用「ー」，如コーヒー。</p></div>`;}
 function dialog(id,title,body){$('#'+id)?.remove();const d=document.createElement('dialog');d.id=id;d.className=id==='word-dialog'?'drawer word-dialog':'drawer';d.setAttribute('aria-label',title);d.innerHTML=`<div class="drawer-inner"><div class="drawer-head"><h2>${esc(title)}</h2><button class="close" data-close="1" aria-label="关闭">${icon('close')}</button></div>${body}</div>`;document.body.append(d);d.addEventListener('click',e=>{if(e.target===d){const rect=d.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)d.close();}});d.showModal();}
 function openKana(){dialog('kana-dialog','五十音图',`<p class="drawer-subtitle">随时查，慢慢记。${textOnly?'':'点一下就能听。'}</p><div id="kana-content">${kanaContent()}</div>`);}
 function webSettingsHTML(){return native?'':`<div class="web-settings"><label class="settings-label">网页版 · 随时接着读</label><p class="hint">${textOnly?'电脑和手机使用同一份正文与学习资料。':'电脑和手机共用正文、插画与录音。'}阅读位置和每句设置保存在当前浏览器中；安卓 App 与不同浏览器之间不会自动同步进度。</p><div class="settings-row"><button class="outline" data-web-open="1">查看手机访问地址</button><button class="outline" id="export-progress">导出进度</button><button class="outline" id="import-progress">导入进度</button></div><input type="file" id="progress-file" accept=".json,application/json" hidden><p class="hint">将导出的 JSON 备份传到另一台设备，在该设备的网页版导入，就能继续阅读。</p></div>`;}
 function exportProgress(){const url=URL.createObjectURL(new Blob([window.UMI_WEB.encode(state,B.lines.length)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='听到涛声-阅读进度-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('进度备份已导出。');}
 async function openWebAccess(){
  $('dialog[open]')?.close();dialog('web-access-dialog','在手机浏览器打开',`<p class="drawer-subtitle">手机和电脑连接同一个路由器或 Wi-Fi。</p><div id="web-addresses" role="status">正在读取访问地址…</div><div class="source-note">在手机浏览器输入上面的地址，然后收藏网页。阅读时电脑需要开机，网页版服务需要保持运行。<br><br>如果打不开，先检查手机是否仍在使用移动数据，以及电脑是否允许本程序通过防火墙访问本地网络。</div>`);
  try{const response=await fetch('api/connection',{cache:'no-store'});if(!response.ok)throw new Error();const info=await response.json();const urls=info.addresses?.filter(item=>/^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:\d+\/$/.test(item.url))||[];const el=$('#web-addresses');if(el)el.innerHTML=urls.length?urls.map(item=>`<div class="web-address"><small>${esc(item.name)}</small><a href="${esc(item.url)}">${esc(item.url)}</a></div>`).join(''):'没有发现局域网地址，请先连接家里的路由器。';}catch{const el=$('#web-addresses');if(el)el.textContent='请双击文件夹里的“启动听到涛声网页版”，再来查看手机访问地址。';}
 }
 function roleSettingsHTML(){if(textOnly)return '';const indices=Object.keys(window.ROLE_AUDIO?.clips||{}).map(Number).sort((a,b)=>a-b);if(!indices.length)return '';return `<label class="settings-label">角色配音试听</label><p class="hint">第 ${indices[0]+1}–${indices.at(-1)+1} 句：拓的旁白与台词采用男声，母亲采用女声，并按情节设置语气。每句可以对比原版，日文 → 中文与循环播放照常使用。其余正文和词语仍使用原版声音。</p><div class="settings-row"><button class="primary" id="go-role-preview">从第 ${indices[0]+1} 句试听</button></div>`;}
 function learningSettingsHTML(){if(textOnly)return '';const indices=new Set([...Object.keys(window.LEARNING_AUDIO?.chinese||{}),...Object.keys(window.CHINESE_EMOTION?.clips||{})]),completed=[...indices].map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<B.lines.length&&chineseRoleFor(i)).length,grammar=Object.keys(window.LEARNING_AUDIO?.grammar||{}).filter(grammarAudioFor).length;return `<label class="settings-label">中文情感配音</label><p class="hint">已完成 ${completed} / ${B.lines.length} 句。已完成的句子会优先播放新的中文配音，和日文共用“对比原版”开关；其余句子仍可听原版中文录音。中文内容与页面参考译文逐字对应。</p><label class="settings-label">语法与助词讲解</label><p class="hint">${grammar?`已有 ${grammar} 条语法讲解录音。`:'讲解录音正在准备。'}在语法笔记里点“听讲解”，先听日文句型或助词，再听中文解释。讲解只播放一遍；点“停止讲解”、上方“停止朗读”，或切换句子都可停止。</p>`;}
 function openSettings(){if(textOnly){dialog('settings-dialog','学习设置',`<p class="drawer-subtitle">此版本不含音频和插图。</p>${webSettingsHTML()}<label class="settings-label">给初学者的小提示</label><div class="source-note">先看日文和假名，试着自己读，再打开中文参考。熟悉假名后可以关掉罗马音。点击日文可查看词语解释与内部构成，使用句子测验检查理解。<br><br>全书 ${B.lines.length} 个原文行均可学习，一行可能包含多个句号。中文机器参考译文、自动词义与句型提示未经逐句人工审校，专名与方言需结合上下文核对。<br><br>阅读位置与显示偏好自动保存在当前浏览器中。</div>`);return;}dialog('settings-dialog','朗读与学习设置',`<p class="drawer-subtitle">${native?'正文、学习资料与双语音频保存在应用里。':'沿用 App 的正文、插画与双语录音，打开就能继续读。'}</p>${webSettingsHTML()}${roleSettingsHTML()}${learningSettingsHTML()}<label class="settings-label">原版朗读</label><p class="hint">日文：Nanami · 中文：晓晓。使用神经网络合成声音，保留句子停顿和语气起伏。建议先用 1.0× 听自然语调，再放慢跟读。</p><div class="settings-row"><button class="primary" id="test-voice">${icon('audio')}试听日文</button></div><label class="settings-label">逐句插图</label><p class="hint">已完成 ${sentenceArtCount()} / ${B.lines.length} 张，优先显示与当前原文一致的独立插图。未完成的句子若已有场景插画，则继续显示场景图。新图会分批加入；网页版刷新后加载，安卓 App 随安装包更新。</p><label class="settings-label">场景插画</label><p class="hint">开篇第 1–${window.ILLUSTRATIONS.coveredLines} 句已绘制 ${window.ILLUSTRATIONS.scenes.length} 个场景。相邻几句共用同一画面，点插画可放大，也可收起。人物和公寓采用固定参考设定；这是辅助阅读的原创 AI 插画，并非原书官方插图。</p><label class="settings-label">循环跟读</label><p class="hint">点“∞ 无限循环”即可重复播放当前这一句，也可在下面设置朗读顺序、次数和停顿，该句会单独记住设置。“日文 → 中文”先读原文，再读页面显示的中文参考。按停止、切换句子或离开应用都会结束循环。</p><label class="settings-label">给初学者的小提示</label><div class="source-note">先听一句，再看假名；试着自己读，最后打开中文参考。熟悉假名后可以关掉罗马音。<br><br>词语按原句顺序排列。全书 ${B.lines.length} 个原文行均可学习；一行可能包含多个句号。词语释义已按全书学习分组校订；“开篇 · 初到东京”第 1–173 句中文已对照日文重校。后续整句中文仍包含机器参考，句型提示也需结合上下文核对。<br><br>语音为合成朗读，不是真人有声书；声音的语气不代表原作者的表演指导。中文音频和显示的参考译文一致。阅读位置和每句循环设置自动保存。</div>`);}

 vocabulary=window.createVocabularyNotebook?.({book:B,getState:()=>state,save,showDialog:dialog,stop,openSource:source=>{state.readingMode='study';setIndex(source.line);let offset=0;const index=groups.findIndex(g=>{const at=offset;offset+=g.s.length;return at===source.offset;});if(index>=0)openWord(index,{track:false});}});
 novelReader=window.createNovelReader?.({book:B,getState:()=>state,save,showDialog:dialog,wordRange:(line,offset)=>{const word=novelWordAt(line,offset);return word?{start:word.start,end:word.end}:null;},lookup:(line,offset)=>{const word=novelWordAt(line,offset);if(!word)return;stop();state.index=line;groups=word.words;save();openWord(word.g.i);},exit:line=>{stop();state.index=line;state.readingMode='study';selected=-1;quizRound=null;walkAt=0;save();render();window.scrollTo(0,0);}});
 render();
})();
