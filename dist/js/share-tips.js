import {backend} from './backend.js';
import {copyHTML,copyRaw} from './site-copy.js';
import {escape as e} from './store.js';

const formatDate=date=>new Date(date).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
const countLabel=(value,singular,plural)=>{
 const count=Math.max(0,Number(value)||0);
 return count+' '+copyHTML(count===1?singular:plural);
};
const byline=item=>`<div class="tip-byline"><strong>@${e(item.username)}</strong><time datetime="${e(item.created_at)}">${e(formatDate(item.created_at))}</time></div>`;
const action=(name,label,{id='',className='',disabled=false}={})=>
 `<button type="button" class="btn ${className}" data-tip-action="${name}" data-tip-id="${e(id)}" ${disabled?'disabled':''}>${copyHTML(label)}</button>`;

class TipsBoard {
 constructor(moderate){this.moderate=moderate;this.revision=0;this.reset();}
 reset(){
  this.revision++;this.host=null;this.ui=null;this.busy=false;this.error='';this.loaded=false;
  this.items=[];this.next=null;this.detailId=null;this.detail=null;this.comments=[];this.commentNext=null;
  this.composing=false;this.draft={title:'',body:'',comment:''};
 }
 allowed(){return Boolean(backend.user()&&!backend.recoveryReady()&&(this.moderate?backend.adminReady():backend.tipsSettings().enabled));}
 attach(host,ui){
  if(!host||!this.allowed())return;
  this.host=host;this.ui=ui;
  host.onclick=event=>{
   const button=event.target.closest('[data-tip-action]');
   if(button&&!button.disabled)this.click(button.dataset.tipAction,Number(button.dataset.tipId));
  };
  host.oninput=event=>{
   const name=event.target.name;
   if(['title','body','comment'].includes(name))this.draft[name]=event.target.value;
  };
  host.onsubmit=event=>{
   if(!['tip-compose','tip-comment-form'].includes(event.target.id))return;
   event.preventDefault();
   const fields=new FormData(event.target);
   if(event.target.id==='tip-compose')this.publish(String(fields.get('title')||''),String(fields.get('body')||''));
   else this.comment(String(fields.get('comment')||''));
  };
  this.paint();
  if(!this.loaded&&!this.detailId&&!this.busy&&!this.error)this.loadFeed();
 }
 paint(){
  if(!this.host?.isConnected||!this.allowed())return;
  this.host.innerHTML=(this.detailId!==null?this.showDetail():this.showFeed())+
   (this.error?`<p class="tip-message notice" role="status">${e(this.error)}</p>`:'');
 }
 async run(work,apply){
  if(this.busy||!this.allowed())return;
  const revision=this.revision,owner=backend.user()?.id;
  const valid=()=>revision===this.revision&&owner===backend.user()?.id&&this.allowed();
  this.busy=true;this.error='';this.paint();
  try{
   const result=await work();
   if(valid())apply(result);
  }catch(error){
   if(valid())this.error=error.message||copyRaw('tips.error');
  }finally{
   if(revision===this.revision&&owner===backend.user()?.id){this.busy=false;this.paint();}
  }
 }
 loadFeed(more=false){
  return this.run(()=>backend.tipFeed(more?this.next:null,this.moderate),page=>{
   this.items=more?[...this.items,...page.items]:page.items;this.next=page.next;this.loaded=true;
  });
 }
 open(id){
  if(!this.allowed()||this.busy||!Number.isSafeInteger(id)||id<1)return;
  this.detailId=id;this.detail=null;this.comments=[];this.commentNext=null;this.draft.comment='';
  return this.run(()=>Promise.all([backend.tipDetail(id,this.moderate),backend.tipComments(id,null,this.moderate)]),([post,comments])=>{
   this.detail=post;this.comments=comments.items;this.commentNext=comments.next;this.syncCounts();
  });
 }
 syncCounts(){
  const item=this.items.find(item=>Number(item.id)===this.detailId);
  if(item&&this.detail)Object.assign(item,{likes:this.detail.likes,comments:this.detail.comments});
 }
 moreComments(){
  return this.run(()=>backend.tipComments(this.detailId,this.commentNext,this.moderate),page=>{
   this.comments.push(...page.items);this.commentNext=page.next;
  });
 }
 publish(title,body){
  if(this.moderate||!this.composing||this.busy)return;
  this.run(()=>backend.publishTip(title.trim(),body.trim()),id=>{
   this.composing=false;this.draft.title='';this.draft.body='';this.loaded=false;
   this.items=[];this.next=null;
   // Open the saved post once the publishing request has released the UI.
   queueMicrotask(()=>this.open(Number(id)));
  });
 }
 comment(body){
  if(this.moderate||!this.detail||!body.trim())return;
  this.run(()=>backend.commentOnTip(this.detailId,body.trim()),comment=>{
   this.draft.comment='';this.comments.unshift(comment);this.detail.comments++;this.syncCounts();
  });
 }
 like(){
  if(this.moderate||!this.detail)return;
  this.run(()=>backend.setTipLike(this.detailId,!this.detail.liked),result=>{
   Object.assign(this.detail,result);this.syncCounts();
  });
 }
 remove(kind,id){
  if(this.busy||!this.detail||!Number.isSafeInteger(id)||id<1)return;
  const postId=this.detailId,revision=this.revision,comment=kind==='comment';
  if(!this.moderate&&!(comment?this.comments.some(item=>Number(item.id)===id&&item.mine):this.detail.mine))return;
  this.ui.modal(copyRaw(comment?'tips.removeCommentTitle':'tips.removeTitle'),`
   <p class="muted">${copyHTML(comment?'tips.removeCommentText':'tips.removeText')}</p>
   <p id="tip-remove-status" role="status"></p>
   <div class="actions"><button type="button" class="btn danger" id="tip-confirm-remove">${copyHTML(comment?'tips.deleteComment':'tips.delete')}</button>
   <button type="button" class="btn" id="tip-cancel-remove">${copyHTML('tips.cancel')}</button></div>`);
  const dialog=document.querySelector('#dialog'),button=dialog.querySelector('#tip-confirm-remove'),status=dialog.querySelector('#tip-remove-status');
  dialog.querySelector('#tip-cancel-remove').onclick=()=>dialog.close();
  button.onclick=async()=>{
   if(button.disabled||revision!==this.revision||this.detailId!==postId||!this.allowed())return;
   button.disabled=true;
   try{
    if(comment)await backend.deleteTipComment(id);else await backend.deleteTip(id);
    if(!this.allowed()||revision!==this.revision||this.detailId!==postId)return;
    if(comment){
     this.comments=this.comments.filter(item=>Number(item.id)!==id);
     this.detail.comments=Math.max(0,this.detail.comments-1);this.syncCounts();
    }else{
     this.items=this.items.filter(item=>Number(item.id)!==id);
     this.detailId=null;this.detail=null;
    }
    if(button.isConnected)dialog.close();
    this.paint();
    if(!comment&&!this.loaded)this.loadFeed();
   }catch(error){status.textContent=error.message;button.disabled=false;}
  };
 }
 click(name,id){
  if(!this.allowed()||this.busy)return;
  if(name==='open')this.open(id);
  if(name==='refresh')this.loadFeed();
  if(name==='more')this.loadFeed(true);
  if(name==='older-comments')this.moreComments();
  if(name==='like')this.like();
  if(name==='delete-tip')this.remove('post',id);
  if(name==='delete-comment')this.remove('comment',id);
  if(name==='back'){
   this.detailId=null;this.detail=null;this.error='';this.paint();
   if(!this.loaded)this.loadFeed();
  }
  if(!this.moderate&&['compose','cancel-compose'].includes(name)){
   this.composing=name==='compose';this.error='';this.paint();
   if(this.composing)this.host.querySelector('#tip-title')?.focus();
  }
 }
 showFeed(){
  const {busy,next,composing,items}=this;
  const composer=composing?`<form class="card tip-form" id="tip-compose">
    <h2>${copyHTML('tips.write')}</h2>
    <p class="muted">${copyHTML('tips.composeHelp')}</p>
    <label for="tip-title">${copyHTML('tips.title')}</label><input id="tip-title" name="title" maxlength="120" required value="${e(this.draft.title)}">
    <label for="tip-body">${copyHTML('tips.body')}</label><textarea id="tip-body" name="body" maxlength="3000" minlength="10" required>${e(this.draft.body)}</textarea>
    <div class="actions"><button type="submit" class="btn primary" ${busy?'disabled':''}>${copyHTML('tips.publish')}</button>
     ${action('cancel-compose','tips.cancel',{disabled:busy})}</div>
   </form>`:'';
  return `<div class="tip-actions">
   ${!this.moderate&&!composing?action('compose','tips.write',{className:'primary',disabled:busy}):''}
   ${action('refresh','tips.refresh',{disabled:busy})}
  </div>${composer}
  ${items.length?`<div class="tip-feed">${items.map(post=>`<article class="card tip-card">
   ${byline(post)}
   <h2><button type="button" class="tip-title-button" data-tip-action="open" data-tip-id="${e(post.id)}" ${busy?'disabled':''}>${e(post.title)}</button></h2>
   <p class="tip-preview">${e(post.preview)}${post.truncated?'…':''}</p>
   <div class="tip-card-footer">
    <span class="muted">${countLabel(post.likes,'tips.oneLike','tips.likes')} · ${countLabel(post.comments,'tips.oneComment','tips.comments')}</span>
    ${action('open','tips.read',{id:post.id,disabled:busy})}
   </div>
  </article>`).join('')}</div>`:`<div class="empty"><h3>${copyHTML(busy?'tips.loading':'tips.empty')}</h3>${!busy&&!this.moderate?`<p>${copyHTML('tips.emptyHint')}</p>`:''}</div>`}
  ${next!==null?`<div class="actions">${action('more','tips.older',{disabled:busy})}</div>`:''}`;
 }
 showDetail(){
  const {detail:post,busy,comments,commentNext}=this;
  const back=`<div class="tip-actions">${action('back','tips.back',{disabled:busy})}</div>`;
  if(!post)return back+(busy?`<div class="empty" role="status">${copyHTML('tips.loading')}</div>`:'');
  return back+`<article class="card tip-card tip-open">
   ${byline(post)}<h2>${e(post.title)}</h2><p class="tip-body">${e(post.body)}</p>
   <div class="actions">
    ${this.moderate?`<span class="muted">${countLabel(post.likes,'tips.oneLike','tips.likes')}</span>`:
     `<button type="button" class="btn ${post.liked?'soft':''}" data-tip-action="like" aria-pressed="${Boolean(post.liked)}" ${busy?'disabled':''}>
      ${copyHTML(post.liked?'tips.liked':'tips.like')} · ${Number(post.likes)||0}</button>`}
    ${this.moderate||post.mine?action('delete-tip','tips.delete',{id:post.id,className:'danger',disabled:busy}):''}
   </div>
  </article>
  <section class="card tip-card tip-comments">
   <h2>${copyHTML('tips.commentsHeading')} <span class="pill">${Number(post.comments)||0}</span></h2>
   ${!this.moderate?`<form class="tip-comment-form" id="tip-comment-form">
    <label for="tip-comment">${copyHTML('tips.addComment')}</label>
    <textarea id="tip-comment" name="comment" maxlength="700" required>${e(this.draft.comment)}</textarea>
    <button type="submit" class="btn primary" ${busy?'disabled':''}>${copyHTML('tips.sendComment')}</button>
   </form>`:''}
   ${comments.length?`<ul class="tip-comment-list">${comments.map(comment=>`<li>${byline(comment)}
    <p class="tip-body">${e(comment.body)}</p>
    ${this.moderate||comment.mine?action('delete-comment','tips.deleteComment',{id:comment.id,className:'danger',disabled:busy}):''}
   </li>`).join('')}</ul>`:`<p class="muted">${copyHTML('tips.noComments')}</p>`}
   ${commentNext!==null?action('older-comments','tips.olderComments',{disabled:busy}):''}
  </section>`;
 }
}

const student=new TipsBoard(false),moderator=new TipsBoard(true);
export function resetTips(){student.reset();moderator.reset();}
export function hideTips(){student.reset();}
export function tipsPage(){
 const settings=backend.tipsSettings();
 return `<div class="heading tips-heading"><div>
  <span class="eyebrow">${copyHTML('tips.eyebrow')}</span>
  <h1>${e(settings.title)}</h1><p>${copyHTML('tips.intro')}</p>
 </div></div><div id="student-tips" class="tips-shell"></div>`;
}
export function bindTips(ui){student.attach(document.querySelector('#student-tips'),ui);}
export function tipsAdminScreen(){
 const settings=backend.tipsSettings();
 return `<div class="tips-shell"><form class="card tip-form" id="tips-settings-form">
  <div class="card-head"><div><h2>${copyHTML('tips.settings')}</h2><p>${copyHTML('tips.settingsHelp')}</p></div>
   <span class="tag">${copyHTML(settings.enabled?'tips.on':'tips.off')}</span></div>
  <label for="tips-name">${copyHTML('tips.sectionName')}</label>
  <input id="tips-name" name="title" type="text" value="${e(settings.title)}" maxlength="55" required>
  <label class="check-line"><input type="checkbox" name="enabled" ${settings.enabled?'checked':''}> ${copyHTML('tips.activate')}</label>
  <div class="actions"><button type="submit" class="btn primary">${copyHTML('tips.save')}</button></div>
  <p class="muted" id="tips-settings-status" role="status"></p>
 </form>
 <div class="section-title"><h2>${copyHTML('tips.moderation')}</h2></div>
 <div id="moderator-tips"></div></div>`;
}
export function bindTipsAdmin(ui){
 if(!backend.adminReady())return;
 const form=document.querySelector('#tips-settings-form');
 if(form)form.onsubmit=async event=>{
  event.preventDefault();
  const data=new FormData(form),status=form.querySelector('#tips-settings-status'),button=form.querySelector('button[type="submit"]');
  if(button.disabled)return;
  button.disabled=true;
  try{
   const saved=await backend.saveTipsSettings(String(data.get('title')||'').trim(),data.has('enabled'));
   if(!backend.adminReady())return;
   if(!saved.enabled)hideTips();
   ui.render();ui.toast(copyRaw('tips.saved'));
  }catch(error){status.textContent=error.code==='PGRST202'?copyRaw('tips.upgrade'):error.message;}
  finally{button.disabled=false;}
 };
 moderator.attach(document.querySelector('#moderator-tips'),ui);
}
