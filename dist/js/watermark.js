// Watermarks are embedded in the stored PDF, not overlaid only in the viewer.
const LIMIT=50*1024*1024;
let libraryFlight;
export async function pdfLibrary(){
 if(globalThis.PDFLib)return globalThis.PDFLib;
 if(!libraryFlight)libraryFlight=import('../vendor/pdf-lib/pdf-lib.min.js').then(()=>{if(!globalThis.PDFLib)throw new Error('PDF tools could not load. Refresh and try again.');return globalThis.PDFLib;}).catch(err=>{libraryFlight=null;throw err;});
 return libraryFlight;
}
export function watermarkText(value='LexAmah'){
 const text=String(value).trim();
 if(!text||text.length>60||!/^[\x20-\x7e]+$/.test(text))throw new Error('Use 1–60 plain English letters, numbers or punctuation for the watermark.');
 return text;
}
export function watermarkSettings(raw={}){
 const number=(key,fallback,min,max)=>{const value=raw[key]===undefined?fallback:Number(raw[key]);if(!Number.isFinite(value)||value<min||value>max)throw new Error(`Invalid watermark ${key}. Use ${min}–${max}.`);return value;};
 const mode=raw.mode||'text';if(!['text','image'].includes(mode))throw new Error('Choose a text or logo watermark.');
 return {mode,text:mode==='text'?watermarkText(raw.text===undefined?'LexAmah':raw.text):'LexAmah',x:number('x',50,0,100),y:number('y',50,0,100),size:number('size',55,5,90),opacity:number('opacity',18,1,100),rotation:number('rotation',35,-90,90)};
}
// Work in the visible, rotated page's coordinates, then map back to PDF coordinates.
export function watermarkPlacement(box,rotation,ratio,settings){
 const r=((rotation%360)+360)%360;if(![0,90,180,270].includes(r))throw new Error('Unsupported PDF page rotation.');
 const displayWidth=r%180?box.height:box.width,displayHeight=r%180?box.width:box.height;
 const radians=settings.rotation*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
 let width=displayWidth*settings.size/100,height=width/ratio;
 const limit=Math.min(1,displayWidth*.96/(Math.abs(width*cos)+Math.abs(height*sin)),displayHeight*.96/(Math.abs(width*sin)+Math.abs(height*cos)));
 width*=limit;height*=limit;
 const halfW=(Math.abs(width*cos)+Math.abs(height*sin))/2,halfH=(Math.abs(width*sin)+Math.abs(height*cos))/2;
 const x=Math.max(halfW+displayWidth*.02,Math.min(displayWidth-halfW-displayWidth*.02,displayWidth*settings.x/100));
 const y=Math.max(halfH+displayHeight*.02,Math.min(displayHeight-halfH-displayHeight*.02,displayHeight*settings.y/100));
 let cx,cy;
 if(r===0){cx=x;cy=box.height-y;}else if(r===90){cx=y;cy=x;}else if(r===180){cx=box.width-x;cy=y;}else{cx=box.width-y;cy=box.height-x;}
 const angle=(settings.rotation+r)*Math.PI/180;
 return {x:box.x+cx-width*Math.cos(angle)/2+height*Math.sin(angle)/2,y:box.y+cy-width*Math.sin(angle)/2-height*Math.cos(angle)/2,width,height,angle:settings.rotation+r,displayX:x,displayY:y};
}
export async function watermarkDocument(file,options={}){
 const settings=watermarkSettings(options),onProgress=options.onProgress||(()=>{});
 if(!file?.size||file.size>LIMIT)throw new Error('Choose a non-empty file up to 50 MB.');
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['pdf','jpg','jpeg','png'].includes(ext))throw new Error('For automatic watermarking, save Word or text documents as PDF first. Upload PDF, JPG or PNG.');
 onProgress('Preparing watermarked PDF…');
 const {PDFDocument,StandardFonts,rgb,degrees}=await pdfLibrary();
 const bytes=new Uint8Array(await file.arrayBuffer());
 let doc;
 try{
  if(ext==='pdf')doc=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
  else{
   doc=await PDFDocument.create();
   const image=ext==='png'?await doc.embedPng(bytes):await doc.embedJpg(bytes);
   const scale=Math.min(1,1440/Math.max(image.width,image.height));
   const page=doc.addPage([image.width*scale,image.height*scale]);
   page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
  }
 }catch(err){
  if(/encrypt|password/i.test(String(err?.message)))throw new Error('This PDF is password-protected. Upload an unlocked PDF copy to add the watermark.');
  throw new Error('The file could not be read. Export a valid PDF, JPG or PNG and try again.');
 }
 const pages=doc.getPages();if(!pages.length)throw new Error('The PDF has no pages.');
 let font,logo,ratio;
 if(settings.mode==='image'){
  const image=options.image,extension=image?.name?.split('.').pop().toLowerCase();
  if(!image?.size||image.size>2*1024*1024||!['png','jpg','jpeg'].includes(extension))throw new Error('Choose a PNG or JPG watermark logo up to 2 MB.');
  try{const data=await image.arrayBuffer();logo=extension==='png'?await doc.embedPng(data):await doc.embedJpg(data);}catch{throw new Error('This logo cannot be read. Choose a valid PNG or JPG.');}
  if(logo.width>8192||logo.height>8192)throw new Error('Resize the watermark logo to 8192 pixels or smaller.');
  ratio=logo.width/logo.height;
 }else{
  font=await doc.embedFont(StandardFonts.HelveticaBold);
  ratio=font.widthOfTextAtSize(settings.text,1)/font.heightAtSize(1);
 }
 for(let i=0;i<pages.length;i++){
  const page=pages[i],crop=page.getCropBox(),media=page.getMediaBox();
  const left=Math.max(crop.x,media.x),bottom=Math.max(crop.y,media.y);
  const width=Math.min(crop.x+crop.width,media.x+media.width)-left,height=Math.min(crop.y+crop.height,media.y+media.height)-bottom;
  if(width<=0||height<=0)throw new Error(`Page ${i+1} has an invalid visible page area. Export a new PDF and retry.`);
  const position=watermarkPlacement({x:left,y:bottom,width,height},page.getRotation().angle,ratio,settings);
  const common={x:position.x,y:position.y,opacity:settings.opacity/100,rotate:degrees(position.angle)};
  if(logo)page.drawImage(logo,{...common,width:position.width,height:position.height});
  else{const size=position.width/font.widthOfTextAtSize(settings.text,1),descent=font.heightAtSize(size)-font.heightAtSize(size,{descender:false}),angle=position.angle*Math.PI/180;page.drawText(settings.text,{...common,x:position.x-descent*Math.sin(angle),y:position.y+descent*Math.cos(angle),font,size,color:rgb(.25,.35,.31)});}
  if(i%8===0||i===pages.length-1){onProgress(`Watermarking page ${i+1} of ${pages.length}…`);await new Promise(resolve=>setTimeout(resolve,0));}
 }
 onProgress('Saving watermarked PDF…');
 const output=await doc.save();
 if(output.length>LIMIT)throw new Error('The watermarked PDF exceeds 50 MB. Compress the original and upload it again.');
 const base=file.name.replace(/\.[^.]+$/,'');
 return new File([output],ext==='pdf'?file.name:`${base}.pdf`,{type:'application/pdf',lastModified:Date.now()});
}
