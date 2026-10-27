export interface Settings {approachRate:number;spawnDistance:number;fadeIn:number;fadeOut:number;fov:number;parallax:number;sensitivity:number;volume:number;musicVolume:number;offset:number;renderScale:number;background:string;resolutionMode:string;frameLimit:number;touchMode:string;cursorShape:string;cursorFill:boolean;cursorSize:number;cursorColor:string;cursorOpacity:number;cursorTrail:boolean;trailLength:number;trailOpacity:number;colors:string[]}
export const DEFAULTS:Readonly<Settings>;
export function sanitizeSettings(value:unknown):Settings;
