// Shared by the game and cloud profiles. Only these settings can be published.
export const DEFAULTS=Object.freeze({approachRate:30,spawnDistance:15,fadeIn:10,fadeOut:75,fov:70,parallax:25,sensitivity:.5,volume:50,musicVolume:50,offset:0,renderScale:1,background:'grid',resolutionMode:'auto',frameLimit:0,touchMode:'relative',cursorShape:'native',cursorFill:false,cursorSize:1,cursorColor:'#ffffff',cursorOpacity:100,cursorTrail:false,trailLength:180,trailOpacity:35,comboRingColor:'#ffffff',colors:['#ff0059','#ffd8e6']});
const ranges={approachRate:[.5,100],spawnDistance:[.5,100],fadeIn:[0,100],fadeOut:[0,100],fov:[30,140],parallax:[0,75],sensitivity:[.05,3],volume:[0,100],musicVolume:[0,100],offset:[-500,500],renderScale:[.5,2],cursorSize:[.4,3],cursorOpacity:[10,100],trailLength:[40,500],trailOpacity:[0,100]};
export function sanitizeSettings(value){
  const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const s={...DEFAULTS,colors:[...DEFAULTS.colors]};
  for(const [key,[a,b]]of Object.entries(ranges)){const v=Number(input[key]??DEFAULTS[key]);s[key]=Number.isFinite(v)?Math.max(a,Math.min(b,v)):DEFAULTS[key]}
  for(const [key,choices]of Object.entries({background:['grid','tunnel','aurora','void'],resolutionMode:['auto','fixed'],touchMode:['direct','relative'],cursorShape:['native','square','circle','diamond']}))if(choices.includes(input[key]))s[key]=input[key];
  for(const key of ['cursorFill','cursorTrail'])if(typeof input[key]==='boolean')s[key]=input[key];
  if(typeof input.cursorColor==='string'&&/^#[\da-f]{6}$/i.test(input.cursorColor))s.cursorColor=input.cursorColor;
  if(typeof input.comboRingColor==='string'&&/^#[\da-f]{6}$/i.test(input.comboRingColor))s.comboRingColor=input.comboRingColor;
  if([0,60,120,144,240].includes(Number(input.frameLimit)))s.frameLimit=Number(input.frameLimit);
  if(Array.isArray(input.colors)){const colors=input.colors.filter(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)).slice(0,128);if(colors.length)s.colors=colors}
  return s;
}
