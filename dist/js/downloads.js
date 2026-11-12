import {copyHTML,copyRaw} from './site-copy.js';
import {backend} from './backend.js';
import {escape as e,download} from './store.js';
let ui,generation=0;
export function initDownloads(callbacks){ui=callbacks;}
export async function requestDownload(resource,{personalNotes=''}={}){
 const stamp=++generation,owner=backend.user()?.id;
 if(!owner){ui.toast(copyRaw("downloads.bd0699275b15"));return;}
 ui.modal(copyRaw("downloads.4aed7510226c"),`<p role="status">${copyHTML("downloads.845cfa961d8f")}</p>`);document.querySelector('#dialog').addEventListener('close',()=>{generation++;},{once:true});
 const current=()=>stamp===generation&&backend.user()?.id===owner;
 const finish=result=>{if(!current())return;if(!result.authorized)throw new Error(copyRaw("downloads.4e7d0bedb908"));if(!resource.lexamah_cloud){download(`${String(resource.title).replace(/[^a-z0-9]/gi,'-')}.txt`,`${resource.title}\n\n${resource.body||resource.description||''}\n\nPERSONAL NOTES\n${personalNotes}`);}else if(result.url){const a=document.createElement('a');a.href=result.url;a.download=result.fileName||'resource';a.target='_blank';a.rel='noopener';a.click();}else download(result.fileName||'lecture-notes.txt',result.text||'');document.querySelector('#dialog').close();ui.toast(copyRaw("downloads.57441fbef793"));};
 const authorize=code=>backend.protectedDownload(resource.lexamah_cloud?resource.resource_type||'materials':'local',resource.id,code);
 const form=(required,message='')=>{
  if(!current())return;
  ui.modal(required?'Enter access code':'Download resource',`<p class="muted">${required?'Enter your access code to download':'Download'} “${e(resource.title)}”.</p><form id="download-form">${required?`<label for="access-code">${copyHTML("downloads.db76a756cec8")}</label><div class="password-field"><input id="access-code" name="code" type="password" autocomplete="off" required><button type="button" class="btn password-toggle" data-password-toggle="access-code" data-password-label="access code" aria-controls="access-code" aria-label="${copyHTML("downloads.772b41051a33")}" aria-pressed="false">${copyHTML("downloads.0df6f1cad36c")}</button></div>`:''}<p id="download-status" class="muted" role="status">${e(message)}</p><div class="actions"><button class="btn primary" id="download-submit" type="submit">${copyHTML("downloads.d6eafe823591")}</button><button class="btn" type="button" id="download-cancel">${copyHTML("downloads.19766ed6ccb2")}</button></div></form>`);
  document.querySelector('#download-cancel').onclick=()=>{generation++;document.querySelector('#dialog').close();};
  document.querySelector('#download-form').onsubmit=async event=>{event.preventDefault();const submit=document.querySelector('#download-submit'),status=document.querySelector('#download-status');submit.disabled=true;try{status.textContent=required?'Checking access code…':'Preparing download…';finish(await authorize(required?new FormData(event.target).get('code'):undefined));}catch(err){if(!current())return;if(err.codeRequired&&!required)form(true,err.message);else status.textContent=err.message;}finally{submit.disabled=false;}};
 };
 try{
  const policy=await backend.downloadPolicy();if(!current())return;
  if(policy.require_access_code)form(true);
  else{try{finish(await authorize(undefined));}catch(err){if(current())form(err.codeRequired===true,err.message);}}
 }catch(err){if(current())form(false,err.message);}
}
