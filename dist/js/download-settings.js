import {copyHTML,copyRaw} from './site-copy.js';
import {backend} from './backend.js';
import {escape as e} from './store.js';
let policy=null,error='',loading=false,saving=false,epoch=0;
export function resetDownloadSettings(){epoch++;policy=null;error='';loading=false;saving=false;}
export async function loadDownloadSettings(ui){
 const stamp=++epoch,owner=backend.user()?.id;loading=true;error='';ui.render();
 try{const result=await backend.downloadPolicy();if(stamp===epoch&&backend.user()?.id===owner)policy=result;}
 catch(err){if(stamp===epoch)error=err.message;}
 finally{if(stamp===epoch){loading=false;ui.render();}}
}
function codeField(id,label){return `<label for="${id}">${label}</label><div class="password-field"><input id="${id}" type="password" autocomplete="new-password" minlength="4" maxlength="64" required><button type="button" class="btn password-toggle" data-password-toggle="${id}" data-password-label="download access code" aria-controls="${id}" aria-label="${copyHTML("download-settings.acac84907f07")}" aria-pressed="false">${copyHTML("download-settings.0df6f1cad36c")}</button></div>`;}
export function downloadSettingsScreen(){
 return `<section class="card"><div class="card-head"><h2>${copyHTML("download-settings.f0c7f301c142")}</h2><button type="button" class="btn" id="download-settings-refresh" ${loading||saving?'disabled':''}>${copyHTML("download-settings.056523395d94")}</button></div><p class="muted">${copyHTML("download-settings.22c3cf90da84")}</p>${loading?`<p role="status">${copyHTML("download-settings.f116d891e125")}</p>`:error?`<p role="alert">${e(error)}</p><p class="muted">${copyHTML("download-settings.12df80e2a814")}</p>`:policy?`<form id="download-settings-form"><label class="task" for="download-code-required"><input id="download-code-required" name="require_access_code" type="checkbox" ${policy.require_access_code?'checked':''}><span>${copyHTML("download-settings.3a5c05f80870")}</span></label><p class="muted">${copyHTML("download-settings.6bfea4a64922")}</p><p id="download-settings-status" role="status"></p><button class="btn primary" type="submit" ${saving?'disabled':''}>${copyHTML("download-settings.0e67b416fd83")}</button></form><hr><h3>${copyHTML("download-settings.6a4f6990157c")}</h3><p class="muted">${copyHTML("download-settings.bfa89dd0cb6e")}</p><form id="download-code-form">${codeField('new-download-code','New access code')}${codeField('confirm-download-code','Confirm new access code')}<p class="muted">${copyHTML("download-settings.27204a5fd9ac")}</p><p id="download-code-status" role="status"></p><button class="btn primary" type="submit" ${saving?'disabled':''}>${copyHTML("download-settings.33a04044ecb3")}</button></form>`:`<p class="muted">${copyHTML("download-settings.9d7458f37ef1")}</p>`}</section>`;
}
export function bindDownloadSettings(ui){
 const refresh=document.querySelector('#download-settings-refresh');
 if(refresh)refresh.onclick=()=>{if(!saving)loadDownloadSettings(ui);};
 const form=document.querySelector('#download-settings-form'),codeForm=document.querySelector('#download-code-form');
 if(!form||!codeForm)return;
 const current=(stamp,owner)=>stamp===epoch&&backend.user()?.id===owner;
 const busy=value=>{saving=value;for(const control of document.querySelectorAll('#download-settings-form input, #download-settings-form button, #download-code-form input, #download-code-form button, #download-settings-refresh'))control.disabled=value;};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const stamp=epoch,owner=backend.user()?.id,status=form.querySelector('#download-settings-status'),required=form.querySelector('#download-code-required').checked;
  busy(true);status.textContent=copyRaw("download-settings.6fed25e45610");
  try{await backend.saveDownloadPolicy(required);if(!current(stamp,owner))return;policy={require_access_code:required};status.textContent=required?'Saved. Downloads now require an access code.':'Saved. Signed-in users can now download without an access code.';ui.toast(copyRaw("download-settings.1f763ddf4e50"));}
  catch(err){if(current(stamp,owner))status.textContent=err.message;}
  finally{if(current(stamp,owner))busy(false);}
 };
 codeForm.onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const stamp=epoch,owner=backend.user()?.id,status=codeForm.querySelector('#download-code-status'),code=codeForm.querySelector('#new-download-code').value.trim(),confirm=codeForm.querySelector('#confirm-download-code').value.trim();
  if(code!==confirm){status.textContent=copyRaw("download-settings.31c8b12c9037");return;}
  busy(true);status.textContent=copyRaw("download-settings.056a3630e7af");
  try{
   await backend.changeDownloadCode(code);if(!current(stamp,owner))return;
   codeForm.reset();
   for(const input of codeForm.querySelectorAll('input'))input.type='password';
   for(const toggle of codeForm.querySelectorAll('[data-password-toggle]')){toggle.textContent=copyRaw("download-settings.0df6f1cad36c");toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Show download access code');}
   status.textContent=copyRaw("download-settings.bde804bda2b3");
   ui.toast(copyRaw("download-settings.a83f358c3013"));
  }catch(err){if(current(stamp,owner))status.textContent=err.message;}
  finally{if(current(stamp,owner))busy(false);}
 };
}
