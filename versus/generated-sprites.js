(function(root){
 'use strict';const DV=root.DV=root.DV||{};
 const generatedTimings={idle:[6,6,6,6,6,6,6,6],run:[3,3,3,3,3,3,3,3],jump:[2,2,3,3,3,3,2,2],fall:[2,2,3,3,3,3,2,2],dash:[2,2,2,2,2,2,2,2],guard:[3,3,3,3,3,3,3,3],punch1:[2,2,3,3,3,3,3,3],punch2:[3,3,3,3,3,3,4,4],kick:[3,4,4,4,4,4,4,3],ki:[3,3,4,3,3,4,4,4],super:[8,8,8,8,8,8,8,16],charge:[6,6,6,6,6,6,6,6],burst:[2,2,3,4,4,5,6,6],assist:[4,4,4,4,4,4,6,6],hit:[2,2,3,3,3,3,2,2],down:[5,5,5,5,6,6,8,8],win:[8,8,8,8,8,8,8,8]};
 function generatedActionName(actions,state){
  if(actions?.[state])return state;
  const exact=String(state||'');
  return ({heavy:'kick',airL:'punch1',airH:'kick',grab:'punch2',counter:'punch2',thrown:'hit',grabbed:'hit'})[exact]||exact;
 }
 const generatedLoops=new Set(['idle','run','guard','charge']);
 function actionSpan(action,duration){return (duration||[]).slice(0,action?.count||duration?.length||0).reduce((sum,n)=>sum+(Number(n)||0),0);}
 function generatedVisualTick(entry,state,frame){
  /* The engine supplies a fixed-step visual clock for looping poses. Keep the
     authored tick intact: sampleGeneratedFrame owns duration holds and wraps
     only at the authored cycle boundary. */
  return Number.isFinite(frame)?Math.max(0,Math.floor(frame)):0;
 }
 const fatherSonFrameDurations=[8,8,8,8,10,10,10,10];
 function sampleFatherSonFrame(frame){
  let tick=Number.isFinite(frame)?Math.max(0,Math.floor(frame)):0,index=0;
  for(;index<fatherSonFrameDurations.length-1;index++){
   if(tick<fatherSonFrameDurations[index])break;
   tick-=fatherSonFrameDurations[index];
  }
  return index;
 }
 function drawFatherSonFighter(ctx,fighter,x,y,scale=1){
  if(fighter?.state!=='super'||fighter.superMove?.teamAnimation!=='father-son-kamehameha')return false;
  const src='assets/versus-expanded/fighters/gohan-teen-ssj2/father-son-kamehameha.png';
  const im=load(src);if(!im.complete||im.naturalWidth!==1536||im.naturalHeight!==1024)return false;
  const index=sampleFatherSonFrame(fighter.frame||0),col=index%4,row=Math.floor(index/4);
  const drawWidth=280,drawHeight=250,anchorX=.5,anchorY=.97;
  ctx.save();ctx.translate(x,y);ctx.scale((fighter.facing===-1?-1:1)*scale,scale);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(im,col*384,row*512,384,512,-drawWidth*anchorX,-drawHeight*anchorY,drawWidth,drawHeight);
  ctx.restore();return true;
 }
 function sampleGeneratedFrame(entry,state,frame){
  if(!entry?.actions)return null;state=generatedActionName(entry.actions,state);const action=entry.actions[state];if(!action)return null;
  const sheet=entry.sheets?.[action.sheet];if(!sheet||!sheet.width||!sheet.height||!sheet.columns||!sheet.rows)return null;
  const duration=action.durations||generatedTimings[state];if(!duration)return null;
  const count=action.count||8;let tick=Number.isFinite(frame)?Math.max(0,Math.floor(frame)):0,index=0;
  if(generatedLoops.has(state)){const span=actionSpan(action,duration);if(span)tick%=span;}
  for(;index<Math.min(count,duration.length)-1;index++){if(tick<duration[index])break;tick-=duration[index];}
  const explicit=action.frames?.[index];
  if(explicit){const [x,y,width,height]=explicit.rect;if(x<0||y<0||width<=0||height<=0||x+width>sheet.width||y+height>sheet.height)return null;return {state,index,sheet,rect:{x,y,width,height},anchor:explicit.anchor||action.anchor||sheet.anchor||[.5,.93],drawSize:explicit.drawSize||action.drawSize||sheet.drawSize||[width,height],clipRuns:explicit.clipRuns};}
  const absolute=(action.startCell??((action.row||0)*sheet.columns))+index;
  if(absolute<0||absolute>=sheet.columns*sheet.rows)return null;
  const col=absolute%sheet.columns,row=Math.floor(absolute/sheet.columns);
  const x=Math.floor(col*sheet.width/sheet.columns),y=Math.floor(row*sheet.height/sheet.rows);
  const right=Math.floor((col+1)*sheet.width/sheet.columns),bottom=Math.floor((row+1)*sheet.height/sheet.rows);
  return {state,index,sheet,rect:{x,y,width:right-x,height:bottom-y},anchor:action.anchor||sheet.anchor||[.5,.93],drawSize:action.drawSize||sheet.drawSize||[186,186]};
 }
 const images=new Map();
 generatedTimings.transform=[4,4,4,4,4,4,6,6];
 function load(src){if(!images.has(src)){const im=new Image();images.set(src,im);im.src=src;}return images.get(src);}
 function fighterArtSheets(specs){
  const sheets=new Map(),seen=new Set(),queue=[...(specs||[])];
  while(queue.length){
   const value=queue.shift(),spec=typeof value==='string'?DV.roster?.find(s=>s.id===value):(value?.spec||value);
   if(!spec?.id||seen.has(spec.id))continue;seen.add(spec.id);
   const entry=DV.generatedSpriteManifest?.fighters?.[spec.id];
   for(const sheet of Object.values(entry?.sheets||{}))if(sheet.src)sheets.set(sheet.src,sheet);
   for(const option of DV.transformationOptions?.(spec)||[])queue.push(option.spec);
   if(spec.id==='gohan-teen-ssj2')sheets.set('assets/versus-expanded/fighters/gohan-teen-ssj2/father-son-kamehameha.png',
    {src:'assets/versus-expanded/fighters/gohan-teen-ssj2/father-son-kamehameha.png',width:1536,height:1024});
  }
  return [...sheets.values()];
 }
 function sheetReady(im,sheet){return !!im?.complete&&im.naturalWidth===sheet.width&&im.naturalHeight===sheet.height;}
 async function preloadFighterArt(specs){
  const sheets=fighterArtSheets(specs);
  const results=await Promise.all(sheets.map(sheet=>{
   let im=load(sheet.src);
   if(sheetReady(im,sheet))return true;
   if(im.complete){images.delete(sheet.src);im=load(sheet.src);}
   return new Promise(resolve=>{
    let timer;const finish=()=>{clearTimeout(timer);im.removeEventListener('load',finish);im.removeEventListener('error',finish);const ok=sheetReady(im,sheet);if(!ok&&images.get(sheet.src)===im)images.delete(sheet.src);resolve(ok);};
    im.addEventListener('load',finish,{once:true});im.addEventListener('error',finish,{once:true});
    timer=setTimeout(finish,12000);if(im.complete)finish();
   });
  }));
  return {ready:results.every(Boolean),failed:sheets.filter((_,i)=>!results[i]).map(s=>s.src)};
 }
 function drawGeneratedFighter(ctx,fighter,x,y,scale=1){
  if(drawFatherSonFighter(ctx,fighter,x,y,scale))return true;
  const spec=fighter.spec||fighter,entry=DV.generatedSpriteManifest?.fighters?.[spec.id];
  if(!entry)return false;
  // Temporary transform art reuses the complete burst sequence; production must replace it explicitly.
  const placeholder=fighter.state==='transform'&&!entry.actions.transform;
  const state=placeholder?'burst':fighter.state||'idle';
  const actionName=generatedActionName(entry.actions,state);
  const loop=generatedLoops.has(actionName);
  const sourceTick=loop&&Number.isFinite(fighter.visualFrame)?fighter.visualFrame:(fighter.frame||0);
  const tick=placeholder?Math.floor((fighter.frame||0)*32/36):generatedVisualTick(entry,state,sourceTick);
  let desc=sampleGeneratedFrame(entry,state,tick),im=desc&&load(desc.sheet.src);
  if(!desc||!sheetReady(im,desc.sheet)){
   // Keep this fighter's authored silhouette while an action is downloading.
   // The battle loading gate normally makes this path selection-preview only.
   const alternate=sampleGeneratedFrame(entry,'idle',0),ready=alternate&&load(alternate.sheet.src);
   if(!alternate||!sheetReady(ready,alternate.sheet))return false;
   desc=alternate;im=ready;
  }
  const r=desc.rect,[w,h]=desc.drawSize,[ax,ay]=desc.anchor;
  ctx.save();ctx.translate(x,y);ctx.scale((fighter.facing===-1?-1:1)*scale,scale);ctx.imageSmoothingEnabled=false;
  // Explicit source rectangle is always wholly inside exactly one validated cell.
  if(desc.clipRuns){ctx.beginPath();for(const [yy,x0,x1] of desc.clipRuns)ctx.rect(-w*ax+x0*w/r.width,-h*ay+yy*h/r.height,(x1-x0)*w/r.width,h/r.height);ctx.clip();}
  ctx.drawImage(im,r.x,r.y,r.width,r.height,-w*ax,-h*ay,w,h);ctx.restore();return true;
 }
 const fallback=DV.drawFighter;
 if(fallback){DV.drawFallbackFighter=fallback;DV.drawFighter=function(ctx,fighter,x,y,scale=1,options={}){if(!drawGeneratedFighter(ctx,fighter,x,y,scale)){const loop=generatedLoops.has(generatedActionName(DV.generatedSpriteManifest?.fighters?.[(fighter.spec||fighter).id]?.actions,fighter.state));let fallbackFighter=fighter.state==='transform'?{...fighter,state:'burst',frame:Math.floor(fighter.frame*32/36)}:loop&&Number.isFinite(fighter.visualFrame)?{...fighter,frame:fighter.visualFrame}:fighter;if(loop&&fallbackFighter!==fighter){const count=DV.animations?.[fighter.state]?.frames;if(Number.isFinite(count)&&count>0)fallbackFighter={...fallbackFighter,frame:fallbackFighter.frame%count};}fallback(ctx,fallbackFighter,x,y,scale,options);}};}
 Object.assign(DV,{generatedTimings,generatedActionName,generatedVisualTick,sampleGeneratedFrame,sampleFatherSonFrame,drawFatherSonFighter,drawGeneratedFighter,fighterArtSheets,preloadFighterArt});
 if(typeof module!=='undefined')module.exports={generatedTimings,generatedActionName,generatedVisualTick,sampleGeneratedFrame,sampleFatherSonFrame,drawFatherSonFighter};
})(globalThis);
