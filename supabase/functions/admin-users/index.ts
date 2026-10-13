import {server,type Dependencies} from '../_shared/server.ts';
export async function handler(req:Request,deps:Dependencies={}){
 const s=server(req,deps);if(s.blocked)return s.blocked;
 try{
 const auth=await s.auth();if(!auth)return s.reply(401,{error:'Sign in first.'});
 const admin=await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_is_admin`,{method:'POST',headers:s.apiHeaders(s.publicKey!,auth.token),body:'{}'});
 if(!admin.ok||await admin.json()!==true)return s.reply(403,{error:'Administrator access required.'});
 if(!s.secretKey)return s.reply(503,{error:'Server configuration is missing.'});
 const body=await s.json(),id=body.user_id;
 if(!['disable','enable','delete'].includes(body.action)||typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))return s.reply(400,{error:'Invalid account action.'});
 if(id===auth.user.id)return s.reply(400,{error:'You cannot disable or delete your own account.'});
 const membership=await s.fetcher(`${s.url}/rest/v1/lexamah_admins?user_id=eq.${id}&select=user_id`,{headers:s.apiHeaders(s.secretKey)});
 if(!membership.ok)throw new Error();if((await membership.json()).length)return s.reply(400,{error:'Administrator accounts are protected. Remove their admin role in Supabase first.'});
 const profiles=await s.fetcher(`${s.url}/rest/v1/lexamah_profiles?user_id=eq.${id}&select=username`,{headers:s.apiHeaders(s.secretKey)});
 if(!profiles.ok)throw new Error();const profile=(await profiles.json())[0];if(!profile)return s.reply(404,{error:'Account not found.'});
 if(body.action==='delete'&&body.confirm!==profile.username)return s.reply(400,{error:'Type the username to confirm permanent deletion.'});
 const headers=s.apiHeaders(s.secretKey);
 // Mark disabled before banning; RLS denies existing JWTs immediately even if Auth update fails.
 if(body.action==='disable'){
 const mark=await s.fetcher(`${s.url}/rest/v1/lexamah_profiles?user_id=eq.${id}`,{method:'PATCH',headers,body:JSON.stringify({disabled:true})});if(!mark.ok)throw new Error();
 }
 const action=await s.fetcher(`${s.url}/auth/v1/admin/users/${id}`,{method:body.action==='delete'?'DELETE':'PUT',headers,body:body.action==='delete'?undefined:JSON.stringify({ban_duration:body.action==='disable'?'876000h':'none'}),signal:AbortSignal.timeout(15000)});
 if(!action.ok)return s.reply(502,{error:body.action==='disable'?'Access disabled, but Auth ban failed. Retry Disable.':'Supabase could not complete this action. Accounts owning Storage files or referenced legacy records may need manual cleanup.'});
 if(body.action==='enable'){
 const mark=await s.fetcher(`${s.url}/rest/v1/lexamah_profiles?user_id=eq.${id}`,{method:'PATCH',headers,body:JSON.stringify({disabled:false})});if(!mark.ok)throw new Error();
 }
 return s.reply(200,{success:true});
 }catch{return s.reply(502,{error:'Account action failed. Refresh and retry.'});}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(req=>handler(req));
