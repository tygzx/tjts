/* Reuse one audio element for all recordings, including mobile playback. */
(()=>{
 'use strict';
 window.createRecordedAudio=({ended,getRate})=>{
  const audio=document.createElement('audio');audio.id='reader-recorded-audio';audio.preload='none';audio.hidden=true;document.body.append(audio);
  let current=null;
  function halt(){current=null;audio.onended=audio.onerror=null;audio.pause();}
  function play(clip,token){
   halt();
   const id=window.UMI_AUDIO_INDEX?.[clip.lang+'\n'+clip.text];
   // A repaired recording can keep its ID; its content hash separates browser
   // cache entries. This URL version never enters the Android clip ID bridge.
   const version=/^[a-f0-9]{64}$/.test(clip.roleHash||'')?'?v='+clip.roleHash.slice(0,16):'';
   const src=clip.roleId&&/^[a-zA-Z0-9_-]+$/.test(clip.roleId)?'role-audio/'+clip.roleId+'.mp3'+version:id&&/^[a-f0-9]{24}$/.test(id)?'neural-audio/'+id+'.mp3':null;
   if(!src)return '这段录音暂时无法读取，请重新打开网页版后再试。';
   current=token;audio.src=src;audio.playbackRate=getRate();audio.preservesPitch=true;
   const finish=status=>{if(current!==token)return;current=null;ended(status,token);};
   audio.onended=()=>finish('done');audio.onerror=()=>finish('error');
   try{Promise.resolve(audio.play()).catch(()=>finish('error'));}catch{finish('error');}
   return null;
  }
  return {play,halt};
 };
})();
