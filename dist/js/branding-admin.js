import {copyHTML,copyRaw} from './site-copy.js';
import {backend} from './backend.js';
import {getBranding,signupFields,validateBranding,setBranding} from './brand-state.js';
import {loadBranding,applyBranding,brandingIssue} from './branding.js';
import {escape as e} from './store.js';
let previewURL;
export function clearBrandingPreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
export async function reloadBranding(ui){clearBrandingPreview();await loadBranding();ui.render();}
export function brandingScreen(){
 const brand=getBranding(),url=backend.brandingLogoURL(brand.logo_path);
 return `<section class="card"><div class="card-head"><h2>${copyHTML("branding-admin.9e1a209c7fc9")}</h2><button type="button" class="btn" id="branding-refresh">${copyHTML("branding-admin.415db71a1296")}</button></div>${brandingIssue()?`<p role="alert">${e(brandingIssue())}</p>`:`<p class="muted">${copyHTML("branding-admin.2506b7955ebf")}</p><form id="branding-form"><label for="branding-name">${copyHTML("branding-admin.e98af105bc0e")}</label><input id="branding-name" required maxlength="60" value="${e(brand.site_name)}"><label for="branding-logo">${copyHTML("branding-admin.6031e47c3a36")}</label><input id="branding-logo" type="file" accept="image/png,image/jpeg,image/webp"><p class="muted">${copyHTML("branding-admin.db41671fe4b0")}</p><img id="branding-logo-preview" ${url?`src="${e(url)}"`:''} ${url?'':'hidden'} alt="Site logo preview" style="width:120px;height:120px;object-fit:contain;background:#eef2ee;border-radius:12px;padding:8px"><label class="task"><input id="branding-original-logo" type="checkbox"><span>${copyHTML("branding-admin.3228ea298200")}</span></label><label for="branding-watermark">${copyHTML("branding-admin.5669d1ce83c9")}</label><input id="branding-watermark" required maxlength="60" pattern="[ -~]{1,60}" value="${e(brand.watermark_text)}"><p class="muted">${copyHTML("branding-admin.6a538dc2b656")}</p><h3>${copyHTML("branding-admin.ad4a3ab042ea")}</h3><p class="muted">${copyHTML("branding-admin.a932973363f0")}</p>${Object.entries(signupFields).map(([key,item])=>`<label for="branding-example-${key}">${e(item.label)} ${copyHTML("branding-admin.50d858e0985e")}</label><input id="branding-example-${key}" maxlength="160" value="${e(brand.signup_examples[key])}" autocomplete="off">`).join('')}<p id="branding-status" role="status"></p><button type="submit" class="btn primary">${copyHTML("branding-admin.be6fc9279870")}</button></form>`}</section>`;
}
export async function prepareBrandLogo(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file?.type)||!file.size||file.size>2*1024*1024)throw new Error(copyRaw("branding-admin.b154600c1c6e"));
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error(copyRaw("branding-admin.d108fd9296d5"));}
 try{if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>25000000)throw new Error(copyRaw("branding-admin.d5a375279089"));const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),scale=Math.min(512/bitmap.width,512/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;ctx.drawImage(bitmap,(512-w)/2,(512-h)/2,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>2*1024*1024)throw new Error(copyRaw("branding-admin.35bc5d97e90e"));return new File([blob],'site-logo.png',{type:'image/png'});}finally{bitmap.close();}
}
export function bindBranding(ui){
 const refresh=document.querySelector('#branding-refresh');if(refresh)refresh.onclick=()=>reloadBranding(ui);
 const form=document.querySelector('#branding-form');if(!form)return;
 const fileInput=form.querySelector('#branding-logo'),original=form.querySelector('#branding-original-logo'),preview=form.querySelector('#branding-logo-preview'),status=form.querySelector('#branding-status');let saving=false;
 original.onchange=()=>{fileInput.disabled=original.checked;preview.hidden=original.checked||!preview.getAttribute('src');};
 fileInput.onchange=()=>{clearBrandingPreview();const file=fileInput.files[0];if(!file){const url=backend.brandingLogoURL(getBranding().logo_path);if(url)preview.src=url;preview.hidden=!url;return;}if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){status.textContent=copyRaw("branding-admin.b154600c1c6e");fileInput.value='';return;}previewURL=URL.createObjectURL(file);preview.src=previewURL;preview.hidden=false;status.textContent=copyRaw("branding-admin.400f21d2d4c0");};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const owner=backend.user()?.id;let upload,saved=false,saveStarted=false;
  try{
   const draft=validateBranding({site_name:form.querySelector('#branding-name').value,watermark_text:form.querySelector('#branding-watermark').value,logo_path:original.checked?null:getBranding().logo_path,signup_examples:Object.fromEntries(Object.keys(signupFields).map(key=>[key,form.querySelector('#branding-example-'+key).value]))});
   const chosen=original.checked?null:fileInput.files[0];saving=true;refresh.disabled=true;for(const control of form.querySelectorAll('input,button'))control.disabled=true;status.textContent=copyRaw("branding-admin.e2d2f66d35dd");
   if(chosen){status.textContent=copyRaw("branding-admin.238d8fe55f27");const png=await prepareBrandLogo(chosen);if(backend.user()?.id!==owner)throw new Error(copyRaw("branding-admin.dfa4c1b5ebda"));upload=await backend.uploadBrandLogo(png);draft.logo_path=upload;}
   if(backend.user()?.id!==owner)throw new Error(copyRaw("branding-admin.dfa4c1b5ebda"));
   saveStarted=true;const result=await backend.saveBranding(draft);saved=true;setBranding(result);applyBranding();clearBrandingPreview();fileInput.value='';original.checked=false;const url=backend.brandingLogoURL(result.logo_path);if(url)preview.src=url;preview.hidden=!url;status.textContent=copyRaw("branding-admin.cf32ce68d0d3");ui.toast(copyRaw("branding-admin.93d4eb15ce25"));
  }catch(err){status.textContent=err.message;if(upload&&!saved&&!saveStarted){try{await backend.removeUnsavedBrandLogo(upload);}catch{status.textContent+=copyRaw("branding-admin.a32782c773cc");}}}
  finally{saving=false;refresh.disabled=false;for(const control of form.querySelectorAll('input,button'))control.disabled=false;fileInput.disabled=original.checked;}
 };
}
