/* Quiet vertical reading. All text comes from the same local book as study mode. */
(()=>{
 'use strict';
 window.createNovelReader=function({book,getState,save,lookup,wordRange,exit,showDialog}){
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const source=i=>book.lines[i].t.map(n=>book.words[n].s).join('');
  let root=null,flow=null,stage=null,observer=null,scrollTimer=0,resizeFrame=0,sectionIndex=0,paragraphs=[],pageWidth=0,anchor=null,lookupLine=null,layoutRunning=false;
  const state=()=>getState();
  const bounds=()=>({start:book.sections[sectionIndex].start,end:book.sections[sectionIndex+1]?.start??book.lines.length});
  const sectionFor=n=>Math.max(0,book.sections.findIndex((s,i)=>s.start<=n&&n<(book.sections[i+1]?.start??book.lines.length)));
  function position(value,fallback){
   const line=Number.isInteger(value?.line)&&value.line>=0&&value.line<book.lines.length?value.line:fallback;
   const offset=Number.isInteger(value?.offset)?Math.max(0,Math.min(source(line).length-1,value.offset)):0;
   return {line,offset};
  }
  const characters=text=>escape(text).replace(/(?<![0-9０-９])[0-9０-９]{1,2}(?![0-9０-９])/gu,'<span class="novel-tcy">$&</span>');
  function paragraphHTML(index){
   let offset=0;
   const text=book.lines[index].t.map(n=>{
    const w=book.words[n],start=offset;offset+=w.s.length;
    if(w.p==='标点')return escape(w.s);
    const surface=characters(w.s),reading=state().novelRuby&&/[\p{Script=Han}]/u.test(w.s)?'<ruby>'+surface+'<rt>'+escape(w.k)+'</rt></ruby>':surface;
    return '<span class="novel-word" role="button" tabindex="0" data-novel-line="'+index+'" data-novel-offset="'+start+'" data-novel-end="'+offset+'" aria-label="查看 '+escape(w.s)+'" aria-haspopup="dialog">'+reading+'</span>';
   }).join('');
   return '<p data-novel-paragraph="'+index+'"'+(/^[「『]/u.test(source(index))?' class="novel-dialogue"':'')+'>'+text+'</p>';
  }
  // Highlight the same learning expression as lookup, including every raw
  // tokenizer piece (e.g. ふん + だ). Keep the existing vertical text and ruby.
  function rangeOf(word){
   const line=Number(word.dataset.novelLine),offset=Number(word.dataset.novelOffset);
   return {line,...(wordRange?.(line,offset)||{start:offset,end:Number(word.dataset.novelEnd)})};
  }
  function highlight(range,className){
   if(!flow)return;
   flow.querySelectorAll('.'+className).forEach(el=>el.classList.remove(className));
   if(!range)return;
   const p=flow.querySelector('[data-novel-paragraph="'+range.line+'"]');
   p?.querySelectorAll('[data-novel-offset]').forEach(el=>{
    if(Number(el.dataset.novelOffset)<range.end&&Number(el.dataset.novelEnd)>range.start)el.classList.add(className);
   });
  }
  function clearHighlights(){highlight(null,'novel-word-hovered');highlight(null,'novel-word-selected');}
  function previewWord(e){
   const word=e.target.closest?.('[data-novel-line]');
   highlight(word&&flow.contains(word)?rangeOf(word):null,'novel-word-hovered');
  }
  function endPreview(){highlight(null,'novel-word-hovered');}
  function visibleAnchor(){
   if(!flow||!pageWidth)return anchor;
   const box=flow.getBoundingClientRect();
   for(const p of paragraphs){
    const r=p.getBoundingClientRect();
    if(r.right<=box.left+1||r.left>=box.right-1)continue;
    for(const token of p.querySelectorAll('[data-novel-offset]')){
     if([...token.getClientRects()].some(t=>t.left>=box.left-1&&t.right<=box.right+1&&t.bottom>box.top&&t.top<box.bottom))
      return {line:Number(token.dataset.novelLine),offset:Number(token.dataset.novelOffset)};
    }
    return {line:Number(p.dataset.novelParagraph),offset:0};
   }
   return anchor;
  }
  function remember(){
   const next=visibleAnchor();if(!next)return;
   anchor=next;
   if(state().novelPosition?.line!==next.line||state().novelPosition?.offset!==next.offset||state().index!==next.line){
    state().novelPosition={...next};state().index=next.line;save();
   }
  }
  function updateNavigation(){
   if(!flow)return;
   const travel=Math.max(0,flow.scrollWidth-flow.clientWidth),distance=Math.min(travel,Math.abs(flow.scrollLeft)),last=travel-distance<2,first=distance<2;
   const total=Math.max(1,Math.ceil(flow.scrollWidth/(pageWidth||1))),page=last?total:Math.min(total,Math.floor((distance+1)/(pageWidth||1))+1);
   const next=root.querySelector('[data-novel-action="next"]'),prev=root.querySelector('[data-novel-action="prev"]');
   next.disabled=last&&sectionIndex===book.sections.length-1;prev.disabled=first&&sectionIndex===0;
   next.textContent=last?(next.disabled?'全书完':'← 下一节'):'← 下一页';prev.textContent=first&&sectionIndex>0?'上一节 →':'上一页 →';
   root.querySelector('#novel-page-status').textContent=page+' / '+total+' 页';
   root.querySelector('.novel-progress span').style.width=(page/total*100)+'%';
  }
  function scrollChanged(){
   if(layoutRunning)return;
   clearHighlights();lookupLine=null;updateNavigation();clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,150);
  }
  function layout(target=anchor){
   if(!flow||!stage)return;
   const available=stage.clientWidth,height=stage.clientHeight;if(!available||!height)return;
   layoutRunning=true;
   const pitch=state().novelFont*2;
   pageWidth=Math.max(pitch,Math.floor(available/pitch)*pitch);
   flow.style.width=pageWidth+'px';flow.style.height=Math.max(state().novelFont*4,Math.floor((height-12)/state().novelFont)*state().novelFont)+'px';
   const padding=flow.querySelector('.novel-end-space');
   if(padding){padding.style.width='0px';padding.style.width=(Math.ceil(flow.scrollWidth/pageWidth)*pageWidth-flow.scrollWidth)+'px';}
   flow.scrollLeft=0;
   if(target){
    const p=flow.querySelector('[data-novel-paragraph="'+target.line+'"]');
    const tokens=p?[...p.querySelectorAll('[data-novel-offset]')]:[];
    const token=[...tokens].reverse().find(t=>Number(t.dataset.novelOffset)<=target.offset)||p;
    const r=token?.getClientRects()[0],box=flow.getBoundingClientRect();
    if(r){const distance=Math.max(0,box.right-r.right);flow.scrollLeft=-Math.floor(distance/pageWidth)*pageWidth;}
   }
   layoutRunning=false;updateNavigation();remember();
  }
  function redraw(target=anchor){
   clearTimeout(scrollTimer);lookupLine=null;
   const {start,end}=bounds();
   root.querySelector('.novel-section-name').textContent=book.sections[sectionIndex].name;
   root.style.setProperty('--novel-font',state().novelFont+'px');
   flow.innerHTML=Array.from({length:end-start},(_,i)=>paragraphHTML(start+i)).join('')+'<div class="novel-end-space" aria-hidden="true"></div>';
   paragraphs=[...flow.querySelectorAll('[data-novel-paragraph]')];
   root.querySelector('[data-novel-action="ruby"]').setAttribute('aria-pressed',String(state().novelRuby));
   root.querySelector('[data-novel-action="smaller"]').disabled=state().novelFont<=18;
   root.querySelector('[data-novel-action="larger"]').disabled=state().novelFont>=30;
   root.querySelector('.novel-font-controls').setAttribute('aria-label','字号 '+state().novelFont);
   layout(target);
  }
  function goSection(n,last=false){
   if(n<0||n>=book.sections.length)return;
   sectionIndex=n;const {start,end}=bounds();
   anchor={line:last?end-1:start,offset:last?source(end-1).length-1:0};
   state().index=anchor.line;state().novelPosition={...anchor};save();redraw(anchor);
   if(last){flow.scrollLeft=-(flow.scrollWidth-flow.clientWidth);remember();updateNavigation();}
  }
  function turn(direction){
   if(!flow)return;
   clearTimeout(scrollTimer);clearHighlights();lookupLine=null;
   const distance=Math.abs(flow.scrollLeft),travel=Math.max(0,flow.scrollWidth-flow.clientWidth);
   if(direction===1&&travel-distance<2){goSection(sectionIndex+1);return;}
   if(direction===-1&&distance<2){goSection(sectionIndex-1,true);return;}
   const page=direction===1?Math.floor((distance+1)/pageWidth)+1:Math.ceil((distance-1)/pageWidth)-1;
   flow.scrollLeft=-Math.max(0,Math.min(travel,page*pageWidth));remember();updateNavigation();
  }
  function leave(){
   clearTimeout(scrollTimer);const selected=lookupLine;remember();exit(selected??anchor?.line??state().index);
  }
  function openContents(){
   showDialog('novel-contents','阅读目录','<p class="hint">沿用逐句版的阅读分段。选择一节继续读。</p><div class="novel-contents">'+book.sections.map((s,i)=>'<button data-novel-section="'+i+'" aria-current="'+(i===sectionIndex?'true':'false')+'"><small>'+String(i+1).padStart(2,'0')+'</small>'+escape(s.name)+'</button>').join('')+'</div>');
  }
  function click(e){
   if(!root)return;
   const chapter=e.target.closest('[data-novel-section]');
   if(chapter){chapter.closest('dialog')?.close();goSection(Number(chapter.dataset.novelSection));return;}
   const action=e.target.closest('[data-novel-action]');
   if(action&&!action.disabled){
    switch(action.dataset.novelAction){
     case'exit':leave();break;
     case'next':turn(1);break;
     case'prev':turn(-1);break;
     case'contents':openContents();break;
     case'ruby':remember();state().novelRuby=!state().novelRuby;save();redraw();break;
     case'smaller':case'larger':remember();state().novelFont=Math.max(18,Math.min(30,state().novelFont+(action.dataset.novelAction==='larger'?2:-2)));save();redraw();break;
    }
    return;
   }
   const word=e.target.closest('[data-novel-line]');
   if(word&&!window.getSelection()?.toString()){
    clearTimeout(scrollTimer);remember();lookupLine=Number(word.dataset.novelLine);
    const range=rangeOf(word);highlight(null,'novel-word-hovered');highlight(range,'novel-word-selected');
    lookup(lookupLine,Number(word.dataset.novelOffset));
   }
  }
  function keydown(e){
   if(!root||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;
   if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-novel-line]')){e.preventDefault();e.target.click();return;}
   if(['ArrowLeft','PageDown','ArrowRight','PageUp'].includes(e.key)){e.preventDefault();turn(['ArrowLeft','PageDown'].includes(e.key)?1:-1);}
   if(e.key==='Escape'){e.preventDefault();leave();}
  }
  function wheel(e){
   if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&!e.ctrlKey){e.preventDefault();flow.scrollLeft-=e.deltaY;}
  }
  function resize(){window.cancelAnimationFrame?.(resizeFrame);resizeFrame=window.requestAnimationFrame?window.requestAnimationFrame(()=>layout(anchor)):window.setTimeout(()=>layout(anchor),0);}
  function hide(){if(root&&document.hidden)remember();}
  function destroy(){
   clearTimeout(scrollTimer);window.cancelAnimationFrame?.(resizeFrame);observer?.disconnect();observer=null;
   document.removeEventListener('click',click);document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',hide);
   window.removeEventListener('resize',resize);window.removeEventListener('pagehide',remember);
   flow?.removeEventListener('scroll',scrollChanged);flow?.removeEventListener('wheel',wheel);
   flow?.removeEventListener('pointerover',previewWord);flow?.removeEventListener('pointerout',endPreview);
   flow?.removeEventListener('focusin',previewWord);flow?.removeEventListener('focusout',endPreview);
   root=null;flow=null;stage=null;paragraphs=[];pageWidth=0;
  }
  function mount(container){
   destroy();anchor=position(state().novelPosition,state().index);sectionIndex=sectionFor(anchor.line);lookupLine=null;
   container.innerHTML='<main class="novel-reader" aria-label="轻小说竖排阅读"><header class="novel-top"><div class="novel-book-name" lang="ja">海がきこえる</div><div class="novel-tools"><button data-novel-action="contents">目录</button><button data-vocab-action="open">生词本<span data-vocab-count></span></button><div class="novel-font-controls" role="group"><button data-novel-action="smaller" aria-label="缩小字号">字−</button><button data-novel-action="larger" aria-label="放大字号">字＋</button></div><button data-novel-action="ruby" aria-pressed="false">注音</button><button data-novel-action="exit" class="novel-exit">逐句学习</button></div></header><div class="novel-running-head"><span class="novel-section-name"></span><span>氷室冴子</span></div><div class="novel-stage"><article id="novel-flow" class="novel-flow" lang="ja" aria-label="小说正文（从右往左读）" tabindex="0"></article></div><footer class="novel-footer"><div class="novel-progress"><span></span></div><div class="novel-pagination"><button data-novel-action="next">← 下一页</button><div><span id="novel-page-status" role="status" aria-live="polite"></span><small>点词查解释 · 向右滑动翻阅</small></div><button data-novel-action="prev">上一页 →</button></div></footer></main>';
   root=container.querySelector('.novel-reader');flow=root.querySelector('#novel-flow');stage=root.querySelector('.novel-stage');
   redraw();flow.addEventListener('scroll',scrollChanged,{passive:true});flow.addEventListener('wheel',wheel,{passive:false});
   flow.addEventListener('pointerover',previewWord);flow.addEventListener('pointerout',endPreview);
   flow.addEventListener('focusin',previewWord);flow.addEventListener('focusout',endPreview);
   document.addEventListener('click',click);document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',hide);
   window.addEventListener('resize',resize);window.addEventListener('pagehide',remember);
   if(window.ResizeObserver){observer=new ResizeObserver(resize);observer.observe(stage);}
   document.fonts?.ready.then(()=>{if(root)layout(anchor);});
  }
  return {mount,destroy,leave,turn};
 };
})();
