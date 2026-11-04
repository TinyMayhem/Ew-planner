// Tesseract.js v5 traineddata language packs for player names.
// Recognize original scripts. Never translate or romanize member names.
export const hasEastAsianScript=value=>/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}]/u.test(String(value||''));
const korean=/[\p{Script=Hangul}]/u;
const japanese=/[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const han=/[\p{Script=Han}\p{Script=Bopomofo}]/u;
const all=['eng','kor','chi_sim','chi_tra','jpn'];
export const OCR_LANGUAGE_MODES=Object.freeze({
 auto:'Automatic (detect from member roster)',
 all:'English + Korean + Chinese + Japanese',
 eng:'English only (fastest)',
 ko:'English + Korean',
 zh:'English + Chinese (simplified and traditional)',
 ja:'English + Japanese'
});
export function languagesForOcr(mode,roster=[],aliases=[]){
 if(mode==='all')return [...all];
 if(mode==='eng')return ['eng'];
 if(mode==='ko')return ['eng','kor'];
 if(mode==='zh')return ['eng','chi_sim','chi_tra'];
 if(mode==='ja')return ['eng','jpn'];
 if(mode!=='auto')throw Error('Choose an available OCR language mode');
 const names=[
  ...roster.map(x=>typeof x==='string'?x:x?.display_name||''),
  ...aliases.flatMap(x=>[x?.alias||'',x?.alias_key||''])
 ];
 const active=names.join(' ');
 const langs=['eng'];
 if(korean.test(active))langs.push('kor');
 if(han.test(active)){langs.push('chi_sim','chi_tra','jpn')}
 else if(japanese.test(active))langs.push('jpn');
 // Names may use a mixture of CJK and Latin glyphs in one ranking.
 return [...new Set(langs)];
}
export function describeLanguagePacks(langs){
 const names={eng:'English',kor:'Korean',chi_sim:'Chinese (simplified)',chi_tra:'Chinese (traditional)',jpn:'Japanese'};
 return langs.map(x=>names[x]||x).join(', ');
}
