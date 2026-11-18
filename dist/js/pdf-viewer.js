import {copyHTML, copyRaw} from './site-copy.js';

const PAD=12, MIN_ZOOM=0.5, MAX_ZOOM=4, MAX_PIXELS=3_000_000;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const twoFingers=points=>{
 const [a,b]=[...points.values()];
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
};

// The CSS page sizes change during a pinch. Only rasterize again after the
// gesture, and keep canvases only near the visible part of the document.
export async function mountPDF(pdf,{scroll,controls,signal,onReady,onError}){
 const first=await pdf.getPage(1);
 if(signal.aborted)return;
 const firstSize=first.getViewport({scale:1});
 const strip=document.createElement('div');
 strip.className='pdf-strip';
 const frames=Array.from({length:pdf.numPages},(_,i)=>{
  const el=document.createElement('div');
  el.className='pdf-page';
  el.setAttribute('role','img');
  el.setAttribute('aria-label',copyRaw('reader.page')+' '+(i+1));
  el.style.setProperty('--page-width',firstSize.width);
  el.style.setProperty('--page-height',firstSize.height);
  const placeholder=document.createElement('span');
  placeholder.textContent=i+1;
  placeholder.setAttribute('aria-hidden','true');
  el.append(placeholder);
  return {el,canvas:null,scale:0,height:firstSize.height};
 });
 strip.append(...frames.map(frame=>frame.el));
 scroll.classList.add('pdf-pages');
 scroll.replaceChildren(strip);
 controls.innerHTML=`<div class="pdf-controls-group">
   <button type="button" class="btn reader-icon" id="pdf-prev" aria-label="${copyHTML('reader.previous')}">‹</button>
   <output id="pdf-page-number"></output>
   <button type="button" class="btn reader-icon" id="pdf-next" aria-label="${copyHTML('reader.next')}">›</button>
  </div><div class="pdf-controls-group">
   <button type="button" class="btn reader-icon" id="pdf-out" aria-label="${copyHTML('reader.zoomOut')}">−</button>
   <span id="pdf-zoom">100%</span>
   <button type="button" class="btn reader-icon" id="pdf-in" aria-label="${copyHTML('reader.zoomIn')}">+</button>
   <button type="button" class="btn" id="pdf-fit-width">${copyHTML('reader.fitWidth')}</button>
   <button type="button" class="btn" id="pdf-fit-page">${copyHTML('reader.fitPage')}</button>
  </div>`;
 const find=id=>controls.querySelector(id);
 const previous=find('#pdf-prev'),next=find('#pdf-next'),pageNumber=find('#pdf-page-number');
 const zoomLabel=find('#pdf-zoom'),minus=find('#pdf-out'),plus=find('#pdf-in');
 let fit='width',zoom=1,base=1,scale=1,lastSize='',zoomGesture=null;
 let scrollFrame,paintTimer,renderEpoch=0,inFlight=null,activeRender=null,ready=false;
 const rendered=new Set(),points=new Map();
 const pageAt=y=>{
  let lo=0,hi=frames.length-1;
  while(lo<hi){
   const mid=(lo+hi+1)>>1;
   if(frames[mid].el.offsetTop<=y)lo=mid;else hi=mid-1;
  }
  return lo;
 };
 const readIndex=()=>pageAt(scroll.scrollTop+Math.min(scroll.clientHeight/2,(frames[pageAt(scroll.scrollTop)].el.offsetHeight||400)/2));
 function updateControls(){
  const index=readIndex();
  pageNumber.textContent=`${index+1} / ${pdf.numPages}`;
  pageNumber.setAttribute('aria-label',`${copyRaw('reader.page')} ${index+1} / ${pdf.numPages}`);
  previous.disabled=index===0;next.disabled=index===pdf.numPages-1;
  zoomLabel.textContent=`${Math.round(zoom*100)}%`;
  minus.disabled=zoom<=MIN_ZOOM;plus.disabled=zoom>=MAX_ZOOM;
 }
 function center(){
  const r=scroll.getBoundingClientRect();
  return {x:r.left+scroll.clientWidth/2,y:r.top+scroll.clientHeight/2};
 }
 function anchorAt({x,y}){
  const r=scroll.getBoundingClientRect(),index=pageAt(y-r.top+scroll.scrollTop);
  const el=frames[index].el.getBoundingClientRect();
  return {index,u:clamp((x-el.left)/(el.width||1),0,1),v:clamp((y-el.top)/(el.height||1),0,1)};
 }
 function hold(anchor,{x,y}){
  const rect=frames[anchor.index].el.getBoundingClientRect();
  scroll.scrollLeft+=rect.left+anchor.u*rect.width-x;
  scroll.scrollTop+=rect.top+anchor.v*rect.height-y;
 }
 function layout(value,anchor,point){
  zoom=clamp(value,MIN_ZOOM,MAX_ZOOM);
  scale=base*zoom;
  strip.style.setProperty('--pdf-scale',scale);
  if(anchor)hold(anchor,point);
  updateControls();
 }
 function resize(force=false){
  const size=scroll.clientWidth+'x'+scroll.clientHeight;
  if(!force&&lastSize===size)return;
  const point=center(),anchor=lastSize?anchorAt(point):null;
  lastSize=size;
  base=Math.max(80,scroll.clientWidth-PAD*2)/firstSize.width;
  if(fit==='page')base=Math.min(base,Math.max(80,scroll.clientHeight-PAD*2)/firstSize.height);
  layout(zoom,anchor,point);
  queuePaint();
 }
 function discard(index){
  const frame=frames[index];
  if(frame.canvas){frame.canvas.remove();frame.canvas.width=0;frame.canvas.height=0;frame.canvas=null;}
  rendered.delete(index);
 }
 async function paint(){
  if(signal.aborted||points.size>1)return;
  const firstVisible=pageAt(scroll.scrollTop),lastVisible=pageAt(scroll.scrollTop+scroll.clientHeight);
  const targetScale=scale,start=Math.max(0,firstVisible-1);
  const end=Math.min(frames.length-1,lastVisible+1);
  const signature=`${start}:${end}:${targetScale}`;
  if(inFlight===signature)return;
  inFlight=signature;
  const epoch=++renderEpoch,current=()=>epoch===renderEpoch&&!signal.aborted;
  activeRender?.cancel();activeRender=null;
  for(const index of rendered)if(index<start||index>end)discard(index);
  const middle=readIndex();
  const ordered=Array.from({length:end-start+1},(_,i)=>i+start).sort((a,b)=>Math.abs(a-middle)-Math.abs(b-middle));
  try{
   for(const index of ordered){
    if(!current())return;
    const frame=frames[index];
    if(frame.canvas&&frame.scale===targetScale)continue;
    const page=index===0?first:await pdf.getPage(index+1);
    if(!current())return;
    const pageSize=page.getViewport({scale:1}),normalized=firstSize.width/pageSize.width;
    const height=pageSize.height*normalized;
    if(frame.height!==height){
     const point=center(),anchor=anchorAt(point);
     frame.height=height;frame.el.style.setProperty('--page-height',height);hold(anchor,point);
    }
    const viewport=page.getViewport({scale:targetScale*normalized});
    // Keep tall, scanned pages usable on phones with small canvas limits.
    const dpr=Math.min(window.devicePixelRatio||1,2,4096/viewport.width,4096/viewport.height,Math.sqrt(MAX_PIXELS/(viewport.width*viewport.height)));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.floor(viewport.width*dpr));
    canvas.height=Math.max(1,Math.floor(viewport.height*dpr));
    let committed=false;
    try{
     const task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:[dpr,0,0,dpr,0,0]});
     activeRender=task;
     await task.promise;
     if(!current())return;
     discard(index);
     frame.el.append(canvas);frame.canvas=canvas;frame.scale=targetScale;rendered.add(index);committed=true;
     if(!ready){ready=true;onReady();}
    }finally{if(!committed){canvas.width=0;canvas.height=0;}}
   }
  }catch(error){if(current()&&error?.name!=='RenderingCancelledException')onError(error);}
  finally{if(current()){inFlight=null;activeRender=null;updateControls();}}
 }
 function queuePaint(delay=95){
  clearTimeout(paintTimer);
  if(points.size<2)paintTimer=setTimeout(paint,delay);
 }
 function scrollChanged(){
  if(scrollFrame)return;
  scrollFrame=requestAnimationFrame(()=>{
   scrollFrame=0;updateControls();queuePaint();
  });
 }
 function scaleAt(value,point=center()){
  layout(value,anchorAt(point),point);
  queuePaint(85);
 }
 function changeFit(mode){
  fit=mode;zoom=1;resize(true);
 }
 function turn(delta){
  const i=clamp(readIndex()+delta,0,frames.length-1);
  scroll.scrollTop=frames[i].el.offsetTop-PAD;
  updateControls();queuePaint(0);
 }
 previous.onclick=()=>turn(-1);next.onclick=()=>turn(1);
 minus.onclick=()=>scaleAt(zoom/1.25);plus.onclick=()=>scaleAt(zoom*1.25);
 find('#pdf-fit-width').onclick=()=>changeFit('width');
 find('#pdf-fit-page').onclick=()=>changeFit('page');
 scroll.addEventListener('scroll',scrollChanged,{passive:true,signal});
 scroll.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch'||points.size===2)return;
  scroll.setPointerCapture(event.pointerId);
  points.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(points.size===2){
   const center=twoFingers(points);
   zoomGesture={...center,zoom,anchor:anchorAt(center)};
   clearTimeout(paintTimer);
  }
 },{signal});
 scroll.addEventListener('pointermove',event=>{
  const old=points.get(event.pointerId);
  if(!old)return;
  const position={x:event.clientX,y:event.clientY};
  points.set(event.pointerId,position);
  if(zoomGesture&&points.size===2){
   const point=twoFingers(points);
   layout(zoomGesture.zoom*point.distance/zoomGesture.distance,zoomGesture.anchor,point);
  }else{
   scroll.scrollLeft+=old.x-position.x;
   scroll.scrollTop+=old.y-position.y;
  }
 },{signal});
 const end=event=>{
  if(!points.delete(event.pointerId))return;
  if(zoomGesture){zoomGesture=null;queuePaint(0);}
 };
 for(const type of ['pointerup','pointercancel','lostpointercapture'])scroll.addEventListener(type,end,{signal});
 scroll.addEventListener('wheel',event=>{
  if(!event.ctrlKey&&!event.metaKey)return;
  event.preventDefault();
  scaleAt(zoom*Math.exp(-event.deltaY*0.006),{x:event.clientX,y:event.clientY});
 },{passive:false,signal});
 const observer=new ResizeObserver(()=>resize());
 observer.observe(scroll);
 signal.addEventListener('abort',()=>{
  observer.disconnect();renderEpoch++;activeRender?.cancel();clearTimeout(paintTimer);
  if(scrollFrame)cancelAnimationFrame(scrollFrame);
  for(const i of rendered)discard(i);
 },{once:true});
 resize();
 queuePaint(0);
}
