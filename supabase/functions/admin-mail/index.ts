import {server,type Dependencies} from '../_shared/server.ts';
export async function handler(req:Request,deps:Dependencies={}){
 const s=server(req,deps);if(s.blocked)return s.blocked;
 try{
 const auth=await s.auth();if(!auth)return s.reply(401,{error:'Sign in first.'});
 const admin=await s.fetcher(`${s.url}/rest/v1/rpc/lexamah_is_admin`,{method:'POST',headers:s.apiHeaders(s.publicKey!,auth.token),body:'{}'});
 if(!admin.ok||await admin.json()!==true)return s.reply(403,{error:'Administrator access required.'});
 if(!s.secretKey)return s.reply(503,{error:'Server configuration is missing.'});
 const api=async(path:string,method='GET',body?:unknown)=>{const r=await s.fetcher(`${s.url}/rest/v1/${path}`,{method,headers:{...s.apiHeaders(s.secretKey!),Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Database request failed');return r.status===204?null:await r.json();};
 const body=await s.json();
 if(body.action==='history')return s.reply(200,{jobs:await api('lexamah_mail_jobs?select=id,subject,created_at&order=created_at.desc&limit=20'),configured:Boolean(s.env('RESEND_API_KEY')&&s.env('LEXAMAH_MAIL_FROM'))});
 const id=body.job_id;if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))return s.reply(400,{error:'Invalid message ID.'});
 if(body.action==='prepare'){
 const subject=typeof body.subject==='string'?body.subject.trim():'',message=typeof body.message==='string'?body.message.trim():'';
 if(!subject||subject.length>180||/[\r\n]/.test(subject)||!message||message.length>8000)return s.reply(400,{error:'Enter a subject (up to 180 characters) and message (up to 8,000 characters).'});
 const existing=await api(`lexamah_mail_jobs?id=eq.${id}&select=id`);
 if(!existing.length)await api('rpc/lexamah_create_mail_job','POST',{p_id:id,p_admin:auth.user.id,p_subject:subject,p_message:message});
 }else if(!['status','send'].includes(body.action))return s.reply(400,{error:'Unknown mail action.'});
 const jobs=await api(`lexamah_mail_jobs?id=eq.${id}&select=*`),job=jobs[0];if(!job)return s.reply(404,{error:'Message not found.'});
 let paused='';
 if(body.action==='send'){
 const key=s.env('RESEND_API_KEY'),from=s.env('LEXAMAH_MAIL_FROM');if(!key||!from)return s.reply(503,{error:'Add RESEND_API_KEY and LEXAMAH_MAIL_FROM in Supabase Edge Function secrets first.'});
 // Resend idempotency keys expire after 24 hours. Never replay an ambiguous old request.
 if(Date.now()-new Date(job.created_at).getTime()>23*3600000)return s.reply(409,{error:'This message is over 23 hours old. Review its counts before creating another message; pending recipients might already have received it.'});
 const recipients=await api(`lexamah_mail_recipients?job_id=eq.${id}&status=eq.pending&order=email&limit=5`);
 for(const recipient of recipients){
 const path=`lexamah_mail_recipients?job_id=eq.${id}&email=eq.${encodeURIComponent(recipient.email)}`;
 const profile=await api(`lexamah_profiles?user_id=eq.${recipient.user_id}&select=disabled`);
 if(!profile[0]||profile[0].disabled){await api(path,'PATCH',{status:'skipped',error:'Account disabled or deleted'});continue;}
 let response;
 try{response=await s.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`lexamah/${id}/${recipient.user_id}`},body:JSON.stringify({from,to:[recipient.email],subject:job.subject,text:job.message}),signal:AbortSignal.timeout(15000)});}catch{paused='Email service did not respond. Resume to safely retry.';break;}
 const result=await response.json().catch(()=>({}));
 if(response.ok){if(!result.id){paused='Email service returned an unexpected response. Resume to retry.';break;}await api(path,'PATCH',{status:'sent',provider_id:result.id,error:null});}
 else if(response.status===429||response.status>=500){paused='Email service is busy or its sending limit was reached. Resume later.';break;}
 else{await api(path,'PATCH',{status:'failed',error:String(result.message||'Email rejected').slice(0,300)});paused='An email was rejected. Check your verified sender and email service limits.';break;}
 await new Promise(resolve=>setTimeout(resolve,600));
 }
 }
 const counts=await api('rpc/lexamah_mail_counts','POST',{p_id:id});
 const errors=await api(`lexamah_mail_recipients?job_id=eq.${id}&status=eq.failed&select=email,error&limit=10`);
 return s.reply(200,{job:{id:job.id,subject:job.subject,message:job.message,created_at:job.created_at},counts,errors,paused});
 }catch{return s.reply(502,{error:'Mail request failed. Refresh message history and resume; previously accepted mail uses duplicate protection for 23 hours.'});}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(req=>handler(req));
