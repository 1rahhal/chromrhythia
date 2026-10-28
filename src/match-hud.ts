import type {Attempt} from './model';
export const accuracyGrade=(accuracy:number)=>accuracy>=99?'S':accuracy>=95?'A':accuracy>=90?'B':accuracy>=80?'C':'D';
export const comboRingProgress=(combo:number)=>combo>0?(combo%100||100):0;
export function matchHudMarkup(){return `<div class="match-stage"><div class="match-title"><strong id="hud-title"></strong><small id="hud-time"></small></div><div class="match-combo"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="35"/><circle id="combo-ring" cx="40" cy="40" r="35" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><b id="hud-combo">0</b></div><div class="match-stat match-accuracy"><small>Accuracy</small><b><span id="hud-accuracy">100.00</span>%</b></div><div class="match-stat match-grade"><small>Grade</small><b id="hud-grade" class="grade-S">S</b></div><div class="match-stat match-misses"><small>Misses</small><b id="hud-misses">0</b></div><div class="match-brackets" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="game-tools"><span id="game-performance" class="game-performance" aria-label="Game frame rate">— FPS</span><button id="pause-button" aria-label="Pause" title="Pause · Esc">Ⅱ</button></div><button id="skip" hidden>Skip break →</button><span id="game-help" class="sr-only"></span>`}
export function updateMatchHud(root:HTMLElement,a:Attempt,t:number){
  const text=(id:string,value:string)=>{const el=root.querySelector<HTMLElement>('#'+id);if(el&&el.textContent!==value)el.textContent=value};
  const time=(ms:number)=>`${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
  text('hud-accuracy',a.accuracy.toFixed(2));text('hud-misses',String(a.misses));text('hud-combo',String(a.combo));text('hud-time',`${time(t)} / ${time(a.chart.length)}`);
  const grade=root.querySelector<HTMLElement>('#hud-grade')!;const value=accuracyGrade(a.accuracy);if(grade.textContent!==value){grade.textContent=value;grade.className='grade-'+value}
  root.querySelector('#combo-ring')!.setAttribute('stroke-dashoffset',String(100-comboRingProgress(a.combo)));
  root.querySelector('.match-combo')!.setAttribute('aria-label',`${a.combo} combo`);
}
