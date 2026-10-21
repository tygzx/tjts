import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=fs.realpathSync(path.join(project,'dist'));
const port=Number(process.env.UMI_PORT||4173),host=process.env.UMI_HOST||'0.0.0.0';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid UMI_PORT');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
function addresses(){return Object.entries(os.networkInterfaces()).flatMap(([name,entries])=>entries.filter(e=>e.family==='IPv4'&&!e.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(e.address)).map(e=>({name,url:`http://${e.address}:${port}/`})))}
function send(res,code,text,type='text/plain; charset=utf-8',head=false){const content=Buffer.from(text);res.writeHead(code,{'Content-Type':type,'Content-Length':content.length,'Cache-Control':'no-store'});res.end(head?undefined:content);}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(res,405,'Method not allowed');return;}
 const head=req.method==='HEAD';let url;
 try{url=decodeURIComponent(req.url.split('?')[0]);}catch{send(res,400,'Invalid URL',undefined,head);return;}
 if(url==='/api/connection'){send(res,200,JSON.stringify({app:'umi-reader',local:`http://127.0.0.1:${port}/`,addresses:addresses()}),'application/json; charset=utf-8',head);return;}
 if(url.includes('\\')||url.includes('\0')||!url.startsWith('/')){send(res,400,'Invalid path',undefined,head);return;}
 const candidate=path.resolve(root,'.'+(url==='/'?'/index.html':url));
 if(!candidate.startsWith(root+path.sep)||!mime[path.extname(candidate)]||url.startsWith('/audio/')){send(res,404,'Not found',undefined,head);return;}
 try{
  const real=await fs.promises.realpath(candidate);
  if(!real.startsWith(root+path.sep)){send(res,404,'Not found',undefined,head);return;}
  const info=await fs.promises.stat(real);
  if(!info.isFile()){send(res,404,'Not found',undefined,head);return;}
  const etag=`"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const headers={'Content-Type':mime[path.extname(real)],'Accept-Ranges':'bytes','ETag':etag,'Cache-Control':/\.(mp3|png|jpg|webp)$/.test(real)?'private, max-age=86400':'no-cache'};
  if(req.headers['if-none-match']===etag&&!req.headers.range){res.writeHead(304,headers).end();return;}
  let start=0,end=info.size-1,code=200;
  if(req.headers.range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   if(!match[1])start=Math.max(0,info.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   code=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(code,headers);
  if(head||info.size===0){res.end();return;}
  const stream=fs.createReadStream(real,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch(error){if(!res.headersSent)send(res,error.code==='ENOENT'?404:500,'Unable to read file',undefined,head);else res.destroy();}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Open the existing reader or choose UMI_PORT.`:error.message);process.exitCode=1;});
server.listen(port,host,()=>{console.log(`听到涛声 · 网页版\n电脑打开：http://127.0.0.1:${port}/`);for(const item of addresses())console.log(`手机同一 Wi-Fi（${item.name}）：${item.url}`);console.log('阅读时请保持此服务运行。按 Ctrl+C 停止。');});
