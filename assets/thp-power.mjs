// Shared, browser-safe power parser for Members Den and the R4 approval queue.
// A shorthand decimal without an explicit suffix means millions:
// 159.98 => 159,980,000. Whole numbers without suffix remain exact raw power.
export function powerFromInput(value,{zero=false}={}){
 const raw=String(value??'').trim().replaceAll(',','').replace(/\s+/g,'');
 const match=raw.match(/^(\d+(?:\.\d{1,3})?)([kmb])?$/i);
 if(!match)return null;
 const suffix=String(match[2]||'').toLowerCase();
 const factor=suffix?({k:1e3,m:1e6,b:1e9})[suffix]:match[1].includes('.')?1e6:1;
 const power=Number(match[1])*factor,rounded=Math.round(power);
 if(!Number.isSafeInteger(rounded)||Math.abs(rounded-power)>0.001||rounded<0||(!zero&&rounded===0))return null;
 return rounded;
}
export function isImplicitMillions(value){
 const raw=String(value??'').trim().replaceAll(',','').replace(/\s+/g,'');
 return /^\d+\.\d{1,3}$/.test(raw);
}
