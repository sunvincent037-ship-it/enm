(function(root){
 'use strict';
 const DV=root.DV=root.DV||{};
 const W=1280,H=720,F=564;
 const imageCache=new Map();
 function asset(src){if(!imageCache.has(src)){const im=new Image();im.src=src;imageCache.set(src,im);}return imageCache.get(src);}
 function ready(im){return im&&im.complete&&im.naturalWidth>0;}
 function polygon(c,points,fill,stroke,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
 function text(c,t,x,y,size=18,color='#fff',align='left',weight=800){c.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(t,x,y);}
 function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 function stageArt(c,stage,x=0,y=0,w=W,h=H,t=0){
  /* 场景缺失时退化为纯色背景，而不是抛异常——renderBattle 抛异常会终止
     requestAnimationFrame 循环，表现为画面永久卡死。 */
  if(!stage)stage={id:'unknown',name:'',kind:'',color:'#fff'};
  const kinds={namek:0,chamber:1,cell:2,void:3,kame:4,kai:5};
  let index=kinds[stage.kind];
  // IDs are a second explicit alias for data-only stage definitions.
  if(index===undefined){const id=stage.id;index=({namek:0,'time-chamber':1,'cell-games':2,'tournament-power':3,'kame-house':4,'king-kai':5})[id];}
  const tournament=/tournament|budokai/.test(stage.kind||'')||stage.id==='world-tournament';
  const desert=/wasteland|wilderness|desert/.test(stage.kind||'')||stage.id==='wasteland';
  const src=tournament?'assets/versus-tournament-arena.png':desert?'assets/vegeta-saga/stages/backgrounds/canyon-pursuit.png':'assets/versus-expanded/classic-stages.png';
  const im=asset(src);
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  if(ready(im)){
   if(index!==undefined&&!tournament&&!desert){const sw=im.naturalWidth/2,sh=im.naturalHeight/3;c.drawImage(im,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,x,y,w,h);}
   else c.drawImage(im,x,y,w,h);
  }else{
   const g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,stage.sky?.[0]||'#195b97');g.addColorStop(1,stage.sky?.[1]||'#aad3bd');c.fillStyle=g;c.fillRect(x,y,w,h);
   c.fillStyle=stage.ground?.[0]||'#709377';c.fillRect(x,y+h*.7,w,h*.3);
  }
  if(w>500){
   const g=c.createLinearGradient(0,0,0,145);g.addColorStop(0,'#020714c9');g.addColorStop(1,'#02071400');c.fillStyle=g;c.fillRect(0,0,W,145);
   for(let i=0;i<15;i++){const px=(i*107+t*(.2+i%3*.1))%W,py=185+(i*67)%370-Math.sin(t/60+i)*12;c.globalAlpha=.24;c.fillStyle=stage.color||'#fff';c.fillRect(px,py,2,2);}
  }
  c.restore();
 }
 function resolvePortraitSource(spec){return spec?.id?`assets/versus-expanded/fighters/${spec.id}/portrait.png`:null;}
 function portrait(c,s,x,y,w,h,mode='full'){
  if(mode==='tile'&&DV.portraitAtlas){const im=asset(DV.portraitAtlas);if(ready(im)){const sw=im.naturalWidth/10,sh=im.naturalHeight/5,idx=s.portraitIndex;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(im,idx%10*sw,Math.floor(idx/10)*sh,sw,sh,x,y,w,h);c.restore();return;}}
  const specific=resolvePortraitSource(s);
  if(specific){const im=asset(specific);if(ready(im)){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(im,x,y,w,h);c.restore();return;}}
  if(DV.portraitAtlas){const im=asset(DV.portraitAtlas);if(ready(im)){const sw=im.naturalWidth/10,sh=im.naturalHeight/5,idx=s.portraitIndex;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(im,idx%10*sw,Math.floor(idx/10)*sh,sw,sh,x,y,w,h);c.restore();return;}}
  if(DV.drawPortrait)DV.drawPortrait(c,s,x,y,w,h);
 }
 function meterFill(c,x,y,w,h,value,color,reverse=false){
  const fill=Math.max(0,Math.min(1,value))*w;
  if(fill>0){const left=reverse?x+w-fill:x;const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,color);g.addColorStop(.5,color);g.addColorStop(.51,color+'c0');g.addColorStop(1,color);c.fillStyle=g;c.fillRect(left,y+2,fill-1,Math.max(1,h-4));}
 }
 function meter(c,x,y,w,h,value,color,reverse=false){polygon(c,[[x,y],[x+w,y],[x+w-5,y+h],[x-5,y+h]],'#08111e','#496079',1);meterFill(c,x,y,w,h,value,color,reverse);}
 function hpTrail(c,x,y,w,h,value,trail,color,reverse){polygon(c,[[x,y],[x+w,y],[x+w-5,y+h],[x-5,y+h]],'#08111e','#496079',1);meterFill(c,x,y,w,h,trail,'#ff8a42',reverse);meterFill(c,x,y,w,h,value,color,reverse);}
 function assistInfo(value){
  const key=typeof value==='string'?value:(value?.assistId||value?.id||value?.spec?.id||value?.assist?.id);
  const list=DV.ASSISTS||{};
  return (DV.assistProfile&&DV.assistProfile(key))||list[key]||list[value?.kind]||{};
 }
 function assistLabel(f){const p=assistInfo(f.assist);return p.label||p.name||p.skill||f.assist?.name||'援助';}
 function assistRoleLabel(kind){return ({grab:'抓取',rush:'突进',strike:'突进',control:'控制',barrier:'防护',support:'补给',projectile:'气弹',beam:'光束',slash:'剑击'})[String(kind||'').toLowerCase()]||'援助';}
 function assistCooldownMax(f){const p=assistInfo(f.assist);return Number(f.assistCooldownMax||p.cooldown||p.cooldownTicks)||Math.max(1,Number(f.assistCooldown)||1);}
 function hud(c,m){
  for(const f of m.fighters){const right=f.side===1,x=right?1179:16,panelX=right?695:105;
   c.save();polygon(c,[[x,18],[x+76,18],[x+85,34],[x+85,103],[x+12,103],[x,85]],'#07131f',right?'#ff9f44':'#5cf0ff',3);portrait(c,f.spec,x+4,22,76,76,'tile');c.restore();
   text(c,f.spec.name+(f.spec.form?' · '+f.spec.form:''),right?1170:111,31,17,'#fff',right?'right':'left');
   const hp=f.hp/f.maxHp,trail=Math.max(hp,(m.presentation?.hpTrail?.[f.side]??hp));hpTrail(c,panelX,42,478,27,hp,trail,hp<.25?'#ff6358':'#8df544',right);
   for(let i=1;i<5;i++){c.fillStyle='#07111a66';c.fillRect(panelX+i*478/5,44,2,22);}
   meter(c,panelX,75,478,10,f.ki/100,'#48d7ff',right);
   meter(c,panelX,90,190,5,f.guard/100,'#c9d9e5',right);
   text(c,`${Math.ceil(f.hp)} / ${f.maxHp}`,right?panelX:panelX+478,108,11,'#e8f2ea',right?'left':'right',600);
   text(c,`KI ${Math.floor(f.ki)}`,right?panelX+478:panelX,109,12,'#6de4ff',right?'right':'left');
   text(c,right?(m.options.training?'TRAINING':m.options.mode==='local'?'PLAYER 02':'CPU · '+({easy:'简单',normal:'标准',hard:'困难',inferno:'炼狱'}[m.options.difficulty]||'标准')):'PLAYER 01',right?panelX+300:panelX+218,101,10,right?'#ffc67a':'#68dced','center',700);
   const ax=right?962:25;
   polygon(c,[[ax,633],[ax+60,633],[ax+68,644],[ax+64,699],[ax,699]],'#06121de8',right?'#ffb655':'#75dcea',2);
   portrait(c,f.assist,ax+4,638,56,54,'tile');
   const cdMax=assistCooldownMax(f), profile=assistInfo(f.assist), role=assistRoleLabel(profile.role||profile.kind);
   const exhausted=Number.isFinite(profile.maxUses)&&Number(f.assistUses||0)>=profile.maxUses;
   text(c,exhausted?'用尽':f.assistCooldown>0?`${Math.ceil(f.assistCooldown/60)}s`:'READY',ax+34,630,12,exhausted||f.assistCooldown>0?'#a8aeba':'#ffe890','center');
   text(c,`${f.assist.name} · ${assistLabel(f)}`,ax+78,651,13,'#fff');
   meter(c,ax+78,663,184,9,1-Math.min(1,f.assistCooldown/cdMax),'#f8c655');
   text(c,role,ax+262,651,9,'#9ab9ce','right',700);
   meter(c,ax+78,682,184,5,f.stamina/100,'#7ad8ed');
   text(c,f.burstFrames>0?`爆气 ${Math.ceil(f.burstFrames/60)}s`:f.burstCooldown>0?`爆气冷却 ${Math.ceil(f.burstCooldown/60)}s`:'S + I  爆气',ax+78,706,11,f.burstFrames>0?'#fff4a3':'#b4c5cc');
   /* 必杀招式名（按正传身份表显示） */
   const mv=DV.resolveMoves?DV.resolveMoves(f):null;
   const supName=f.state==='super'&&f.superMove?.label?f.superMove.label:(mv&&mv.super&&mv.super.label&&mv.super.label!=='super')?mv.super.label:null;
   if(supName)text(c,`必杀 · ${supName}`,right?panelX+478:panelX,124,11,right?'#ffd28a':'#ffd28a',right?'right':'left',700);
   /* 状态效果剩余时间 */
   if(f.status){
    const keys=Object.keys(f.status).filter(k=>f.status[k]>0);
    if(keys.length){
     const zh={blind:'致盲',paralyze:'麻痹',freeze:'停止',stun:'眩晕',seal:'封锁',slow:'迟缓',burn:'燃烧',poison:'中毒'};
     const show=keys.filter(k=>zh[k]).map(k=>`${zh[k]} ${Math.ceil(f.status[k]/60)}s`).join(' · ');
     if(show)text(c,show,right?panelX+120:panelX+358,124,11,'#ffb86b',right?'right':'left',700);
    }
   }
   if(f.combo>=2&&f.comboTimer>0){const cx=right?1125:155;text(c,String(f.combo),cx,214,57,'#ffe695',right?'right':'left',900);text(c,'HITS · COMBO',cx+(right?-62:67),207,19,'#fff',right?'right':'left');text(c,`${f.damageCombo} DAMAGE`,cx,237,12,'#f6e4bc',right?'right':'left');}
  }
  polygon(c,[[604,22],[676,22],[697,49],[679,91],[601,91],[583,49]],'#081a2b','#86d4e4',3);
  text(c,m.options.training||!Number.isFinite(m.time)?'∞':String(m.time).padStart(2,'0'),640,74,43,'#defcff','center',900);
  text(c,m.options.training?'TRAINING':!Number.isFinite(m.time)?'NO LIMIT':'TIME',640,107,10,'#d1e8ec','center');
  const cue=m.options.training&&!m.options.tutorial&&DV.trainingCue?.(m.fighters[0]);
  if(cue){
   const color=cue.kind==='pursuit'?'#ffe08a':cue.kind==='confirm'?'#98f0d1':'#9bdefb';
   c.fillStyle='#071725ed';c.fillRect(370,142,540,44);
   text(c,cue.text,640,165,14,color,'center',700);
   c.fillStyle=color;c.fillRect(370,181,540*Math.max(0,Math.min(1,cue.remaining)),3);
  }
 }
 function aura(c,f,t){
  const x=f.x,y=F-f.y,charge=f.state==='charge'||f.state==='burst',color=f.spec.color;
  c.save();c.globalCompositeOperation='screen';
  c.globalAlpha=charge?.58:.36;glow(c,x,y-73,120,color);
  for(let layer=0;layer<3;layer++){
   c.globalAlpha=.15+layer*.08;const points=[[x-48-layer*5,y+5]];
   for(let i=0;i<=12;i++){const a=Math.PI+i/12*Math.PI,rx=60+Math.sin(t*.18+i*3+layer)*14,ry=135+Math.sin(t*.2+i)*23;points.push([x+Math.cos(a)*rx,y-25+Math.sin(a)*ry]);}points.push([x+54,y+5]);polygon(c,points,color);
  }
  if(f.burstFrames>0){c.globalAlpha=.9;c.strokeStyle='#dcf6ff';c.lineWidth=2;for(let i=0;i<3;i++){const xx=x-45+i*40+Math.sin(t*.32+i)*20;c.beginPath();c.moveTo(xx,y-132);c.lineTo(xx+18,y-101);c.lineTo(xx-7,y-77);c.lineTo(xx+10,y-48);c.stroke();}}
  c.restore();
 }
 function beam(c,x,y,end,color,r=20,t=0){
  c.save();c.globalCompositeOperation='screen';
  c.shadowBlur=24;c.shadowColor=color;c.lineCap='round';
  for(const [width,alpha,col] of [[r*2.8,.18,color],[r*1.7,.55,color],[r,.9,color],[r*.45,1,'#fff']]){c.lineWidth=width;c.globalAlpha=alpha;c.strokeStyle=col;c.beginPath();c.moveTo(x,y);c.lineTo(end,y+Math.sin(t*.4)*2);c.stroke();}
  c.globalAlpha=.7;for(let i=0;i<8;i++){const xx=x+(end-x)*((i/8+t*.025)%1);c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.ellipse(xx,y,r*.3,r*.9,0,0,Math.PI*2);c.stroke();}
  c.restore();
 }
 /* 气圆斩类：扁平高速旋转气刃（正传：切割型、具穿透性） */
 function disc(c,p,x,y){
  const spin=t=>(t*.55);
  const px=F-p.y, dir=p.dir||1, r=p.r||34;
  c.save();c.globalCompositeOperation='screen';c.shadowBlur=22;c.shadowColor=p.color;
  c.translate(x,px);c.rotate(p.age*0.55);
  c.globalAlpha=.28;c.fillStyle=p.color;c.beginPath();c.ellipse(0,0,r*2.1,r*.42,0,0,Math.PI*2);c.fill();
  c.globalAlpha=.95;c.fillStyle=p.color;c.beginPath();c.ellipse(0,0,r*1.25,r*.2,0,0,Math.PI*2);c.fill();
  c.globalAlpha=1;c.fillStyle='#ffffff';c.beginPath();c.ellipse(0,0,r*1.1,r*.08,0,0,Math.PI*2);c.fill();
  c.restore();
  // 飞行拖尾
  c.save();c.globalAlpha=.35;c.strokeStyle=p.color;c.lineWidth=3;
  c.beginPath();c.moveTo(x-dir*r*2.6,px);c.lineTo(x-dir*r*.6,px);c.stroke();c.restore();
 }
 /* 状态效果标记（致盲/麻痹/冻结/封技），让机制可见 */
 function statusMarks(c,f,t){
  if(!f.status)return;
  const active=Object.keys(f.status).filter(k=>f.status[k]>0&&k!=='regen'&&k!=='absorb');
  if(!active.length)return;
  const meta={blind:['盲','#ffd95c'],paralyze:['痹','#c99cff'],freeze:['停','#8fe6ff'],stun:['晕','#ffb15c'],seal:['封','#ff8fd0'],slow:['缓','#9fd6ff'],burn:['燃','#ff9a5c'],poison:['毒','#a8e06a']};
  const x=f.x,y=F-f.y;
  active.slice(0,4).forEach((key,i)=>{
    const [glyph,col]=meta[key]||[key.slice(0,1),'#ffffff'];
    const bx=x-16+i*13, by=y-150-Math.sin(t*.12+i)*3;
    c.save();c.globalAlpha=.92;
    c.fillStyle='#06121dcc';c.beginPath();c.arc(bx,by,6.4,0,Math.PI*2);c.fill();
    c.strokeStyle=col;c.lineWidth=1.4;c.stroke();
    c.fillStyle=col;c.font='700 8px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(glyph,bx,by+.5);
    c.restore();
  });
 }
 function drawEffect(c,e){
  const age=e.max-e.life,p=age/e.max,x=e.x,y=F-e.y;
  c.save();c.globalAlpha=1-p;c.strokeStyle=e.color;c.fillStyle=e.color;
  if(e.kind==='dust'){for(let i=0;i<5;i++){c.globalAlpha=(1-p)*.24;c.beginPath();c.ellipse(x+(i-2)*p*20,y-p*8,8+p*15,4+p*6,0,0,Math.PI*2);c.fill();}}
  else if(e.kind==='rise'||e.kind==='gather'){glow(c,x+Math.sin(age*.2)*10,y-age*2,8,e.color);}
  else if(e.kind==='summon'){c.lineWidth=4;c.beginPath();c.ellipse(x,y,25+p*30,85*(1-p*.4),0,0,Math.PI*2);c.stroke();}
  else if(e.kind==='guard'){c.lineWidth=4;c.beginPath();c.arc(x,y,35+p*17,-1.2,1.2);c.stroke();}
  else if(e.kind==='slash'){c.lineWidth=4*(1-p);c.beginPath();c.ellipse(x,y,30+p*25,18,e.facing*.5,-2,1.8);c.stroke();}
  else{
   const big=e.kind==='burst',r=(big?25:8)+p*(big?(e.small?50:170):55);
   c.globalCompositeOperation='screen';glow(c,x,y,r*.8,e.color);c.lineWidth=(1-p)*(big?8:4);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
   for(let i=0;i<(big?20:11);i++){const a=i*Math.PI*2/(big?20:11)+age*.03;const r1=r*.38,r2=r*(i%2?1.4:.8);c.lineWidth=(1-p)*3;c.strokeStyle=i%2?e.color:'#ffffff';c.beginPath();c.moveTo(x+Math.cos(a)*r1,y+Math.sin(a)*r1);c.lineTo(x+Math.cos(a)*r2,y+Math.sin(a)*r2);c.stroke();}
  }
  c.restore();
 }
 function hitSpark(c,e){const p=Math.max(0,e.life/e.max),x=e.x,y=F-e.y,dir=e.dir||1;c.save();c.globalCompositeOperation='screen';c.globalAlpha=p;c.fillStyle='#fff';c.beginPath();c.moveTo(x,y-6);c.lineTo(x+6,y);c.lineTo(x,y+6);c.lineTo(x-6,y);c.closePath();c.fill();c.strokeStyle='#fff';c.lineWidth=2.5;for(let i=-3;i<=3;i++){const a=i*.34+Math.PI*(dir<0?1:0),len=25+(i&1)*16;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);c.stroke();}c.restore();}
 function heavyImpact(c,e){const p=1-e.life/e.max,x=e.x,y=F-e.y;c.save();c.globalAlpha=1-p;c.strokeStyle='#fff3ca';c.lineWidth=5*(1-p);c.beginPath();c.arc(x,y,18+p*68,0,Math.PI*2);c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.strokeStyle=i%2?'#ffcf6c':'#fff';c.lineWidth=3*(1-p);c.beginPath();c.moveTo(x+Math.cos(a)*(20+p*22),y+Math.sin(a)*(20+p*22));c.lineTo(x+Math.cos(a)*(32+p*80),y+Math.sin(a)*(32+p*80));c.stroke();}c.restore();}
 function guardShield(c,e){const p=1-e.life/e.max,x=e.x,y=F-e.y,rot=e.dir>0?Math.PI:0;c.save();c.globalAlpha=(1-p)*.7;c.strokeStyle='#77ddff';c.lineWidth=4;c.beginPath();c.arc(x,y,42+p*16,-1.18+rot,1.18+rot);c.stroke();c.strokeStyle='#efffff';c.lineWidth=1.5;c.beginPath();c.arc(x,y,48+p*12,-1.05+rot,1.05+rot);c.stroke();c.restore();}
 function dashTrail(c,f){if(!f.trail?.length)return;for(const t of f.trail){c.save();c.globalAlpha=t.life/12*.34;c.filter='hue-rotate(10deg) saturate(1.5)';DV.drawFighter(c,{...f,state:'dash',frame:t.frame},t.x,F-t.y,1.03);c.restore();}}
 function landingDust(c,e){const p=1-e.life/e.max,x=e.x,y=F-e.y;c.save();c.globalAlpha=(1-p)*.4;c.fillStyle='#d7e9f1';for(let i=0;i<5;i++){c.beginPath();c.ellipse(x+(i-2)*(10+p*16),y-p*14,8+p*14,3+p*4,0,0,Math.PI*2);c.fill();}c.restore();}
 /* 援助只读取引擎实体的当前位置与阶段。这样抓取、护罩和空中突袭都与实际判定同步，
    不会把角色锁死在固定的蓄气姿势或用画面伪造命中。 */
 function assistStyle(a){
  const p=assistInfo(a), raw=String(a.kind||p.kind||p.type||'projectile').toLowerCase(),label=String(p.label||'');
  if(/grab|grapple|throw|hold/.test(raw))return 'grab';
  if(/support|heal|supply/.test(raw))return 'support';
  if(/beam/.test(raw))return 'beam';
  if(/strike|melee|rush|kick|punch/.test(raw))return 'strike';
  if(/剑|斩|sword|slash|blade/.test(label)||/slash|sword|blade/.test(raw))return 'slash';
  if(/guard|barrier|shield|protect/.test(raw))return 'guard';
  if(/psych|telekin|blind|seal|control|stun/.test(raw))return 'control';
  if(/slash|sword|blade/.test(raw))return 'slash';
  return 'projectile';
 }
 function assistVisual(c,a,t){
  const style=assistStyle(a), p=Math.max(0,Math.min(1,(a.age||0)/Math.max(1,a.duration||45))), x=a.x,y=F-(a.y||0)-76,dir=a.facing||1;
  const phase=a.phase||'execute', exitSpan=Math.max(1,(a.profile?.timing?.end||a.duration||45)-(a.profile?.timing?.exit||0)),fade=phase==='enter'?Math.min(1,p*3):phase==='exit'?Math.max(0,Math.min(1,(a.life||0)/exitSpan)):1;
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.65*fade;
  if(phase==='telegraph'){c.strokeStyle='#c7eeff';c.lineWidth=2;c.setLineDash([5,6]);c.beginPath();c.ellipse(x,F-(a.y||0)+3,28,8,0,0,Math.PI*2);c.stroke();c.restore();return;}
  const targetX=x+dir*(style==='projectile'?100:38);
  if(style==='grab'){
   c.strokeStyle='#ffd67a';c.lineWidth=4;c.beginPath();c.arc(targetX,y,23,0,Math.PI*2);c.stroke();
   c.setLineDash([5,5]);c.lineWidth=2;c.beginPath();c.arc(targetX,y,32,0,Math.PI*2);c.stroke();
  }else if(style==='strike'){
   c.strokeStyle='#fff0ae';c.lineWidth=6;c.beginPath();c.moveTo(x+dir*16,y+8);c.lineTo(x+dir*70,y-12);c.stroke();
   c.strokeStyle='#ff9d62';c.lineWidth=2;c.beginPath();c.arc(targetX,y,18+p*22,0,Math.PI*2);c.stroke();
  }else if(style==='guard'){
   const rot=dir>0?0:Math.PI;c.strokeStyle='#7eeeff';c.lineWidth=4;c.beginPath();c.arc(x+dir*24,y,50,-1.1+rot,1.1+rot);c.stroke();c.lineWidth=1.5;c.beginPath();c.arc(x+dir*24,y,59,-1+rot,1+rot);c.stroke();
  }else if(style==='support'){
   c.strokeStyle='#a8ffb4';c.lineWidth=2;for(let i=0;i<3;i++){c.globalAlpha=(.65-i*.14)*fade;c.beginPath();c.ellipse(x,y+14-i*14,18+i*13,7+i*5,0,0,Math.PI*2);c.stroke();}
  }else if(style==='control'){
   c.strokeStyle='#e6a4ff';c.lineWidth=3;for(let i=0;i<3;i++){c.beginPath();c.ellipse(targetX,y,22+i*13+Math.sin(t*.2+i)*3,34+i*11,0,0,Math.PI*2);c.stroke();}
   c.fillStyle='#fff6c8';c.beginPath();c.arc(targetX,y,5,0,Math.PI*2);c.fill();
  }else if(style==='slash'){
   c.strokeStyle='#d9fbff';c.lineWidth=4;c.beginPath();c.arc(x+dir*48,y,52,dir>0?-2.45:-.7,dir>0?.55:3.85);c.stroke();c.strokeStyle='#7ccaff';c.lineWidth=1.5;c.beginPath();c.arc(x+dir*48,y,66,dir>0?-2.45:-.7,dir>0?.55:3.85);c.stroke();
  }else if(style==='beam'){
   c.strokeStyle='#b9f8ff';c.lineWidth=5;c.beginPath();c.moveTo(x+dir*18,y);c.lineTo(x+dir*138,y);c.stroke();c.lineWidth=1.5;c.strokeStyle='#fff';c.beginPath();c.moveTo(x+dir*18,y);c.lineTo(x+dir*138,y);c.stroke();
  }else{
   c.strokeStyle='#9cf2ff';c.lineWidth=3;c.beginPath();c.moveTo(x+dir*18,y);c.lineTo(x+dir*124,y);c.stroke();glow(c,x+dir*124,y,24,'#d8ffff');
  }
  c.restore();
 }
 function render(c,m,stage){
  /* 整帧渲染包裹在 try/catch 内：渲染异常绝不允许冒泡到 requestAnimationFrame，
     否则循环被终止、画面永久卡死（用户看到的现象）。失败时退化为纯背景。 */
  try{
   renderFrame(c,m,stage);
  }catch(err){
   try{
    if(typeof console!=='undefined'&&console.error)console.error('[DV] render failed:',err);
    c.save();c.setTransform&&c.setTransform(1,0,0,1,0,0);
    c.fillStyle='#04060f';c.fillRect(0,0,W,H);
    c.restore();
   }catch(_){}
  }
 }
 function koCamera(m){
  if(m.phase!=='over')return null;
  const t=Math.max(0,m.overFrames||0),loser=m.winner===null?0:1-m.winner;
  const targetSide=t<55?loser:(m.winner===null?1:m.winner);
  const fighter=m.fighters[targetSide];
  const zoom=t<55?1+Math.min(1,t/30)*.62:1.2+Math.min(1,(t-55)/30)*.55;
  const halfW=W/(2*zoom),halfH=H/(2*zoom);
  return {targetSide,zoom,
   centerX:Math.max(halfW,Math.min(W-halfW,fighter.x)),
   centerY:Math.max(halfH,Math.min(H-halfH,F-fighter.y-80))};
 }
 function renderFrame(c,m,stage){
  c.clearRect(0,0,W,H);c.save();
  const ko=koCamera(m);
  if(ko){c.translate(W/2,H/2);c.scale(ko.zoom,ko.zoom);c.translate(-ko.centerX,-ko.centerY);}
  /* 新机制状态（grab/heavy/airL/airH/grabbed/thrown/counter）没有专属贴图，
     统一映射到 18 个既有姿态之一，保证矢量回落时姿态正确。 */
  const posed=f=>{const entry=DV.generatedSpriteManifest?.fighters?.[(f.spec||f).id];if(entry?.actions?.[f.state])return f;const move=DV.moveOf?DV.moveOf(f,f.state):null;const p=(move&&move.pose)||(DV.poseOf?DV.poseOf(f,f.state):f.state);return p===f.state?f:Object.assign({},f,{state:p});};
  if(m.shake>1)c.translate(Math.sin(m.tick*2.1)*m.shake,Math.cos(m.tick*1.7)*m.shake*.4);
  stageArt(c,stage,0,0,W,H,m.tick);
  if(m.fighters.some(f=>f.state==='super'&&f.frame<32)){c.fillStyle='#06122177';c.fillRect(0,0,W,H);}
  for(const f of m.fighters){
   /* 被吸收进体内的对手不再单独绘制（正传：被封在布欧体内，尚未放出） */
   if(f.swallowedBy!==null&&f.swallowedBy!==undefined){
    const h=m.fighters[f.swallowedBy];
    if(h){c.save();c.globalAlpha=.55+.2*Math.sin(m.tick*.25);c.fillStyle='#ffe6a8';
      c.font='700 12px "Microsoft YaHei",sans-serif';c.textAlign='center';
      c.fillText('已吸收 '+f.spec.name,h.x,F-h.y-150);c.restore();}
    continue;
   }
   c.fillStyle='#04141c44';c.beginPath();c.ellipse(f.x,F+4,45*(1-f.y/700),10*(1-f.y/700),0,0,Math.PI*2);c.fill();
   if(f.burstFrames>0||f.state==='charge'||f.state==='burst'||f.state==='transform')aura(c,f,m.tick);
   dashTrail(c,f);
   c.save();if(f.flash>0)c.filter='brightness(2)';
   /* 巨大化／四身拳等体型变化：绘制缩放（正传：比克巨大化、天津饭四身拳） */
   DV.drawFighter(c,posed(f),f.x,F-f.y,1.04*(f.giantFrames>0?(f.giantScale||1):1));
   c.restore();
   statusMarks(c,f,m.tick);
   /* 反击架势：可见的架势环，提示反击窗口 */
   if(f.state==='counter'&&f.counter>0){
    c.save();c.globalAlpha=.4+.22*Math.sin(m.tick*.4);c.strokeStyle='#ffe27a';c.lineWidth=3;
    c.beginPath();c.ellipse(f.x,F-f.y-74,40,74,0,0,Math.PI*2);c.stroke();
    c.globalAlpha=.45;c.setLineDash([6,7]);c.beginPath();c.ellipse(f.x,F-f.y-74,52,88,0,0,Math.PI*2);c.stroke();c.restore();
   }
   /* 被投：挣扎窗口提示 */
   if(f.state==='grabbed'){
    c.save();c.globalAlpha=.5;c.strokeStyle='#ffd98a';c.lineWidth=2;c.setLineDash([4,5]);
    c.beginPath();c.ellipse(f.x,F-f.y-70,34,68,0,0,Math.PI*2);c.stroke();c.restore();
   }
   /* 巨大化：脚下光环提示体型变化生效中 */
   if(f.giantFrames>0){
    c.save();c.globalAlpha=.35+.15*Math.sin(m.tick*.2);c.strokeStyle=f.spec.color;c.lineWidth=3;
    c.beginPath();c.ellipse(f.x,F+4,72*(f.giantScale||1),14*(f.giantScale||1),0,0,Math.PI*2);c.stroke();c.restore();
   }
   /* 吸收强化：持续期间的气焰提示 */
   if(f.absorbPower>0){
    c.save();c.globalAlpha=.28+.12*Math.sin(m.tick*.3);c.strokeStyle='#c8ff8a';c.lineWidth=2;
    c.beginPath();c.ellipse(f.x,F-f.y-74,44,80,0,0,Math.PI*2);c.stroke();c.restore();
   }
   if(f.state==='guard'){c.save();c.globalAlpha=.35;c.strokeStyle='#bdf7ff';c.lineWidth=3;c.beginPath();c.ellipse(f.x+f.facing*28,F-f.y-76,30,64,0,0,Math.PI*2);c.stroke();c.restore();}
   if(f.assistBarrier>0&&f.assistBarrierTicks>0){const pulse=.68+.12*Math.sin(m.tick*.28);c.save();c.globalAlpha=pulse;c.strokeStyle='#8deeff';c.lineWidth=1.8;c.beginPath();c.ellipse(f.x,F-f.y-76,48,82,0,0,Math.PI*2);c.stroke();c.globalAlpha=pulse*.72;c.strokeStyle='#eaffff';c.lineWidth=.8;c.beginPath();c.ellipse(f.x,F-f.y-76,54,90,0,0,Math.PI*2);c.stroke();c.restore();}
   if(f.state==='super'&&f.frame<32){const r=5+f.frame*.6;glow(c,f.x+f.facing*44,F-f.y-80,r*2,f.spec.color);c.fillStyle='#fff';c.beginPath();c.arc(f.x+f.facing*44,F-f.y-80,r*.45,0,Math.PI*2);c.fill();}
   if(m.debugBoxes){for(const [box,color]of [[DV.hurtbox(f),'#53f7ac'],[DV.attackBox(f),'#ff5778']]){if(!box)continue;c.save();c.strokeStyle=color;c.fillStyle=color+'22';c.lineWidth=2;c.fillRect(box.left,F-box.top,box.right-box.left,box.top-box.bottom);c.strokeRect(box.left,F-box.top,box.right-box.left,box.top-box.bottom);c.restore();}}
  }
  for(const a of m.assists){
   const alpha=a.phase==='enter'?Math.min(1,(a.age||0)/8):a.phase==='exit'?Math.max(0,(a.life||0)/12):1;
   c.save();c.globalAlpha=alpha*.9;DV.drawFighter(c,a,a.x,F-(a.y||0),1);c.restore();assistVisual(c,a,m.tick);
  }
  /* 气圆斩类走扁平气刃渲染，其余走光束渲染 */
  for(const p of m.projectiles){
   if(p.kind==='disc')disc(c,p,p.x,F-p.y);
   else beam(c,p.x-p.dir*p.r*2,F-p.y,p.x,p.color,p.r,m.tick);
  }
  for(const b of m.beams)beam(c,b.x,F-b.y,b.end,b.color,24+Math.sin(m.tick)*3,m.tick);
  if(m.clash){const q=m.clash,x=m.clashX(),y=F-(q.left.y+q.right.y)/2;beam(c,q.left.x,F-q.left.y,x,q.left.color,30,m.tick);beam(c,q.right.x,F-q.right.y,x,q.right.color,30,m.tick);glow(c,x,y,105,'#cfffff');c.fillStyle='#fff';c.beginPath();c.ellipse(x,y,20+Math.sin(m.tick)*5,44,0,0,Math.PI*2);c.fill();}
  for(const e of m.effects)drawEffect(c,e);
  for(const e of (m.presentation?.effects||[])){if(e.kind==='hit')hitSpark(c,e);else if(e.kind==='heavy')heavyImpact(c,e);else if(e.kind==='guard')guardShield(c,e);else if(e.kind==='landing')landingDust(c,e);else if(e.kind==='feedback'){c.save();c.globalAlpha=Math.min(1,e.life/12);const y=F-e.y-(e.max-e.life)*.7;c.strokeStyle='#06121f';c.lineWidth=4;c.font='800 15px "Microsoft YaHei",sans-serif';c.textAlign='center';c.strokeText(e.label,e.x,y);text(c,e.label,e.x,y,15,e.color,'center');c.restore();}}
  c.restore();
  const bottom=c.createLinearGradient(0,590,0,H);bottom.addColorStop(0,'#01081400');bottom.addColorStop(1,'#010814cc');c.fillStyle=bottom;c.fillRect(0,590,W,130);
  hud(c,m);
  if(m.debugBoxes){c.fillStyle='#061322df';c.fillRect(350,124,580,62);const f=m.fighters[0];text(c,`P1 ${f.state} · tick ${f.frame} · 预输入 ${f.buffer||'—'} · 距离 ${Math.round(Math.abs(f.x-m.fighters[1].x))}`,640,148,14,'#fff','center');text(c,`绿色：受击框　红色：有效攻击框　${m.lastHit?`${m.lastHit.combo} HIT / ${m.lastHit.total} DAMAGE`:'等待命中'}`,640,172,14,'#b2eadb','center');}
  text(c,stage?.name||'',640,704,12,'#e3ecebcc','center',600);
  if(m.phase==='intro'){
   const fight=m.intro<43;const a=fight?1:Math.min(1,(150-m.intro)/15);c.save();c.globalAlpha=a;
   if(!fight){c.fillStyle='#0613229c';c.fillRect(0,279,W,105);text(c,'ROUND  01',640,346,57,'#e5f8ff','center',900);}else{c.save();c.translate(640,345);c.rotate(-.045);text(c,'FIGHT!',0,0,105,'#ffd35c','center',900);c.restore();}c.restore();
  }
  if(m.clash){
   const q=m.clash;text(c,'BEAM CLASH',640,226,34,'#fff','center',900);text(c,'对波 · 有节奏地连按攻击键',640,254,16,'#c8f6ff','center');
   meter(c,420,272,440,16,.5+q.balance*.5,'#4de3ff');text(c,'J',394,287,20,'#6deaff','center');text(c,m.options.mode==='local'?'1':'CPU',897,287,18,'#ffc774','center');
   text(c,(q.timer/60).toFixed(1)+'s',640,313,15,'#fff','center');
  }
  if(ko){
   const showWinner=(m.overFrames||0)>=55;
   c.save();c.fillStyle='#06101abb';c.fillRect(0,178,W,72);
   text(c,showWinner?(m.winner===null?'DRAW · 平局':`WINNER · ${m.fighters[m.winner].spec.name}`):'K.O. · 战败',640,229,42,showWinner?'#ffe29a':'#fff4e5','center',900);
   c.restore();
  }
  if(m.flash>0){c.fillStyle=`rgba(220,250,255,${m.flash/20})`;c.fillRect(0,0,W,H);}
 }
 Object.assign(DV,{renderBattle:render,stageArt,portrait,resolvePortraitSource,asset,assetReady:ready});
 if(typeof module!=='undefined')module.exports={resolvePortraitSource,koCamera};
})(globalThis);
