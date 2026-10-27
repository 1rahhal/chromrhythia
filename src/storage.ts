import type {Chart} from './model';
let db:Promise<IDBDatabase>;
function database(){return db??=new Promise((resolve,reject)=>{const r=indexedDB.open('chromrhythia',1);r.onupgradeneeded=()=>{r.result.createObjectStore('maps',{keyPath:'id'});r.result.createObjectStore('scores',{keyPath:'id'});r.result.createObjectStore('replays',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function records<T>(store:string):Promise<T[]>{const d=await database();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function save(store:string,value:unknown){const d=await database();return new Promise<void>((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
export async function remove(store:string,key:string){const d=await database();return new Promise<void>((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
export interface Score{id:string;mapId:string;date:string;score:number;accuracy:number;combo:number;hits:number;misses:number;speed:number;mods:string[];alive:boolean;replayId?:string}
export interface WebReplay{id:string;version:1;mapId:string;speed:number;mods:import('./model').Mod[];settings:import('./model').Settings;frames:number[][];results:number[];startFrom:number}
export type StoredMap=Chart;
