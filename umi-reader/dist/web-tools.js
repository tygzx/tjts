/* Reading backups include progress and preferences, never the novel. */
(()=>{
 'use strict';
 function clean(value,total){
  if(!value||typeof value!=='object'||!Number.isInteger(value.index)||value.index<0||value.index>=total||!Array.isArray(value.done))throw new Error('备份中的阅读进度不完整。');
  const result={index:value.index,done:[...new Set(value.done.filter(n=>Number.isInteger(n)&&n>=0&&n<total))],sentencePlayback:{}};
  for(const key of ['ruby','romaji','kana','segmented','illustrations','roleVoices'])if(typeof value[key]==='boolean')result[key]=value[key];
  if([.6,.8,1].includes(value.rate))result.rate=value.rate;
  if(value.sentencePlayback&&typeof value.sentencePlayback==='object')for(const [key,setting] of Object.entries(value.sentencePlayback)){
   if(!/^\d+$/.test(key)||Number(key)>=total||!setting||typeof setting!=='object')continue;
   result.sentencePlayback[key]={mode:setting.mode==='ja'?'ja':'both',count:[0,1,3,5].includes(setting.count)?setting.count:1,pause:[1,2,3,5].includes(setting.pause)?setting.pause:2};
  }
  return result;
 }
 window.UMI_WEB={
  encode(state,total){return JSON.stringify({format:'umi-reading-progress',version:1,book:'umi-volume-1-2640',savedAt:new Date().toISOString(),state:clean(state,total)},null,2);},
  decode(text,total){const backup=JSON.parse(text);if(backup.format!=='umi-reading-progress'||backup.version!==1||backup.book!=='umi-volume-1-2640')throw new Error('请选择这本书导出的阅读进度备份。');return clean(backup.state,total);}
 };
})();
