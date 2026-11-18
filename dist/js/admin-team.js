import {backend} from './backend.js';
import {copyHTML,copyRaw} from './site-copy.js';
import {escape as e} from './store.js';

let list=null,error='',version=0,loading=false;
export function resetTeam(){list=null;error='';version++;loading=false;}
function rows(){
 if(error)return `<p class="notice" role="status">${e(error)}</p>`;
 if(!list)return `<p class="muted" role="status">${copyHTML('team.loading')}</p>`;
 return list.length?list.map(person=>`<div class="row team-row">
  <div class="row-copy"><strong>@${e(person.username)}</strong><small>${e(person.name)}</small></div>
  <span class="tag">${copyHTML(person.disabled?'team.disabled':'team.assistant')}</span>
  <button type="button" class="btn danger" data-dismiss-assistant="${e(person.user_id)}">${copyHTML('team.dismiss')}</button>
 </div>`).join(''):`<p class="muted">${copyHTML('team.empty')}</p>`;
}
export function teamScreen(){
 return `<div class="team-shell"><section class="card">
  <div class="card-head"><div><h2>${copyHTML('team.title')}</h2><p>${copyHTML('team.help')}</p></div></div>
  <form id="appoint-assistant"><label for="assistant-username">${copyHTML('team.username')}</label>
   <div class="team-add"><input id="assistant-username" name="username" maxlength="31" autocomplete="off" spellcheck="false" required>
    <button type="submit" class="btn primary">${copyHTML('team.add')}</button></div>
   <p class="muted" id="team-status" role="status"></p>
  </form>
 </section><section class="card">
  <div class="card-head"><h2>${copyHTML('team.members')}</h2></div><div id="assistant-rows">${rows()}</div>
 </section></div>`;
}
async function loadTeam(){
 if(loading||!backend.adminReady())return;
 const stamp=version;
 loading=true;error='';
 try{
  const next=await backend.contentTeam();
  if(stamp===version&&backend.adminReady())list=next;
 }catch(err){
  if(stamp===version)error=err.code==='PGRST202'?copyRaw('tips.upgrade'):err.message;
 }finally{
  if(stamp===version){loading=false;const host=document.querySelector('#assistant-rows');if(host&&backend.adminReady())host.innerHTML=rows();}
 }
}
export function bindTeam(ui){
 if(!backend.adminReady())return;
 const form=document.querySelector('#appoint-assistant');
 if(!form)return;
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button'),status=form.querySelector('#team-status');
  if(button.disabled)return;
  const username=String(new FormData(form).get('username')||'').trim().replace(/^@/,'');
  button.disabled=true;status.textContent='';
  try{
   await backend.appointAssistant(username);
   if(!backend.adminReady())return;
   form.reset();await loadTeam();ui.toast(copyRaw('team.added'));
  }catch(err){status.textContent=err.code==='PGRST202'?copyRaw('tips.upgrade'):err.message;}
  finally{button.disabled=false;}
 };
 if(!list&&!error)loadTeam();
}
export function dismissAssistantClick(id,ui){
 if(!backend.adminReady())return;
 const person=list?.find(person=>person.user_id===id);
 if(!person)return;
 ui.modal(copyRaw('team.dismissTitle'),`<p>${copyHTML('team.dismissHelp')} <strong>@${e(person.username)}</strong>. ${copyHTML('team.dismissKeep')}</p>
  <p id="team-dismiss-status" class="muted" role="status"></p>
  <div class="actions"><button type="button" class="btn danger" id="team-dismiss-confirm">${copyHTML('team.dismiss')}</button>
   <button type="button" class="btn" id="team-dismiss-cancel">${copyHTML('tips.cancel')}</button></div>`);
 const dialog=document.querySelector('#dialog'),button=dialog.querySelector('#team-dismiss-confirm'),status=dialog.querySelector('#team-dismiss-status');
 dialog.querySelector('#team-dismiss-cancel').onclick=()=>dialog.close();
 button.onclick=async()=>{
  if(button.disabled||!backend.adminReady())return;
  button.disabled=true;
  try{
   await backend.dismissAssistant(id);
   if(button.isConnected)dialog.close();
   await loadTeam();ui.toast(copyRaw('team.dismissed'));
  }catch(err){status.textContent=err.message;button.disabled=false;}
 };
}
