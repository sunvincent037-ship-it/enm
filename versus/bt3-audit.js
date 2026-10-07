(function(root){
 'use strict';
 if(!new URLSearchParams(root.location.search).has('audioAudit'))return;
 const box=document.createElement('pre');box.id='bt3-audio-diagnostics';box.setAttribute('aria-label','音频诊断');box.style.cssText='position:fixed;left:8px;bottom:8px;z-index:999999;background:#101820e8;color:#c7f4db;padding:10px;max-width:540px;font:12px/1.4 monospace;white-space:pre-wrap;pointer-events:none';document.body.append(box);
 setInterval(()=>{const sound=root.DV?.app?.sound;box.textContent=JSON.stringify({stats:sound?.stats,active:sound?.active?.size,muted:sound?.muted,charging:[...(sound?.charges?.keys()||[])],loops:[...(sound?.active||[])].filter(a=>a.loop).map(a=>a.id),lastClip:sound?.lastClip,event:sound?.lastEvent,recentVoices:sound?.played?.filter(p=>p.voice).map(p=>p.id).slice(-5)},null,2);},250);
})(window);
