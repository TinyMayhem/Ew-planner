// Verified UTW Train Desk roster from 2026-11-22.
// Member IDs survive nickname changes and do not depend on R4 login accounts.
// Archived members automatically become ineligible without deleting train history.
export const TRAIN_R4_ROSTER=Object.freeze([
 {label:'Savvy',memberId:'c447db67-02f0-48f3-a0bf-e3ba37fddfe2'},
 {label:'Baba',memberId:'9e913464-558a-44b9-ba0b-35dfba2f9c6a'},
 {label:'Catalyst',memberId:'115bf671-a7fc-4c30-a5cd-4042af956b7e'},
 {label:'Devi',memberId:'f98a2b36-49d4-4a5e-b3d0-83ceb5f282ba'},
 {label:'Noosh',memberId:'e4367cfd-9200-4132-8a67-f70066bac06b'},
 {label:'Mo',memberId:'ea01ce15-b96d-41dd-a4d2-3d7e6b3518c0'},
 {label:'Tiny',memberId:'038f0c32-5428-450c-8a39-7f98b7b3652d'},
 {label:'Chibi',memberId:'ac0e6c60-a8e7-44c7-9891-55bec518448d'},
 {label:'Crum',memberId:'2a451fb1-d082-453e-aaea-fe7081a772ea'},
 {label:'Rylis',memberId:'4079b4c0-3e3c-451b-860d-f5314c83eb78'},
 {label:'Sea',memberId:'ebab9318-c776-4874-9a6c-a89fa5b35670'},
]);
export function currentTrainR4Ids(members=[]){
 const byId=new Map(members.map(member=>[member.id,member]));
 const missing=TRAIN_R4_ROSTER.filter(entry=>!byId.has(entry.memberId));
 if(missing.length)throw Error('The saved Train Desk R4 roster needs its member links checked: '+missing.map(x=>x.label).join(', '));
 return new Set(TRAIN_R4_ROSTER.filter(entry=>!byId.get(entry.memberId).archived_at).map(entry=>entry.memberId));
}
