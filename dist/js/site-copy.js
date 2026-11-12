import {copyCatalog} from './copy-catalog.js';
let overrides={};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setSiteCopy(value={}){overrides=Object.fromEntries(Object.entries(value).filter(([key,text])=>Object.hasOwn(copyCatalog,key)&&typeof text==='string'&&text.length<=5000&&!/[<>\x00-\x08]/.test(text)));}
export function copyRaw(key){return Object.hasOwn(overrides,key)?overrides[key]:copyCatalog[key]?.text||'';}
export const copyHTML=key=>escape(copyRaw(key));
export function siteCopyValues(){return {...overrides};}
export function applyStaticCopy(){if(typeof document==='undefined')return;for(const el of document.querySelectorAll('[data-site-copy]'))el.textContent=copyRaw(el.dataset.siteCopy);}
