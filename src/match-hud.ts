import {DEFAULTS,clamp,type Attempt,type Settings} from './model';
export const accuracyGrade=(accuracy:number)=>accuracy>=99?'S':accuracy>=95?'A':accuracy>=90?'B':accuracy>=80?'C':'D';
export const comboRingProgress=(progress:number,increment:number)=>clamp(progress/Math.max(1,increment),0,1)*100;
export const comboRingSides=(increment:number)=>clamp(increment,3,32);
export function comboRingPoints(sides:number){return Array.from({length:sides},(_,i)=>{const angle=i/sides*Math.PI*2-Math.PI/2;return `${40+Math.cos(angle)*35},${40+Math.sin(angle)*35}`}).join(' ')}
export function matchHudMarkup(prefix=""){return `<div class="match-stage"><div class="match-title"><strong id="hud-title"></strong><small id="hud-time"></small></div><div class="match-progress"><i id="hud-progress"></i></div><div class="match-health"><i id="hud-health"></i></div><div class="match-combo"><svg viewBox="0 0 80 80" aria-hidden="true"><polygon id="combo-ring-track"/><polygon id="combo-ring" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><b id="hud-multiplier">1×</b><small><span id="hud-combo">0</span> combo</small></div><div class="match-stat match-accuracy"><small>Accuracy</small><b><span id="hud-accuracy">100.00</span>%</b></div><div class="match-stat match-grade"><small>Grade</small><b id="hud-grade" class="grade-S">S</b></div><div class="match-stat match-misses"><small>Misses</small><b id="hud-misses">0</b></div><div class="match-brackets" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="game-tools"><span id="game-performance" class="game-performance" aria-label="Game frame rate">— FPS</span><button id="pause-button" aria-label="Pause" title="Pause · Esc">Ⅱ</button></div><button id="skip" hidden>Skip break →</button><span id="game-help" class="sr-only"></span>`.replace(/id="/g,`id="${prefix}`)}
const hudCache=new WeakMap<HTMLElement,{nodes:Record<string,HTMLElement>;combo:number;multiplier:number;sides:number;progress:number;color:string}>();
const hudTime=(ms:number)=>`${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
function hudText(element:HTMLElement,value:string){if(element.textContent!==value)element.textContent=value}
export function updateMatchHud(root:HTMLElement,a:Attempt,t:number,settings:Pick<Settings,'comboRingColor'>=DEFAULTS,prefix=''){
  let cache=hudCache.get(root);
  if(!cache){const nodes:Record<string,HTMLElement>={};for(const id of ['hud-accuracy','hud-misses','hud-combo','hud-time','hud-grade','hud-multiplier','combo-ring','combo-ring-track'])nodes[id]=root.querySelector<HTMLElement>('#'+prefix+id)!;nodes.combo=root.querySelector<HTMLElement>('.match-combo')!;cache={nodes,combo:-1,multiplier:-1,sides:-1,progress:-1,color:''};hudCache.set(root,cache)}
  const n=cache.nodes;
  hudText(n['hud-accuracy'],a.accuracy.toFixed(2));hudText(n['hud-misses'],String(a.misses));hudText(n['hud-combo'],String(a.combo));hudText(n['hud-time'],`${hudTime(t)} / ${hudTime(a.chart.length)}`);
  const grade=n['hud-grade'],value=accuracyGrade(a.accuracy);if(grade.textContent!==value){grade.textContent=value;grade.className='grade-'+value}
  hudText(n['hud-multiplier'],a.multiplier+'×');
  const sides=comboRingSides(a.increment),progress=comboRingProgress(a.multiplierProgress,a.increment);
  if(cache.sides!==sides){const points=comboRingPoints(sides);n['combo-ring'].setAttribute('points',points);n['combo-ring-track'].setAttribute('points',points);cache.sides=sides}
  if(cache.progress!==progress){n['combo-ring'].setAttribute('stroke-dashoffset',String(100-progress));cache.progress=progress}
  if(cache.color!==settings.comboRingColor){n['combo-ring'].setAttribute('stroke',settings.comboRingColor);n['combo-ring-track'].setAttribute('stroke',settings.comboRingColor);cache.color=settings.comboRingColor}
  if(cache.combo!==a.combo||cache.multiplier!==a.multiplier){n.combo.setAttribute('aria-label',`${a.combo} combo, ${a.multiplier} times multiplier`);cache.combo=a.combo;cache.multiplier=a.multiplier}
}
