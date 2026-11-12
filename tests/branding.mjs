import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultBranding,setBranding,getBranding,brandHTML,signupExample,validateBranding} from '../dist/js/brand-state.js';
import {watermarkSettings} from '../dist/js/watermark.js';
import {watermarkEditor} from '../dist/js/watermark-controls.js';
import {aboutPage} from '../dist/js/about.js';
const changed={...defaultBranding(),site_name:'Justice & Learning',watermark_text:'Adv Chimdike et Faithful',logo_path:'logos/test.png'};changed.signup_examples.phone_number='08123456789';changed.signup_examples.email='student@school.edu';
setBranding(changed);assert.equal(watermarkSettings().text,changed.watermark_text);assert.match(watermarkEditor(),/value="Adv Chimdike et Faithful"/);assert.match(aboutPage(),/Justice &amp; Learning/);assert.equal(signupExample('phone_number'),'08123456789');
const malicious={...changed,site_name:'<img src=x onerror=alert(1)>',signup_examples:{...changed.signup_examples,full_name:'" onfocus="alert(1)'}};setBranding(malicious);assert.ok(!brandHTML().includes('<img'));assert.match(brandHTML(),/&lt;img/);assert.ok(!aboutPage().includes('<img src=x'));
for(const partial of [{site_name:''},{watermark_text:'😀'},{logo_path:'https://evil.test/logo.png'},{signup_examples:{...changed.signup_examples,email:42}},{signup_examples:{...changed.signup_examples,unknown:'x'}},{signup_examples:{...changed.signup_examples,email:'x'.repeat(161)}}])assert.throws(()=>validateBranding({...changed,...partial}));
setBranding(changed);const copy=getBranding();copy.signup_examples.phone_number='mutated';assert.equal(signupExample('phone_number'),'08123456789');setBranding({...changed,signup_examples:{...changed.signup_examples,phone_number:''}});assert.equal(signupExample('phone_number'),'','blank removes hint');setBranding(changed);
const memory=new Map();globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.sessionStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
// backend was imported by the watermark editor; stub identity without changing its RPC methods.
const {backend}=await import('../dist/js/backend.js');let admin=false,calls=[];backend.user=()=>({id:'admin'});backend.isAdmin=async()=>admin;
globalThis.fetch=async(url,options={})=>{calls.push({url,options});let data=[changed];if(url.includes('/storage/'))data={Key:'logo'};if(url.includes('account-login'))data={access_token:'token',user:{id:'admin'}};return {ok:true,json:async()=>data};};
await backend.publicBranding();assert.ok(!calls[0].options.headers.Authorization?.includes('token'));assert.equal(calls[0].options.method,'GET');
await assert.rejects(()=>backend.saveBranding(changed),/Administrator/);assert.equal(calls.length,1);await assert.rejects(()=>backend.uploadBrandLogo(new File(['x'],'x.png',{type:'image/png'})),/Administrator/);assert.equal(calls.length,1);
admin=true;await backend.signIn('admin','password');await backend.saveBranding(changed);assert.equal(calls.at(-1).options.method,'PATCH');assert.equal(JSON.parse(calls.at(-1).options.body).site_name,changed.site_name);assert.ok(!Object.hasOwn(JSON.parse(calls.at(-1).options.body),'id'));
await assert.rejects(()=>backend.uploadBrandLogo(new File(['<svg>'],'logo.svg',{type:'image/svg+xml'})),/PNG/);await assert.rejects(()=>backend.uploadBrandLogo(new File(['not png'],'logo.png',{type:'image/png'})),/valid PNG/);
const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],'logo.png',{type:'image/png'});const path=await backend.uploadBrandLogo(png);assert.match(path,/^logos\/[a-f0-9-]+\.png$/);assert.match(backend.brandingLogoURL(path),/\/public\/lexamah-branding\/logos\//);assert.equal(backend.brandingLogoURL('../private/file'),'');
const app=await readFile(new URL('../dist/js/app.js',import.meta.url),'utf8');for(const key of ['full_name','email','phone_number','institution','level','username','password'])assert.ok(app.includes(`signupExample('${key}')`));
console.log('PASS: shared brand name escaping, new upload watermark defaults, configurable and blank sign-up hints, public reads, administrator-only writes and logo type/path validation.');
// A public refresh already in flight must not overwrite a just-saved admin change.
const {loadBranding}=await import('../dist/js/branding.js');let resolveOld;backend.publicBranding=()=>new Promise(resolve=>resolveOld=resolve);const pending=loadBranding();setBranding({...changed,site_name:'Latest saved name'});resolveOld(changed);await pending;assert.equal(getBranding().site_name,'Latest saved name');
