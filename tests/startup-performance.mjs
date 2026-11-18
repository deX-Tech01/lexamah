import assert from 'node:assert/strict';

const deferred=()=>{
 let resolve;const work=new Promise(done=>{resolve=done;});
 return {work,resolve};
};
const appearance=deferred(),checks=deferred(),progress=deferred(),preview=deferred();
const calls=[],values=new Map(),elements=new Map(),listeners={},writes=[];
function node(selector){
 if(!elements.has(selector)){
  const classes=new Set();
  elements.set(selector,{
   dataset:{},textContent:'',value:'',disabled:false,
   get innerHTML(){return this.html||'';},
   set innerHTML(text){this.html=text;if(selector==='#content')writes.push(text);},
   classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},
   addEventListener(){},setAttribute(){},insertAdjacentHTML(){},showModal(){},close(){},load(){},pause(){},removeAttribute(){},
   contains(){return false;},
   querySelector:()=>node('#submit-button'),
   querySelectorAll:()=>selector==='#login-form'?[node('#login-username'),node('#login-password')]:[]
  });
 }
 return elements.get(selector);
}
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
globalThis.localStorage=storage;globalThis.sessionStorage=storage;
globalThis.FormData=class {constructor(){return new Map([['username','student'],['password','test-only-password']]);}};
globalThis.document={body:node('body'),querySelector:node,querySelectorAll:()=>[],addEventListener(){}};
globalThis.window={scrollTo(){},matchMedia:()=>({matches:false}),addEventListener:(name,callback)=>listeners[name]=callback};
globalThis.location={hash:'#login',search:'',origin:'https://lexamah.test'};
globalThis.history={replaceState:(_data,_title,hash)=>{location.hash=hash;}};

let blocked=false;
globalThis.fetch=async (raw,options={})=>{
 const url=new URL(raw),endpoint=url.pathname.split('/').at(-1);calls.push({endpoint,url});
 let value=[];
 if(endpoint==='lexamah_site_editor'){await appearance.work;value=[{copy:{},appearance:{}}];}
 else if(endpoint==='lexamah_branding')value=[{site_name:'LexAmah',signup_examples:{}}];
 else if(endpoint==='account-login')value={access_token:'fixture-token',user:{id:'fixture-user',email:'student@example.test'},profile:{username:'student',full_name:'Test Student',phone_number:'',institution:'UNIPORT',level:'300'}};
 else if(endpoint==='lexamah_workspace_access'){
  await checks.work;value=blocked?{active:false}:{active:true,role:'student',tips:{enabled:false,title:'Share Tips'}};
 }
 else if(endpoint==='lexamah_user_progress'){await progress.work;value=[{data:{tasks:[]}}];}
 else if(endpoint==='lexamah_materials'&&url.searchParams.has('limit')){
  await preview.work;value=[{id:'stale-preview',title:'Outdated dashboard preview',subject:'Contract'}];
 }else if(endpoint==='lexamah_materials')value=[{id:'fresh-material',title:'Full library material',subject:'Contract'}];
 return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
};

const has=endpoint=>calls.some(call=>call.endpoint===endpoint);
async function until(condition){
 const until=Date.now()+5000;
 while(!condition()&&Date.now()<until)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(condition(),'Background work did not reach the expected state.');
}
const go=hash=>{location.hash=hash;listeners.hashchange();};
const signIn=()=>node('#login-form').onsubmit({preventDefault(){},target:node('#login-form')});

await import('../dist/js/app.js');
await until(()=>has('lexamah_site_editor'));
assert.match(node('#content').innerHTML,/id="login-form"/,'The sign-in form is ready while public settings are blocked.');
node('#login-username').value='student';
node('#login-password').value='new draft';
const loginRenders=writes.length,signInWork=signIn();
await until(()=>has('lexamah_workspace_access'));
assert.match(node('#content').innerHTML,/id="login-form"/,'The dashboard must wait for access verification.');
assert.equal(has('lexamah_materials'),false);
assert.equal(has('lexamah_user_progress'),false);
appearance.resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(writes.length,loginRenders,'Presentation must not replace a login form in use.');

checks.resolve();await signInWork;
assert.equal(location.hash,'#dashboard');
assert.match(node('#content').innerHTML,/Build your knowledge/);
assert.match(node('#content').innerHTML,/Test\./);
assert.ok(has('lexamah_user_progress'),'Profile-independent progress sync starts in the background.');
assert.ok(!has('lexamah_profiles'),'Reuse the verified profile included in the login response.');
assert.ok(!has('lexamah_quiz_questions')&&!has('lexamah_flashcards')&&!has('lexamah_cases'));
assert.ok(calls.some(call=>call.endpoint==='lexamah_materials'&&call.url.searchParams.get('limit')==='6'));

go('#materials');
await until(()=>node('#content').innerHTML.includes('Full library material'));
preview.resolve();progress.resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.match(node('#content').innerHTML,/Full library material/,'A late preview must not replace the full library.');
assert.doesNotMatch(node('#content').innerHTML,/Outdated dashboard preview/);
go('#quiz');
await until(()=>has('lexamah_quiz_questions'));
assert.equal(has('lexamah_flashcards'),false);

const {backend}=await import('../dist/js/backend.js');
backend.clearSession();blocked=true;go('#login');await signIn();
assert.match(node('#content').innerHTML,/id="login-form"/);
assert.match(node('#login-status').textContent,/disabled/i);
assert.equal(backend.user(),undefined);

console.log('PASS: login renders before remote settings, access checks remain required, and optional work cannot delay the dashboard or replace newer data.');
process.exit(0);
