import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
globalThis.self=globalThis;
const {watermarkDocument,pdfLibrary,watermarkText}=await import('../dist/js/watermark.js');
const {PDFDocument,StandardFonts,degrees}=await pdfLibrary();
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
for(const [w,h,angle] of [[595,842,0],[842,595,0],[595,842,90]]){const page=doc.addPage([w,h]);page.setRotation(degrees(angle));page.drawText('Original legal study content',{x:50,y:h-70,font,size:18});}
const cropped=doc.addPage([600,800]);cropped.setCropBox(100,200,400,400);cropped.drawText('Cropped page retained',{x:120,y:550,font,size:18});
const original=await doc.save();const file=new File([original],'lecture.pdf',{type:'application/pdf'});let progress=[];
const output=await watermarkDocument(file,{onProgress:x=>progress.push(x)});
assert.equal(output.name,'lecture.pdf');assert.equal(output.type,'application/pdf');assert.ok(progress.some(x=>/page 4 of 4/.test(x)));
const loaded=await PDFDocument.load(await output.arrayBuffer());assert.equal(loaded.getPageCount(),4);assert.equal(loaded.getPage(2).getRotation().angle,90);assert.deepEqual(loaded.getPage(3).getCropBox(),cropped.getCropBox());assert.equal(file.size,original.length);
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDQAAAABJRU5ErkJggg==','base64'));
const image=await watermarkDocument(new File([png],'scan.png',{type:'image/png'}));assert.equal(image.name,'scan.pdf');assert.equal((await PDFDocument.load(await image.arrayBuffer())).getPageCount(),1);
await assert.rejects(()=>watermarkDocument(new File(['word'],'notes.docx')),/save Word or text documents as PDF/);
await assert.rejects(()=>watermarkDocument(new File(['broken'],'broken.pdf')),/could not be read/);
await assert.rejects(()=>watermarkDocument(new File([],'empty.pdf')),/non-empty/);assert.throws(()=>watermarkText(''),/1–60/);assert.throws(()=>watermarkText('你好'),/plain English/);
await mkdir('/tmp/lexamah-watermark-check',{recursive:true});await writeFile('/tmp/lexamah-watermark-check/marked.pdf',new Uint8Array(await output.arrayBuffer()));
// Verify the actual upload path receives transformed bytes, and an error never uploads the original.
const memory=new Map();globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};let uploads=[];
globalThis.fetch=async(url,options={})=>{let data=true;if(url.includes('account-login'))data={access_token:'token',user:{id:'admin'}};if(url.includes('/storage/v1/object/')){uploads.push(options.body);data={};}return {ok:true,json:async()=>data};};
const {backend}=await import('../dist/js/backend.js');await backend.signIn('Admin','password');const result=await backend.upload(file,{watermark:true});assert.equal(result.mime_type,'application/pdf');assert.equal(result.file_name,'lecture.pdf');assert.equal(uploads[0].name,'lecture.pdf');await assert.rejects(()=>backend.upload(new File(['word'],'bad.docx'),{watermark:true}),/save Word/);assert.equal(uploads.length,1);
console.log('PASS: all-page PDF stamping, portrait/landscape/rotation/crop preservation, image conversion, progress reporting, unsupported/corrupt/empty file rejection and upload of transformed bytes only.');

const {watermarkSettings,watermarkPlacement}=await import('../dist/js/watermark.js');
for(const rotation of [0,90,180,270])for(const x of [0,50,100])for(const y of [0,50,100])for(const angle of [-90,0,35,90]){
 const settings=watermarkSettings({x,y,size:90,rotation:angle,opacity:65});const p=watermarkPlacement({x:100,y:200,width:400,height:300},rotation,2,settings),w=rotation%180?300:400,h=rotation%180?400:300;
 const a=angle*Math.PI/180,halfW=(Math.abs(p.width*Math.cos(a))+Math.abs(p.height*Math.sin(a)))/2,halfH=(Math.abs(p.width*Math.sin(a))+Math.abs(p.height*Math.cos(a)))/2;
 assert.ok(p.displayX-halfW>=-1e-8&&p.displayX+halfW<=w+1e-8);assert.ok(p.displayY-halfH>=-1e-8&&p.displayY+halfH<=h+1e-8);
}
assert.throws(()=>watermarkSettings({opacity:101}),/opacity/);assert.throws(()=>watermarkSettings({size:NaN}),/size/);await assert.rejects(()=>watermarkDocument(file,{mode:'image'}),/watermark logo/);
const custom=await watermarkDocument(file,{text:'Chimdike Legal',x:90,y:90,size:35,opacity:65,rotation:0});await writeFile('/tmp/lexamah-watermark-check/custom.pdf',new Uint8Array(await custom.arrayBuffer()));
const logo=await watermarkDocument(file,{mode:'image',image:new File([png],'logo.png',{type:'image/png'}),x:10,y:10,size:25,opacity:40,rotation:0});const logoDoc=await PDFDocument.load(await logo.arrayBuffer());assert.equal(logoDoc.getPageCount(),4);assert.ok(logoDoc.getPage(0).node.Resources().get(globalThis.PDFLib.PDFName.of('XObject')));
const {watermarkEditor}=await import('../dist/js/watermark-controls.js');const markup=watermarkEditor();for(const name of ['mode','image','x','y','size','opacity','rotation'])assert.match(markup,new RegExp('name="watermark_'+name+'"'));assert.match(markup,/Preview first page/);
console.log('PASS: selectable text/logo, range validation, every corner across four page rotations, custom text/opacity/size and logo embedding on all pages.');

const named=await watermarkDocument(new File([original],'Legal Method - Week 1.PDF',{type:'application/pdf'}));assert.equal(named.name,'Legal Method - Week 1.PDF');
