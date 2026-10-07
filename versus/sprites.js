/* Dragon Versus — authored cel renderer. Every cached cell belongs to one action.
 * All poses are evaluated from integer fixed-step frame indices, never wall time.
 * No generated sprite sheets are cropped, guessed or interleaved by this module. */
(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};
  const TAU = Math.PI * 2;
  const INK = '#111828';
  const WIDTH = 256, HEIGHT = 224, DENSITY = 2, AX = 104, AY = 208;
  const animations = Object.freeze(Object.fromEntries([
    ['idle',48,true],['run',24,true],['jump',20,false],['fall',20,false],
    ['dash',16,false],['guard',24,true],['punch1',22,false],['punch2',26,false],
    ['kick',30,false],['ki',28,false],['super',72,false],['charge',48,true],
    ['burst',32,false],['assist',36,false],['hit',20,false],['down',48,false],['win',64,false]
  ].map(([name, frames, loop]) => [name, Object.freeze({frames,loop,hold:!loop})])));
  const actionName = action => Object.hasOwn(animations, action) ? action : 'idle';
  const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
  const frameIndex = (action, frame) => clamp(Number.isFinite(frame) ? Math.floor(frame) : 0, 0, animations[action].frames-1);

  class Animation {
    constructor(action = 'idle') { this.action = actionName(action); this.frame = 0; this.done = false; }
    set(action, restart = false) {
      action = actionName(action);
      if (action !== this.action || restart) { this.action = action; this.frame = 0; this.done = false; }
      return this;
    }
    tick() {
      const config = animations[this.action];
      if (this.frame < config.frames-1) this.frame++;
      else if (config.loop) this.frame = 0;
      else this.done = true;
      return this.frame;
    }
  }

  function frameDescriptor(action, frame) {
    action = actionName(action);
    return {action,frame:frameIndex(action,frame),width:WIDTH*DENSITY,height:HEIGHT*DENSITY,
      rect:{x:0,y:0,width:WIDTH*DENSITY,height:HEIGHT*DENSITY},anchor:{x:AX*DENSITY,y:AY*DENSITY},density:DENSITY};
  }

  const BASE = Object.freeze({
    hip:[-3,-57],shoulder:[0,-101],head:[3,-123],
    frontElbow:[30,-78],frontHand:[40,-104],backElbow:[-25,-87],backHand:[-12,-109],
    frontKnee:[15,-31],frontFoot:[25,0],backKnee:[-23,-29],backFoot:[-31,-1],
    lean:0,turn:0,handOpen:0,headTilt:0
  });
  function key(frame, values) { return {frame,values}; }
  // Key poses are deliberately separated from playback. Intermediates are authored
  // joint interpolation, including preparation, contact, overshoot and recovery.
  const tracks = {
    punch1:[key(0,{}),key(4,{shoulder:[-5,-99],frontElbow:[12,-85],frontHand:[-4,-103],backHand:[2,-111],frontKnee:[10,-28]}),
      key(8,{shoulder:[13,-99],hip:[3,-56],head:[18,-121],frontElbow:[48,-102],frontHand:[84,-105],backElbow:[-14,-80],backHand:[-5,-101],frontKnee:[23,-29],frontFoot:[34,0]}),
      key(11,{shoulder:[15,-97],frontElbow:[51,-98],frontHand:[86,-99],backHand:[0,-107],frontKnee:[24,-27]}),key(21,{})],
    punch2:[key(0,{}),key(5,{shoulder:[-9,-92],hip:[-5,-51],head:[-7,-115],frontHand:[1,-72],frontElbow:[-3,-81],backHand:[17,-106],frontKnee:[21,-22]}),
      key(10,{shoulder:[9,-102],head:[10,-125],frontElbow:[33,-112],frontHand:[56,-142],backElbow:[-20,-81],backHand:[-8,-98],hip:[1,-58],frontKnee:[20,-32],frontFoot:[29,-2]}),
      key(14,{shoulder:[8,-107],head:[7,-131],frontElbow:[37,-122],frontHand:[47,-157],backHand:[-4,-104],hip:[1,-62],frontKnee:[17,-34]}),key(25,{})],
    kick:[key(0,{}),key(5,{hip:[-10,-57],shoulder:[-7,-103],head:[-7,-126],frontKnee:[27,-64],frontFoot:[9,-46],frontElbow:[16,-89],frontHand:[29,-113],backHand:[-21,-107]}),
      key(12,{hip:[-7,-60],shoulder:[-27,-94],head:[-29,-119],frontKnee:[39,-73],frontFoot:[84,-84],backKnee:[-26,-30],backFoot:[-30,0],frontElbow:[-8,-73],frontHand:[20,-66],backElbow:[-46,-86],backHand:[-52,-112]}),
      key(15,{hip:[-4,-59],shoulder:[-29,-93],head:[-32,-116],frontKnee:[42,-75],frontFoot:[89,-82],frontHand:[26,-64],backHand:[-55,-109]}),
      key(21,{frontKnee:[32,-54],frontFoot:[28,-37],frontHand:[28,-95],backHand:[-25,-111]}),key(29,{})],
    ki:[key(0,{}),key(5,{shoulder:[-7,-99],head:[-4,-123],frontElbow:[7,-73],frontHand:[-1,-85],backElbow:[-25,-79],backHand:[-32,-84],frontKnee:[11,-27]}),
      key(12,{shoulder:[13,-101],head:[15,-125],frontElbow:[41,-95],frontHand:[67,-98],backElbow:[-17,-81],backHand:[-10,-99],hip:[3,-55],frontKnee:[26,-28],frontFoot:[37,0],handOpen:1}),
      key(17,{shoulder:[9,-101],head:[11,-123],frontElbow:[39,-97],frontHand:[63,-99],frontKnee:[23,-27],handOpen:1}),key(27,{})],
    super:[key(0,{}),key(13,{shoulder:[-10,-95],head:[-7,-120],hip:[-5,-52],frontElbow:[6,-77],frontHand:[-15,-79],backElbow:[-39,-84],backHand:[-24,-81],frontKnee:[22,-22],frontFoot:[38,0],backFoot:[-37,0],handOpen:1}),
      key(27,{shoulder:[-13,-94],head:[-7,-120],hip:[-5,-51],frontElbow:[2,-76],frontHand:[-21,-80],backElbow:[-43,-86],backHand:[-26,-83],frontKnee:[24,-20],frontFoot:[40,0],backFoot:[-39,0],handOpen:1}),
      key(32,{shoulder:[13,-96],head:[15,-120],hip:[3,-52],frontElbow:[43,-85],frontHand:[72,-92],backElbow:[28,-96],backHand:[69,-95],frontKnee:[32,-24],frontFoot:[43,0],backKnee:[-25,-27],backFoot:[-41,0],handOpen:1}),
      key(45,{shoulder:[11,-97],head:[13,-121],hip:[1,-54],frontElbow:[41,-86],frontHand:[71,-92],backElbow:[28,-95],backHand:[68,-95],frontKnee:[31,-25],frontFoot:[43,0],backFoot:[-41,0],handOpen:1}),
      key(59,{shoulder:[14,-96],head:[15,-119],hip:[4,-52],frontElbow:[45,-86],frontHand:[74,-91],backElbow:[30,-94],backHand:[71,-94],frontKnee:[32,-23],frontFoot:[43,0],backFoot:[-41,0],handOpen:1}),key(71,{})],
    burst:[key(0,{}),key(4,{hip:[0,-45],shoulder:[-1,-82],head:[4,-105],frontElbow:[16,-80],frontHand:[5,-108],backElbow:[-13,-80],backHand:[-3,-109],frontKnee:[23,-19],frontFoot:[32,0],backFoot:[-35,0]}),
      key(8,{hip:[0,-61],shoulder:[0,-107],head:[4,-133],frontElbow:[35,-102],frontHand:[54,-129],backElbow:[-34,-103],backHand:[-50,-129],frontKnee:[17,-33],frontFoot:[30,0],backFoot:[-32,0]}),
      key(17,{hip:[0,-58],shoulder:[0,-104],head:[3,-132],frontElbow:[38,-99],frontHand:[59,-115],backElbow:[-39,-99],backHand:[-56,-116],frontKnee:[17,-28],frontFoot:[31,0],backFoot:[-32,0]}),key(31,{})],
    hit:[key(0,{}),key(4,{hip:[-9,-55],shoulder:[-24,-96],head:[-31,-119],frontElbow:[1,-74],frontHand:[20,-88],backElbow:[-45,-93],backHand:[-39,-121],frontKnee:[5,-28],frontFoot:[21,0],backFoot:[-39,0],headTilt:-0.24}),
      key(11,{hip:[-7,-53],shoulder:[-21,-92],head:[-26,-113],frontElbow:[0,-70],frontHand:[15,-83],backHand:[-38,-115],frontKnee:[8,-23],headTilt:-0.14}),key(19,{})],
    down:[key(0,{}),key(10,{hip:[-4,-46],shoulder:[-17,-88],head:[-23,-110],frontElbow:[20,-66],frontHand:[36,-81],backElbow:[-32,-74],backHand:[-39,-95],frontKnee:[12,-28],frontFoot:[31,-7],lean:-0.35}),
      key(22,{hip:[0,-19],shoulder:[-5,-62],head:[-5,-85],frontElbow:[24,-54],frontHand:[38,-72],backElbow:[-24,-57],backHand:[-24,-78],frontKnee:[14,0],frontFoot:[34,8],backFoot:[-23,7],lean:-1.22}),
      key(34,{hip:[0,-11],shoulder:[0,-54],head:[0,-77],frontElbow:[22,-32],frontHand:[25,-48],backElbow:[-18,-34],backHand:[-13,-53],frontKnee:[18,9],frontFoot:[36,10],backKnee:[-13,8],backFoot:[-19,27],lean:-1.48}),
      key(47,{hip:[0,-10],shoulder:[0,-53],head:[0,-76],frontElbow:[23,-31],frontHand:[26,-47],backElbow:[-19,-33],backHand:[-14,-52],frontKnee:[19,10],frontFoot:[37,11],backKnee:[-13,9],backFoot:[-19,28],lean:-1.48})],
    jump:[key(0,{hip:[-2,-49],shoulder:[4,-92],head:[8,-115],frontKnee:[25,-24],frontFoot:[29,0]}),
      key(6,{hip:[-1,-67],shoulder:[3,-110],head:[6,-132],frontKnee:[22,-51],frontFoot:[14,-29],backKnee:[-18,-46],backFoot:[-34,-27],frontElbow:[24,-101],frontHand:[24,-128],backElbow:[-29,-104],backHand:[-27,-131]}),
      key(19,{hip:[-3,-59],shoulder:[2,-102],head:[7,-126],frontKnee:[24,-43],frontFoot:[30,-17],backKnee:[-18,-45],backFoot:[-40,-31],frontHand:[35,-111],backHand:[-21,-114]})],
    fall:[key(0,{hip:[-3,-59],shoulder:[2,-102],head:[7,-126],frontKnee:[24,-43],frontFoot:[30,-17],backKnee:[-18,-45],backFoot:[-40,-31],frontHand:[35,-111],backHand:[-21,-114]}),
      key(19,{hip:[-3,-55],shoulder:[-2,-96],head:[3,-120],frontKnee:[16,-32],frontFoot:[21,-5],backKnee:[-18,-37],backFoot:[-37,-14],frontElbow:[25,-89],frontHand:[41,-107],backElbow:[-26,-91],backHand:[-21,-116]})],
    dash:[key(0,{}),key(5,{hip:[-13,-50],shoulder:[17,-84],head:[31,-103],frontKnee:[21,-27],frontFoot:[44,-13],backKnee:[-45,-40],backFoot:[-68,-24],frontElbow:[-2,-65],frontHand:[-24,-80],backElbow:[-22,-82],backHand:[-48,-86]}),
      key(10,{hip:[-15,-48],shoulder:[19,-82],head:[34,-99],frontKnee:[25,-28],frontFoot:[47,-16],backKnee:[-48,-40],backFoot:[-72,-23],frontElbow:[0,-64],frontHand:[-23,-78],backElbow:[-25,-81],backHand:[-53,-85]}),key(15,{})],
    assist:[key(0,{}),key(8,{shoulder:[1,-103],head:[4,-125],frontElbow:[29,-103],frontHand:[23,-127],backHand:[-15,-95],frontKnee:[12,-32]}),
      key(16,{shoulder:[7,-105],head:[10,-129],frontElbow:[30,-124],frontHand:[58,-149],backHand:[-22,-79],frontKnee:[21,-32],frontFoot:[29,0],handOpen:1}),
      key(23,{frontElbow:[36,-119],frontHand:[65,-140],backHand:[-17,-89],frontKnee:[18,-30],handOpen:1}),key(35,{})],
    win:[key(0,{}),key(20,{hip:[-2,-64],shoulder:[0,-108],head:[2,-132],frontKnee:[14,-34],frontFoot:[19,0],backKnee:[-15,-33],backFoot:[-20,0],frontElbow:[31,-110],frontHand:[27,-143],backElbow:[-25,-83],backHand:[-13,-69]}),
      key(38,{hip:[-2,-64],shoulder:[0,-109],head:[3,-134],frontKnee:[14,-34],frontFoot:[19,0],backKnee:[-15,-33],backFoot:[-20,0],frontElbow:[28,-127],frontHand:[31,-157],backElbow:[-25,-83],backHand:[-13,-69],handOpen:1}),
      key(63,{hip:[-2,-63],shoulder:[0,-108],head:[3,-133],frontKnee:[14,-34],frontFoot:[19,0],backKnee:[-15,-33],backFoot:[-20,0],frontElbow:[28,-126],frontHand:[31,-156],backElbow:[-25,-82],backHand:[-13,-68],handOpen:1})]
  };
  function clonePose(values) {
    const p = {};
    for (const name in BASE) { const value = values[name] === undefined ? BASE[name] : values[name]; p[name] = Array.isArray(value) ? value.slice() : value; }
    return p;
  }
  function samplePose(action, frame) {
    action = actionName(action); frame = frameIndex(action,frame);
    const phase = frame / animations[action].frames * TAU;
    let p;
    if (tracks[action]) {
      const keys = tracks[action]; let a = keys[0], b = keys[keys.length-1];
      for (let i=1;i<keys.length;i++) if(frame<=keys[i].frame){a=keys[i-1];b=keys[i];break;}
      let t=clamp((frame-a.frame)/(b.frame-a.frame||1),0,1);t=t*t*(3-2*t);
      const pa=clonePose(a.values),pb=clonePose(b.values);p={};
      for(const name in BASE) p[name]=Array.isArray(pa[name])?pa[name].map((v,i)=>v+(pb[name][i]-v)*t):pa[name]+(pb[name]-pa[name])*t;
    } else {
      p=clonePose({});
      if(action==='run'){
        const s=Math.sin(phase),c=Math.cos(phase),bounce=Math.cos(phase*2)*2;
        p.hip=[-6,-57+bounce];p.shoulder=[10,-99+bounce];p.head=[16,-121+bounce];
        p.frontKnee=[s*31,-28-Math.max(0,-c)*15];p.frontFoot=[s*43,-3-Math.max(0,-c)*27];
        p.backKnee=[-s*31,-28-Math.max(0,c)*15];p.backFoot=[-s*43,-3-Math.max(0,c)*27];
        p.frontElbow=[13-s*27,-77+bounce];p.frontHand=[27-s*42,-99+bounce+s*9];
        p.backElbow=[3+s*26,-81+bounce];p.backHand=[14+s*39,-105+bounce-s*8];
      }else if(action==='guard'){
        const b=Math.sin(phase)*1.3;
        p=clonePose({hip:[-4,-52],shoulder:[-8,-96+b],head:[-3,-118+b],frontElbow:[13,-87+b],frontHand:[16,-121+b],backElbow:[-9,-94+b],backHand:[6,-122+b],frontKnee:[19,-24],frontFoot:[28,0],backKnee:[-24,-25]});
      }else if(action==='charge'){
        const b=Math.sin(phase)*1.4;
        p=clonePose({hip:[-2,-53+b*.3],shoulder:[0,-97+b],head:[4,-124+b],frontElbow:[28,-80+b],frontHand:[30,-59+b],backElbow:[-28,-82+b],backHand:[-29,-63+b],frontKnee:[23,-25],frontFoot:[34,0],backKnee:[-27,-26],backFoot:[-36,0]});
      }else{
        const b=Math.sin(phase)*1.6;
        for(const name of ['hip','shoulder','head','frontElbow','frontHand','backElbow','backHand'])p[name][1]+=b;
        p.frontHand[0]+=Math.sin(phase+.5)*1.4;p.backHand[0]-=Math.sin(phase+.5);
        p.frontKnee[0]+=Math.sin(phase)*.6;p.backKnee[0]-=Math.sin(phase)*.6;
      }
    }
    return p;
  }

  const tintCache=new Map();
  function tint(hex, amount){
    const key=hex+':'+amount;if(tintCache.has(key))return tintCache.get(key);
    let clean=String(hex||'#75859c').replace('#','');if(clean.length===3)clean=clean.split('').map(c=>c+c).join('');
    if(!/^[\da-f]{6}$/i.test(clean))clean='75859c';
    const n=parseInt(clean,16),target=amount>0?255:0,a=Math.abs(amount);
    const channels=[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v+(target-v)*a));
    const value='#'+channels.map(v=>v.toString(16).padStart(2,'0')).join('');tintCache.set(key,value);return value;
  }
  function poly(ctx,points,fill,stroke=INK,width=1.65){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke&&width){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}
  }
  function line(ctx,points,color=INK,width=1.2){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function ellipse(ctx,x,y,rx,ry,color,stroke=INK,width=1.5){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  const shifted=(point,x,y)=>[point[0]+x,point[1]+y];
  function segment(ctx,a,b,r1,r2,color,shadow=0.24){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    const pts=[[a[0]+nx*r1,a[1]+ny*r1],[b[0]+nx*r2,b[1]+ny*r2],[b[0]+dx/length*r2*.38,b[1]+dy/length*r2*.38],[b[0]-nx*r2,b[1]-ny*r2],[a[0]-nx*r1,a[1]-ny*r1]];
    poly(ctx,pts,color);
    poly(ctx,[[a[0]-nx*r1*.1,a[1]-ny*r1*.1],pts[3],pts[4]],tint(color,-shadow),null);
    line(ctx,[[a[0]+nx*r1*.53,a[1]+ny*r1*.53],[b[0]+nx*r2*.5,b[1]+ny*r2*.5]],tint(color,.25),Math.max(1,r2*.22));
  }
  function hand(ctx,point,spec,open,back){
    const color=spec.gloves||(((spec.armor&&!['cell','frost','dragon'].includes(spec.species))||spec.species==='majin')?'#edeff1':spec.skin),x=point[0],y=point[1];
    poly(ctx,[[x-5,y-5],[x+2,y-7],[x+7,y-3],[x+7,y+3],[x+2,y+6],[x-5,y+3]],back?tint(color,-.15):color);
    if(open>.6){poly(ctx,[[x+2,y-5],[x+6,y-12],[x+9,y-11],[x+8,y-3],[x+12,y-8],[x+14,y-6],[x+10,y+1],[x+6,y+4]],color);}
    line(ctx,[[x-2,y-3],[x+2,y-2],[x+3,y+1]],tint(color,-.42),.85);
    line(ctx,[[x+3,y-3],[x+5,y-2]],tint(color,-.4),.75);
  }
  function boot(ctx,foot,spec,back){
    const color=spec.boots||((spec.armor||spec.species==='majin')?'#f1f0e8':spec.species==='frost'?spec.skin:spec.accent);
    poly(ctx,[[foot[0]-7,foot[1]-13],[foot[0]+5,foot[1]-12],[foot[0]+7,foot[1]-5],[foot[0]+17,foot[1]-2],[foot[0]+17,foot[1]+3],[foot[0]-7,foot[1]+3]],back?tint(color,-.2):color);
    line(ctx,[[foot[0]-6,foot[1]-10],[foot[0]+5,foot[1]-9]],spec.armor?'#dec179':tint(color,.48),2.4);
    line(ctx,[[foot[0]-5,foot[1]+2],[foot[0]+16,foot[1]+2]],INK,1.5);
    line(ctx,[[foot[0]+6,foot[1]-4],[foot[0]+13,foot[1]-2]],tint(color,.5),1.2);
  }
  function leg(ctx,hip,knee,foot,spec,back){
    const bulk=spec.silhouette==='heavy'?1.27:1,pants=spec.pants||((spec.species==='frost'||spec.species==='cell')?spec.skin:spec.outfit);
    const base=back?tint(pants,-.2):pants;
    segment(ctx,hip,knee,11.5*bulk,8.7*bulk,base);segment(ctx,knee,shifted(foot,0,-9),8.8*bulk,5.9,base);
    line(ctx,[shifted(knee,-6,-3),shifted(knee,4,1),shifted(knee,1,7)],tint(pants,-.4),1);
    line(ctx,[shifted(hip,3,9),shifted(knee,2,-5)],tint(pants,.2),1.5);
    if(spec.species==='cell')cellSpots(ctx,knee[0],knee[1]-8,8,18,back?9:4);
    if(spec.species==='frost'){ellipse(ctx,knee[0],knee[1]-1,6.5,7,spec.accent,INK,1.1);}
    boot(ctx,foot,spec,back);
  }
  function arm(ctx,shoulder,elbow,wrist,spec,back,open){
    const bulk=spec.silhouette==='heavy'?1.3:spec.silhouette==='slim'?.77:1;
    const sleeves=spec.sleeves||(['android','angel','demon'].includes(spec.species)&&!spec.armor)||['trunks','future-trunks','android17','android18','goku-black','zamasu','hit','whis'].includes(spec.characterId);
    const color=sleeves?spec.outfit:spec.skin,shade=back?.18:0;
    segment(ctx,shoulder,elbow,8.5*bulk,7*bulk,tint(color,-shade));
    ellipse(ctx,elbow[0],elbow[1],6.8*bulk,6.7*bulk,tint(color,-shade),null);
    segment(ctx,elbow,wrist,7.1*bulk,4.2,tint(color,-shade));
    line(ctx,[shifted(shoulder,0,7),shifted(elbow,-3,-5),shifted(elbow,2,-2)],tint(color,-.4),1.1);
    if(spec.species==='namekian'){
      ellipse(ctx,(shoulder[0]+elbow[0])*.5,(shoulder[1]+elbow[1])*.5,4,7,'#db9095',INK,.7);
      for(let i=-3;i<=3;i+=3)line(ctx,[[(shoulder[0]+elbow[0])*.5-3,(shoulder[1]+elbow[1])*.5+i],[(shoulder[0]+elbow[0])*.5+3,(shoulder[1]+elbow[1])*.5+i]],'#873d60',.65);
    }
    if(spec.species==='cell')cellSpots(ctx,elbow[0],elbow[1],5,10,7);
    if(spec.armor&&!['cell','frost','dragon'].includes(spec.species))ellipse(ctx,shoulder[0],shoulder[1],10,7,'#ede9da',INK,1.2);
    else if(!sleeves&&spec.species!=='frost')segment(ctx,shifted(wrist,(elbow[0]-wrist[0])*.18,(elbow[1]-wrist[1])*.18),wrist,5,4.5,spec.accent);
    hand(ctx,wrist,spec,open,back);
  }
  function cellSpots(ctx,x,y,w,h,seed){
    for(let i=0;i<8;i++){const px=x+Math.sin(i*7+seed)*w,py=y+Math.cos(i*4+seed)*h;poly(ctx,[[px-1.7,py-2],[px+2,py-.8],[px+1,py+2],[px-2,py+1]],'#223b38',null);}
  }
  function tail(ctx,p,spec,phase){
    if(!spec.tail)return;
    const x=p.hip[0],y=p.hip[1],frost=spec.species==='frost',cell=spec.species==='cell';
    ctx.beginPath();ctx.moveTo(x-8,y+3);ctx.bezierCurveTo(x-55,y+18,x-78,y+Math.sin(phase)*7-24,x-54,y-41+Math.sin(phase)*9);
    ctx.strokeStyle=INK;ctx.lineWidth=frost?14:cell?10:8;ctx.lineCap='round';ctx.stroke();ctx.strokeStyle=(frost||cell||['god','majin','demon'].includes(spec.species))?spec.skin:'#8a4730';ctx.lineWidth=frost?10:cell?6:4.6;ctx.stroke();
    if(cell)poly(ctx,[[x-57,y-39],[x-51,y-39],[x-55,y-52]],'#dca876');
    else if(frost){ctx.beginPath();ctx.moveTo(x-13,y+2);ctx.bezierCurveTo(x-51,y+13,x-71,y-15,x-55,y-36);ctx.strokeStyle=tint(spec.skin,.45);ctx.lineWidth=2;ctx.stroke();}
  }
  function cape(ctx,p,spec,phase){
    if(!spec.cape)return;
    const sx=p.shoulder[0],sy=p.shoulder[1],wave=Math.sin(phase)*4;
    poly(ctx,[[sx-20,sy-5],[sx+9,sy-5],[sx-5,sy+24],[sx-5,sy+80],[sx-29,sy+94],[sx-61-wave,sy+81],[sx-48-wave,sy+55]],spec.species==='namekian'?'#eceee8':spec.capeColor||'#f0efde');
    poly(ctx,[[sx-18,sy+6],[sx-26,sy+72],[sx-52-wave,sy+81],[sx-39,sy+46]],'#a7b7bc',null);
    line(ctx,[[sx-12,sy+12],[sx-14,sy+57],[sx-22,sy+85]],'#758a96',1.5);
  }

  function torso(ctx,p,spec){
    const h=p.hip,s=p.shoulder,heavy=spec.silhouette==='heavy',slim=spec.silhouette==='slim',bulk=heavy?1.27:slim?.75:1;
    const width=19*bulk,waist=13*bulk,col=spec.chest||((spec.species==='frost'||spec.species==='cell'||spec.species==='majin')?spec.skin:spec.outfit);
    if(spec.species==='majin'&&heavy){
      ellipse(ctx,h[0],h[1]-14,27,31,spec.skin);poly(ctx,[[s[0]-20,s[1]-2],[s[0]-6,s[1]+8],[h[0]-20,h[1]-10],[h[0]-29,h[1]-21]],'#302c42');poly(ctx,[[s[0]+6,s[1]-2],[s[0]+21,s[1]+5],[h[0]+27,h[1]-20],[h[0]+16,h[1]-10]],'#302c42');
      ellipse(ctx,h[0]+2,h[1]-11,1.7,2.1,'#ae5d8b',null);
    }else{
      poly(ctx,[[s[0]-width,s[1]-3],[s[0]+width,s[1]+1],[s[0]+width+1,s[1]+15],[h[0]+waist,h[1]+6],[h[0]-waist,h[1]+6],[s[0]-width-2,s[1]+12]],col);
      poly(ctx,[[s[0]-width,s[1]-1],[s[0]-6,s[1]+14],[h[0]-2,h[1]+3],[h[0]-waist,h[1]+4],[s[0]-width-2,s[1]+12]],tint(col,-.32),null);
      poly(ctx,[[s[0]+4,s[1]+8],[s[0]+width-4,s[1]+5],[h[0]+waist-2,h[1]-7],[h[0]+3,h[1]-4]],tint(col,.18),null);
      line(ctx,[[s[0]+4,s[1]+21],[s[0]+12,s[1]+18],[s[0]+16,s[1]+21]],tint(col,-.4),1);
      line(ctx,[[h[0]-7,h[1]-13],[h[0]+6,h[1]-17],[h[0]+11,h[1]-13]],tint(col,-.35),1.1);
    }
    if(spec.armor&&!['cell','frost','dragon'].includes(spec.species)){
      poly(ctx,[[s[0]-20,s[1]-2],[s[0]-8,s[1]+4],[s[0]+8,s[1]+4],[s[0]+19,s[1]],[s[0]+16,s[1]+23],[h[0]+12,h[1]-4],[h[0]-11,h[1]-4],[s[0]-18,s[1]+22]],'#e8e9df');
      poly(ctx,[[s[0]-15,s[1]+19],[s[0]+15,s[1]+21],[h[0]+11,h[1]-4],[h[0]-11,h[1]-4]],'#bda76b');
      for(let i=0;i<3;i++)line(ctx,[[s[0]-14+i,s[1]+24+i*5],[s[0]+14-i,s[1]+25+i*5]],'#726244',1);
      poly(ctx,[[s[0]-18,s[1]+1],[s[0]-11,s[1]+8],[s[0]-10,s[1]+21],[s[0]-17,s[1]+19]],'#a0b2ba',null);
      line(ctx,[[s[0]-5,s[1]+6],[s[0]+10,s[1]+6]],'#ffffff',2.5);
    }else if(spec.species==='cell'){
      poly(ctx,[[s[0]-15,s[1]+7],[s[0]-1,s[1]+14],[s[0]+15,s[1]+8],[s[0]+12,s[1]+30],[h[0],h[1]-4],[s[0]-12,s[1]+30]],'#263c3d');
      for(let i=0;i<4;i++)line(ctx,[[s[0]-10,s[1]+18+i*5],[s[0]+10,s[1]+18+i*5]],'#819986',1.2);
      cellSpots(ctx,s[0]-17,s[1]+7,5,10,3);cellSpots(ctx,s[0]+15,s[1]+9,4,11,4);
    }else if(spec.species==='frost'){
      ellipse(ctx,s[0]+1,s[1]+12,12,10,spec.accent);line(ctx,[[s[0]-8,s[1]+9],[s[0],s[1]+6],[s[0]+7,s[1]+8]],tint(spec.accent,.5),2);
      for(let i=0;i<3;i++)line(ctx,[[h[0]-9,h[1]-15+i*4],[h[0]+8,h[1]-16+i*4]],tint(spec.skin,-.35),.8);
    }else if(spec.species==='dragon'){
      poly(ctx,[[s[0]-19,s[1]-3],[s[0]-34,s[1]-18],[s[0]-28,s[1]+9],[s[0]-19,s[1]+12]],'#2b3441');
      poly(ctx,[[s[0]+17,s[1]-2],[s[0]+32,s[1]-20],[s[0]+29,s[1]+9],[s[0]+18,s[1]+12]],'#2b3441');
      for(let i=0;i<7;i++){const angle=i/7*TAU,x=s[0]+Math.cos(angle)*11,y=s[1]+22+Math.sin(angle)*13;ellipse(ctx,x,y,4,4,'#d77d4c',INK,.8);ellipse(ctx,x+.5,y-.5,1,1,'#ae3031',null);}
    }else if(spec.species==='angel'||spec.characterId==='beerus'){
      poly(ctx,[[s[0]-18,s[1]-2],[s[0]+18,s[1]-1],[s[0]+10,s[1]+25],[s[0],s[1]+31],[s[0]-12,s[1]+24]],'#20262d');
      poly(ctx,[[s[0]-16,s[1]],[s[0]+16,s[1]],[s[0]+10,s[1]+22],[s[0],s[1]+28],[s[0]-10,s[1]+22]],null,'#e7c16b',2);
      poly(ctx,[[s[0],s[1]+7],[s[0]+5,s[1]+15],[s[0],s[1]+22],[s[0]-5,s[1]+15]],'#77c9e8',null);
    }else if(spec.vest||spec.characterId==='gotenks'){
      poly(ctx,[[s[0]-11,s[1]-4],[s[0]+10,s[1]-3],[s[0]+12,s[1]+26],[h[0]+8,h[1]-5],[h[0]-7,h[1]-4],[s[0]-12,s[1]+25]],spec.skin);
      poly(ctx,[[s[0]-20,s[1]-4],[s[0]-10,s[1]-6],[s[0]-7,s[1]+25],[s[0]-18,s[1]+28]],'#263448');
      poly(ctx,[[s[0]+9,s[1]-6],[s[0]+20,s[1]-2],[s[0]+17,s[1]+28],[s[0]+9,s[1]+25]],'#263448');
      line(ctx,[[s[0]-18,s[1]-3],[s[0]-13,s[1]+4]],'#eec577',5);line(ctx,[[s[0]+12,s[1]-3],[s[0]+18,s[1]+2]],'#eec577',5);
    }else if(!['majin','dragon','demon'].includes(spec.species)&&!spec.chest){
      poly(ctx,[[s[0]-10,s[1]-4],[s[0]+11,s[1]-3],[s[0]+1,s[1]+17]],spec.skin);
      line(ctx,[[s[0]-12,s[1]-4],[s[0]+1,s[1]+19],[s[0]+14,s[1]-1]],spec.accent,4.5);
      if(['goku','gohan','krillin','yamcha','goten','roshi'].some(id=>spec.characterId.includes(id))){
        ellipse(ctx,s[0]+11,s[1]+13,6,6,'#f6eddb',INK,.75);ctx.save();ctx.fillStyle=INK;ctx.font='bold 8px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(spec.characterId.includes('goku')?'悟':'亀',s[0]+11,s[1]+13);ctx.restore();
      }
    }
    const belt=spec.species==='majin'?'#dab961':spec.accent;
    poly(ctx,[[h[0]-waist-2,h[1]-5],[h[0]+waist+2,h[1]-4],[h[0]+waist,h[1]+4],[h[0]-waist,h[1]+4]],belt);
    line(ctx,[[h[0]-waist,h[1]-2],[h[0]+waist,h[1]-1]],tint(belt,.35),1.1);
    if(spec.species==='majin'){ctx.save();ctx.font='bold 9px serif';ctx.fillStyle=INK;ctx.textAlign='center';ctx.fillText('M',h[0],h[1]+3);ctx.restore();}
    else if(!spec.armor&&!['frost','cell','angel'].includes(spec.species)){
      poly(ctx,[[h[0]+3,h[1]],[h[0]+8,h[1]+1],[h[0]+15,h[1]+20],[h[0]+8,h[1]+16]],belt);
      poly(ctx,[[h[0]+4,h[1]+2],[h[0]+7,h[1]+7],[h[0]-1,h[1]+19],[h[0]-4,h[1]+17]],tint(belt,-.2));
    }
    if(spec.sword){line(ctx,[[s[0]-29,s[1]-17],[h[0]+28,h[1]+18]],'#182334',7);line(ctx,[[s[0]-28,s[1]-16],[s[0]-13,s[1]+2]],'#899caf',4);line(ctx,[[s[0]-21,s[1]+2],[s[0]-7,s[1]-9]],'#d9c48f',3);}
  }

  function hairShape(ctx,spec,back=false){
    const id=spec.characterId,head=spec.head,hair=spec.hair,light=tint(hair,.23);
    if(head==='bald'||head==='helmet'||head==='antenna'||spec.species==='frost'||(spec.species==='majin'&&id!=='android21')||spec.species==='cell'||spec.species==='namekian'||id==='beerus')return;
    const ss3=/ssj?3|super.?saiyan.?3|超[级級]?赛[亚亞]人3|超三/i.test(spec.id+' '+spec.form),ss4=/ssj?4|超四|超级赛亚人4/i.test(spec.id+' '+spec.form);
    if(back&&(spec.longHair||head==='long'||ss3||ss4)){
      poly(ctx,[[-12,-12],[-21,2],[-29,16],[-25,11],[-28,34],[-18,25],[-18,44],[-5,32],[5,39],[14,24],[12,10],[17,-10]],hair);
      line(ctx,[[-10,-9],[-17,15],[-15,30]],light,2);line(ctx,[[1,-8],[6,17],[5,29]],light,1.6);return;
    }
    if(back)return;
    let points;
    if(id==='hercule')points=[[-14,9],[-21,3],[-18,-3],[-24,-9],[-21,-17],[-15,-17],[-16,-24],[-8,-28],[-3,-25],[2,-29],[10,-26],[11,-22],[18,-21],[22,-14],[17,-6],[18,3],[12,10],[9,-7],[1,-12],[-6,-6],[-10,7]];
    else if(head==='round')points=[[-14,5],[-17,-4],[-15,-15],[-8,-21],[2,-24],[13,-19],[18,-10],[16,-3],[9,-8],[4,-6],[-1,-9],[-8,-6],[-9,7]];
    else if(head==='bob'||id.includes('18'))points=[[-12,10],[-17,-2],[-14,-16],[-5,-22],[9,-22],[18,-15],[17,15],[12,20],[9,-9],[3,-13],[-3,-10],[-7,11]];
    else if(head==='long'&&!ss3&&!ss4)points=[[-12,10],[-16,-8],[-11,-22],[3,-26],[14,-17],[16,-2],[11,15],[8,-10],[2,-15],[-4,-7],[-7,8]];
    else if(id.includes('trunks')&&!/ss|超/.test(spec.id+' '+spec.form))points=[[-13,8],[-17,-8],[-10,-22],[5,-24],[18,-17],[17,1],[10,11],[7,-11],[0,-14],[-5,-4],[-10,6]];
    else if(head==='mohawk')points=[[-9,-8],[-9,-25],[-3,-22],[-1,-35],[7,-31],[11,-18],[12,-6],[3,-11]];
    else if(id.includes('vegeta')||id==='cabba')points=[[-12,1],[-18,-15],[-20,-32],[-12,-28],[-11,-40],[-4,-35],[1,-45],[7,-32],[15,-36],[16,-23],[21,-18],[16,-1],[9,-10],[2,-6],[-5,-12]];
    else if(spec.species==='angel')points=[[-12,-7],[-11,-22],[-16,-39],[-12,-53],[-1,-59],[9,-54],[14,-40],[10,-24],[13,-12],[7,-10],[2,-17],[-5,-13]];
    else if(head==='swept')points=[[-13,2],[-18,-13],[-15,-23],[-23,-27],[-11,-29],[-13,-39],[1,-30],[9,-32],[17,-19],[15,-5],[7,-12],[0,-8],[-5,-15]];
    else if(ss3)points=[[-13,-3],[-20,-16],[-24,-34],[-12,-29],[-13,-42],[-2,-33],[3,-41],[14,-30],[21,-16],[17,-2],[7,-11],[0,-7],[-6,-13]];
    else points=[[-13,5],[-19,-3],[-29,-8],[-18,-12],[-28,-20],[-13,-19],[-20,-34],[-5,-26],[-4,-42],[6,-29],[16,-36],[16,-24],[27,-23],[18,-13],[23,-7],[14,-4],[9,-13],[3,-3],[-2,-12],[-7,-4]];
    poly(ctx,points,hair,INK,1.9);
    if(head==='bob'||head==='long'){line(ctx,[[-9,-14],[-12,-2],[-11,10]],light,2.3);line(ctx,[[11,-13],[13,0],[13,13]],light,2);}
    else{line(ctx,[[-10,-16],[-5,-23],[-4,-15]],light,2.2);line(ctx,[[3,-25],[6,-16],[10,-19]],light,1.7);if(spec.species==='angel')line(ctx,[[-5,-46],[3,-48],[7,-37],[5,-25]],'#ffffff',2);}
  }
  function head(ctx,p,spec,portrait=false){
    ctx.save();ctx.translate(p.head[0],p.head[1]);ctx.rotate(p.headTilt||0);
    const juvenile=spec.silhouette==='small';if(juvenile)ctx.scale(1.14,1.1);
    const skin=spec.skin,id=spec.characterId,sp=spec.species;
    hairShape(ctx,spec,true);
    segment(ctx,[0,18],[0,8],5.5,6,skin);
    if(id==='beerus'||spec.ears){
      poly(ctx,[[-11,-5],[-15,-43],[-8,-46],[-1,-11]],skin);poly(ctx,[[6,-11],[13,-47],[19,-41],[16,-2]],skin);
      poly(ctx,[[-10,-13],[-12,-36],[-8,-34],[-4,-12]],'#bd80b2',null);poly(ctx,[[10,-11],[14,-35],[16,-34],[14,-10]],'#bd80b2',null);
    }
    if(sp==='cell'){
      poly(ctx,[[-17,8],[-19,-17],[-24,-42],[-13,-39],[-3,-18],[4,-19],[17,-42],[25,-40],[19,-14],[18,10],[10,17],[-8,17]],skin);
      poly(ctx,[[-15,-14],[-5,-23],[7,-23],[16,-13],[13,4],[-11,4]],'#273c3b');
      cellSpots(ctx,-17,-23,4,12,1);cellSpots(ctx,17,-24,4,12,9);
    }
    if(sp==='majin'&&id!=='android21'){
      ctx.beginPath();ctx.moveTo(-5,-9);ctx.bezierCurveTo(-8,-27,15,-27,13,-44);ctx.bezierCurveTo(26,-26,8,-21,7,-10);ctx.closePath();ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=1.6;ctx.stroke();
    }
    const heavy=spec.silhouette==='heavy'&&sp==='majin',w=heavy?17:13;
    poly(ctx,[[-w,-10],[-8,-18],[4,-19],[w,-13],[w+2,-4],[w+5,0],[w+2,3],[w+1,11],[6,19],[-2,19],[-11,12],[-w,2]],skin);
    poly(ctx,[[-w,-7],[-7,-11],[-5,4],[-1,14],[6,19],[-2,19],[-11,12],[-w,2]],tint(skin,-.26),null);
    poly(ctx,[[3,-13],[10,-10],[12,-2],[8,0],[9,11],[4,14],[-1,9]],tint(skin,.15),null);
    if(spec.horns&&!['cell','frost'].includes(sp)){
      poly(ctx,[[-10,-11],[-17,-24],[-15,-37],[-8,-20],[-3,-15]],sp==='dragon'?'#273541':tint(skin,-.15));
      poly(ctx,[[7,-15],[13,-34],[17,-29],[16,-13],[12,-9]],sp==='dragon'?'#273541':tint(skin,-.15));
    }
    if(sp==='frost'){
      ellipse(ctx,0,-14,11,8,spec.accent,INK,1.1);line(ctx,[[-6,-17],[1,-19],[6,-17]],tint(spec.accent,.5),1.5);
      for(let i=0;i<3;i++)line(ctx,[[-11,5+i*3],[-6,7+i*3]],tint(skin,-.48),.8);
      if(spec.horns){poly(ctx,[[-12,-10],[-28,-20],[-28,-29],[-19,-19],[-10,-17]],'#f4efdb');poly(ctx,[[12,-13],[24,-27],[27,-29],[27,-20],[15,-8]],'#f4efdb');}
    }
    if(sp==='namekian'){
      poly(ctx,[[-10,0],[-26,-7],[-18,8],[-10,10]],skin);poly(ctx,[[12,0],[25,-6],[18,9],[12,10]],skin);
      line(ctx,[[-20,-2],[-14,5]],tint(skin,-.4),1);
      line(ctx,[[-6,-14],[-12,-27],[-20,-28]],skin,3);line(ctx,[[5,-16],[11,-28],[18,-29]],skin,3);
      line(ctx,[[-5,12],[2,14],[7,12]],tint(skin,-.4),.85);
    }else if(!['cell','frost','majin'].includes(sp))ellipse(ctx,-12,3,4.3,5.5,skin,INK,1.2);
    // Broad, angular Dragon Ball eyes: lid, white, dark pupil, brow, cheek mark.
    const eyes=heavy?[[-6,3],[8,3]]:[[-4,1],[9,0]];
    for(let i=0;i<eyes.length;i++){
      const [x,y]=eyes[i];poly(ctx,[[x-5,y-3],[x+4,y-1],[x+3,y+3],[x-4,y+2]],'#f3f5ed',INK,.65);
      const iris=(sp==='frost'||sp==='majin'||sp==='cell')?'#b02d48':/blue|蓝|ssg|god/.test(spec.id)?'#168bac':spec.hair!=='#151b2a'&&/^#f|^#e/.test(spec.hair)?'#329a83':'#18232d';
      ellipse(ctx,x+2,y+.3,1.2,2.15,iris,null);line(ctx,[[x-5,y-5],[x+4,y-2]],spec.hair==='#ffffff'?'#929aaa':INK,1.8);
    }
    line(ctx,[[10,4],[13,7],[8,8]],tint(skin,-.58),.85);
    line(ctx,[[3,12],[9,12],[11,10]],INK,.9);
    line(ctx,[[-5,7],[-2,9]],tint(skin,-.45),.7);
    if(id==='jiren'){
      ellipse(ctx,-5,1,5.5,7,'#152030',null);ellipse(ctx,9,0,4.5,6.5,'#152030',null);line(ctx,[[-8,-3],[-5,-4]],'#cdd2df',1);line(ctx,[[7,-4],[10,-4]],'#cdd2df',1);
    }
    if(id==='chiaotzu'){ellipse(ctx,-8,8,3,2.3,'#c53743',null);ellipse(ctx,12,7,2,2,'#c53743',null);}
    if(spec.scar){line(ctx,[[-6,4],[-3,9],[-5,13]],'#9b5549',.9);line(ctx,[[-7,7],[-3,6]],'#9b5549',.8);}
    if(id==='baby'){poly(ctx,[[-13,-4],[-7,5],[-8,11],[-12,5]],'#b53848',null);poly(ctx,[[11,-5],[15,1],[13,10],[10,4]],'#b53848',null);}
    if(spec.earrings){ellipse(ctx,-13,11,2.2,2.8,'#e7c86c',INK,.7);ellipse(ctx,14,11,1.5,2.3,'#e7c86c',INK,.7);}
    if(spec.mark){ctx.save();ctx.fillStyle=INK;ctx.font='bold 7px serif';ctx.fillText(spec.mark,-2,-8);ctx.restore();}
    if(sp==='majin'){for(const [x,y]of[[-10,-6],[-3,-13],[8,-11],[-11,7]])ellipse(ctx,x,y,1,1.6,'#9e496f',null);}
    if(id==='krillin'||id==='tien'){for(let i=0;i<6;i++)ellipse(ctx,-4+(i%3)*4,-10+Math.floor(i/3)*4,.85,.85,'#985c37',null);if(id==='tien')ellipse(ctx,1,-9,3,2,'#f7e9d2',INK,.75);}
    if(spec.beard||id==='roshi'){
      if(id==='roshi'){poly(ctx,[[-8,10],[-6,20],[-2,23],[1,32],[6,24],[12,22],[14,10],[6,16],[0,15]],'#e8ebe6');line(ctx,[[0,20],[2,26]],'#82929a',1);}
      else if(id==='dabura'){poly(ctx,[[-3,15],[1,28],[6,23],[9,14],[3,17]],spec.hair);}
      else poly(ctx,[[-6,10],[-2,8],[3,10],[7,8],[12,10],[12,14],[5,13],[1,14],[-6,14]],spec.hair);
    }
    if(spec.glasses||id==='roshi'){poly(ctx,[[-11,-1],[-1,0],[0,7],[-9,6]],'#1b2538','#4d626f',1);poly(ctx,[[3,0],[13,-1],[13,6],[4,7]],'#1b2538','#4d626f',1);line(ctx,[[0,2],[3,2]],'#bdc2bf',1.4);line(ctx,[[-8,1],[-4,2]],'#70c0eb',1.2);}
    hairShape(ctx,spec,false);
    if(spec.hat){poly(ctx,[[-16,-5],[-14,-20],[4,-26],[16,-18],[18,-7]],spec.hatColor||spec.outfit);poly(ctx,[[-16,-6],[18,-8],[23,-4],[4,-1],[-16,-2]],spec.accent);}
    if(spec.cape&&sp==='namekian'){
      poly(ctx,[[-15,-7],[-15,-18],[-7,-25],[8,-23],[15,-16],[17,-7]],'#f2efe0');
      for(let i=0;i<3;i++)line(ctx,[[-13,-16+i*4],[-1,-13+i*3],[13,-15+i*4]],'#acbcb7',1.2);
    }
    if(id==='bardock')line(ctx,[[-13,-7],[-1,-5],[13,-7]],'#b3373c',3.5);
    if(spec.scouter){poly(ctx,[[-15,-2],[-1,-3],[1,5],[-12,7]],'#b7498ba8','#e7ecdf',1.3);poly(ctx,[[-17,-3],[-13,-2],[-13,9],[-17,8]],'#e3e8d9');line(ctx,[[-12,0],[-4,0]],'#f99de0',.85);}
    if(id==='android19'||id==='dr-gero'){ctx.fillStyle='#b62832';ctx.font='bold 5px sans-serif';ctx.fillText('RR',-4,-14);}
    ctx.restore();
  }

  function normalizedSpec(spec={}){
    return Object.assign({id:'goku-base',characterId:'goku',form:'base',color:'#ffa946',skin:'#efb381',hair:'#172131',outfit:'#ef712d',accent:'#244776',species:'saiyan',silhouette:'athletic',height:1,head:'spiky'},spec);
  }
  function paintFighter(ctx,spec,action,frame){
    const p=samplePose(action,frame),phase=frame/animations[action].frames*TAU;
    ctx.save();
    if(p.lean){ctx.translate(p.hip[0],p.hip[1]);ctx.rotate(p.lean);ctx.translate(-p.hip[0],-p.hip[1]);}
    if(spec.species==='angel'){
      line(ctx,[[-39,-5],[-39,-168]],'#d9be70',3);ellipse(ctx,-39,-173,7.5,7.5,'#182635','#b5dfeb',2);
      ctx.save();ctx.translate(p.head[0],p.head[1]+24);ctx.scale(1,.32);ctx.beginPath();ctx.arc(0,0,25,0,TAU);ctx.strokeStyle='#92dceb';ctx.lineWidth=5;ctx.stroke();ctx.restore();
    }
    cape(ctx,p,spec,phase);tail(ctx,p,spec,phase);
    const shoulderBack=shifted(p.shoulder,-12,2),shoulderFront=shifted(p.shoulder,13,3);
    arm(ctx,shoulderBack,p.backElbow,p.backHand,spec,true,p.handOpen);
    leg(ctx,shifted(p.hip,-7,0),p.backKnee,p.backFoot,spec,true);
    leg(ctx,shifted(p.hip,6,1),p.frontKnee,p.frontFoot,spec,false);
    torso(ctx,p,spec);head(ctx,p,spec);
    arm(ctx,shoulderFront,p.frontElbow,p.frontHand,spec,false,p.handOpen);
    if(spec.species==='cell'){
      poly(ctx,[[p.shoulder[0]-17,p.shoulder[1]+4],[p.shoulder[0]-33,p.shoulder[1]+13],[p.hip[0]-29,p.hip[1]+22],[p.hip[0]-12,p.hip[1]+10]],'#253438');
      line(ctx,[[p.shoulder[0]-24,p.shoulder[1]+18],[p.hip[0]-26,p.hip[1]+13]],'#536664',1.3);
    }
    ctx.restore();
  }

  const cells = new Map(), portraits = new Map(), CACHE_LIMIT=144;
  let totalBakes=0;
  function createCanvas(w,h){
    if(typeof root.OffscreenCanvas==='function')return new root.OffscreenCanvas(w,h);
    if(root.document&&typeof root.document.createElement==='function'){const canvas=root.document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;}
    return null;
  }
  function visualKey(spec){return [spec.id,spec.skin,spec.hair,spec.outfit,spec.accent,spec.species,spec.head,spec.silhouette,spec.armor,spec.cape,spec.tail,spec.sword,spec.longHair,spec.horns,spec.beard,spec.glasses,spec.hat,spec.ears,spec.chest,spec.scouter,spec.vest,spec.earrings,spec.scar,spec.mark].join('|');}
  function cachedCell(spec,action,frame){
    const key=visualKey(spec)+':'+action+':'+frame;
    if(cells.has(key)){const cell=cells.get(key);cells.delete(key);cells.set(key,cell);return cell;}
    const canvas=createCanvas(WIDTH*DENSITY,HEIGHT*DENSITY);if(!canvas)return null;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.scale(DENSITY,DENSITY);ctx.translate(AX,AY);paintFighter(ctx,spec,action,frame);
    const cell={canvas,...frameDescriptor(action,frame)};cells.set(key,cell);totalBakes++;
    if(cells.size>CACHE_LIMIT){const oldest=cells.keys().next().value;const released=cells.get(oldest);cells.delete(oldest);released.canvas.width=1;released.canvas.height=1;}
    return cell;
  }
  function drawAura(ctx,spec,action,frame,burst){
    if(!['charge','super','burst'].includes(action)&&!burst)return;
    const phase=frame*.23,weight=action==='burst'?1.25:1,color=/^#[\da-f]{6}$/i.test(spec.color)?spec.color:'#61cfff';
    ctx.save();ctx.globalCompositeOperation='screen';
    const grad=ctx.createRadialGradient(0,-67,8,0,-70,104*weight);grad.addColorStop(0,color+'00');grad.addColorStop(.55,color+'12');grad.addColorStop(1,color+'00');ctx.fillStyle=grad;ctx.fillRect(-105,-189,210,202);
    for(let i=0;i<7;i++){
      const angle=i/7*TAU,xx=Math.cos(angle)*42,yy=Math.sin(angle)*13;
      poly(ctx,[[xx,yy],[xx*1.4,-55-Math.sin(phase+i)*13],[xx*.5,-140-Math.cos(phase+i)*18],[xx*.55,-70]],i%2?color+'15':color+'24',null);
    }
    ctx.restore();
  }
  function drawFighter(ctx,fighter,x,y,scale=1,options={}){
    if(!ctx)return;
    const spec=normalizedSpec(fighter.spec||fighter),action=actionName(fighter.state||'idle'),frame=frameIndex(action,fighter.frame||0);
    const height=Number.isFinite(spec.height)?clamp(spec.height,.65,1.4):1,actualScale=scale*height;
    ctx.save();ctx.translate(x,y);ctx.scale((fighter.facing===-1?-1:1)*actualScale,actualScale);
    if(options.alpha!==undefined)ctx.globalAlpha*=options.alpha;
    if(!options.portrait&&options.aura!==false)drawAura(ctx,spec,action,frame,fighter.burstFrames>0);
    const cell=cachedCell(spec,action,frame);
    if(cell){ctx.imageSmoothingEnabled=true;ctx.drawImage(cell.canvas,0,0,cell.width,cell.height,-AX,-AY,WIDTH,HEIGHT);}
    else paintFighter(ctx,spec,action,frame);
    if(fighter.invuln>0&&frame%4<2&&action!=='down'){
      ctx.save();ctx.globalAlpha*=.2;ctx.globalCompositeOperation='screen';if(cell)ctx.drawImage(cell.canvas,-AX,-AY,WIDTH,HEIGHT);ctx.restore();
    }
    ctx.restore();
  }
  function drawPortrait(ctx,input,x,y,w,h){
    if(!ctx)return;const spec=normalizedSpec(input),key=visualKey(spec);let canvas=portraits.get(key);
    if(!canvas){canvas=createCanvas(160,184);if(canvas){const pctx=canvas.getContext('2d');pctx.translate(77,178);pctx.scale(2.25,2.25);const p=samplePose('idle',0);pctx.translate(0,91);torso(pctx,p,spec);head(pctx,p,spec,true);portraits.set(key,canvas);}}
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(canvas){const ratio=Math.max(w/160,h/184);ctx.drawImage(canvas,x+(w-160*ratio)*.5,y+(h-184*ratio)*.5,160*ratio,184*ratio);}
    else{ctx.translate(x+w*.5,y+h*1.45);ctx.scale(w/70,w/70);const p=samplePose('idle',0);ctx.translate(0,79);torso(ctx,p,spec);head(ctx,p,spec,true);}
    ctx.restore();
  }
  Object.assign(DV,{Animation,animations,frameDescriptor,samplePose,drawFighter,drawPortrait,
    spriteCache:{stats:()=>({cells:cells.size,portraits:portraits.size,totalBakes,maxCells:CACHE_LIMIT}),clear:()=>{cells.clear();portraits.clear();}}
  });
  if(typeof module!=='undefined'&&module.exports)module.exports=DV;
})(typeof globalThis!=='undefined'?globalThis:window);
