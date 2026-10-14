import {server,type Dependencies} from '../_shared/server.ts';
export async function handler(req:Request,deps:Dependencies={}){
 const s=server(req,deps);if(s.blocked)return s.blocked;
 if(!s.url||!s.publicKey||!s.secretKey)return s.reply(503,{error:'Username login needs the Supabase server environment keys.'});
 try{let body;try{body=await s.json();}catch{return s.reply(400,{error:'Enter a valid username and password.'});}
 const username=typeof body.username==='string'?body.username.trim():'';const password=typeof body.password==='string'?body.password:'';
 if(!/^[a-zA-Z0-9_.]{3,30}$/.test(username)||!password||password.length>200)return s.reply(400,{error:'Enter your username and password.'});
 const lookup=await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_account_lookup`,{method:'POST',headers:s.apiHeaders(s.secretKey),body:JSON.stringify({p_username:username}),signal:AbortSignal.timeout(15000)});
 if(!lookup.ok)return s.reply(503,{error:'Run supabase/updates.sql to enable username login.'});
 const account=await lookup.json();if(!account?.email)return s.reply(401,{error:'Incorrect username or password.'});
 const response=await s.fetcher(`${s.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:s.apiHeaders(s.publicKey),body:JSON.stringify({email:account.email,password}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok){if(response.status===429)return s.reply(429,{error:'Too many login attempts. Try again shortly.'});if(result.error_code==='email_not_confirmed')return s.reply(401,{error:'Confirm your email before logging in.'});return s.reply(401,{error:'Incorrect username or password.'});}
 const token=`Bearer ${result.access_token}`;
 const member=await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_admin_member`,{method:'POST',headers:s.apiHeaders(s.publicKey,token),body:'{}'});
 if(!member.ok)return s.reply(503,{error:'Run security-update.sql to enable secure account access.'});
 if(await member.json()===true){
 const claim=await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_claim_admin_session`,{method:'POST',headers:s.apiHeaders(s.publicKey,token),body:'{}'});
 if(!claim.ok||await claim.json()!==true){await s.fetcher(`${s.url}/auth/v1/logout?scope=local`,{method:'POST',headers:s.apiHeaders(s.publicKey,token)});return s.reply(409,{error:'Two administrator sessions are already active. Sign out on another device, or wait three minutes after closing it.'});}
 }
 return s.reply(200,{...result,profile:account.profile});
 }catch{return s.reply(502,{error:'Login could not reach Supabase. Try again shortly.'});}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(req=>handler(req));
