// Dashboard previews and full sections are cached separately by load level.
// Resetting the library also invalidates work started for the previous account.
import {legacyTables} from './library-overrides.js';

const PREVIEW_LIMIT=6;
const routes={
 dashboard:['materials','lectures'],
 materials:['materials','lectureNotes'],
 lectures:['lectures'],
 cases:['cases'],
 quiz:['quizSets','quizQuestions'],
 flashcards:['flashcards']
};

export function createSharedLibrary(client){
 let sections=new Map();
 const rows=kind=>sections.get(kind)?.rows||[];
 async function load(kind,preview){
  const level=preview?1:2,previous=sections.get(kind);
  if(previous?.level>=level&&previous.status!=='error')return previous.work;
  const entry={level,status:'loading',rows:previous?.rows||[],work:null};
  sections.set(kind,entry);
  const current=()=>sections.get(kind)===entry;
  const options=preview?{limit:PREVIEW_LIMIT}:{};
  const legacy=Object.hasOwn(legacyTables,kind)?client.read(legacyTables[kind],options):Promise.resolve(null);
  const cloud=client.cloudRead(kind,options);
  entry.work=Promise.allSettled([legacy,cloud]).then(results=>{
   if(!current())return;
   const collections=results.flatMap((r,index)=>r.status==='fulfilled'&&Array.isArray(r.value)?
    [r.value.map(row=>({...row,lexamah_cloud:index===1,library_source:index===1?undefined:'legacy'}))]:[]);
   if(!collections.length){entry.status='error';return;}
   entry.rows=collections.flat().map(x=>({...x,title:x.title||x.name,subject:x.subject||x.course||'General',
    body:x.body||x.content||x.summary,url:x.url||x.file_url||x.recording_url}));
   entry.status='ready';
  });
  return entry.work;
 }
 return {
  rows,
  reset(){sections=new Map();},
  canLoad(route){return Object.hasOwn(routes,route);},
  load(route){const kinds=Object.hasOwn(routes,route)?routes[route]:[];return Promise.all(kinds.map(kind=>load(kind,route==='dashboard')));},
  status(route){
   const kinds=Object.hasOwn(routes,route)?routes[route]:[];
   const states=kinds.map(kind=>sections.get(kind));
   if(!states.length)return 'ready';
   if(states.some(value=>!value||value.status==='loading'||(route!=='dashboard'&&value.level===1)))return 'loading';
   return states.some(value=>value.status==='error')?'error':'ready';
  }
 };
}
