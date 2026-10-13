const KEY = 'lexamah:v1';
const defaults = {profile:{name:'Student',username:'',email:'',institution:'',level:''}, theme:'light', bookmarks:[], completed:[], attempts:[], sessions:[], tasks:[], notes:{}, materials:[], lectureNotes:[], lectures:[], cases:[], flashcards:[], quizSets:[], quizQuestions:[]};
let state;
try { state = {...defaults, ...JSON.parse(localStorage.getItem(KEY)||'{}')}; } catch { state = structuredClone(defaults); }
export const store = {
 get: () => state,
 update(patch) {const next={...state,...patch};localStorage.setItem(KEY,JSON.stringify(next));state=next;return state;},
 toggle(key,value) {this.update({[key]:state[key].includes(value)?state[key].filter(x=>x!==value):[...state[key],value]});},
 export() {return JSON.stringify({version:1,exportedAt:new Date().toISOString(),data:state},null,2);},
 import(raw) {const parsed=JSON.parse(raw);if(parsed.version!==1||!parsed.data||typeof parsed.data.profile?.name!=='string')throw new Error('Choose a valid LexAmah backup.');for(const k of ['bookmarks','completed','attempts','sessions','tasks','materials','lectures','cases','flashcards','quizSets','quizQuestions'])if(!Array.isArray(parsed.data[k]))throw new Error('Backup data is incomplete.');this.update({...defaults,...parsed.data});}
};
export const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function download(name,body,type='text/plain'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
