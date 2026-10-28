import {sanitizeSettings,type Settings} from './model';
import {readPresets,savePresets,makePublisherKey,type LocalPreset,type Preset} from './presets';

export function saveCurrentPreset(name:string,settings:Settings):LocalPreset {
  name=name.trim().slice(0,60);
  if(!name)throw Error('Enter a preset name.');
  const local=readPresets();
  let preset=local.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(!preset){
    if(local.length>=50)throw Error('This device can save up to 50 presets.');
    preset={id:crypto.randomUUID(),name,settings:sanitizeSettings(settings)};
    local.push(preset);
  }else preset.settings=sanitizeSettings(settings);
  savePresets(local);
  return preset;
}

export async function sharePreset(preset:LocalPreset,author:string,publish:(p:LocalPreset,a:string)=>Promise<Preset>){
  // Retain the identity before sending: a timeout/retry must update the same record.
  preset.publisherKey??=makePublisherKey();
  const persist=()=>{
    const local=readPresets(),index=local.findIndex(p=>p.id===preset.id);
    if(index<0)local.push(preset);else local[index]=preset;
    savePresets(local);
  };
  persist();
  const published=await publish(preset,author);
  preset.publicId=published.id;
  persist();
  return published;
}
