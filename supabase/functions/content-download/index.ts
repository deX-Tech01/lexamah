import {server,type Dependencies} from '../_shared/server.ts';
export async function handler(req:Request,deps:Dependencies={}){
 const s=server(req,deps);if(s.blocked)return s.blocked;
 try{const auth=await s.auth();if(!auth)return s.reply(401,{error:'Log in before downloading materials or lecture notes.'});
 let body;try{body=await s.json();}catch{return s.reply(400,{error:'Enter an access code.'});}
 if(typeof body.code!=='string'||body.code.trim()!==(s.env('LEXAMAH_DOWNLOAD_CODE')||'5Gsupport'))return s.reply(403,{error:'Incorrect access code. Please try again.'});
 const success=async(payload:Record<string,unknown>)=>{if(s.secretKey&&s.url){try{await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_record_download`,{method:'POST',headers:s.apiHeaders(s.secretKey),body:JSON.stringify({p_user_id:auth.user.id,p_resource_type:body.type,p_resource_id:body.id||null}),signal:AbortSignal.timeout(10000)});}catch{/* Downloads remain usable if tracking is unavailable. */}}return s.reply(200,payload);};
 if(body.type==='local')return success({authorized:true});
 const table=body.type==='materials'?'lexamah_materials':body.type==='lectureNotes'?'lexamah_lecture_notes':body.type==='cases'?'lexamah_cases':null;
 if(!table||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return s.reply(400,{error:'Choose a valid material or lecture note.'});
 if(!s.url||!s.publicKey||!s.secretKey)return s.reply(503,{error:'Downloads need the Supabase server environment keys.'});
 const response=await s.fetcher(`${s.url}/rest/v1/${table}?id=eq.${encodeURIComponent(body.id)}&select=*`,{headers:s.apiHeaders(s.publicKey,auth.token),signal:AbortSignal.timeout(15000)});
 if(!response.ok)return s.reply(503,{error:'Run the latest Supabase setup to enable downloads.'});
 const rows=await response.json();const item=rows?.[0];if(!item)return s.reply(404,{error:'This resource is unavailable.'});
 const fileName=item.file_name||`${String(item.title).replace(/[^a-z0-9]/gi,'-')}.txt`;
 if(item.storage_path){const bucket=item.storage_bucket||'lexamah-files';if(bucket!=='lexamah-files')return s.reply(400,{error:'Invalid document bucket.'});const path=item.storage_path.split('/').map(encodeURIComponent).join('/');const signed=await s.fetcher(`${s.url}/storage/v1/object/sign/${bucket}/${path}`,{method:'POST',headers:s.apiHeaders(s.secretKey),body:JSON.stringify({expiresIn:60}),signal:AbortSignal.timeout(15000)});const data=await signed.json();if(!signed.ok||!data.signedURL)return s.reply(502,{error:'The file could not be downloaded.'});const signedPath=data.signedURL.startsWith('/object/')?'/storage/v1'+data.signedURL:data.signedURL;const url=new URL(signedPath,`${s.url}/storage/v1/`);if(url.origin!==new URL(s.url).origin)return s.reply(502,{error:'Invalid file URL.'});url.searchParams.set('download',fileName);return success({authorized:true,url:url.href,fileName});}
 if(item.url){const url=new URL(item.url);if(!['https:','http:'].includes(url.protocol))return s.reply(400,{error:'Invalid resource URL.'});return success({authorized:true,url:url.href,fileName});}
 return success({authorized:true,text:`${item.title}\n\n${item.body||item.description||''}`,fileName});
 }catch{return s.reply(502,{error:'The download service could not complete your request.'});}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(req=>handler(req));
