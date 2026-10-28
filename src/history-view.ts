import type {Chart} from './model';
import type {Score} from './storage';
import {icon} from './icons';
import {esc} from './selector-view';
import {accuracyGrade} from './match-hud';
export function historyMarkup(scores:Score[],maps:Chart[]){
  const list=[...scores].sort((a,b)=>b.date.localeCompare(a.date));
  return `<section class="score-history"><header><div><h1>Scores</h1><p>Saved on this device with replays.</p></div><button id="import-replay">${icon('upload')} Import replay</button></header><div class="score-summary"><span><b>${scores.length}</b> Attempts</span><span><b>${scores.reduce((n,s)=>n+s.hits,0).toLocaleString()}</b> Notes hit</span><span><b>${Math.max(0,...scores.map(s=>s.combo)).toLocaleString()}</b> Best combo</span></div><div class="score-list">${list.slice(0,100).map(s=>`<article class="score-row"><b class="history-grade grade-${accuracyGrade(s.accuracy)}">${accuracyGrade(s.accuracy)}</b><div class="history-map"><strong>${esc(maps.find(m=>m.id===s.mapId)?.title||'Map not in library')}</strong><small>${esc(new Date(s.date).toLocaleString())} · ${s.speed.toFixed(2)}×${s.mods.length?' · '+esc(s.mods.join(', ')):''}${s.alive?'':' · Failed'}</small></div><div class="history-accuracy"><b>${s.accuracy.toFixed(2)}%</b><small>${s.misses} misses · ${s.combo} combo</small></div>${s.replayId?`<button class="small" data-watch="${esc(s.replayId)}" aria-label="Watch replay" title="Watch replay">${icon('eye')}</button><button class="small" data-replay-export="${esc(s.replayId)}" aria-label="Download replay" title="Download replay">${icon('download')}</button>`:'<span class="history-no-replay">Replay unavailable</span>'}</article>`).join('')||'<p class="empty">No scores yet.</p>'}</div></section>`;
}
