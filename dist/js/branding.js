import {copyRaw,applyStaticCopy} from './site-copy.js';
import {backend} from './backend.js';
import {getBranding,setBranding,brandName,signupFields,signupExample,brandingRevision} from './brand-state.js';
let issue='',flight,originalMark,originalIcon;
export const brandingIssue=()=>issue;
export async function loadBranding(){
 if(!flight)flight=(async()=>{try{const revision=brandingRevision(),next=await backend.publicBranding();if(revision===brandingRevision()){setBranding(next);applyBranding();}issue='';return true;}catch{issue='Branding settings could not load. Run supabase/branding-update.sql, check your connection and refresh.';return false;}finally{flight=null;}})();
 return flight;
}
export function applyBranding(){
 if(typeof document==='undefined'||!document.head)return;
 const name=brandName(),brand=getBranding();
 for(const item of document.querySelectorAll('[data-brand-name]'))item.textContent=name;
 for(const item of document.querySelectorAll('[data-brand-uppercase]'))item.textContent=name.toUpperCase();
 const brandLabel=document.querySelector('.brand > span:last-child');
 if(brandLabel){let slot=brandLabel.querySelector('[data-brand-name]');if(!slot){const small=brandLabel.querySelector('small');slot=document.createElement('span');slot.setAttribute('data-brand-name','');brandLabel.replaceChildren(slot,...(small?[small]:[]));}slot.textContent=name;brandLabel.style.overflowWrap='anywhere';brandLabel.style.minWidth='0';}
 const footer=document.querySelector('footer > span:first-child');if(footer&&!footer.querySelector('[data-brand-name]')){const slot=document.createElement('span');slot.setAttribute('data-brand-name','');slot.textContent=name;footer.replaceChildren(slot,document.createTextNode(' • '),Object.assign(document.createElement('span'),{textContent:copyRaw('shell.footer_tagline')}));}
 const footerText=footer?.lastElementChild;if(footerText&&!footerText.hasAttribute('data-brand-name'))footerText.textContent=copyRaw('shell.footer_tagline');
 const eyebrow=document.querySelector('.dialog-top .eyebrow');if(eyebrow)eyebrow.textContent=`${name.toUpperCase()} ${copyRaw('shell.workspace')}`;
 const about=document.querySelector('#nav [data-route="about"]');if(about){const label=about.querySelector('[data-brand-name]');if(label)label.textContent=name;}
 const crumb=document.querySelector('#crumb');if(crumb&&location.hash==='#about')crumb.textContent=`${copyRaw('shell.about')} ${name}`;
 document.title=`${crumb?.textContent||'Your legal learning workspace'} · ${name}`;
 const description=document.querySelector('meta[name="description"]');if(description)description.content=`${name} — your law school, thoughtfully organized. Study materials, case briefs, revision and progress in one workspace.`;
 const connection=document.querySelector('#connection');if(connection&&!backend.user())connection.textContent=`${copyRaw('shell.welcome')} ${name}`;
 const ids={full_name:'signup-name',email:'signup-email',phone_number:'signup-phone',institution:'signup-institution',level:'signup-level',username:'signup-username',password:'signup-password'};
 for(const key of Object.keys(signupFields)){const input=document.querySelector('#'+ids[key]);if(input)input.placeholder=signupExample(key);}
 const mark=document.querySelector('.brand-mark'),url=backend.brandingLogoURL(brand.logo_path);
 if(mark){if(originalMark===undefined)originalMark=mark.innerHTML;if(url){let img=mark.querySelector('[data-brand-logo]');if(!img){img=document.createElement('img');img.setAttribute('data-brand-logo','');img.style.cssText='width:100%;height:100%;object-fit:contain';mark.replaceChildren(img);}img.src=url;img.alt=`${name} logo`;mark.style.flexShrink='0';}else if(mark.querySelector('[data-brand-logo]'))mark.innerHTML=originalMark;}
 let icon=document.querySelector('link[rel="icon"]');if(originalIcon===undefined)originalIcon=icon?.getAttribute('href')||null;
 if(url){if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon);}icon.href=url;icon.type='image/png';let touch=document.querySelector('link[data-brand-touch]');if(!touch){touch=document.createElement('link');touch.rel='apple-touch-icon';touch.setAttribute('data-brand-touch','');document.head.append(touch);}touch.href=url;}
 else{if(icon){if(originalIcon)icon.href=originalIcon;else icon.remove();}document.querySelector('link[data-brand-touch]')?.remove();}
 applyStaticCopy();
}
