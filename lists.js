// Derived from current project data; never modifies or duplicates scene state.
export function sceneList(scenes,kind){
 const ordered=scenes.map((scene,index)=>({scene,number:Number.isFinite(Number(scene.number))?Number(scene.number):index+1})).sort((a,b)=>a.number-b.number);
 const entries=ordered.filter(({scene})=>typeof scene[kind]==='string'&&scene[kind].trim());
 const text=entries.map(({scene,number})=>`${number}. ${scene[kind].replace(/\r\n|[\r\n\u2028\u2029]/g,' ')}`).join('\n');
 return {text,count:entries.length,missing:ordered.filter(({scene})=>typeof scene[kind]!=='string'||!scene[kind].trim()).map(x=>x.number)};
}
