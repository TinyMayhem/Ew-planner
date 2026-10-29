// Cross-alliance coordination: shared faction planning groups in weeks 0-8.
// Keep alliance-specific R4 readiness, closing reviews, and member data private.
export const workspaces=['utw','von'];
export function taskParts(key,weeks){
 if(typeof key!=='string'||!/^\d+-\d+-\d+$/.test(key))return null;
 const [w,g,i]=key.split('-').map(Number);
 if(!Number.isInteger(w)||!weeks[w]?.groups[g]?.items[i])return null;
 return {week:w,group:g,item:i};
}
export function isFactionTask(key,weeks){
 const task=taskParts(key,weeks);
 return !!task&&task.group===0&&task.week>=0&&task.week<=8;
}
export function scopeForTask(alliance,key,weeks){
 if(!workspaces.includes(alliance)||!taskParts(key,weeks))return null;
 return isFactionTask(key,weeks)?'faction':alliance;
}
