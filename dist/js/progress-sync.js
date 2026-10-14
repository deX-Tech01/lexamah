import {store} from './store.js';
import {backend} from './backend.js';
let timer=null,readyOwner=null,chain=Promise.resolve(),revision=0;
export function pauseSync(){clearTimeout(timer);readyOwner=null;revision++;}
export async function syncAccount(ui){pauseSync();const id=backend.user()?.id;if(!id||store.owner()!==id)return;const stamp=revision;
 try{const cloud=await backend.getProgress();if(stamp!==revision||backend.user()?.id!==id||store.owner()!==id)return;
 if(cloud&&!store.dirty()){store.applyCloud(cloud);ui.render();}
 // Dirty local changes stay authoritative on this device; otherwise load the account's cloud snapshot.
 readyOwner=id;if(store.dirty()||!cloud)await flushProgress();
 }catch(err){if(stamp===revision){readyOwner=id;ui.toast('Your progress is saved for this account on this device. Cloud sync is unavailable.');}}
}
export function flushProgress(){clearTimeout(timer);const id=store.owner();if(!id||readyOwner!==id||backend.user()?.id!==id)return Promise.resolve();const data=store.personal(),stamp=revision;
 chain=chain.catch(()=>{}).then(async()=>{if(stamp!==revision||backend.user()?.id!==id)return;await backend.saveProgress(id,data);if(stamp===revision&&JSON.stringify(store.personal())===JSON.stringify(data))store.clean(id);});return chain;
}
store.subscribe((_,id)=>{if(id&&id===readyOwner){clearTimeout(timer);timer=setTimeout(()=>flushProgress().catch(()=>{}),700);}});
