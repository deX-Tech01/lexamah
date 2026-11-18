import {copyHTML, copyRaw} from './site-copy.js';
import {backend} from './backend.js';
import {escape as e} from './store.js';
import {mountPDF} from './pdf-viewer.js';

const MAX_BYTES=50*1024*1024;
let active=null,wordReader=null;
export function closeReader(){
 const reader=active;
 if(!reader)return;
 active=null;
 reader.controller.abort();
 if(reader.dialog.open)reader.dialog.close();
 reader.dialog.remove();
}
async function readFile(url,signal){
 const response=await fetch(url,{referrerPolicy:'no-referrer',signal});
 if(!response.ok)throw new Error(copyRaw('document-reader.f693ced343c6'));
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error(copyRaw('document-reader.02579859ef0c'));
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength>MAX_BYTES)throw new Error(copyRaw('document-reader.02579859ef0c'));
 return {bytes,contentType:response.headers.get('content-type')?.split(';')[0]||''};
}
function loadWordReader(){
 if(window.mammoth)return Promise.resolve(window.mammoth);
 if(!wordReader)wordReader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=new URL('../vendor/mammoth/mammoth.browser.min.js',import.meta.url).href;
  script.onload=()=>resolve(window.mammoth);
  script.onerror=()=>reject(new Error(copyRaw('document-reader.55c3b9d2cbd5')));
  document.head.append(script);
 }).catch(error=>{wordReader=null;throw error;});
 return wordReader;
}
export async function showDocument(item,type,{onRead}={}){
 const owner=backend.user()?.id;
 if(!owner||backend.recoveryReady())throw new Error(copyRaw('document-reader.9d6cc2043fe4'));
 closeReader();
 const source=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.className='resource-reader';
 dialog.setAttribute('aria-labelledby','reader-title');
 dialog.innerHTML=`<div class="reader-top">
  <button type="button" class="btn reader-back" aria-label="${copyHTML('reader.close')}" autofocus>← <span>${copyHTML('reader.back')}</span></button>
  <h2 id="reader-title">${e(item.title||copyRaw('reader.document'))}</h2>
 </div>
 <div class="reader-tools"></div>
 <p class="reader-status" role="status">${copyHTML('document-reader.aa46ebd38538')}</p>
 <div id="document-pages" class="reader-scroll" tabindex="0" role="region" aria-label="${copyHTML('reader.pages')}"></div>`;
 const controller=new AbortController(),reader={controller,dialog};
 const {signal}=controller;
 active=reader;
 const current=()=>active===reader&&!signal.aborted&&backend.user()?.id===owner;
 dialog.addEventListener('close',()=>{
  if(active===reader)closeReader();
  if(backend.user()?.id===owner&&source?.isConnected)source.focus();
 },{once:true});
 dialog.querySelector('.reader-back').onclick=closeReader;
 document.body.append(dialog);dialog.showModal();
 const status=dialog.querySelector('.reader-status'),scroll=dialog.querySelector('.reader-scroll'),controls=dialog.querySelector('.reader-tools');
 let viewed=false;
 const ready=message=>{
  if(!current())return;
  status.textContent=message||'';status.hidden=!message;
  if(!viewed){viewed=true;onRead?.();}
 };
 function showText(value){
  const page=document.createElement('div');page.className='reader reader-text';page.textContent=value;
  scroll.replaceChildren(page);
 }
 try{
  const result=item.lexamah_cloud?await backend.viewDocument(type,item.id,signal):{text:item.body||item.content||'',url:item.url,mime_type:item.mime_type,fileName:item.file_name};
  if(!current())return;
  const link=result.url||(!item.storage_path?item.url:'');
  if(!link){
   showText(result.text||copyRaw('reader.noDocument'));
   if(result.text)ready();else status.hidden=true;
   return;
  }
  const url=new URL(link);
  if(!['https:','http:'].includes(url.protocol))throw new Error(copyRaw('document-reader.d53e52eb82fa'));
  const {bytes,contentType}=await readFile(url.href,signal);
  if(!current())return;
  const name=String(result.fileName||url.pathname).toLowerCase(),mime=result.mime_type||contentType,
   pdfHeader=new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-');
  if(pdfHeader||mime==='application/pdf'||name.endsWith('.pdf')){
   const pdfjs=await import('../vendor/pdfjs/build/pdf.mjs');
   if(!current())return;
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/build/pdf.worker.mjs',import.meta.url).href;
   const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href});
   signal.addEventListener('abort',()=>{task.destroy().catch(()=>{});},{once:true});
   const pdf=await task.promise;
   if(!current())return;
   await mountPDF(pdf,{scroll,controls,signal,onReady:()=>ready(copyRaw('reader.gestures')),onError:()=>{
    if(current()){status.hidden=false;status.textContent=copyRaw('reader.failedPage');}
   }});
  }else if(mime.includes('wordprocessingml')||name.endsWith('.docx')){
   const mammoth=await loadWordReader();
   if(!current())return;
   const text=await mammoth.extractRawText({arrayBuffer:bytes.buffer});
   if(current()){showText(text.value);ready(copyRaw('document-reader.e74b919980c7'));}
  }else if(mime.startsWith('image/')||/\.(png|jpe?g)$/.test(name)){
   const src=URL.createObjectURL(new Blob([bytes],{type:mime||'image/png'}));
   signal.addEventListener('abort',()=>URL.revokeObjectURL(src),{once:true});
   const img=document.createElement('img');img.src=src;img.alt=item.title||copyRaw('reader.document');img.className='document-image';img.draggable=false;
   scroll.replaceChildren(img);ready();
  }else if(mime==='text/plain'||name.endsWith('.txt')){
   showText(new TextDecoder().decode(bytes));ready();
  }else throw new Error(copyRaw('document-reader.c8a321809534'));
 }catch(error){
  if(!current())return;
  status.hidden=false;status.textContent=error.message||copyRaw('reader.failedPage');
 }
}
