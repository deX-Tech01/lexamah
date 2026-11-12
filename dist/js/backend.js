import {copyRaw} from './site-copy.js';
import {defaultWatermark,validateBranding,validLogoPath} from './brand-state.js';
import {watermarkDocument} from './watermark.js';
// Public Supabase publishable/anon key only. Never use a service-role key here.
// Existing quiz integrations use quiz_set_id, not quiz_id.
const CONFIG_KEY='lexamah:supabase';
let config={url:'https://tvycfhrbdtyxmyeymdgo.supabase.co',key:'sb_publishable_B7s2zzncHW0H-ICBEljE0A_srylPjhR'};
try {config={...config,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')};}catch{}
let session=null;
let refreshFlight=null;let administrator=false;
try {session=JSON.parse(sessionStorage.getItem('lexamah:auth')||'null');}catch{}
async function request(path,{method='GET',body,auth=true,prefer='return=representation',signal}={}) {
 const owner=auth?session?.user?.id:null;if(auth&&session?.refresh_token)await backend.refreshSession();if(auth&&owner!==session?.user?.id)throw new Error(copyRaw("backend.1fa60f80356c"));
 if(!backend.configured())throw new Error(copyRaw("backend.0c4d7a9f2b44"));
 const response=await fetch(`${config.url}${path}`,{method,headers:{apikey:config.key,...(auth&&session?.access_token?{Authorization:`Bearer ${session.access_token}`}:(config.key.startsWith('sb_')?{}:{Authorization:`Bearer ${config.key}`})),'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined,signal});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error(data?.msg||data?.message||data?.error_description||data?.error||'The server could not complete this request.');error.codeRequired=data?.code_required===true;throw error;}
 return data;
}
export const backend={
 configured:()=>Boolean(config.url&&config.key), config:()=>({...config}), user:()=>session?.user,
 configure(url,key){if(!administrator)throw new Error(copyRaw("backend.0e83b057c6d5"));const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw new Error(copyRaw("backend.8e209460e2da"));if(!key.trim())throw new Error(copyRaw("backend.494f6fb03556"));if(key.startsWith('sb_secret_'))throw new Error(copyRaw("backend.81b68ce518b3"));if(key.includes('.')){let payload;try{payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{}if(payload?.role==='service_role')throw new Error(copyRaw("backend.fe0a5d22f9d3"));}if(config.url!==u.origin){session=null;sessionStorage.removeItem('lexamah:auth');}config={url:u.origin,key:key.trim()};localStorage.setItem(CONFIG_KEY,JSON.stringify(config));},
 async signIn(username,password){sessionStorage.removeItem('lexamah:recovery');session=await request('/functions/v1/account-login',{method:'POST',body:{username,password},auth:false});session.expires_at ||= Math.floor(Date.now()/1000)+(session.expires_in||3600);sessionStorage.setItem('lexamah:auth',JSON.stringify(session));return session;},
 async signUp(email,password,profile){const data=await request(`/auth/v1/signup${typeof location!=='undefined'&&location.href?'?redirect_to='+encodeURIComponent(location.href.split('#')[0]):''}`,{method:'POST',body:{email,password,data:{full_name:profile.full_name,username:profile.username,institution:profile.institution,level:profile.level,phone_number:profile.phone_number,lexamah_signup:true}},auth:false});if(data.access_token){session=data;sessionStorage.setItem('lexamah:auth',JSON.stringify(session));}return data;},
 async signOut(){try{if(session){try{await request('/rest/v1/rpc/lexamah_release_admin_session',{method:'POST',body:{}});}catch{}await request('/auth/v1/logout?scope=local',{method:'POST'});}}finally{this.clearSession();}},
 clearSession(){session=null;administrator=false;sessionStorage.removeItem('lexamah:auth');sessionStorage.removeItem('lexamah:recovery');},
 adminReady:()=>administrator,
 async read(table){return await request(`/rest/v1/${table}?select=*`);},
 async saveQuizAttempt(attempt,cloud=false){if(!session?.user)throw new Error(copyRaw("backend.8326eead43b9"));return request(cloud?'/rest/v1/lexamah_quiz_attempts':'/rest/v1/quiz_attempts',{method:'POST',body:{user_id:session.user.id,quiz_set_id:attempt.quiz_set_id,score:attempt.score,total_questions:attempt.total_questions}});},
 async insert(table,payload){return request(`/rest/v1/${table}`,{method:'POST',body:payload});},
 async remove(table,id){return request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});}
};

// LexAmah cloud content lives in separate tables to preserve legacy Lexora data.
const cloudTables={subjects:'lexamah_subjects',lectureNotes:'lexamah_lecture_notes',materials:'lexamah_materials',lectures:'lexamah_lectures',cases:'lexamah_cases',flashcards:'lexamah_flashcards',quizSets:'lexamah_quiz_sets',quizQuestions:'lexamah_quiz_questions'};
const BUCKET='lexamah-files';
const encodePath=path=>path.split('/').map(encodeURIComponent).join('/');
Object.assign(backend,{
 async isAdmin(){if(!backend.user())return false;const id=backend.user().id;const allowed=(await request('/rest/v1/rpc/lexamah_is_admin',{method:'POST',body:{}}))===true;if(backend.user()?.id!==id)return false;administrator=allowed;return allowed;},
 async cloudRead(type){const table=cloudTables[type];if(!table)throw new Error(copyRaw("backend.5aa669ab7b91"));return request(`/rest/v1/${table}?select=*&order=created_at.desc`);},
 async cloudSave(type,item,id){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.a4eb4b836621"));const table=cloudTables[type];if(!table)throw new Error(copyRaw("backend.5aa669ab7b91"));const data=await request(`/rest/v1/${table}${id?`?id=eq.${encodeURIComponent(id)}`:''}`,{method:id?copyRaw("backend.8dce33b49f31"):copyRaw("backend.9aee6b1bcdf6"),body:item});if(!Array.isArray(data)||data.length!==1)throw new Error(copyRaw("backend.c9cc0a3abb7c"));return data[0];},
 async cloudDelete(type,id){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.a4eb4b836621"));const table=cloudTables[type];if(!table)throw new Error(copyRaw("backend.5aa669ab7b91"));const data=await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});if(!Array.isArray(data)||data.length!==1)throw new Error(copyRaw("backend.476b0c0b14a1"));return data[0];},
 async upload(file,{audioOnly=false,watermark=false,watermarkLabel=defaultWatermark(),watermarkOptions={},onProgress=()=>{}}={}){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.a4eb4b836621"));const owner=backend.user().id;if(watermark){if(audioOnly)throw new Error(copyRaw("backend.1a14c7e87eb7"));file=await watermarkDocument(file,{text:watermarkLabel,...watermarkOptions,onProgress});if(backend.user()?.id!==owner||!await backend.isAdmin())throw new Error(copyRaw("backend.e124b546ca96"));}onProgress('Uploading file…');if(!file?.size)throw new Error(copyRaw("backend.a74119b33203"));if(file.size>50*1024*1024)throw new Error(copyRaw("backend.80dc97e4564b"));const audioTypes=['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/flac'];const documentTypes=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png'];const allowed=audioOnly?audioTypes:documentTypes;const mimeByExtension={pdf:documentTypes[0],docx:documentTypes[1],txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',flac:'audio/flac'};const extension=file.name.split('.').pop().toLowerCase();const fallback=mimeByExtension[extension];const mime=allowed.includes(file.type)?file.type:(!file.type||file.type==='audio/x-m4a'?fallback:null);if(!allowed.includes(mime)||!allowed.includes(fallback))throw new Error(audioOnly?copyRaw("backend.323eb6b4e885"):copyRaw("backend.790fadec5f64"));const bucket=audioOnly?'lexamah-audio':BUCKET;const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100);const path=`${backend.user().id}/${crypto.randomUUID()}-${name}`;const response=await fetch(`${config.url}/storage/v1/object/${bucket}/${encodePath(path)}`,{method:'POST',headers:{apikey:config.key,Authorization:`Bearer ${session.access_token}`,'Content-Type':mime,'x-upsert':'false'},body:file});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||data?.error||'File upload failed.');return {storage_path:path,file_name:file.name,file_size:file.size,storage_bucket:bucket,mime_type:mime};},
 async fileURL(path,bucket=BUCKET){if(!['lexamah-files','lexamah-audio'].includes(bucket))throw new Error(copyRaw("backend.7b033b2abdb5"));if(!backend.user())throw new Error(copyRaw("backend.0f2355382253"));const data=await request(`/storage/v1/object/sign/${bucket}/${encodePath(path)}`,{method:'POST',body:{expiresIn:bucket==='lexamah-audio'?7200:300}});const value=data?.signedURL||data?.signedUrl;if(!value)throw new Error(copyRaw("backend.736ad122a1ab"));const signedPath=value.startsWith('/object/')?'/storage/v1'+value:value;const url=new URL(signedPath,`${config.url}/storage/v1/`);if(url.origin!==new URL(config.url).origin)throw new Error(copyRaw("backend.c0872fbb4d12"));return url.href;},
 async deleteFile(path,bucket=BUCKET){if(!['lexamah-files','lexamah-audio'].includes(bucket))throw new Error(copyRaw("backend.7b033b2abdb5"));if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.a4eb4b836621"));return request(`/storage/v1/object/${bucket}`,{method:'DELETE',body:{prefixes:[path]}});},
 async refreshSession(){if(!session?.refresh_token)return;if(session.expires_at&&session.expires_at*1000>Date.now()+60000)return;if(!refreshFlight)refreshFlight=(async()=>{const previous=session;const updated=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});if(session!==previous)return;session={...updated,profile:previous.profile,expires_at:updated.expires_at||Math.floor(Date.now()/1000)+(updated.expires_in||3600)};sessionStorage.setItem('lexamah:auth',JSON.stringify(session));})().finally(()=>{refreshFlight=null;});await refreshFlight;}
});

Object.assign(backend,{
 async protectedDownload(type,id,code){if(!backend.user())throw new Error(copyRaw("backend.71c76201fad0"));return request('/functions/v1/content-download',{method:'POST',body:{type,id,code}});},
 profile(){return session?.profile||session?.user?.user_metadata||{};},
 async saveProfile(profile){if(!backend.user())return;const data=await request(`/rest/v1/lexamah_profiles?user_id=eq.${encodeURIComponent(backend.user().id)}`,{method:'PATCH',body:{full_name:profile.name,phone_number:profile.phone_number||'',institution:profile.institution,level:profile.level}});if(!data?.[0])throw new Error(copyRaw("backend.249190526a53"));session.profile=data[0];sessionStorage.setItem('lexamah:auth',JSON.stringify(session));}
});

Object.assign(backend,{
 async saveAbout(content){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));const rows=await request('/rest/v1/lexamah_about?id=eq.main',{method:'PATCH',body:{content,updated_at:new Date().toISOString()}});if(!rows?.[0])throw new Error(copyRaw("backend.479745190d0a"));return rows[0];},
 async uploadPortrait(file){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024)throw new Error(copyRaw("backend.68d9b5bc3338"));const path=`${backend.user().id}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi,'-')}`;const response=await fetch(`${config.url}/storage/v1/object/lexamah-portraits/${encodePath(path)}`,{method:'POST',headers:{apikey:config.key,Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type,'x-upsert':'false'},body:file});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||'Picture upload failed.');return `${config.url}/storage/v1/object/public/lexamah-portraits/${encodePath(path)}`;}
});

Object.assign(backend,{
 recoveryReady(){try{return Boolean(session?.user&&sessionStorage.getItem('lexamah:recovery')==='ready');}catch{return false;}},
 async requestRecovery(email,redirect){const url=new URL(redirect);if(url.origin!==location.origin)throw new Error(copyRaw("backend.a911d426514f"));return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(url.href)}`,{method:'POST',body:{email},auth:false});},
 async acceptRecovery(access,refresh,seconds){const response=await fetch(`${config.url}/auth/v1/user`,{headers:{apikey:config.key,Authorization:`Bearer ${access}`}});if(!response.ok)throw new Error(copyRaw("backend.ec1e0abca7b8"));const user=await response.json();if(!user.id)throw new Error(copyRaw("backend.049a4f6ce9cd"));session={access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+Math.max(1,Math.min(seconds,86400)),user};sessionStorage.setItem('lexamah:auth',JSON.stringify(session));sessionStorage.setItem('lexamah:recovery','ready');},
 async resetPassword(password){if(!this.recoveryReady())throw new Error(copyRaw("backend.1fa20945819a"));if(password.length<8||password.length>200)throw new Error(copyRaw("backend.4521551d6585"));await request('/auth/v1/user',{method:'PUT',body:{password}});sessionStorage.removeItem('lexamah:recovery');try{await this.signOut();}finally{session=null;sessionStorage.removeItem('lexamah:auth');}},
 async trackVisit(visitor){return request('/rest/v1/rpc/lexamah_record_visit',{method:'POST',body:{p_visitor_id:visitor}});},
 async adminStats(){if(!backend.user()||!await backend.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));return request('/rest/v1/rpc/lexamah_admin_stats',{method:'POST',body:{}});}
});

Object.assign(backend,{
 async adminUsers(offset=0,query=''){return request('/rest/v1/rpc/lexamah_admin_users',{method:'POST',body:{p_offset:offset,p_query:query}});},
 async adminAccount(action,user_id,confirm=''){return request('/functions/v1/admin-users',{method:'POST',body:{action,user_id,confirm}});},
 async adminMail(body){return request('/functions/v1/admin-mail',{method:'POST',body});}
});

Object.assign(backend,{
 async resolveAccess(){administrator=false;if(!this.user()||this.recoveryReady())return false;const id=this.user().id;const active=await request('/rest/v1/rpc/lexamah_account_active',{method:'POST',body:{}});if(this.user()?.id!==id)return false;if(active!==true){this.clearSession();throw new Error(copyRaw("backend.76055c6947d4"));}const member=await request('/rest/v1/rpc/lexamah_admin_member',{method:'POST',body:{}});if(member===true){const slot=await request('/rest/v1/rpc/lexamah_claim_admin_session',{method:'POST',body:{}});if(this.user()?.id===id)administrator=slot===true;}return administrator;},
 async loadProfile(){if(!this.user())return;const id=this.user().id;const rows=await request(`/rest/v1/lexamah_profiles?user_id=eq.${encodeURIComponent(id)}&select=*`);if(this.user()?.id===id&&rows?.[0]){session.profile=rows[0];sessionStorage.setItem('lexamah:auth',JSON.stringify(session));}},
 async getProgress(){if(!this.user())throw new Error(copyRaw("backend.771a9aa3e820"));const rows=await request(`/rest/v1/lexamah_user_progress?user_id=eq.${encodeURIComponent(this.user().id)}&select=data`);return rows?.[0]?.data||null;},
 async saveProgress(id,data){if(this.user()?.id!==id)throw new Error(copyRaw("backend.4991424c0f47"));return request('/rest/v1/lexamah_user_progress?on_conflict=user_id',{method:'POST',body:{user_id:id,data,updated_at:new Date().toISOString()},prefer:'resolution=merge-duplicates,return=representation'});},
 async viewDocument(type,id){if(!this.user())throw new Error(copyRaw("backend.9d6cc2043fe4"));return request('/functions/v1/content-view',{method:'POST',body:{type,id}});}
});

Object.assign(backend,{
 async downloadPolicy(){if(!this.user())throw new Error(copyRaw("backend.bd0699275b15"));const rows=await request('/rest/v1/lexamah_download_settings?id=eq.main&select=require_access_code');if(!Array.isArray(rows)||rows.length!==1||typeof rows[0].require_access_code!=='boolean')throw new Error(copyRaw("backend.f14d3a9feadb"));return rows[0];},
 async saveDownloadPolicy(required){if(typeof required!=='boolean')throw new Error(copyRaw("backend.155ff44abf59"));if(!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));const rows=await request('/rest/v1/lexamah_download_settings?id=eq.main',{method:'PATCH',body:{require_access_code:required,updated_at:new Date().toISOString()}});if(!Array.isArray(rows)||rows.length!==1)throw new Error(copyRaw("backend.4f53370f5f22"));return rows[0];}
});

Object.assign(backend,{
 async changeDownloadCode(value){
  const code=typeof value==='string'?value.trim():'';
  if(code.length<4||new TextEncoder().encode(code).length>64||/[\x00-\x1f\x7f]/.test(code))throw new Error(copyRaw("backend.def503f79c82"));
  if(!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));
  const result=await request('/rest/v1/rpc/lexamah_change_download_code',{method:'POST',body:{p_code:code}});
  if(result!==true)throw new Error(copyRaw("backend.7a0f5798c8b6"));
  return true;
 }
});

Object.assign(backend,{
 async publicBranding(){const rows=await request('/rest/v1/lexamah_branding?id=eq.main&select=site_name,logo_path,watermark_text,signup_examples',{auth:false,signal:AbortSignal.timeout(8000)});if(!Array.isArray(rows)||rows.length!==1)throw new Error(copyRaw("backend.f3a1d1a64b86"));return rows[0];},
 async saveBranding(value){const payload=validateBranding(value),owner=this.user()?.id;if(!owner||!await this.isAdmin()||this.user()?.id!==owner)throw new Error(copyRaw("backend.0e83b057c6d5"));const rows=await request('/rest/v1/lexamah_branding?id=eq.main',{method:'PATCH',body:{...payload,updated_at:new Date().toISOString()}});if(!Array.isArray(rows)||rows.length!==1)throw new Error(copyRaw("backend.8f1e4f7f988a"));if(this.user()?.id!==owner)throw new Error(copyRaw("backend.1553e8cfa181"));return rows[0];},
 brandingLogoURL(path){const safe=validLogoPath(path);return safe?`${config.url}/storage/v1/object/public/lexamah-branding/${encodePath(safe)}`:'';},
 async uploadBrandLogo(file){const owner=this.user()?.id;if(!owner||!await this.isAdmin()||this.user()?.id!==owner)throw new Error(copyRaw("backend.0e83b057c6d5"));if(file?.type!=='image/png'||!file.size||file.size>2*1024*1024)throw new Error(copyRaw("backend.a4c0f7556da2"));const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());if(bytes.join(',')!=='137,80,78,71,13,10,26,10')throw new Error(copyRaw("backend.10419e776351"));await this.refreshSession();if(this.user()?.id!==owner)throw new Error(copyRaw("backend.2465fbad8d82"));const path=`logos/${crypto.randomUUID()}.png`;const response=await fetch(`${config.url}/storage/v1/object/lexamah-branding/${encodePath(path)}`,{method:'POST',headers:{apikey:config.key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'image/png','x-upsert':'false'},body:file});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||data?.error||'Logo upload failed. Run branding-update.sql and try again.');return path;},
 async removeUnsavedBrandLogo(path){if(!validLogoPath(path)||!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));return request('/storage/v1/object/lexamah-branding',{method:'DELETE',body:{prefixes:[path]}});}
});

Object.assign(backend,{
 async publicSiteEditor(){const rows=await request('/rest/v1/lexamah_site_editor?id=eq.main&select=copy,appearance',{auth:false,signal:AbortSignal.timeout(8000)});if(!Array.isArray(rows)||rows.length!==1)throw new Error(copyRaw("backend.a8d9f8a3d2a5"));return rows[0];},
 async saveSiteEditor(value){if(!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));const rows=await request('/rest/v1/lexamah_site_editor?id=eq.main',{method:'PATCH',body:{copy:value.copy,appearance:value.appearance,updated_at:new Date().toISOString()}});if(!Array.isArray(rows)||rows.length!==1)throw new Error(copyRaw("backend.29dc730e117e"));return rows[0];},
 async libraryOverrides(){if(!this.user())return [];return request('/rest/v1/lexamah_library_overrides?select=*');},
 async saveLibraryOverride(row){if(!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));const value={kind:row.kind,source:row.source,source_id:String(row.source_id),content:row.content,hidden:row.hidden===true,updated_at:new Date().toISOString()};const result=await request('/rest/v1/lexamah_library_overrides?on_conflict=kind,source,source_id',{method:'POST',body:value,prefer:'resolution=merge-duplicates,return=representation'});if(!Array.isArray(result)||result.length!==1)throw new Error(copyRaw("backend.52bd1c31112e"));return result[0];},
 async resetLibraryOverride(kind,source,id){if(!this.user()||!await this.isAdmin())throw new Error(copyRaw("backend.0e83b057c6d5"));return request(`/rest/v1/lexamah_library_overrides?kind=eq.${encodeURIComponent(kind)}&source=eq.${encodeURIComponent(source)}&source_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});}
});
