const defaults={profile:{name:'Student',username:'',email:'',phone_number:'',institution:'',level:''},theme:'light',bookmarks:[],completed:[],attempts:[],sessions:[],tasks:[],notes:{},materials:[],lectureNotes:[],lectures:[],cases:[],flashcards:[],quizSets:[],quizQuestions:[]};
let owner=null,key='lexamah:v2:guest';
const fresh=()=>structuredClone(defaults);
function read(){try{return {...fresh(),...JSON.parse(localStorage.getItem(key)||'{}')};}catch{return fresh();}}
let state=read();const listeners=new Set();
const personalKeys=Object.keys(defaults).filter(k=>k!=='profile');
export const store={
 get:()=>state,owner:()=>owner,
 useAccount(id){owner=id||null;key=owner?`lexamah:v2:user:${owner}`:'lexamah:v2:guest';state=read();return state;},
 subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
 update(patch,{silent=false}={}){const next={...state,...patch};localStorage.setItem(key,JSON.stringify(next));state=next;if(!silent&&Object.keys(patch).some(k=>personalKeys.includes(k))){localStorage.setItem(key+':dirty','true');for(const fn of listeners)fn(state,owner);}return state;},
 dirty(){return localStorage.getItem(key+':dirty')==='true';},
 clean(id){if(id===owner)localStorage.setItem(key+':dirty','false');},
 personal(){return Object.fromEntries(personalKeys.map(k=>[k,structuredClone(state[k])]));},
 applyCloud(data){if(!data||typeof data!=='object')return;const patch={};for(const k of personalKeys){if(k==='theme'){if(['light','dark'].includes(data[k]))patch[k]=data[k];}else if(k==='notes'){if(data[k]&&typeof data[k]==='object'&&!Array.isArray(data[k]))patch[k]=data[k];}else if(Array.isArray(data[k]))patch[k]=data[k];}this.update(patch,{silent:true});},
 toggle(k,value){this.update({[k]:state[k].includes(value)?state[k].filter(x=>x!==value):[...state[k],value]});},
 export(){return JSON.stringify({version:2,owner,exportedAt:new Date().toISOString(),data:state},null,2);},
 import(raw){const parsed=JSON.parse(raw);if(![1,2].includes(parsed.version)||!parsed.data||typeof parsed.data.profile?.name!=='string')throw new Error('Choose a valid LexAmah backup.');if(parsed.version===2&&parsed.owner&&parsed.owner!==owner)throw new Error('This backup belongs to a different account.');for(const k of personalKeys.filter(k=>!['theme','notes','lectureNotes'].includes(k)))if(!Array.isArray(parsed.data[k]))throw new Error('Backup data is incomplete.');const profile=state.profile;this.update({...fresh(),...parsed.data,profile});}
};
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function download(name,body,type='text/plain'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
