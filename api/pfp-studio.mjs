import {validSession,hash} from '../lib/buddies.mjs';
import {THEMES,activeTheme,buildPrompt,imageKind} from '../lib/pfp-studio.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const enabled=()=>process.env.UTW_PFP_STUDIO_ENABLED==='true'&&Boolean(process.env.OPENAI_API_KEY&&process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.UTW_SESSION_SECRET&&process.env.UTW_PAGE_PASSWORD);
const authed=request=>Boolean(process.env.UTW_SESSION_SECRET&&process.env.UTW_PAGE_PASSWORD&&(validSession(request.headers.get('cookie'),'page')||validSession(request.headers.get('cookie'),'admin')));
const model=()=>process.env.UTW_PFP_MODEL||'gpt-image-2.5-flare';

export async function GET(){
 return json({ready:enabled(),activeTheme:activeTheme(),themes:THEMES,
  demoPreviewAllowed:process.env.VERCEL_ENV==='preview',
  note:enabled()?'AI generation is available. Images are not saved by this site.':'This is a test preview. AI generation is off until a private API key and usage controls are configured.'});
}
async function quota(request){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
 const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/utw_buddy_rate_limit',{
  method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({p_key:'pfp-studio:'+hash(ip)}),signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error('Usage limit service is temporarily unavailable.');
 const count=await response.json();
 if(!Number.isInteger(count))throw Error('Usage limit service is temporarily unavailable.');
 return count<=2;
}
export async function POST(request){
 if(!enabled())return json({error:'AI generation is not enabled for this beta. You can test the preview without sending your photo to an AI service.'},503);
 if(!authed(request))return json({error:'Unlock the Member Den before generating an image.'},401);
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)return json({error:'Requests must come from Members Den.'},403);
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Image upload required.'},415);
 if(Number(request.headers.get('content-length')||0)>3700000)return json({error:'Your image is too large. Maximum 3 MB.'},413);
 try{
  const form=await request.formData();
  const image=form.get('image');
  if(!(image instanceof File)||image.size<100||image.size>3000000)return json({error:'Please upload an image smaller than 3 MB.'},400);
  if(!['image/jpeg','image/png','image/webp'].includes(image.type))return json({error:'Use JPG, PNG or WebP.'},415);
  const bytes=new Uint8Array(await image.arrayBuffer());
  if(imageKind(bytes)!==image.type)return json({error:'Image format does not match its file type.'},415);
  const theme=String(form.get('theme')||'');
  if(theme!==activeTheme())return json({error:'This theme is not active this week. Refresh Members Den.'},409);
  const prompt=buildPrompt({
   theme,squad:form.get('squad'),pose:form.get('pose'),role:form.get('role'),
   style:form.get('style'),outfit:form.get('outfit'),favourites:form.get('favourites')
  });
  if(!await quota(request))return json({error:'Generation limit reached. Please try later.'},429);
  const input=new FormData();
  input.append('model',model());
  input.append('image',new Blob([bytes],{type:image.type}),'character.'+image.type.split('/')[1]);
  input.append('prompt',prompt);
  input.append('size','1024x1024');
  input.append('quality','medium');
  input.append('output_format','webp');
  const result=await fetch('https://api.openai.com/v1/images/edits',{
   method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},
   body:input,signal:AbortSignal.timeout(115000)
  });
  if(!result.ok){
   // Never log prompts, uploaded photo bytes, or response bodies.
   if(result.status===429)return json({error:'The image service is busy. Please try again later.'},429);
   if(result.status===400)return json({error:'The image provider could not process this request. Please try another image.'},422);
   return json({error:'The image service could not complete your request.'},502);
  }
  const output=await result.json();
  const base64=output?.data?.[0]?.b64_json;
  if(typeof base64!=='string'||!base64.length)return json({error:'No image was returned by the provider.'},502);
  return json({ok:true,image:base64,mime:'image/webp'});
 }catch(error){
  if(error?.message==='Enter at least one favourite thing for this theme.')return json({error:error.message},400);
  if(error?.name==='TimeoutError')return json({error:'Generation timed out. Please try again later.'},504);
  return json({error:'Could not process the upload. Please retry with a smaller image.'},503);
 }
}
