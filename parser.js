export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]/g,' ').trim();
export function parseSource(source){
 const out={source,scenes:[],characters:[],unknown:[]};let scene=null;
 const ensure=n=>{let s=out.scenes.find(x=>x.number===n);if(!s){s={id:uid(),number:n,name:'Escena '+n,image:'',video:'',imageDone:false,videoDone:false};out.scenes.push(s);}scene=s;return s;};
 const unknown=text=>{if(text.trim())out.unknown.push({id:uid(),text});};
 const add=(kind,text)=>{const s=scene||ensure(1);s[kind]+=(s[kind]?'\n\n':'')+text;};
 const promptKind=k=>{k=norm(k);return /^(prompt (de |para )?(imagen|image)|image( prompt)?|imagen)$/.test(k)?'image':/^(prompt (de |para )?(video)|video( prompt)?)$/.test(k)?'video':null;};
 const value=v=>typeof v==='string'?v:JSON.stringify(v,null,2);
 function jsonWalk(obj,context='root'){
  if(Array.isArray(obj)){obj.forEach((v,i)=>{if(context==='scenes')ensure(i+1);if(context==='characters'){out.characters.push({id:uid(),name:v?.nombre||v?.name||'Personaje '+(i+1),prompt:value(v)});}else jsonWalk(v,context==='scenes'?'scene':context);});return;}
  if(!obj||typeof obj!=='object'){unknown(value(obj));return;}
  for(const [key,v] of Object.entries(obj)){const k=norm(key),kind=promptKind(key);if(kind){add(kind,value(v));continue;}
   if(/^(escenas|scenes)$/.test(k)){jsonWalk(v,'scenes');continue;}
   if(/^(personajes|characters)$/.test(k)){jsonWalk(v,'characters');continue;}
   const sm=k.match(/^(escena|scene)\s*(\d+)/);if(sm){ensure(+sm[2]);jsonWalk(v,'scene');continue;}
   if(/^(personaje|character)\s*\d+/.test(k)){out.characters.push({id:uid(),name:key,prompt:value(v)});continue;}
   if(context==='scene'&&/^(nombre|name|titulo|title)$/.test(k)&&typeof v==='string'){scene.name=v;continue;}
   unknown(JSON.stringify({[key]:v},null,2));
  }
 }
 let raw=source.trim().replace(/^```(?:json)?\s*\n/i,'').replace(/\n```\s*$/,'');
 try{jsonWalk(JSON.parse(raw));return out;}catch{}
 const lines=source.split(/(?<=\n)/);let current=null,buffer='',fence=null,character=null;
 // Keep line endings and bodies verbatim. Only explicit structural headings end a prompt.
 const flush=()=>{
  if(current==='characterIntro'){
   if(character.explicitPrompt)character.metadata+=buffer;else character.prompt+=buffer;
  }else if(current==='characterPrompt')character.prompt+=buffer;
  else if(current==='sceneMetadata')scene.metadata=(scene.metadata||'')+buffer;
  else if(current==='image'||current==='video')add(current,buffer);
  else unknown(buffer);
  buffer='';
 };
 const heading=clean=>clean.match(/^(escena|scene|personaje|character)\s*(?:#\s*|n[º°.]?\s*)?(\d+)\s*(?:[:.\-–—−]\s*(.*))?$/i);
 for(const line of lines){
  const clean=line.trim().replace(/^#{1,6}\s+/,'').replace(/\*\*/g,'').replace(/^\d+[.)]\s+(?=(?:escena|scene|personaje|character)\b)/i,'');
  const marker=clean.match(/^(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence=null;buffer+=line;continue;}
  if(fence){buffer+=line;continue;}
  let h=heading(clean);
  // A speaker cue such as "PERSONAJE 1:" inside video is dialogue, not a new profile.
  if(h&&current==='video'&&/^(personaje|character)$/i.test(h[1])&&!h[3]&&clean.endsWith(':'))h=null;
  const pr=clean.match(/^(prompt\s+(?:(?:de|para)\s+)?(?:imagen|image|video)|image prompt|video prompt)(?:\s*:\s*(.*))?$/i);
  const master=clean.match(/^(?:prompt\s+(?:maestro\s+(?:de\s+)?|de\s+)?personaje|(?:master\s+)?character\s+prompt)(?:\s*:\s*(.*))?$/i);
  const section=/^(?:\d+[.)]\s*)?(?:guion tecnico(?: interactivo)?|guion de escenas|technical script|storyboard)\s*:?$/i.test(norm(clean));
  if(h){
   flush();character=null;
   if(/^(escena|scene)$/i.test(h[1])){
    const s=ensure(+h[2]);s.metadata=s.metadata||'';s.heading=line;s.title='';if(h[3])s.name='Escena '+h[2]+' · '+h[3];current='sceneMetadata';
   }else{
    character={id:uid(),name:'Personaje '+h[2]+(h[3]?' · '+h[3]:''),prompt:'',metadata:'',heading:line,explicitPrompt:false};out.characters.push(character);current='characterIntro';
   }
  }else if(section){flush();current=null;character=null;buffer=line;}
  else if(master&&character){
   // A named master prompt distinguishes its body from preceding character metadata.
   if(current==='characterIntro')character.explicitPrompt=true;
   flush();current='characterPrompt';buffer=master[1]?(master[1]+(line.endsWith('\r\n')?'\r\n':line.endsWith('\n')?'\n':'')):'';
  }else if(pr){flush();current=promptKind(pr[1]);character=null;buffer=pr[2]?(pr[2]+(line.endsWith('\r\n')?'\r\n':line.endsWith('\n')?'\n':'')):'';}
  else{
   if(current==='sceneMetadata'&&!scene.title&&clean&&!clean.includes(':')){scene.title=clean;scene.name+=' · '+clean;}
   buffer+=line;
  }
 }
 flush();return out;
}
