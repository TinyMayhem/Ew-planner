export const rates={'Black Market Cash':1,'Mobilization Coupons':50,'Glittering Coins':10,'Bounty Voucher':1000/120,Diamonds:1,bricks:1,Ammo:500};
export function positive(value,max=1e6){const n=Number(value);return Number.isFinite(n)&&n>0&&n<=max?n:null;}
export function localRate(price,amount){const p=positive(price),a=positive(amount);return p&&a?p/a:null;}
function limitFor(availability,limit,periods,days){if(!limit)return Infinity;return limit*(/Daily/.test(availability)?days:periods);}
export function funding(cost,days){let best=null;for(let daily=0;daily<=days;daily++){const normal=Math.ceil(Math.max(0,cost-daily*800)/1000);if(normal>3*days)continue;const rare=Math.min(days,Math.floor(normal/2)),premium=normal-rare*2;const candidate={bricks:daily*500+normal*1000,cash:daily*800+normal*1000,daily,normal,premium,rare};if(!best||candidate.bricks<best.bricks||(candidate.bricks===best.bricks&&candidate.cash<best.cash))best=candidate;}return best;}
export function calculate(data,item,need,{periods=1,days=1,owned=0}={}){
 const offers=[];
 for(const r of data.items.filter(x=>x.item===item)){
  const wanted=Math.ceil(need/r.qty),max=limitFor(r.availability,r.limit,periods,days),buys=Math.min(wanted,max),qty=buys*r.qty,native=buys*r.price,rate=rates[r.currency];
  const base={...r,kind:'Store',buys,qty,extra:Math.max(0,qty-need),short:Math.max(0,need-qty),native,total:rate?native*rate:null,unit:rate?r.price*rate/r.qty:null,conditions:r.availability,periods};
  if(r.currency==='Black Market Cash'){
   const affordable=Math.min(buys,Math.floor((owned+3800*days)/r.price)),fundedNative=affordable*r.price,fundedQty=affordable*r.qty;
   const f=funding(Math.max(0,fundedNative-owned),days);offers.push({...base,buys:affordable,qty:fundedQty,extra:Math.max(0,fundedQty-need),short:Math.max(0,need-fundedQty),native:fundedNative,kind:'Funded store',total:f.bricks,unit:r.price*500/800/r.qty,leftover:Math.max(0,owned+f.cash-fundedNative),conditions:`${r.availability}. Buy ${f.daily} special 800-cash pack(s) at 500 bricks, ${f.premium} premium 1,000-cash pack(s) and ${f.rare} rare 2,000-cash pack(s). Each pack limited once per day. ${owned} existing cash included.`,funding:f});
  }else offers.push(base);
 }
 const packs=data.packs.filter(x=>x.item===item);
 for(const r of packs){
  if(r.note==='Currency pack'||r.note==='Check diamond price in game'||r.note==='Free reward')continue;
  let packQty=r.qty,price=r.price,cap=null,description=r.availability;
  const tier=r.name.match(/^(.*) \/ Tier (\d+)$/);
  if(tier){const previous=data.packs.filter(x=>{const t=x.name.match(/^(.*) \/ Tier (\d+)$/);return t&&t[1]===tier[1]&&Number(t[2])<=Number(tier[2]);});const unique=[...new Map(previous.map(x=>[x.name,x])).values()];price=unique.every(x=>typeof x.price==='number')?unique.reduce((n,x)=>n+x.price,0):null;packQty=previous.filter(x=>x.item===item).reduce((n,x)=>n+x.qty,0);cap=1;description+='; includes preceding tiers and their matching rewards';}
  const m=r.availability.match(/×(\d+)/);if(cap===null)cap=m?limitFor(r.availability,Number(m[1]),periods,days):periods;
  const requested=Math.ceil(need/packQty),buys=Math.min(requested,cap),qty=buys*packQty;
  const unverified=price===0||price===null;
  offers.push({...r,kind:'Pack',buys,qty,extra:Math.max(0,qty-need),short:Math.max(0,need-qty),currency:'bricks',native:typeof price==='number'?buys*price:null,total:unverified?null:buys*price,unit:price>0?price/packQty:null,unverified,conditions:description+(unverified?'; source price needs in-game verification':'; full pack price, other rewards included'),source:r.source});
 }
 return offers.sort((a,b)=>(a.short>0)-(b.short>0)||(a.total===null)-(b.total===null)||(a.total??Infinity)-(b.total??Infinity));
}
