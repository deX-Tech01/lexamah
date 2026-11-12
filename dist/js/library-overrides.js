import {backend} from './backend.js';
import * as seed from './data.js';
let rows=[],failure='',generation=0;
export const legacyTables={materials:'materials',lectures:'lectures',cases:'cases',quizSets:'quiz_sets',quizQuestions:'quiz_questions'};
export const overrideKey=(kind,source,id)=>JSON.stringify([kind,source,String(id)]);
export function resetLibraryOverrides(){generation++;rows=[];failure='';}
export function setLibraryOverrides(next){rows=Array.isArray(next)?next:[];}
export const libraryOverrideError=()=>failure;
export async function loadLibraryOverrides(){const stamp=++generation,owner=backend.user()?.id;try{const result=await backend.libraryOverrides();if(stamp===generation&&backend.user()?.id===owner){setLibraryOverrides(result);failure='';}}catch(err){if(stamp===generation&&backend.user()?.id===owner)failure=err.message;}}
export function applyLibraryOverrides(kind,items,{includeHidden=false}={}){
 const map=new Map(rows.filter(row=>row.kind===kind).map(row=>[overrideKey(kind,row.source,row.source_id),row]));
 return items.map(item=>{const source=item.library_source||(item.lexamah_cloud?null:'legacy');if(!source)return item;const row=map.get(overrideKey(kind,source,item.id));if(!row)return item;const allowed=['title','name','subject','description','body','front','back','question','options','correct_index','explanation','time_minutes','difficulty','citation','url','quiz_set_id','type'];const content=Object.fromEntries(allowed.filter(key=>Object.hasOwn(row.content||{},key)).map(key=>[key,row.content[key]]));if(kind==='quizSets'&&content.name!==undefined)content.title=content.name;return {...item,...content,id:item.id,library_source:source,library_hidden:row.hidden};}).filter(item=>includeHidden||!item.library_hidden);
}
export const builtinResources=kind=>(seed[kind]||[]).map(item=>({...item,library_source:'builtin'}));
