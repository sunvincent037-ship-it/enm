(function(root){
 'use strict';
 const DV=root.DV=root.DV||{};
 // Sony voice-bank subsongs are one-based. Speech lines retain the AFS ids.
 const SHORTS={attack:[1,2,3,4],ki:[5,6],heavy:[17,18,19],hurt:[7,8,9,10,11,12],hurtHeavy:[13,14,15,16],power:[37,25,26]};
 const SFX={select:['system',1],confirm:['system',2],cancel:['system',3],swing:['battle',1],hit:['battle',7],heavyHit:['battle',8],guard:['battle',13],dash:['battle',24],jump:['battle',23],ki:['battle',31],super:['battle',37],burst:['battle',36],teleport:['battle',25],escape:['battle',25],throw:['battle',10],throwLaunch:['battle',1],throwSlam:['battle',10],counter:['battle',13],break:['battle',8],clash:['battle',37],clashEnd:['battle',38],ko:['battle',8]};
 function profile(catalog,spec){const id=typeof spec==='string'?spec:spec?.id,form=catalog.forms[id]||(catalog.stage?.[id]?{profile:catalog.stage[id],match:'original-form'}:null);if(!form)return null;const original=catalog.profiles[form.profile],p=form.useReplacement===false?original:(catalog.profiles[original.replacementProfile]||original),shared=catalog.profiles[p.fallbackProfile];const lines={...(shared?.lines||{}),...p.lines};if(p.lineBase)for(const [n,clip]of Object.entries(p.lines))lines[Number(n)-p.lineBase+500]=clip;return {...original,character:p.character,voiceSlot:p.slot,shorts:{...(shared?.shorts||{}),...p.shorts},lines,key:form.profile,match:form.match};}
 function pick(catalog,p,kind,variant=0){if(!p)return null;const ids=(SHORTS[kind]||SHORTS.attack).map(i=>p.shorts[i]).filter(Boolean);return ids.length?ids[Math.abs(variant)%ids.length]:null;}
 function routeEvent(catalog,match,type,data={}){
  const results=[],fighters=match?.fighters||[],side=data.side??0,fighter=fighters[side];
  const effectKind=type==='hit'?(data.heavy?'heavyHit':'hit'):type==='transformStart'?'super':type==='transformEnd'?'burst':type==='barrier'?'guard':type;
  const sfx=SFX[effectKind],effect=sfx&&catalog.sfx[sfx[0]]?.[sfx[1]];
  if(effect)results.push({clip:effect,voice:false,channel:'sfx:'+effectKind,cooldown:['hit','heavyHit'].includes(effectKind)?.07:.1,gain:.36,priority:0});
  function voice(spec,kind,owner,priority=1,extra={}){const p=profile(catalog,spec),clip=pick(catalog,p,kind,match?.tick??0);if(clip)results.push({clip,voice:true,channel:owner,cooldown:.38,priority,gain:.65,...extra});}
  if(type==='hit'){const victim=data.targetSide??(1-side);voice(fighters[victim]?.spec,data.heavy?'hurtHeavy':'hurt','fighter:'+victim,2,{cooldown:.45});}
  else if(type==='swing'||type==='grab'||type==='throwSlam'||type==='counter')voice(fighter?.spec,type==='swing'?'attack':'heavy','fighter:'+side);
  else if(type==='ki'&&!data.heavy)voice(fighter?.spec,'ki','fighter:'+side);
  else if(type==='super'||type==='aoe'||type==='unique'){
   const p=profile(catalog,fighter?.spec),named=DV.bt3TechniqueVoices?.[fighter?.spec?.id]?.[data.name||fighter?.spec?.moves?.super];
   if(named&&p&&p.match!=='same-character'&&catalog.clips[named])results.push({clip:named,voice:true,channel:'fighter:'+side,cooldown:.5,priority:4,gain:.7});
   else voice(fighter?.spec,'power','fighter:'+side,4,{cooldown:.6});
  }
  else if(type==='burst'||type==='transformStart')voice(fighter?.spec,'power','fighter:'+side,3,{cooldown:.6});
  else if(type==='assistStrike'||type==='assistStart'){
   // The engine supplies an assist spec id, separate from its owner.
   const helper=(DV.roster||[]).find(s=>s.id===data.assistId)||fighter?.assist;
   voice(helper,'heavy','assist:'+side,2,{cooldown:.65});
  }
  else if(type==='ko'&&(data.winner===0||data.winner===1)){
   const p=profile(catalog,fighters[data.winner]?.spec),clip=p&&p.match!=='same-character'&&(p.lines[503]||p.lines[504]);
   if(clip)results.push({clip,voice:true,victory:true,channel:'fighter:'+data.winner,cooldown:1,priority:5,gain:.7,maxDelay:2});
   else voice(fighters[data.winner]?.spec,'heavy','fighter:'+data.winner,5,{victory:true});
  }
  return results;
 }
 class BT3Sound{
  constructor(fallback,options={}){
   this.fallback=fallback||{muted:false,ctx:null,unlock(){},play(){}};this.catalog=options.catalog||DV.bt3Audio;
   this.loader=options.load||((id)=>this.loadBuffer(id));this.clock=options.clock||(()=>((root.performance?.now?.()??Date.now())/1000));
   this.buffers=new Map();this.loading=new Map();this.active=new Set();this.channels=new Map();this.recent=new Map();this.charges=new Map();this.played=[];this.generation=0;this.serial=0;this.stats={started:0,failed:0,limited:0,expired:0};
  }
  get muted(){return !!this.fallback.muted;}
  set muted(value){this.fallback.muted=!!value;if(value)this.stop();}
  get ctx(){return this.fallback.ctx;}
  unlock(){this.fallback.unlock();if(!this.fallback.ctx){try{const AC=root.AudioContext||root.webkitAudioContext;if(AC)this.fallback.ctx=new AC();}catch(_){}}if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});}
  stop(){this.generation++;for(const item of [...this.active]){try{item.source.stop();}catch(_){}this.release(item);}this.channels.clear();this.recent.clear();this.charges.clear();}
  stopChannel(channel){const item=this.channels.get(channel);this.channels.delete(channel);this.recent.delete(channel);if(item?.source){try{item.source.stop();}catch(_){}this.release(item);}}
  startCharge(spec,owner=0){
   if(this.muted||!this.ctx)return false;
   const key=String(owner),id=spec?.id||String(spec),loop=this.catalog?.sfx.battle?.[23];
   if(!loop)return false;if(this.charges.get(key)===id)return true;this.stopCharge(key);
   this.charges.set(key,id);
   // SE_Battle subsong 23 has a native 0..7028-sample loop in the Sony bank.
   this.playClip(loop,{loop:true,channel:'charge:'+key,cooldown:0,gain:.32,maxDelay:1.5});
   const p=profile(this.catalog,spec),voice=p?.shorts[37];
   if(voice)this.playClip(voice,{voice:true,channel:'charge-voice:'+key,cooldown:0,priority:3,gain:.65,maxDelay:1.5});
   this.lastEvent={type:'chargeStart',owner:key,voices:voice?[voice]:[]};return true;
  }
  stopCharge(owner=0){const key=String(owner);if(!this.charges.has(key))return false;this.charges.delete(key);this.stopChannel('charge:'+key);this.stopChannel('charge-voice:'+key);this.lastEvent={type:'chargeStop',owner:key,voices:[]};return true;}
  syncCharge(match){
   const wanted=new Map();if(match?.phase==='fight'&&!match.paused&&!this.muted)(match.fighters||[]).forEach((f,side)=>{if(f.state==='charge'&&(f.hp??1)>0)wanted.set(String(side),f.spec);});
   for(const key of this.charges.keys())if(!wanted.has(key))this.stopCharge(key);
   for(const [key,spec]of wanted)this.startCharge(spec,key);
  }
  release(item){if(item.ended)return;item.ended=true;this.active.delete(item);if(this.channels.get(item.channel)===item)this.channels.delete(item.channel);try{item.source.disconnect();item.gain.disconnect();item.pan?.disconnect();}catch(_){} }
  async loadBuffer(id){
   if(this.buffers.has(id)){const b=this.buffers.get(id);this.buffers.delete(id);this.buffers.set(id,b);return b;}
   if(this.loading.has(id))return this.loading.get(id);
   const entry=this.catalog?.clips[id];if(!entry||!this.ctx)return null;
   const promise=(async()=>{const response=await fetch(entry.url);if(!response.ok)throw new Error('audio '+response.status);const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.buffers.set(id,buffer);while(this.buffers.size>96)this.buffers.delete(this.buffers.keys().next().value);return buffer;})().finally(()=>this.loading.delete(id));
   this.loading.set(id,promise);return promise;
  }
  playClip(id,options={}){
   if(this.muted||!this.catalog?.clips[id]||!this.ctx)return false;
   const now=this.clock(),channel=options.channel||'sfx:'+id,previous=this.channels.get(channel),priority=options.priority||0;
   const recent=this.recent.get(channel);
   if((recent&&now-recent.at<(options.cooldown??.12)&&priority<=recent.priority)||(previous&&previous.voice&&priority<=previous.priority)){this.stats.limited++;return false;}
   if(previous){try{previous.source?.stop();}catch(_){}if(previous.source)this.release(previous);}
   if(this.active.size>=12){this.stats.limited++;return false;}
   const item={id,channel,priority,voice:!!options.voice,loop:!!options.loop,at:now,token:++this.serial,generation:this.generation};this.channels.set(channel,item);
   this.recent.set(channel,{at:now,priority});
   const start=(buffer)=>{
    if(!buffer||this.muted||item.generation!==this.generation||this.channels.get(channel)!==item||this.clock()-now>(options.maxDelay??.4)){if(this.channels.get(channel)===item){this.channels.delete(channel);this.recent.delete(channel);this.stats.expired++;}return;}
    if(this.active.size>=12){this.channels.delete(channel);this.stats.limited++;return;}
    const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=1;source.loop=!!options.loop;if(source.loop){source.loopStart=0;source.loopEnd=buffer.duration;}
    const info=this.catalog.clips[id],normalization=Math.min(1.35,.12/Math.max(.02,(info.rms||3000)/32768));gain.gain.value=Math.min(.9,(options.gain??.6)*normalization);
    Object.assign(item,{source,gain});source.connect(gain);
    if(typeof ctx.createStereoPanner==='function'){item.pan=ctx.createStereoPanner();item.pan.pan.value=options.pan??0;gain.connect(item.pan);item.pan.connect(ctx.destination);}else gain.connect(ctx.destination);
    source.onended=()=>this.release(item);this.active.add(item);source.start();this.stats.started++;this.lastClip=id;this.played.push({id,voice:item.voice});if(this.played.length>20)this.played.shift();
   };
   // Direct-file opening cannot fetch WAVs, but HTMLAudio can play the same URLs.
   if(root.location?.protocol==='file:'&&typeof root.Audio==='function'){
    const audio=new root.Audio(this.catalog.clips[id].url);audio.loop=!!options.loop;audio.volume=Math.min(1,options.gain??.5);item.source={stop:()=>{audio.pause();audio.currentTime=0;},disconnect(){}};item.gain={disconnect(){}};this.active.add(item);audio.onended=()=>this.release(item);audio.play().then(()=>{if(this.muted||item.generation!==this.generation)item.source.stop();else this.stats.started++;}).catch(()=>{this.stats.failed++;this.release(item);});return true;
   }
   Promise.resolve(this.loader(id)).then(start).catch(()=>{this.stats.failed++;if(this.channels.get(channel)===item){this.channels.delete(channel);this.recent.delete(channel);}});return true;
  }
  play(kind){const descriptor=SFX[kind],clip=descriptor&&this.catalog?.sfx[descriptor[0]]?.[descriptor[1]];if(clip&&this.playClip(clip,{channel:'sfx:'+kind,cooldown:.08,gain:.32}))return true;this.fallback.play(kind);return false;}
  playHit(heavy){return this.play(heavy?'heavyHit':'hit');}
  event(match,type,data){const routes=routeEvent(this.catalog,match,type,data);for(const route of routes)this.playClip(route.clip,{...route,pan:route.voice?(route.channel.endsWith(':1')?.2:-.2):0});if(!routes.some(r=>!r.voice)&&['fight','tap','assist','unique','grabbed','aoe','tech'].includes(type))this.fallback.play(type);this.lastEvent={...data,type,voices:routes.filter(r=>r.voice).map(r=>r.clip)};return routes;}
  select(spec,side=0){const old=this.channels.get('selection');if(old){try{old.source?.stop();}catch(_){}this.release(old);}this.channels.delete('selection');this.recent.delete('selection');this.preload([spec]);const p=profile(this.catalog,spec),clip=p&&p.match!=='same-character'&&p.lines[500];if(clip)this.playClip(clip,{voice:true,channel:'selection',priority:2,cooldown:1,gain:.55,maxDelay:1.5});}
  preload(specs){if(!this.ctx||!this.catalog||root.location?.protocol==='file:')return;const ids=new Set();for(const spec of specs){const p=profile(this.catalog,spec);if(!p)continue;for(const indexes of Object.values(SHORTS))for(const i of indexes)if(p.shorts[i])ids.add(p.shorts[i]);for(const line of [500,503])if(p.lines[line])ids.add(p.lines[line]);const named=DV.bt3TechniqueVoices?.[spec?.id];for(const id of Object.values(named||{}))if(this.catalog.clips[id])ids.add(id);}for(const kind of ['select','confirm','hit','guard','ki','swing']){const s=SFX[kind],id=this.catalog.sfx[s[0]]?.[s[1]];if(id)ids.add(id);}for(const id of ids)this.loader(id).catch(()=>{});}
 }
 Object.assign(DV,{BT3Sound,bt3RouteEvent:routeEvent,bt3Profile:profile});if(typeof module!=='undefined')module.exports={BT3Sound,routeEvent,profile};
})(typeof window!=='undefined'?window:globalThis);
