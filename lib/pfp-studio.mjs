// PFP Studio beta: only theme settings are retained in code, never member photos or results.
export const THEMES = Object.freeze([
 {id:'squad',title:'Pick Your Squad',subtitle:'Ride, hug or pop out of a Tank, Aircraft or Missile.',needs:'Choose your squad and pose.'},
 {id:'starter',title:'Your Starter Pack',subtitle:'A profile picture filled with your favourite things.',needs:'Tell us a few things you love.'},
 {id:'royalty',title:'UTW Royalty',subtitle:'Your portrait as a queen, king, knight or court jester.',needs:'Choose your royal role.'}
]);
const allowed={squad:['tank','aircraft','missile'],pose:['surprise','riding','clinging','popping'],role:['queen','king','knight','jester'],style:['original','theme','anime','chibi','comic','photorealistic','3d','watercolor'],outfit:['keep','theme']};
export const choice=(field,value,fallback)=>{
 const text=String(value??'').trim().toLowerCase();
 return allowed[field]?.includes(text)?text:fallback;
};
export const cleanFavourites=value=>String(value??'').trim().replace(/[\r\n\t]/g,' ').replace(/\s{2,}/g,' ').slice(0,160);
export const activeTheme=()=>THEMES.some(t=>t.id===process.env.UTW_PFP_THEME)?process.env.UTW_PFP_THEME:'squad';
export function buildPrompt(input){
 const theme=THEMES.find(t=>t.id===input.theme);
 if(!theme)throw Error('Unknown weekly theme.');
 const style=choice('style',input.style,'original');
 const outfit=choice('outfit',input.outfit,'keep');
 const identity='Use the uploaded photo or illustration as the character reference. Preserve their recognizable appearance, visible complexion, hairstyle, facial features, accessories, silhouette and their existing visual art style. Do not assume they should be chibi. Do not turn a realistic person into an anime character unless explicitly selected. ';
 const stylePrompt={
  original:'Closely match the source image visual medium, rendering style, line quality and proportions.',
  theme:'Interpret the character in an imaginative polished storybook illustration, preserving identity.',
  anime:'Convert into detailed anime illustration.',
  chibi:'Convert into cute expressive chibi with a larger head and compact proportions.',
  comic:'Convert into bold colorful comic book art.',
  photorealistic:'Use realistic photographic rendering where appropriate.',
  '3d':'Use high quality stylized 3D rendering.',
  watercolor:'Use soft painterly watercolor art.'
 }[style];
 let scene='';
 if(theme.id==='squad'){
  const squad=choice('squad',input.squad,'tank'),pose=choice('pose',input.pose,'surprise');
  const icon={tank:'the specific simplified pale-cyan Tank symbol with its upper turret and separate lower body containing three circular openings',aircraft:'the specific simplified pale-cyan diagonal Aircraft symbol',missile:'the specific pale-cyan Missile launcher truck symbol with raised angled launcher and open cab window'}[squad];
  const action={surprise:'interacting creatively with',riding:'riding playfully on',clinging:'clinging to',popping:'popping out from behind or above'}[pose];
  scene='The character is '+action+' '+icon+'. The icon should retain the distinctive clean silhouette from Tiny’s supplied prototype, with vivid blue-to-cyan background. Preserve its recognizable geometry and do not replace it with a realistic armored tank, airplane or missile. Draw the uploaded character in their own source image style, unless a different style is expressly selected. The character may sit, hug, cling or peek over the unit symbol, keeping the symbol visible. Avoid invented game logos or text.';
 }else if(theme.id==='starter'){
  const favourites=cleanFavourites(input.favourites);
  if(!favourites)throw Error('Enter at least one favourite thing for this theme.');
  scene='Create a playful personalized starter-pack portrait incorporating these favourite items: '+favourites+'. Keep the person or character as the main focus. Objects should look recognizable and harmonious.';
 }else{
  const role=choice('role',input.role,'queen');
  scene='Create a whimsical fantasy royalty portrait with the character as a '+({queen:'regal queen',king:'regal king',knight:'heroic knight',jester:'mischievous court jester'}[role])+'. Rich forest green and warm gold accents, expressive posture.';
 }
 const clothing=outfit==='keep'?'Keep their current clothes unchanged as much as possible.':'Change the outfit to suit the weekly theme, without changing the character identity.';
 return [identity,stylePrompt,scene,clothing,'1:1 square profile-picture composition, character large and immediately readable at Discord avatar size. No border, no lettering, no watermark. Keep the entire meaningful subject in frame.'].join(' ');
}
export function imageKind(bytes){
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10)return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return '';
}
