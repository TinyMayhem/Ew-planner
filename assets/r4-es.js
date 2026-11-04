// English / Spanish interface switch for UTW R4. No external translation
// service, no modifications to saved data, and no translation of player names.
import {translateR4Text} from './r4-es-core.mjs';
import {ES_CHECKLIST} from './r4-es-checklists.mjs';
import {ES_EXTRA,NICKNAME_ES,DYNAMIC_ES} from './r4-es-extra.mjs?rev=nickname-dropdown-v2';
const STORAGE_KEY='utw-r4-interface-language';
const SUPPORTED=['en','es'];
const originals=new WeakMap(),attributeOriginals=new WeakMap();
const SKIP='script, style, textarea, code, pre, [contenteditable="true"], .r4-comment-body, .r4-comment-head, .r4-role-label input, .stat-points, .stat-person b, .stat-line strong, .nickname-person strong, .stat-candidate strong';
function translated(raw){
 const source=String(raw??''),trimmed=source.trim();
 if(!trimmed)return source;
 let result=ES_CHECKLIST[trimmed]||ES_EXTRA[trimmed]||NICKNAME_ES[trimmed];
 if(!result){
  const shared=trimmed.match(/^(.+) · 🤝 UTW \+ VON shared$/);
  if(shared)result=(ES_CHECKLIST[shared[1]]||ES_EXTRA[shared[1]]||translateR4Text(shared[1],'es'))+' · 🤝 Compartido entre UTW y VON';
 }
 if(!result){
  const save=trimmed.match(/^Save (.+)$/);
  if(save)result='Guardar '+(ES_CHECKLIST[save[1]]||ES_EXTRA[save[1]]||translateR4Text(save[1],'es'));
 }
 if(!result){
  for(const [pattern,replacement] of DYNAMIC_ES){
   if(pattern.test(trimmed)){result=trimmed.replace(pattern,replacement);break}
  }
 }
 if(!result||result===trimmed)result=translateR4Text(trimmed,'es');
 return source.replace(trimmed,result);
}
function textUpdate(node,lang){
 if(node.nodeType!==Node.TEXT_NODE||!node.parentElement||node.parentElement.closest(SKIP))return;
 const current=node.nodeValue||'';
 let record=originals.get(node);
 if(!record||current!==record.en&&current!==record.es){
  record={en:current,es:translated(current)};originals.set(node,record);
 }
 const desired=lang==='es'?record.es:record.en;
 if(current!==desired)node.nodeValue=desired;
}
function attrUpdate(element,lang){
 if(element.nodeType!==Node.ELEMENT_NODE||element.matches(SKIP)||element.closest('.r4-comment-body'))return;
 let map=attributeOriginals.get(element);
 if(!map){map={};attributeOriginals.set(element,map)}
 for(const key of ['placeholder','title','aria-label']){
  if(!element.hasAttribute(key))continue;
  const now=element.getAttribute(key)||'';
  if(!map[key]||now!==map[key].en&&now!==map[key].es)map[key]={en:now,es:translated(now)};
  const desired=lang==='es'?map[key].es:map[key].en;
  if(now!==desired)element.setAttribute(key,desired);
 }
}
function apply(node,lang){
 if(node.nodeType===Node.TEXT_NODE){textUpdate(node,lang);return}
 if(node.nodeType!==Node.ELEMENT_NODE)return;
 if(node.matches(SKIP))return;
 attrUpdate(node,lang);
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 let descendant;
 while((descendant=walker.nextNode())){
  if(descendant.nodeType===Node.TEXT_NODE)textUpdate(descendant,lang);
  else attrUpdate(descendant,lang);
 }
}
function savedLanguage(){
 try{const value=localStorage.getItem(STORAGE_KEY);return SUPPORTED.includes(value)?value:'en'}catch{return 'en'}
}
let active=savedLanguage(),scheduled=false,queue=new Set();
function scanMutations(){
 scheduled=false;
 const batch=[...queue];queue.clear();
 for(const target of batch)apply(target,active);
}
const observer=new MutationObserver(mutations=>{
 for(const mutation of mutations){
  if(mutation.type==='characterData')queue.add(mutation.target);
  else if(mutation.type==='attributes')queue.add(mutation.target);
  else for(const node of mutation.addedNodes)queue.add(node);
 }
 if(!scheduled&&queue.size){scheduled=true;queueMicrotask(scanMutations)}
});
function toggleLanguage(lang){
 if(!SUPPORTED.includes(lang))return;
 active=lang;
 try{localStorage.setItem(STORAGE_KEY,lang)}catch{}
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-r4-lang-control]').forEach(select=>{if(select.value!==lang)select.value=lang});
 apply(document.body,lang);
 document.dispatchEvent(new CustomEvent('utw-r4-language',{detail:{language:lang}}));
}
function createSwitcher(){
 const navigation=document.querySelector('header nav')||document.querySelector('header .container')||document.body;
 if(navigation.querySelector('[data-r4-lang-control]'))return;
 const wrapper=document.createElement('label');wrapper.className='r4-language-picker';
 const label=document.createElement('span');label.textContent='Language / Idioma';
 const select=document.createElement('select');select.dataset.r4LangControl='1';select.setAttribute('aria-label','Language');
 select.append(new Option('English','en'),new Option('Español','es'));select.value=active;
 select.addEventListener('change',()=>toggleLanguage(select.value));
 wrapper.append(label,select);navigation.append(wrapper);
}
// Exported for other R4 controls such as Copy Checklist. Only exact fixed
// interface labels are translated; user content is never sent externally.
window.utwR4Translate=word=>active==='es'?translated(word):String(word??'');
function start(){
 if(!document.querySelector('link[data-r4-language-styles]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/r4-es.css';link.dataset.r4LanguageStyles='1';document.head.append(link);
 }
 createSwitcher();
 // Watch the planner's lazy-loaded weekly checklists and role descriptions.
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
 toggleLanguage(active);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
