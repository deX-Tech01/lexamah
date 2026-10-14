import {server,type Dependencies} from '../_shared/server.ts';
export async function handler(req:Request,deps:Dependencies={}){
 const s=server(req,deps);if(s.blocked)return s.blocked;
 try{const auth=await s.auth();if(!auth)return s.reply(401,{error:'Log in to read documents.'});
 const body=await s.json();const table=body.type==='materials'?'lexamah_materials':body.type==='lectureNotes'?'lexamah_lecture_notes':null;
 if(!table||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/i.test(body.id))return s.reply(400,{error:'Choose a valid resource.'});
 if(!s.url||!s.publicKey||!s.secretKey)return s.reply(503,{error:'Document viewing is not configured.'});
 const r=await s.fetcher(`${s.url}/rest/v1/${table}?id=eq.${body.id}&select=*`,{headers:s.apiHeaders(s.publicKey,auth.token),signal:AbortSignal.timeout(15000)});
 if(!r.ok)return s.reply(503,{error:'The resource could not be loaded.'});const item=(await r.json())[0];if(!item)return s.reply(404,{error:'Resource unavailable.'});
 if(!item.storage_path)return s.reply(200,{text:item.body||'',mime_type:'text/plain',fileName:item.title});
 if((item.storage_bucket||'lexamah-files')!=='lexamah-files')return s.reply(400,{error:'Invalid document bucket.'});
 const path=item.storage_path.split('/').map(encodeURIComponent).join('/');
 const r2=await s.fetcher(`${s.url}/storage/v1/object/sign/lexamah-files/${path}`,{method:'POST',headers:s.apiHeaders(s.secretKey),body:JSON.stringify({expiresIn:60}),signal:AbortSignal.timeout(15000)});
 const signed=await r2.json();if(!r2.ok||!signed.signedURL)return s.reply(502,{error:'Document could not be opened.'});
 const path2=signed.signedURL.startsWith('/object/')?'/storage/v1'+signed.signedURL:signed.signedURL;const url=new URL(path2,`${s.url}/storage/v1/`);
 if(url.origin!==new URL(s.url).origin)return s.reply(502,{error:'Invalid document URL.'});
 return s.reply(200,{url:url.href,mime_type:item.mime_type,fileName:item.file_name});
 }catch{return s.reply(502,{error:'Document viewing failed. Please try again.'});}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(req=>handler(req));
