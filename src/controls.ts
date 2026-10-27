export function paintRange(input:HTMLInputElement){const min=Number(input.min)||0,max=Number(input.max)||100;const value=Math.max(0,Math.min(100,(Number(input.value)-min)/Math.max(.001,max-min)*100));input.style.setProperty('--range-fill',value+'%')}
export function paintRanges(root:ParentNode=document){root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange)}
export function installRangeTheme(){document.addEventListener('input',event=>{const input=event.target;if(input instanceof HTMLInputElement&&input.type==='range')paintRange(input)},true)}
