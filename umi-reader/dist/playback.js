/* A cancellable sentence sequence. Transport owns one clip; this owns repetitions. */
(() => {
 'use strict';
 window.createSentencePlayer=({play,halt,changed,schedule=setTimeout,cancel=clearTimeout})=>{
  let generation=0,serial=0,timer=null,active=null,pending=null;
  function stop(){generation++;if(timer!==null)cancel(timer);timer=null;pending=null;active=null;halt();changed(null);}
  function later(fn,ms){const g=generation;timer=schedule(()=>{timer=null;if(g===generation&&active)fn();},ms);}
  function next(){
   if(!active)return;
   if(active.part>=active.clips.length){
    active.round++;
    if(active.count!==0&&active.round>active.count){stop();return;}
    active.part=0;active.phase='pause';changed({...active});later(next,active.pause*1000);return;
   }
   const clip=active.clips[active.part],token=String(++serial);
   active.phase=clip.lang;pending=token;changed({...active});
   const error=play(clip,token);
   if(error){stop();changed({error});}
  }
  function start(clips,{count=1,pause=2}={}){
   stop();const spoken=clips.filter(c=>/[\p{L}\p{N}]/u.test(c.text)&&!/^[ーっッ]+$/.test(c.text.trim()));
   if(!spoken.length){changed({error:'这一行是沉默或标点，没有可朗读的文字。'});return;}
   active={clips:spoken,count,pause,round:1,part:0,phase:spoken[0].lang};next();
  }
  function ended(status,token){
   if(!active||token!==pending)return;
   pending=null;
   if(status==='error'){stop();changed({error:'音频播放失败，请停止后再试一次。'});return;}
   if(status!=='done')return;
   active.part++;
   if(active.part<active.clips.length){active.phase='pause';changed({...active});later(next,650);}
   else next();
  }
  return {start,stop,ended};
 };
})();
