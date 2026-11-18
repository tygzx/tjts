/* Screenshot data lives in IndexedDB. Reading progress only keeps its IDs. */
(()=>{
 'use strict';

 const maxPerNote=8;
 const maxBytes=256*1024;
 const maxSourceBytes=24*1024*1024;
 const accepted='image/png,image/jpeg,image/webp';
 const isId=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
 let database;

 function createId(){
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
 }

 function validData(source){
  if(typeof source!=='string'||source.length>Math.ceil(maxBytes/3)*4+24)return false;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if(!match||match[2].length%4!==0)return false;
  const head=atob(match[2].slice(0,16));
  if(match[1]==='png')return head.startsWith('\x89PNG\r\n\x1a\n');
  if(match[1]==='jpeg')return head.startsWith('\xff\xd8\xff');
  return head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
 }

 function open(){
  if(!database){
   database=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('当前浏览器无法保存截图。'));return;}
    const request=window.indexedDB.open('umi-note-screenshots',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('screenshots',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
   }).catch(error=>{
    database=null;
    throw error;
   });
  }
  return database;
 }

 async function transact(mode,run){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const transaction=db.transaction('screenshots',mode);
   transaction.onabort=()=>reject(transaction.error||new Error('截图保存已中断。'));
   const requests=run(transaction.objectStore('screenshots'));
   transaction.oncomplete=()=>resolve(requests?.map(request=>request.result));
  });
 }

 async function read(ids){
  if(!ids.length)return [];
  const records=await transact('readonly',store=>ids.map(id=>store.get(id)));
  return records.filter(record=>record&&isId(record.id)&&validData(record.data));
 }

 function save(records){
  if(!records.length)return Promise.resolve();
  if(records.some(record=>!isId(record.id)||!validData(record.data)))throw new Error('截图格式无效。');
  return transact('readwrite',store=>{
   for(const record of records)store.add(record);
  });
 }

 function remove(ids){
  if(!ids.length)return Promise.resolve();
  return transact('readwrite',store=>{
   for(const id of ids)store.delete(id);
  });
 }

 function loadImage(url){
  return new Promise((resolve,reject)=>{
   const image=new Image();
   image.onload=()=>resolve(image);
   image.onerror=()=>reject(new Error('无法读取这张图，请选择 PNG、JPG 或 WebP。'));
   image.src=url;
  });
 }

 function encodeCanvas(canvas,type,quality){
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
 }

 function toDataURL(blob){
  return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(reader.error);
   reader.readAsDataURL(blob);
  });
 }

 async function prepare(file){
  if(file.type&&!accepted.split(',').includes(file.type))throw new Error('请选择 PNG、JPG 或 WebP 图片。');
  if(!file.size||file.size>maxSourceBytes)throw new Error('请选择不超过 24 MB 的截图。');
  const objectUrl=URL.createObjectURL(file);
  try{
   const image=await loadImage(objectUrl);
   const {naturalWidth:width,naturalHeight:height}=image;
   if(!width||!height)throw new Error('无法读取这张截图。');
   const scale=Math.min(1,1600/width,3600/height,Math.sqrt(3200000/(width*height)));
   const canvas=document.createElement('canvas');
   const context=canvas.getContext('2d',{alpha:false});
   if(!context)throw new Error('当前浏览器无法处理截图。');
   function draw(factor){
    canvas.width=Math.max(1,Math.round(width*factor));
    canvas.height=Math.max(1,Math.round(height*factor));
    context.fillStyle='#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
   }
   draw(scale);
   // Prefer crisp text when a lossless screenshot fits, then reduce file size.
   let compressed=await encodeCanvas(canvas,'image/png');
   if(!compressed||compressed.size>maxBytes){
    for(const [factor,quality] of [[1,.91],[1,.82],[.8,.82],[.62,.8],[.45,.76]]){
     if(factor!==1)draw(scale*factor);
     compressed=await encodeCanvas(canvas,'image/jpeg',quality);
     if(compressed&&compressed.size<=maxBytes)break;
    }
   }
   if(!compressed||compressed.size>maxBytes)throw new Error('这张截图内容太多，请裁小后再添加。');
   return await toDataURL(compressed);
  }finally{
   URL.revokeObjectURL(objectUrl);
  }
 }

 window.UMI_NOTE_IMAGES=Object.freeze({accepted,createId,isId,validData,maxPerNote,prepare,read,save,remove});
})();
