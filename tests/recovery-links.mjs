import assert from 'node:assert/strict';
const saved=new Map();
globalThis.sessionStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.location={origin:'https://example.com',pathname:'/',search:'',hash:''};
globalThis.history={replaceState(_a,_b,url){const parsed=new URL(url,location.origin);Object.assign(location,{search:parsed.search,hash:parsed.hash});}};
let checks=0;
globalThis.fetch=async()=>{checks++;return {ok:true,json:async()=>({id:'recovered-account'})};};
const {backend}=await import('../dist/js/backend.js');
const {handleRecoveryLink,resetPage}=await import('../dist/js/recovery.js');
for(const prefix of ['#','#reset#','#reset&']){
 backend.clearSession();location.search='?recovery=1';location.hash=prefix+'access_token=verified&refresh_token=refresh&type=recovery&expires_in=3600';
 assert.equal(await handleRecoveryLink(),true);assert.equal(backend.recoveryReady(),true);assert.equal(location.hash,'#reset');assert.equal(location.search,'');assert.match(resetPage(),/id="reset-form"/);
}
assert.equal(checks,3);
location.search='?recovery=1';location.hash='#error=access_denied&error_code=otp_expired';
assert.equal(await handleRecoveryLink(),true);assert.equal(backend.recoveryReady(),false);assert.match(resetPage(),/expired or is invalid/);
location.search='';location.hash='#type=recovery';await handleRecoveryLink();assert.equal(backend.recoveryReady(),false);assert.match(resetPage(),/incomplete/);
location.hash='#dashboard';assert.equal(await handleRecoveryLink(),false);
console.log('PASS: standard and legacy recovery fragments, token cleanup, expired and incomplete links, no unverified password form.');
