export type Dependencies={env?:(key:string)=>string|undefined;fetch?:typeof fetch};
export function server(req:Request,deps:Dependencies={}){
 const env=deps.env||((key:string)=>Deno.env.get(key));const fetcher=deps.fetch||fetch;
 const origins=(env('LEXAMAH_ALLOWED_ORIGINS')||'https://lexuniport.vercel.app,https://lexamah.modestbadge128.chatgpt.site,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080').split(',').map(x=>x.trim());const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,prefer','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
 const blocked=origin&&!origins.includes(origin)?reply(403,{error:'This website origin is not allowed.'}):req.method==='OPTIONS'?new Response(null,{status:204,headers}):req.method!=='POST'?reply(405,{error:'Use POST.'}):null;
 const getKey=(name:string,plural:string)=>{let value=env(name);if(!value){try{value=Object.values(JSON.parse(env(plural)||'{}') as Record<string,string>)[0];}catch{}}return value;};
 const url=env('SUPABASE_URL');const publicKey=env('LEXAMAH_SUPABASE_PUBLISHABLE_KEY')||getKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');const secretKey=getKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
 const apiHeaders=(key:string,token?:string)=>({apikey:key,...(token?{Authorization:token}:key.startsWith('sb_')?{}:{Authorization:`Bearer ${key}`}),'Content-Type':'application/json'});
 const json=async()=>{const raw=await req.text();if(raw.length>12000)throw new Error('Request too large.');const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid request.');return value;};
 const auth=async()=>{const token=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+$/i.test(token)||!url||!publicKey)return null;const response=await fetcher(`${url}/auth/v1/user`,{headers:apiHeaders(publicKey,token),signal:AbortSignal.timeout(15000)});if(!response.ok)return null;const user=await response.json();if(!user.id)return null;const active=await fetcher(`${url}/rest/v1/rpc/lexamah_account_active`,{method:'POST',headers:apiHeaders(publicKey,token),body:'{}',signal:AbortSignal.timeout(15000)});if(!active.ok||await active.json()!==true)return null;return {user,token};};
 return {env,fetcher,reply,blocked,url,publicKey,secretKey,apiHeaders,json,auth};
}
