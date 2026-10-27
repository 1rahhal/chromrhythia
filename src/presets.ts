import {sanitizeSettings,type Settings} from './model';
export interface Preset {id:string;name:string;author:string;settings:Settings;createdAt:string;updatedAt:string}
export interface LocalPreset {id:string;name:string;settings:Settings;publicId?:string;publisherKey?:string}
const storage='chromrhythia-presets-v1';
export function readPresets():LocalPreset[]{try{const values=JSON.parse(localStorage.getItem(storage)||'[]');return Array.isArray(values)?values.slice(0,50).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({...p,settings:sanitizeSettings(p.settings)})):[]}catch{return []}}
export function savePresets(presets:LocalPreset[]){localStorage.setItem(storage,JSON.stringify(presets))}
export function makePublisherKey(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('')}
