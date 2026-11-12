// Public presentation settings only. Keep account/storage identifiers unchanged.
export const signupFields=Object.freeze({
 full_name:{label:'Full name',example:'Adv Chimdike'},
 email:{label:'Email',example:'AdvChimdike@gmail.com'},
 phone_number:{label:'Phone number',example:'08012345678 or +2348012345678'},
 institution:{label:'Institution',example:'University of Port Harcourt'},
 level:{label:'Level',example:'LLB 4'},
 username:{label:'Username',example:'AdvChimdike'},
 password:{label:'Password hint',example:'Choose a password (at least 8 characters)'}
});
export const defaultBranding=()=>({site_name:'LexAmah',logo_path:null,watermark_text:'LexAmah',signup_examples:Object.fromEntries(Object.entries(signupFields).map(([key,item])=>[key,item.example]))});
let current=defaultBranding(),revision=0;
export const brandingRevision=()=>revision;
export function validLogoPath(value){return typeof value==='string'&&/^logos\/[a-zA-Z0-9_-]+\.png$/.test(value)?value:null;}
export function normalizeBranding(value={}){
 const defaults=defaultBranding(),clean=(value,max)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max):'';
 return {site_name:clean(value.site_name,60)||defaults.site_name,logo_path:validLogoPath(value.logo_path),watermark_text:typeof value.watermark_text==='string'&&/^[ -~]{1,60}$/.test(value.watermark_text.trim())?value.watermark_text.trim():defaults.watermark_text,signup_examples:Object.fromEntries(Object.keys(signupFields).map(key=>[key,typeof value.signup_examples?.[key]==='string'?clean(value.signup_examples[key],160):defaults.signup_examples[key]]))};
}
export function setBranding(value){current=normalizeBranding(value);revision++;return getBranding();}
export function getBranding(){return structuredClone(current);}
export const brandName=()=>current.site_name;
export const defaultWatermark=()=>current.watermark_text;
export const signupExample=key=>current.signup_examples[key]??'';
const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const brandHTML=(uppercase=false)=>`<span ${uppercase?'data-brand-uppercase':'data-brand-name'}>${html(uppercase?brandName().toUpperCase():brandName())}</span>`;
export function validateBranding(value){
 const name=typeof value.site_name==='string'?value.site_name.trim():'';
 if(!name||name.length>60||/[\x00-\x1f\x7f]/.test(name))throw new Error('Use a site name of 1–60 characters.');
 if(typeof value.watermark_text!=='string'||!/^[ -~]{1,60}$/.test(value.watermark_text.trim()))throw new Error('Use 1–60 plain English letters, numbers or punctuation for the default watermark.');
 if(value.logo_path!==null&&!validLogoPath(value.logo_path))throw new Error('Choose a valid uploaded logo.');
 if(!value.signup_examples||Object.keys(value.signup_examples).length!==Object.keys(signupFields).length||Object.keys(value.signup_examples).some(key=>!signupFields[key])||Object.values(value.signup_examples).some(text=>typeof text!=='string'||text.length>160||/[\x00-\x1f\x7f]/.test(text)))throw new Error('Use up to 160 characters for each sign-up example.');
 return normalizeBranding(value);
}
