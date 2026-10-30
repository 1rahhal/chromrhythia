// Every selection invalidates previous asynchronous play/preview work.
export const jumpLeadIn=(target:number,speed:number,approachSeconds:number)=>({time:target-approachSeconds*1000*speed,delayMs:1000});
export const songClock=(origin:number,clockOrigin:number,now:number,speed:number)=>origin+Math.max(0,now-clockOrigin)*1000*speed;
export class LatestRequest {
  private generation=0;
  begin(){return ++this.generation}
  cancel(){this.generation++}
  current(request:number){return request===this.generation}
}
export class FrameLimiter {
  private last:number|undefined;
  reset(){this.last=undefined}
  ready(now:number,limit:number){if(!limit){this.last=now;return true}const interval=1000/limit;if(this.last===undefined){this.last=now;return true}const elapsed=now-this.last;if(elapsed<interval-.25)return false;this.last=elapsed<interval?this.last+interval:now-elapsed%interval;return true}
}
