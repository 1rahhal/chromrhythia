import {sanitizeSettings,type Settings} from './model';
import {readPresets,savePresets,type Preset} from './presets';
import {communityPresets,publishPreset} from './shared';
import {saveCurrentPreset,sharePreset} from './preset-actions';
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let community:Preset[]=[],next:string|null=null,loaded=false,requestGeneration=0;
export function mountPresets(holder:HTMLElement,getSettings:()=>Settings,apply:(s:Settings)=>void,toast:(text:string)=>void){
  let local=readPresets(),busy=false,error='',status='',draft='',author='';try{author=localStorage.getItem('chromrhythia-preset-author')||''}catch{}
  const report=(e:unknown)=>{status='';error=e instanceof Error?e.message:String(e);toast(error)};
  const summary=(s:Settings)=>`AR ${s.approachRate} · FOV ${s.fov}° · ${s.parallax}% parallax · ${s.cursorFill?'filled ':''}${s.cursorShape} cursor${s.cursorTrail?' + trail':''}`;
  const snapshot=()=>sanitizeSettings(getSettings());
  function render(){if(!holder.isConnected)return;
    holder.innerHTML=`<div class="preset-heading"><h3>Presets</h3><button id="presets-refresh" class="small" ${busy?'disabled':''}>Refresh</button></div><div class="preset-save"><input id="preset-name" type="text" maxlength="60" placeholder="Preset name" aria-label="Preset name" value="${escape(draft)}"><button id="preset-save" ${busy?'disabled':''}>Save locally</button><button id="preset-global" ${busy?'disabled':''}>Save global</button></div><label class="preset-author">Name <input id="preset-author" type="text" maxlength="40" placeholder="Anonymous" value="${escape(author)}"></label><p id="preset-status" class="preset-status ${error?'error':''}" role="status">${escape(error||status)}</p><div class="preset-columns"><section><h4>My presets</h4><div class="preset-list">${local.length?local.map(p=>`<article class="preset-card"><strong>${escape(p.name)}</strong><small>${escape(summary(p.settings))}</small><div class="preset-actions"><button class="small" data-local-apply="${escape(p.id)}">Apply</button><button class="small" data-local-update="${escape(p.id)}" ${busy?'disabled':''}>Save current locally</button><button class="small" data-publish="${escape(p.id)}" ${busy?'disabled':''}>${p.publicId?'Save current globally':'Share saved copy'}</button></div>${p.publicId?'<span class="preset-shared">Global</span>':''}</article>`).join(''):'<p class="empty"></p>'}</div></section><section><h4>Global presets</h4><div class="preset-list">${community.length?community.map(p=>`<article class="preset-card"><strong>${escape(p.name)}</strong><small>by ${escape(p.author||'Anonymous')} · ${escape(summary(p.settings))}</small><div class="preset-actions"><button class="small" data-community-apply="${escape(p.id)}">Apply</button><button class="small" data-community-copy="${escape(p.id)}">Save a copy</button></div></article>`).join(''):`<p class="empty">${busy?'Loading shared presets…':loaded?'No shared presets yet. Share yours to get started.':'Shared presets load when you open Settings.'}</p>`}</div>${next?`<button class="small" id="presets-more" ${busy?'disabled':''}>Load more</button>`:''}</section></div>`;
    holder.querySelector<HTMLInputElement>('#preset-name')!.oninput=e=>draft=(e.target as HTMLInputElement).value;
    holder.querySelector<HTMLInputElement>('#preset-author')!.oninput=e=>{author=(e.target as HTMLInputElement).value;try{localStorage.setItem('chromrhythia-preset-author',author)}catch{}};
    holder.querySelector<HTMLButtonElement>('#preset-save')!.onclick=()=>{try{saveCurrentPreset(draft,getSettings());local=readPresets();error='';status='Saved on this device.';render()}catch(e){report(e);render()}};
    holder.querySelector<HTMLButtonElement>('#preset-global')!.onclick=()=>void publish();
    holder.querySelector<HTMLButtonElement>('#presets-refresh')!.onclick=()=>void load(false);
    holder.querySelector<HTMLButtonElement>('#presets-more')?.addEventListener('click',()=>void load(true));
    holder.querySelectorAll<HTMLButtonElement>('[data-local-apply]').forEach(b=>b.onclick=()=>{const p=local.find(p=>p.id===b.dataset.localApply);if(p)apply(sanitizeSettings(p.settings))});
    holder.querySelectorAll<HTMLButtonElement>('[data-local-update]').forEach(b=>b.onclick=()=>{const p=local.find(p=>p.id===b.dataset.localUpdate);if(!p)return;try{p.settings=snapshot();savePresets(local);status='Saved on this device.';error='';render()}catch(e){report(e)}});
    holder.querySelectorAll<HTMLButtonElement>('[data-publish]').forEach(b=>b.onclick=()=>void publish(b.dataset.publish!));
    holder.querySelectorAll<HTMLButtonElement>('[data-community-apply]').forEach(b=>b.onclick=()=>{const p=community.find(p=>p.id===b.dataset.communityApply);if(p)apply(sanitizeSettings(p.settings))});
    holder.querySelectorAll<HTMLButtonElement>('[data-community-copy]').forEach(b=>b.onclick=()=>{const p=community.find(p=>p.id===b.dataset.communityCopy);if(!p)return;try{if(local.length>=50)throw Error('This device can save up to 50 presets.');local.push({id:crypto.randomUUID(),name:p.name,settings:sanitizeSettings(p.settings)});savePresets(local);render();toast('Saved an independent copy on this device.')}catch(e){report(e)}});
  }
  async function load(more:boolean){if(busy)return;busy=true;error='';const generation=++requestGeneration;render();try{const data=await communityPresets(more?next||undefined:undefined);if(generation!==requestGeneration)return;const incoming=data.presets.map(p=>({...p,settings:sanitizeSettings(p.settings)}));community=(more?[...community,...incoming]:incoming).filter((p,i,a)=>a.findIndex(v=>v.id===p.id)===i).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));next=data.cursor;loaded=true}catch(e){report(e)}finally{busy=false;render()}}
  async function publish(id?:string){if(busy)return;error='';status='';try{
    const saved=id?local.find(p=>p.id===id):undefined;
    const p=saved&&!saved.publicId?saved:saveCurrentPreset(saved?.name||draft,getSettings());
    busy=true;requestGeneration++;status='Saving globally…';render();
    const published=await sharePreset(p,author,publishPreset);
    community=[published,...community.filter(v=>v.id!==published.id)];loaded=true;
    status='Saved globally. Everyone can apply this preset.';toast(status);
  }catch(e){report(e)}finally{local=readPresets();busy=false;render()}}
  render();void load(false);
}
