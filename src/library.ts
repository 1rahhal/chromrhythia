import type {Chart} from './model';
export const EMPTY_CHART:Chart={id:'',title:'Upload a map',artist:'',mappers:[],difficulty:0,notes:[],length:0};
export const uploadedMaps=(charts:Chart[])=>charts.filter(c=>!c.demo&&!/^demo-[012]$/.test(c.id));
