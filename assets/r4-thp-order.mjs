// The THP tracker is ordered by the most recent THP available on or before
// the selected snapshot date. Do not sort by historical THP from the future.
// A recorded zero is a real value and is ranked above a missing measurement.
export function orderThpPeople(members,latest=[]){
 const powers=new Map();
 for(const entry of latest){
  const id=String(entry?.source_member_id||''),thp=Number(entry?.thp);
  if(!id||!Number.isSafeInteger(thp)||thp<0)continue;
  powers.set(id,thp);
 }
 return [...members].sort((a,b)=>{
  const ap=powers.get(String(a.id)),bp=powers.get(String(b.id));
  if(ap===undefined&&bp!==undefined)return 1;
  if(bp===undefined&&ap!==undefined)return -1;
  if(ap!==undefined&&bp!==undefined&&ap!==bp)return bp-ap;
  return String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'});
 });
}
