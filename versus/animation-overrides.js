(function(root){
 'use strict';
 /* These eight source sheets were inspected cell by cell. Their generated
    atlases do not all follow the generic row contract, so only verified cells
    are corrected here and the generated manifest stays reproducible. */
 const DV=root.DV=root.DV||{},manifest=DV.generatedSpriteManifest;
 if(!manifest?.fighters)return;
 const originalActions=Object.fromEntries(Object.entries(manifest.fighters).map(([id,entry])=>[id,{...entry.actions}]));
 function reviewedStrip(id,name){
  const authored=originalActions[id]?.[name];
  return authored&&authored.sheet!=='core'&&authored.sheet!=='power'&&
   manifest.fighters[id].sheets[authored.sheet]&&['integrated-review','approved'].includes(authored.status);
 }
 const layouts={
  'gohan-kid':{bottom:170,bottomOverrides:{4:169,6:166,9:169,10:167},actions:{idle:[0,1,2,3,2,1],run:[4,5,6,5],guard:[26],jump:[48],fall:[51],dash:[4,5,6],hit:[32,33,34],down:[35,36,37,38,39],punch1:[10,11,12,11,10],punch2:[9,10,11,12,11,10,9],kick:[19,20,16,17,18,17,16,20],heavy:[19,20,16,18,17,16,20,19],airL:[53],airH:[52]}},
  'gohan-teen-ssj':{bottom:170,actions:{idle:[0,1,2,3,2,1],run:[4,5,6,5],guard:[26],jump:[48],fall:[51],dash:[4,5,6],hit:[32,33,34],down:[35,36,37,38,39],punch1:[10,11,12,11,10],punch2:[9,10,11,12,11,10,9],kick:[19,20,16,17,18,17,16,20],heavy:[19,20,16,18,17,16,20,19],airL:[53],airH:[52]}},
  'gohan-teen-ssj2':{bottom:168,bottomOverrides:{3:169,5:169,7:166,9:150,10:150,11:154,12:154,13:159,14:158,16:160,17:156,18:159,19:156,20:162,22:159,23:160,29:161,30:161,31:161,44:109,45:126,46:117},actions:{idle:[0,1,2,3,4,5],run:[6,7,6,7],guard:[1],jump:[30],fall:[31],dash:[6,7],hit:[44,45],down:[46],punch1:[10,11,12,11,10],punch2:[9,10,11,12,11,10,9],kick:[19,20,16,17,18,17,16,20],heavy:[19,20,16,18,17,16,20,19],airL:[29],airH:[22,23]}},
  'piccolo-z':{bottom:167,actions:{idle:[5,6,7,6],run:[10,11,12,13,14,15,14,13,12,11],guard:[7],jump:[43,44],fall:[39],dash:[12,13,14,15],hit:[48,49,50],down:[51,52],punch1:[20,21,22,23,22,21,20],punch2:[20,21,22,23,23,22,21,20],kick:[20,28,30,32,33,30,28,20],heavy:[20,28,30,32,33,30,28,20],airL:[23],airH:[33]}},
  'piccolo-fused':{bottom:167,bottomOverrides:{33:163},actions:{idle:[5,6,7,6],run:[10,11,12,13,14,15,14,13,12,11],guard:[7],jump:[19,20,21],fall:[37],dash:[12,13,14,15],hit:[40,41],down:[43,44,45,46],punch1:[24,25,26,27,26,25,24],punch2:[24,25,26,27,27,26,25,24],kick:[34,35,32,33,32,35,34,24],heavy:[34,35,32,33,32,35,34,24],airL:[27],airH:[33]}},
  'piccolo-orange':{bottom:167,actions:{idle:[5,6,7,6],run:[10,11,12,13,14,15,14,13,12,11],guard:[7],jump:[19,20,21],fall:[37],dash:[12,13,14,15],hit:[40,41],down:[43,44,45,46],punch1:[24,25,26,27,26,25,24],punch2:[24,25,26,27,27,26,25,24],kick:[34,35,32,33,32,35,34,24],heavy:[34,35,32,33,32,35,34,24],airL:[27],airH:[33]}},
  'frieza-final':{bottoms:[162,163,164,163],actions:{run:[11,12,14,12]}},
  'gogeta-base':{bottoms:[139,138,138,131],actions:{run:[12,13,14,15]}}
 };
 const timing={idle:[8,8,8,8,8,8],run:[4,4,4,4,4,4,4,4,4,4],guard:[6,6,6,6],jump:[3,3,3,3],fall:[3,3,3,3],dash:[3,3,3,3],hit:[3,3,4],down:[5,6,8,8,8],punch1:[4,4,5,4,5,3,2],punch2:[3,3,4,5,4,3,4,2],kick:[3,3,4,3,6,4,4,3],heavy:[4,4,3,3,8,4,4,4],airL:[3,3,5,4,5,3,2],airH:[3,3,2,5,5,4,3,3]};
 function frameCell(entry,number,bottom,sheetName='core'){
  const sheet=entry.sheets[sheetName],col=number%sheet.columns,row=Math.floor(number/sheet.columns);
  const x=Math.floor(col*sheet.width/sheet.columns),y=Math.floor(row*sheet.height/sheet.rows),right=Math.floor((col+1)*sheet.width/sheet.columns),lower=Math.floor((row+1)*sheet.height/sheet.rows);
  const frame={cell:number,rect:[x,y,right-x,lower-y],drawSize:[...(sheet.drawSize||[right-x,lower-y])],anchor:[...(sheet.anchor||[.5,.93])]};
  if(Number.isFinite(bottom))frame.anchor=[.5,(bottom+1)/(lower-y)];
  return frame;
 }
 function action(entry,name,cells,bottoms,sheetName='core',baseDurations=null){
  const base=baseDurations||timing[name]||[4],durations=cells.map((_,i)=>base[i]??base[base.length-1]);
  return {sheet:sheetName,count:cells.length,durations,frames:cells.map((cell,index)=>frameCell(entry,cell,bottoms?.[index],sheetName)),status:'source-verified'};
 }
 for(const [id,layout] of Object.entries(layouts)){
  const entry=manifest.fighters[id];if(!entry?.sheets?.core)continue;
  for(const [name,cells] of Object.entries(layout.actions)){
   if(reviewedStrip(id,name))continue;
   const bottoms=layout.bottoms||cells.map(cell=>layout.bottomOverrides?.[cell]??layout.bottom);
   entry.actions[name]=action(entry,name,cells,bottoms);
  }
 }
 /* These power sheets use a different row order from the generic 8-action
    template. Each sequence below names inspected source cells, including the
    held victory and KO poses. Keep the original action durations. */
 const semanticLayouts={
  'goku-kid':{win:['power',[56,57,58,57,58,57,58,57]]},
  'goku-gt-kid':{win:['power',[56,57,58,57,58,57,58,57]]},
  'goku-daima-mini':{win:['power',[56,57,58,59,58,59,59,59]]},
  'vegeta-daima-mini':{
   ki:['power',[16,17,18,19,20,20,20,20]],
   win:['power',[32,33,34,35,36,37,37,37]]
  },
  'gohan-kid':{
   charge:['power',[24,24,24,24,24,24,24,24]],
   ki:['power',[8,9,10,11,12,12,12,12]],
   super:['power',[8,9,10,11,12,12,12,12]],
   burst:['power',[48,49,50,51,50,51,52,53]],
   assist:['power',[44,45,46,47,44,45,46,47]],
   down:['power',[32,33,34,35,36,37,38,38]],
   win:['power',[48,49,50,51,50,51,51,51]]
  },
  'gohan-teen-ssj':{
   charge:['power',[61,61,61,61,61,61,61,61]],
   ki:['power',[8,9,10,11,12,12,12,12]],
   super:['power',[8,9,10,11,12,12,12,12]],
   burst:['power',[56,58,59,61,61,61,61,61]],
   assist:['power',[8,9,10,11,12,12,12,12]],
   down:['power',[32,33,34,35,36,37,38,39]]
  },
  'gohan-teen-ssj2':{
   ki:['power',[36,37,38,39,37,38,39,39]],
   super:['power',[32,33,34,35,36,37,38,39]],
   burst:['power',[3,4,5,6,5,6,6,6]],
   assist:['power',[36,37,38,39,37,38,39,39]],
   win:['core',[48,49,50,51,52,53,54,54]]
  },
  'gohan-adult-ssj':{
   ki:['power',[12,13,14,15,14,14,15,15]],
   super:['power',[4,5,6,7,12,13,14,15]],
   burst:['power',[4,5,6,7,5,6,6,6]],
   assist:['power',[12,13,14,15,14,14,15,15]],
   win:['power',[0,1,2,3,4,5,5,5]]
  },
  'gohan-ultimate':{
   ki:['power',[24,25,26,27,28,29,30,31]],
   super:['power',[24,25,26,27,28,29,30,31]],
   burst:['power',[0,1,2,3,2,3,3,3]],
   assist:['power',[24,25,26,27,28,29,30,31]],
   down:['power',[32,33,34,35,35,35,35,35]],
   win:['power',[0,1,2,3,3,3,3,3]]
  },
  'gohan-future':{
   ki:['power',[24,25,26,27,28,29,30,31]],
   super:['power',[24,25,26,27,28,29,30,31]],
   burst:['power',[3,4,5,6,5,6,6,6]],
   assist:['power',[24,25,26,27,28,29,30,31]],
   down:['power',[32,33,34,35,35,35,35,35]],
   win:['power',[0,1,2,3,4,5,6,6]]
  },
  'gohan-beast':{
   ki:['power',[16,17,18,19,20,20,21,22]],
   super:['power',[16,17,18,19,20,21,22,23]],
   burst:['power',[0,1,2,3,4,3,4,4]],
   assist:['power',[16,17,18,19,20,21,22,23]],
   win:['power',[0,1,2,3,4,4,4,4]]
  },
  'piccolo-z':{
   charge:['power',[5,6,7,6,7,6,7,7]],
   ki:['power',[24,25,26,27,26,27,26,27]],
   super:['power',[32,33,25,26,24,25,26,27]],
   burst:['power',[34,35,36,38,38,38,38,38]],
   assist:['power',[24,25,26,27,26,27,26,27]],
   win:['power',[56,57,58,59,60,61,62,62]]
  },
  'vegito-blue':{
   ki:['power',[16,17,18,18,18,18,18,18]],
   super:['power',[32,33,34,34,34,34,34,34]]
  },
  'gogeta-super':{
   ki:['power',[3,5,3,5,3,5,5,5]],
   super:['power',[24,25,26,27,27,27,27,27]],
   assist:['power',[24,25,26,27,27,27,27,27]],
   win:['power',[48,49,50,51,51,51,51,51]]
  },
  'gogeta-base':{
   ki:['power',[16,17,18,19,20,20,20,20]],
   super:['power',[32,33,34,34,34,34,34,34]]
  },
  'gogeta-blue':{
   ki:['power',[16,17,18,19,20,20,20,20]],
   super:['power',[16,17,18,19,20,20,20,20]],
   win:['power',[48,49,50,51,52,53,54,55]]
  },
  'gogeta-ssj4':{
   ki:['power',[16,17,18,18,18,18,18,18]],
   super:['power',[16,17,18,18,18,18,18,18]],
   win:['power',[48,49,50,51,52,53,54,55]]
  },
  'baby-super2':{
   down:['power',[56,57,57,57,57,57,57,57]],
   win:['power',[48,49,50,51,52,53,54,55]]
  },
  /* Reviewed 2026-10-07: the power hold is a crouch. The final three core
     cells hold a complete lying pose; its low source bottom needs a floor anchor. */
  'broly-z':{
   down:['core',[32,34,35,40,42,51,51,51],[null,null,null,null,null,91.56,91.56,91.56]]
  },
  'zamasu-fused':{
   down:['power',[56,57,58,58,58,58,58,58]],
   win:['power',[48,49,50,50,50,50,50,50]]
  },
  'super17-gt':{
   ki:['power',[16,17,18,19,20,20,20,20]],
   super:['power',[32,33,34,35,36,37,38,38]],
   burst:['power',[36,37,38,38,38,38,38,38]],
   down:['power',[40,41,42,43,44,44,44,44]],
   win:['power',[0,1,2,3,4,5,6,7]]
  },
  'yajirobe-db':{
   down:['power',[40,41,42,37,38,38,38,38]]
  }
 };
 /* Energy effects occupy different strips on these sheets. The generic
    ki/super rows would otherwise show a run, sword swing, or kick. */
 const energyLayouts={
  'frieza-first':{ki:['power',[8,9,10,11,11,11,11,11]]},
  'frieza-final':{
   ki:['power',[24,25,26,27,27,27,27,27]],
   super:['power',[24,25,26,27,27,27,27,27]],
   assist:['power',[24,25,26,27,27,27,27,27]]
  },
  'frieza-full':{
   ki:['power',[2,3,4,4,4,4,4,4]],
   super:['power',[0,1,2,3,4,4,4,4]],
   assist:['power',[0,1,2,3,4,4,4,4]]
  },
  'frieza-golden':{super:['power',[8,9,10,11,12,13,15,15]]},
  'cell-first':{super:['power',[16,17,18,19,19,19,19,19]]},
  'cell-super-perfect':{super:['power',[8,9,10,11,12,13,13,13]]},
  'buu-fat':{super:['power',[8,9,10,11,12,12,12,12]]},
  'buu-gohan':{super:['power',[8,9,10,11,11,11,11,11]]},
  'buu-kid':{
   ki:['power',[8,9,10,11,11,11,11,11]],
   super:['power',[24,25,26,27,27,27,27,27]]
  },
  'android18-z':{ki:['power',[16,17,18,19,19,19,19,19]]},
  'broly-full':{ki:['power',[16,17,18,18,18,18,18,18]]},
  'future-trunks-sword':{
   ki:['power',[24,25,26,27,27,27,27,27]],
   super:['power',[24,25,26,27,27,27,27,27]],
   assist:['power',[24,25,26,27,27,27,27,27]]
  },
  'future-trunks-ssj':{
   ki:['power',[0,1,2,3,4,4,4,4]],
   super:['power',[0,1,2,3,4,4,4,4]],
   assist:['power',[0,1,2,3,4,4,4,4]]
  },
  'future-trunks-super':{
   ki:['power',[8,9,10,10,10,10,10,10]],
   super:['power',[8,9,10,10,10,10,10,10]],
   assist:['power',[8,9,10,10,10,10,10,10]]
  },
  'gotenks-ssj3':{
   ki:['power',[16,17,18,18,18,18,18,18]],
   super:['power',[16,17,18,19,20,21,22,22]]
  },
  'gotenks-base':{super:['power',[32,33,34,35,35,35,35,35]]},
  'gotenks-ssj':{super:['power',[16,17,18,19,20,20,20,20]]},
  'caulifla-ssj2':{super:['power',[16,17,18,19,19,19,19,19]]},
  'broly-z':{super:['power',[16,17,18,19,20,21,21,21]]},
  'pan-gt':{super:['power',[8,9,10,11,12,13,13,13]]},
  'dabura-z':{super:['power',[32,33,34,35,36,36,36,36]]},
  'zamasu-base':{super:['power',[24,25,26,27,28,28,28,28]]},
  'zamasu-fused':{super:['power',[8,9,10,11,11,11,11,11]]},
  'vegito-base':{
   ki:['power',[16,17,18,19,20,21,22,22]],
   super:['power',[24,25,26,27,28,30,31,31]]
  },
  'vegito-ssj':{
   ki:['power',[24,25,26,27,28,28,28,28]],
   super:['power',[40,41,42,43,44,44,44,44]]
  }
 };
 for(const [id,actions] of Object.entries(energyLayouts))Object.assign(semanticLayouts[id]||(semanticLayouts[id]={}),actions);
 const koLayouts={
  'gogeta-blue':['core',[40,41,42,43,44,44,44,44],[null,null,null,null,122,122,122,122]],
  'gogeta-ssj4':['core',[40,41,42,43,44,44,44,44],[null,null,null,101,101,101,101,101]],
  'gotenks-ssj3':['core',[42,43,44,45,46,48,49,49],[null,null,null,null,null,114,114,114]],
  'super17-gt':['core',[42,43,44,45,46,47,48,48],[null,null,null,null,null,null,80,80]],
  'future-trunks-sword':['power',[32,33,34,35,36,37,37,37],[null,null,null,null,null,129,129,129]]
 };
 for(const [id,sequence] of Object.entries(koLayouts))(semanticLayouts[id]||(semanticLayouts[id]={})).down=sequence;
 /* The generic down strip ends in a recovery stance on many sheets. Hold the
    inspected impact pose instead; keep each sheet's preceding fall frames. */
 const downHoldGroups={
  44:['bulma-adventure','future-trunks-super','gotenks-ssj3','gogeta-super','gogeta-blue','gogeta-ssj4','frieza-final','frieza-full','frieza-golden','cell-super-perfect','buu-fat','buu-super','buu-gohan','broly-wrath','broly-full','goku-black-base','uub-majuub','hercule-z','videl-z','moro-planet-eater'],
  45:['vegeta-scouter','gotenks-ssj','pan-gt','dabura-z'],
  49:['vegeta-ssj','vegeta-super','vegeta-majin','vegeta-god','vegeta-blue','vegeta-ssj4','krillin-z','frieza-first'],
  50:['goku-kaioken','vegeta-daima-mini','yamcha-z','tien-z','chiaotzu-z','roshi-max','chichi-tournament','future-trunks-ssj','trunks-kid','vegito-base','vegito-ssj','gogeta-base','cell-first','cell-perfect','buu-kid','broly-z','cooler-final','kefla-ssj2','caulifla-ssj2'],
  51:['goku-kid','goku-ssj','goku-ssj2','goku-ssj3','goku-god','goku-blue','goku-ultra','goku-gt-kid','goku-ssj4','goku-daima-mini','goku-daima-ssj4','goten-ssj','android16-z','android21-majin','beerus-super','whis-super','goku-black-rose'],
  52:['vegeta-daima-ssj3','future-trunks-rage','gotenks-base','bardock-z','raditz-z','nappa-z','android17-ranger','janemba-super','hit-super','kale-berserk','zamasu-base']
 };
 for(const [lastCell,ids] of Object.entries(downHoldGroups)){
  const hold=Number(lastCell),start=Math.floor(hold/8)*8;
  for(const id of ids){
   const layout=semanticLayouts[id]||(semanticLayouts[id]={});
   if(!layout.down)layout.down=['power',Array.from({length:8},(_,index)=>Math.min(start+index,hold))];
  }
 }
 const winHoldGroups={
  51:['future-trunks-super'],
  53:['vegito-ssj'],
  54:['frieza-final'],
  55:['piccolo-orange','future-trunks-sword','frieza-full'],
  61:['goku-kaioken','goku-ssj','goku-ssj2','goku-ssj3','goku-god','goku-blue','goku-ultra','goku-ssj4','goku-daima-ssj4'],
  62:['piccolo-fused','yajirobe-db','cell-super-perfect']
 };
 for(const [lastCell,ids] of Object.entries(winHoldGroups)){
  const hold=Number(lastCell),start=Math.floor(hold/8)*8;
  for(const id of ids){
   const layout=semanticLayouts[id]||(semanticLayouts[id]={});
   if(!layout.win)layout.win=['power',Array.from({length:8},(_,index)=>Math.min(start+index,hold))];
  }
 }
 for(const [id,actions] of Object.entries(semanticLayouts)){
  const entry=manifest.fighters[id];if(!entry)continue;
  for(const [name,[sheetName,cells,bottoms]] of Object.entries(actions)){
   if(reviewedStrip(id,name))continue;
   entry.actions[name]=action(entry,name,cells,bottoms,sheetName,originalActions[id]?.[name]?.durations);
  }
 }
 DV.generatedAnimationOverrides=[...new Set([...Object.keys(layouts),...Object.keys(semanticLayouts)])];
 if(typeof module!=='undefined')module.exports={layouts,semanticLayouts,timing};
})(globalThis);
