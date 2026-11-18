import {loadSiteEditor,siteEditorScreen,bindSiteEditor,resetSiteEditor} from './site-editor.js';
import {copyHTML,copyRaw} from './site-copy.js';
import {loadSamples,samplesScreen,bindSamples,resetSampleEditor} from './sample-editor.js';
import {brandName,brandHTML} from './brand-state.js';
import {loadBranding} from './branding.js';
import {brandingScreen,bindBranding,clearBrandingPreview} from './branding-admin.js';
import {downloadSettingsScreen,loadDownloadSettings,bindDownloadSettings,resetDownloadSettings} from './download-settings.js';
import {watermarkEditor,bindWatermarkEditor,readWatermark} from './watermark-controls.js';
import {resetUsers,usersScreen,mailScreen,bindUsers,usersClick,loadUsersTab} from './users.js';
import {backend,assistantContentTypes} from './backend.js';
import {tipsAdminScreen,bindTipsAdmin} from './share-tips.js';
import {teamScreen,bindTeam,resetTeam,dismissAssistantClick} from './admin-team.js';
import {loadStats,statsCards} from './analytics.js';
import {loadAbout,aboutEditor,bindAboutEditor} from './about.js';
import {escape as e} from './store.js';
import {subjectCatalog,subjectsScreen,bindSubjects,removeSubject} from './subjects.js';
const types={get "materials"(){return copyRaw("admin.fd10a146e962");},get "lectures"(){return copyRaw("admin.95f7caf5f942");},get "lectureNotes"(){return copyRaw("admin.b2b5202e7477");},get "cases"(){return copyRaw("admin.9ab92306f737");},get "flashcards"(){return copyRaw("admin.eac4b70868b6");},get "quizSets"(){return copyRaw("admin.dd0acd7417ae");},get "quizQuestions"(){return copyRaw("admin.f5f777044b10");}};
let state={status:'idle',items:{},type:'materials',query:'',error:''},busy=false;
let ui;
export function initAdmin(callbacks){ui=callbacks;}
let loadEpoch=0;
export function resetAdmin(){
 loadEpoch++;resetDownloadSettings();resetSampleEditor();resetSiteEditor();clearBrandingPreview();resetTeam();
 busy=false;state={status:'idle',items:{},type:'materials',query:'',error:''};resetUsers();
}
const contentTypes=()=>backend.assistantReady()?assistantContentTypes:Object.keys(types);
function adminTabs(){
 const content=Object.fromEntries(contentTypes().map(type=>[type,types[type]]));
 return backend.assistantReady()?content:{...content,subjects:'Subjects',about:`About ${brandName()}`,users:'Users',mail:'Bulk Email',downloadSettings:'Download Settings',branding:'Branding Settings',samples:'Samples & Existing Content',siteEditor:'Text & Appearance',tips:copyRaw('tips.adminTab'),team:copyRaw('team.title')};
}
async function loadTab(){
 if(!backend.adminReady())return;
 await loadUsersTab(state.type,ui);
 if(state.type==='downloadSettings')await loadDownloadSettings(ui);
 if(state.type==='samples')await loadSamples(ui);
}
export async function loadAdmin(){
 const epoch=++loadEpoch,owner=backend.user()?.id,assistant=backend.assistantReady();
 const current=()=>epoch===loadEpoch&&owner===backend.user()?.id;
 state.status='loading';state.error='';ui.render();
 try{
  await backend.refreshSession();
  if(!current())return;
  if(!backend.user()){state.status='signedout';return;}
  if(!await (assistant?backend.isAssistant():backend.isAdmin())){if(current())state.status='denied';return;}
  if(!current())return;
  if(!Object.hasOwn(adminTabs(),state.type))state.type='materials';
  const [results]=await Promise.all([
   Promise.all(contentTypes().map(async type=>[type,await backend.cloudRead(type,{owned:assistant})])),
   subjectCatalog.load(),
   ...(!assistant?[loadAbout(),loadStats(),loadBranding(),loadSiteEditor()]:[])
  ]);
  if(!current())return;
  state.items=Object.fromEntries(results);state.status='ready';await loadTab();
 }catch(err){if(current()){state.status='error';state.error=err.message;}}
 finally{if(current())ui.render();}
}
export function renderAdmin(){
 const assistant=backend.assistantReady();
 const heading=`<div class="heading"><div><span class="eyebrow">${brandHTML(true)} ${copyHTML("admin.bbdbcbf7345b")}</span>
 <h1>${copyHTML(assistant?'team.desk':'admin.a1ea4ff68e33')}</h1><p>${copyHTML(assistant?'team.deskHelp':'admin.6d30c2d72e35')}</p></div>
 <button class="btn" id="admin-refresh">${copyHTML("admin.0e9161011702")}</button></div>`;
 if(state.status==='idle'||state.status==='loading')return heading+`<div class="empty"><h3>${copyHTML("admin.2f0885e205d8")}</h3><p>${copyHTML("admin.1411a201077f")}</p></div>`;
 if(state.status!=='ready'){
  const messages={signedout:['Sign in to manage shared content.','Use your username and password on the Log In page, then return here.'],denied:['Administrator access required.','This account does not have an active staff session.'],error:['The content workspace could not load.',state.error]};
  const [title,description]=messages[state.status];
  return heading+`<div class="empty"><h3>${e(title)}</h3><p>${e(description)}</p><button class="btn primary" data-route="login">${copyHTML("admin.fea8850128d0")}</button></div>`;
 }
 const available=adminTabs(),selected=Object.hasOwn(available,state.type)?state.type:'materials';
 const metrics=assistant?'':statsCards();
 const tabs=`<div class="admin-tabs">${Object.entries(available).map(([key,label])=>`<button class="btn ${selected===key?'primary':''}" data-admin-type="${key}">${key==='about'?`About ${brandHTML()}`:e(label)}</button>`).join('')}</div>`;
 const screens={siteEditor:siteEditorScreen,samples:samplesScreen,branding:brandingScreen,downloadSettings:downloadSettingsScreen,users:usersScreen,mail:mailScreen,subjects:subjectsScreen,about:aboutEditor,tips:tipsAdminScreen,team:teamScreen};
 if(Object.hasOwn(screens,selected)&&!assistant)return heading+metrics+tabs+screens[selected]();
 const items=state.items[selected]||[],filtered=items.filter(x=>`${x.title||x.name||x.front||x.question} ${x.subject||''}`.toLowerCase().includes(state.query.toLowerCase()));
 const summary=assistant?'':`<div class="notice">${copyHTML("admin.b06f7e8860f6")}</div><div class="stats">${['materials','lectures','quizSets','quizQuestions'].map(k=>`<div class="stat"><div><small>${e(types[k])}</small><strong>${state.items[k]?.length||0}</strong><span class="sub">${copyHTML("admin.8685a2f15510")}</span></div></div>`).join('')}</div>`;
 return heading+metrics+summary+tabs+`<div class="toolbar"><input id="admin-search" aria-label="${copyHTML("admin.c0d59ffbd9b4")}" placeholder="Search ${e(types[selected].toLowerCase())}…" value="${e(state.query)}">
 <button class="btn primary" id="admin-create">${copyHTML("admin.c007258c23b0")} ${e(types[selected].toLowerCase())}</button></div>
 <section class="card"><div class="card-head"><h2>${e(types[selected])}</h2><span class="pill">${filtered.length} ${copyHTML("admin.a94e7bcfcbed")}</span></div>
 ${filtered.length?filtered.map(x=>`<div class="row"><div class="row-copy"><strong>${e(x.title||x.name||x.front||x.question)}</strong><small>${e(x.subject||'Quiz question')}${x.file_name?` · ${e(x.file_name)}`:''}</small></div>
 <button class="btn" data-admin-edit="${e(x.id)}">${copyHTML("admin.464c4ffd019e")}</button><button class="btn danger" data-admin-delete="${e(x.id)}">${copyHTML("admin.e2d0a54968ea")}</button></div>`).join(''):`<p class="muted">${copyHTML("admin.2da748b20572")}</p>`}</section>`
 +(assistant?'':`<p class="muted">${copyHTML("admin.74a461348401")} <button class="text-button" data-route="studio">${copyHTML("admin.0d477a44f5cb")}</button>.</p>`);
}
function field(name,label,value='',kind='input',attrs=''){return `<label for="admin-${name}">${label}</label><${kind} id="admin-${name}" name="${name}" ${kind==='input'?`value="${e(value)}"`:''} ${attrs}>${kind==='textarea'?e(value)+'</textarea>':''}`;}
function edit(id){if(state.status!=='ready'||!contentTypes().includes(state.type))return;const type=state.type,x=id?(state.items[type]||[]).find(x=>x.id===id):{};if(!x)return;if(type!=='quizQuestions'&&!subjectCatalog.options(x.subject).length){ui.toast(copyRaw("admin.93a995208be2"));return;}let html='';if(type==='flashcards')html=field('front',copyRaw("admin.289aff12b042"),x.front,'textarea','required maxlength="4000"')+field('back',copyRaw("admin.b2a3aa602762"),x.back,'textarea','required maxlength="10000"');else if(type==='quizQuestions'){if(!state.items.quizSets.length){ui.toast(copyRaw("admin.49cdde0b7884"));return;}html=`<label for="admin-quiz-set">${copyHTML("admin.e1bf4b3f3d18")}</label><select id="admin-quiz-set" name="quiz_set_id" required>${state.items.quizSets.map(q=>`<option value="${e(q.id)}" ${x.quiz_set_id===q.id?'selected':''}>${e(q.name)}</option>`).join('')}</select>`+field('question',copyRaw("admin.289aff12b042"),x.question,'textarea','required maxlength="4000"')+[0,1,2,3].map(i=>field(`option${i}`,`Option ${'ABCD'[i]}`,x.options?.[i]||'','input','required maxlength="2000"')).join('')+`<label for="admin-correct-index">${copyHTML("admin.fb019d338b43")}</label><select id="admin-correct-index" name="correct_index">${[0,1,2,3].map(i=>`<option value="${i}" ${Number(x.correct_index)===i?'selected':''}>${'ABCD'[i]}</option>`).join('')}</select>`+field('explanation',copyRaw("admin.16ee4625bce9"),x.explanation,'textarea','required maxlength="10000"');}else html=field(type==='quizSets'?'name':'title',copyRaw("admin.7e8cd2056da7"),x.name||x.title,'input','required maxlength="180"')+field('description',copyRaw("admin.526e0087cc3f"),x.description,'textarea','maxlength="4000"');if(type!=='quizQuestions')html+=`<label for="admin-subject">${copyHTML("admin.68971283841a")}</label><select id="admin-subject" name="subject">${subjectCatalog.options(x.subject).map(s=>`<option value="${e(s)}" ${s===x.subject?'selected':''}>${e(s)}${s===x.subject&&!subjectCatalog.names().includes(s)?' (no longer listed)':''}</option>`).join('')}</select>`;if(['materials','lectureNotes','cases'].includes(type))html+=field('body',type==='cases'?copyRaw("admin.e9987ce19e1d"):copyRaw("admin.0a6a90f5a4ec"),x.body,'textarea','maxlength="100000"');if(type==='cases')html+=field('citation',copyRaw("admin.a2a15fd54244"),x.citation);if(['materials','lectureNotes','cases','lectures'].includes(type)){if(type!=='lectures')html+=field('url',copyRaw("admin.9ffb7fed1806"),x.url,'input','type="url"');const audio=type==='lectures',watermarked=['materials','lectureNotes'].includes(type);html+=`<label for="admin-upload">${x.storage_path?copyRaw("admin.bebe38e427a4"):audio?copyRaw("admin.2f17498989c9"):copyRaw("admin.507ae671a6e1")}${audio?'':' (optional)'}</label><input id="admin-upload" name="upload" type="file" accept="${audio?'.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac':watermarked?'.pdf,.jpg,.jpeg,.png':'.pdf,.docx,.txt,.jpg,.jpeg,.png'}" ${audio&&!x.storage_path?'required':''}><p class="muted">${audio?copyRaw("admin.097196389194"):watermarked?copyRaw("admin.ff5a50eb4564"):copyRaw("admin.7857b385ef4e")} ${copyHTML("admin.2f2c44eb1498")}${x.file_name?` Current file: ${e(x.file_name)}.`:''}</p>${x.storage_path&&!audio?`<label class="task"><input type="checkbox" name="detach"><span>${copyHTML("admin.7036a4e5cdbb")}</span></label>`:''}`;}if(['materials','lectureNotes'].includes(type))html+=watermarkEditor();if(type==='quizSets')html+=field('time_minutes',copyRaw("admin.0f8f608aa012"),x.time_minutes||10,'input','type="number" min="1" max="180" required')+field('difficulty',copyRaw("admin.be44133ed57f"),x.difficulty||'Practice');ui.modal(`${id?copyRaw("admin.464c4ffd019e"):copyRaw("admin.9fd728c66c9a")} ${types[type].toLowerCase()}`,`<form id="admin-form">${html}<p class="muted" id="admin-form-status" aria-live="polite"></p><div class="actions"><button class="btn primary" id="admin-save">${id?copyRaw("admin.dd0ae7a5cbcf"):copyRaw("admin.5f72328b3f6c")}</button><button type="button" class="btn" id="admin-cancel">${copyHTML("admin.19766ed6ccb2")}</button></div></form>`);if(['materials','lectureNotes'].includes(type))bindWatermarkEditor(document.querySelector('#admin-form'));document.querySelector('#admin-cancel').onclick=()=>{if(!busy)document.querySelector('#dialog').close();};document.querySelector('#admin-form').onsubmit=async ev=>{ev.preventDefault();if(busy)return;busy=true;const submit=document.querySelector('#admin-save'),status=document.querySelector('#admin-form-status');submit.disabled=true;let upload;let saved=false;try{const form=new FormData(ev.target),payload=Object.fromEntries(form);delete payload.upload;const watermarkOptions=['materials','lectureNotes'].includes(type)?readWatermark(ev.target):{};for(const key of Object.keys(payload))if(key.startsWith('watermark_'))delete payload[key];const controls=ev.target.querySelector('.watermark-editor');if(controls)controls.disabled=true;if(payload.detach){payload.storage_path=null;payload.file_name=null;payload.file_size=null;payload.mime_type=null;}delete payload.detach;if(payload.url){const u=new URL(payload.url);if(!['http:','https:'].includes(u.protocol))throw new Error(copyRaw("admin.8414a5b47093"));}if(type==='quizQuestions'){payload.options=[0,1,2,3].map(i=>payload[`option${i}`]);[0,1,2,3].forEach(i=>delete payload[`option${i}`]);payload.correct_index=Number(payload.correct_index);}if(type==='quizSets')payload.time_minutes=Number(payload.time_minutes);const file=form.get('upload');if(file?.size){status.textContent=copyRaw("admin.7cdfb59cd1d3");upload=await backend.upload(file,{audioOnly:type==='lectures',watermark:['materials','lectureNotes'].includes(type),watermarkOptions,onProgress:message=>{status.textContent=message;}});Object.assign(payload,upload);}if(type==='lectures'){payload.url='';if(!upload&&(!x.storage_path||x.storage_bucket!=='lexamah-audio'||!String(x.mime_type||'').startsWith('audio/')))throw new Error(copyRaw("admin.bdd41d220eef"));}status.textContent=copyRaw("admin.432798827065");await backend.cloudSave(type,payload,id);saved=true;document.querySelector('#dialog').close();await ui.reload();await loadAdmin();ui.toast(copyRaw("admin.7342bfed8e1e"));}catch(err){if(upload&&!saved){try{await backend.deleteFile(upload.storage_path,upload.storage_bucket);}catch{ui.toast(copyRaw("admin.d9257b44c065"));}}status.textContent=err.message;}finally{busy=false;submit.disabled=false;const controls=ev.target.querySelector('.watermark-editor');if(controls)controls.disabled=false;}};}
async function remove(id){if(!contentTypes().includes(state.type))return;const type=state.type,item=(state.items[type]||[]).find(x=>x.id===id);if(!item)return;ui.modal(copyRaw("admin.060c4eb3793f"),`<p class="muted">${copyHTML("admin.5b7e3a54b292")}${e(item.title||item.name||item.front||item.question)}${copyHTML("admin.4a8e10073985")}${type==='quizSets'?' Its questions will also be removed. Sets with saved student attempts cannot be deleted.':''}</p>${item.storage_path?`<label class="task"><input id="admin-delete-file" type="checkbox"><span>${copyHTML("admin.2c418fad2666")}</span></label>`:''}<p class="muted" id="admin-delete-status" aria-live="polite"></p><div class="actions"><button class="btn danger" id="admin-confirm-delete">${copyHTML("admin.f256539ae020")}</button><button class="btn" id="admin-cancel-delete">${copyHTML("admin.4f655ad4f081")}</button></div>`);document.querySelector('#admin-cancel-delete').onclick=()=>document.querySelector('#dialog').close();document.querySelector('#admin-confirm-delete').onclick=async ev=>{ev.target.disabled=true;try{const deleteFile=document.querySelector('#admin-delete-file')?.checked;await backend.cloudDelete(type,id);let message='Resource deleted.';if(deleteFile){try{await backend.deleteFile(item.storage_path,item.storage_bucket||'lexamah-files');}catch{message='Resource deleted; its file remains in Storage. Remove it there if needed.';}}document.querySelector('#dialog').close();await ui.reload();await loadAdmin();ui.toast(message);}catch(err){document.querySelector('#admin-delete-status').textContent=err.message;ev.target.disabled=false;}};}
export function bindAdmin(){
 if(state.status!=='ready'||!backend.staffReady())return;
 if(backend.adminReady()){
  const binding={siteEditor:bindSiteEditor,samples:bindSamples,branding:bindBranding,downloadSettings:bindDownloadSettings,users:bindUsers,mail:bindUsers,about:bindAboutEditor,subjects:bindSubjects,tips:bindTipsAdmin,team:bindTeam};
  if(Object.hasOwn(binding,state.type)){binding[state.type](ui);return;}
 }
 const search=document.querySelector('#admin-search');
 if(search)search.oninput=ev=>{state.query=ev.target.value;const pos=ev.target.selectionStart;ui.render();const next=document.querySelector('#admin-search');next.focus();next.setSelectionRange(pos,pos);};
}
export async function adminClick(button){
 if(!backend.staffReady())return false;
 if(button.id==='admin-refresh'){resetTeam();await loadAdmin();return true;}
 if(state.status!=='ready')return false;
 if(backend.adminReady()){
  if(await usersClick(button,ui))return true;
  if(button.dataset.removeSubject&&state.type==='subjects'){removeSubject(button.dataset.removeSubject,ui);return true;}
  if(button.dataset.dismissAssistant&&state.type==='team'){dismissAssistantClick(button.dataset.dismissAssistant,ui);return true;}
 }
 if(button.dataset.adminType){
  if(!Object.hasOwn(adminTabs(),button.dataset.adminType))return true;
  clearBrandingPreview();state.type=button.dataset.adminType;state.query='';ui.render();
  await loadTab();return true;
 }
 if(button.id==='admin-create'){edit();return true;}
 if(button.dataset.adminEdit){edit(button.dataset.adminEdit);return true;}
 if(button.dataset.adminDelete){await remove(button.dataset.adminDelete);return true;}
 return false;
}
