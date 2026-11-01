// Bundled infographics use their GitHub import timestamp (uploadedAt).
// Admin uploads use Supabase Storage's creation timestamp (createdAt).
const uploadTime=file=>{
 const raw=file?.createdAt??file?.uploadedAt;
 const date=raw?Date.parse(raw):NaN;
 return Number.isFinite(date)?date:0;
};

// Stable sorting preserves original library order when dates are identical or missing.
export const sortInfographics=files=>[...files].sort((a,b)=>uploadTime(b)-uploadTime(a));
