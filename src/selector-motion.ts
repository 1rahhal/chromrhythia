export interface ArtworkAppearance {background:string;tint:string}
type ArtworkLoader=(url:string)=>Promise<ArtworkAppearance>;

// Keep decoded, preblurred menu backgrounds small. No full-screen blur runs per frame.
export class ArtworkCache {
  private entries=new Map<string,Promise<ArtworkAppearance>>();
  constructor(private decode:ArtworkLoader,private limit=16){}
  load(url:string){
    const existing=this.entries.get(url);
    if(existing){this.entries.delete(url);this.entries.set(url,existing);return existing}
    const pending=this.decode(url).catch(error=>{if(this.entries.get(url)===pending)this.entries.delete(url);throw error});
    this.entries.set(url,pending);
    while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);
    return pending;
  }
}
async function decodeArtwork(url:string):Promise<ArtworkAppearance>{
  const image=new Image();image.decoding='async';image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
  const ctx=canvas.getContext('2d')!;
  const scale=224/Math.min(image.naturalWidth,image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.filter='blur(14px)';ctx.drawImage(image,(160-w)/2,(160-h)/2,w,h);ctx.filter='none';
  const background=canvas.toDataURL('image/jpeg',.78);
  canvas.width=canvas.height=8;ctx.drawImage(image,0,0,8,8);
  const pixels=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0,weight=0;
  for(let i=0;i<pixels.length;i+=4){
    const high=Math.max(pixels[i],pixels[i+1],pixels[i+2]),low=Math.min(pixels[i],pixels[i+1],pixels[i+2]);
    const amount=(high-low+12)*(pixels[i+3]/255);
    r+=pixels[i]*amount;g+=pixels[i+1]*amount;b+=pixels[i+2]*amount;weight+=amount;
  }
  return {background,tint:weight?`rgb(${Math.round(r/weight)} ${Math.round(g/weight)} ${Math.round(b/weight)})`:'#282035'};
}
const artworkCache=new ArtworkCache(decodeArtwork);

export class SelectorArtwork {
  private layers:HTMLElement[];
  private active=0;
  private generation=0;
  private visibleURL='';
  private disposed=false;
  constructor(private background:HTMLElement,private load:ArtworkLoader=url=>artworkCache.load(url)){
    this.layers=[0,1].map(()=>{const layer=background.ownerDocument.createElement('div');layer.className='selector-atmosphere';background.append(layer);return layer});
  }
  dispose(){this.disposed=true;this.generation++}
  async select(url:string,stack?:HTMLElement){
    const generation=++this.generation;
    let outgoing:HTMLElement|undefined;
    if(stack&&this.visibleURL&&this.visibleURL!==url){
      outgoing=stack.ownerDocument.createElement('div');outgoing.className='stack-outgoing';
      outgoing.style.cssText='position:absolute;inset:3% 0;width:100%;height:94%;background-size:cover;background-position:center;border-radius:12px;pointer-events:none;transition:opacity .3s ease';
      outgoing.style.backgroundImage=`url("${this.visibleURL}")`;stack.append(outgoing);
    }
    try{
      const appearance=url?await this.load(url):undefined;
      if(this.disposed||generation!==this.generation)return;
      stack?.classList.add('art-ready');if(outgoing){outgoing.classList.add('leaving');outgoing.style.opacity='0'}
      if(url!==this.visibleURL){
        const next=1-this.active,layer=this.layers[next];
        layer.style.backgroundImage=appearance?`radial-gradient(ellipse at 15% 25%,color-mix(in srgb,${appearance.tint} 26%,transparent),transparent 75%),linear-gradient(0deg,#0009,#0008),url("${appearance.background}")`:'';
        layer.classList.toggle('visible',!!appearance);this.layers[this.active].classList.remove('visible');
        this.active=next;this.visibleURL=url;
      }
    }catch{
      if(this.disposed||generation!==this.generation)return;
      stack?.classList.add('art-failed');outgoing?.remove();
      this.layers.forEach(layer=>layer.classList.remove('visible'));this.visibleURL='';
    }
  }
}

const cardSources=new WeakMap<Element,string>();
// Retain card/image nodes across selection and cover updates, including their focus.
export function reconcileCards(root:HTMLElement,items:{id:string;markup:string;selected:boolean}[]){
  const old=new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-map]'),node=>[node.dataset.map!,node]));
  const keep=new Set<HTMLElement>();
  items.forEach((item,index)=>{
    let node=old.get(item.id);
    if(!node||cardSources.get(node)!==item.markup){
      const template=root.ownerDocument.createElement('template');template.innerHTML=item.markup;
      const fresh=template.content.firstElementChild as HTMLElement;
      if(node)node.replaceWith(fresh);node=fresh;cardSources.set(node,item.markup);
    }
    node.classList.toggle('selected',item.selected);node.setAttribute('aria-pressed',String(item.selected));keep.add(node);
    if(root.children[index]!==node)root.insertBefore(node,root.children[index]||null);
  });
  for(const node of Array.from(root.children))if(!keep.has(node as HTMLElement))node.remove();
}
