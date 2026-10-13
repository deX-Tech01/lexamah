import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
const {store,escape}=await import('../dist/js/store.js');
store.update({profile:{name:'Test Student',level:'LL.B 3'}});assert.equal(store.get().profile.name,'Test Student');store.toggle('bookmarks','guide-case');assert.deepEqual(store.get().bookmarks,['guide-case']);store.toggle('bookmarks','guide-case');assert.equal(store.get().bookmarks.length,0);assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');const backup=store.export();store.update({tasks:[{id:'x',text:'Temporary',done:false}]});store.import(backup);assert.equal(store.get().tasks.length,0);assert.throws(()=>store.import('{"version":2}'));
globalThis.fetch=async()=>({ok:true,json:async()=>[]});
const elements=new Map();const listeners={};const windowListeners={};
function el(selector){if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},classList:{add(){},remove(){},toggle(){return false;}},setAttribute(){},addEventListener(){},showModal(){},close(){},focus(){},setSelectionRange(){},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}});return elements.get(selector);}
globalThis.document={querySelector:el,querySelectorAll:()=>[],body:el('body'),addEventListener:(k,v)=>listeners[k]=v};globalThis.window={addEventListener:(k,v)=>windowListeners[k]=v,scrollTo(){}};globalThis.location={hash:'#dashboard'};
await import('../dist/js/app.js');assert.match(el('#content').innerHTML,/Test/);assert.match(el('#content').innerHTML,/Build your knowledge/);
function go(hash){location.hash=hash;windowListeners.hashchange();}
async function click(props){await listeners.click({target:{closest:()=>({dataset:{},...props})},preventDefault(){}});}
go('#quiz');assert.match(el('#content').innerHTML,/Study foundations/);await click({dataset:{startQuiz:'orientation'}});assert.match(el('#content').innerHTML,/Question 1 of 5/);
for(const [i,answer] of [1,0,2,1,0].entries()){await click({dataset:{answer:String(answer)}});if(i<4)assert.match(el('#content').innerHTML,new RegExp('Question '+(i+2)+' of 5'));}
await click({id:'quiz-finish'});assert.equal(store.get().attempts.length,1);assert.equal(store.get().attempts[0].score,5);assert.equal(store.get().attempts[0].quiz_set_id,'orientation');assert.match(el('#content').innerHTML,/100% correct/);await click({id:'quiz-finish'});assert.equal(store.get().attempts.length,1,'double submission must not duplicate a result');
go('#flashcards');assert.match(el('#content').innerHTML,/main headings/);await click({id:'flip-card'});assert.match(el('#content').innerHTML,/procedural history/);go('#progress');assert.match(el('#content').innerHTML,/Study foundations/);go('#settings');assert.match(el('#content').innerHTML,/Configured/);
const {backend}=await import('../dist/js/backend.js');assert.equal(backend.configured(),true);assert.throws(()=>backend.configure('http://example.com','abc'));assert.throws(()=>backend.configure('https://x.supabase.co','sb_secret_test'));
for(const route of ['materials','lectures','cases','study','signup','login','admin']){go('#'+route);assert.ok(el('#content').innerHTML.length>200,route+' renders');}
go('#signup');for(const text of ['Full name','Email','Institution','Level','Username','Password','University of Port Harcourt','LLB 4'])assert.ok(el('#content').innerHTML.includes(text));go('#login');assert.match(el('#content').innerHTML,/Username/);assert.ok(!el('#content').innerHTML.includes('type="email"'));assert.ok(!el('#nav').innerHTML.includes('AI Tutor'));
console.log('PASS: persistence, backup, escaping, dashboard, quiz flow and duplicate submission, flashcards, progress, settings, routing and key safeguards.');
clearTimeout();process.exit(0);
