(function(root){
 'use strict';
 const DV=root.DV=root.DV||{};
 DV.portraitAtlas='assets/versus-expanded/portraits-50.png';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 /* P1：J 轻击三段连 · H 重击浮空 · G 投技 · C 反击 */
 const P1={KeyJ:'light',KeyH:'heavy',KeyK:'jump',KeyL:'dash',KeyU:'ki',KeyI:'super',KeyO:'assist',KeyG:'grab',KeyC:'counter',
   /* 角色专属机制：只有该角色拥有时才生效；由 command() 的 unique: 前缀转发。
      注意 F 已被「全屏」占用、V 未被占用，故吸收用 Z、念动力用 V、巨大化用 X。 */
   KeyZ:'unique:absorb',KeyV:'unique:psycho',KeyX:'unique:giant',
   /* 脱身（每局 3 次）：被连段锁住、被抓、被吞入体内时也能发动，立刻摆脱并绕到对手背后。
      正传里各角色用自己的机动手段完成（瞬间移动／残像拳／舞空术／翻身脱身）。 */
   KeyY:'escape'};
  const P2={Numpad1:'light',Numpad2:'jump',Numpad3:'dash',Numpad4:'ki',Numpad5:'super',Numpad6:'assist',Numpad7:'heavy',Numpad8:'grab',NumpadDecimal:'counter',
   Numpad9:'unique:absorb',NumpadAdd:'escape',
   Digit1:'light',Digit2:'jump',Digit3:'dash',Digit4:'ki',Digit5:'super',Digit6:'assist',Digit7:'heavy',Digit8:'grab',
    Digit9:'unique:absorb',Period:'counter',Minus:'escape',Equal:'escape'};
 /* 组合键：按住「方向下」+ 远程攻击键 → 副技能（该角色的太阳拳／吸收／念动力…） */
 const HOLD_DOWN_P1={KeyS:1};
  const HOLD_DOWN_P2={ArrowDown:1};
  const COMBO_ATTACK_P1={KeyU:1};
  const COMBO_ATTACK_P2={Numpad4:1,Digit4:1};
  /* Select rendering may run at 60/144/240 Hz.  The preview still consumes the
     same fixed 60 Hz pose timeline as combat, so display refresh never changes
     its animation speed. */
  const selectPreviewFrame=seconds=>Math.floor(Math.max(0,Number(seconds)||0)*60);
 const assistProfile=spec=>{try{const key=typeof spec==='string'?spec:(spec?.id||spec?.assistId);return (DV.assistProfile&&DV.assistProfile(key))||(DV.ASSISTS&&DV.ASSISTS[key])||{};}catch(_){return {};}};
 const assistRole=kind=>({grab:'抓取',rush:'突进',strike:'突进',control:'控制',barrier:'防护',support:'补给',projectile:'气弹',beam:'光束',slash:'剑击'})[kind]||'援助';
 const conditionText=condition=>condition?.maxHpRatio?`生命低于 ${Math.round(condition.maxHpRatio*100)}%`:condition?.minKi?`气力至少 ${Math.round(condition.minKi)}`:'';
 const assistText=(spec,main)=>{const p=assistProfile(spec)||{};let bond=null;try{bond=DV.assistBond&&DV.assistBond(main,spec);}catch(_){}const teamSuper=main?.id==='gohan-teen-ssj2'&&spec?.id==='goku-ssj';const guide=DV.assistInstruction?DV.assistInstruction(p):'';return {name:p.label||p.name||p.skill||'援助技',role:assistRole(p.role||p.kind),cooldown:Number(p.cooldown||p.cooldownTicks)||0,bond:bond?.label||'',condition:conditionText(bond?.condition||p.condition),maxUses:Number.isFinite(p.maxUses)?p.maxUses:0,guide:guide+(teamSuper?' 合招条件：悟饭生命≤50%、消耗58气、每局1次。':''),teamSuper};};
 function touchControlGroups(moves={}){
  const primary=[['light','轻击'],['heavy','重击'],['jump','跳跃'],['dash','冲刺'],['ki','气弹'],['super','必杀'],['assist','援助']];
  const extra=[['grab','投技'],['counter','反击'],['escape','脱身×3'],['combo','副技'],['burst','爆气'],['transform','变身']];
  for(const [key,label] of [['absorb','吸收'],['psycho','念动力'],['giant','巨大化']])if(moves[key])extra.push(['unique:'+key,label]);
  const pack=items=>items.map(([action,label])=>({action,label}));
  return {primary:pack(primary),extra:pack(extra)};
 }
 class Sound{
  constructor(){this.muted=false;this.ctx=null;this.voices=0;}
  unlock(){try{if(!this.ctx){const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.noise=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*.3),this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);}if(this.ctx.state==='suspended')this.ctx.resume();}catch{}}
  play(kind){if(!this.ctx||this.muted||this.voices>14)return;const ctx=this.ctx,t=ctx.currentTime;const osc=ctx.createOscillator(),gain=ctx.createGain();const params={select:[650,1000,.035,.035],confirm:[450,1100,.16,.045],swing:[260,70,.075,.035],hit:[100,30,.13,.08],heavyHit:[82,25,.17,.11],guard:[1300,280,.1,.035],dash:[600,80,.1,.03],jump:[250,650,.1,.025],ki:[700,170,.19,.03],super:[90,360,.4,.055],burst:[60,200,.45,.06],clash:[150,450,.5,.05],clashEnd:[170,35,.5,.08],ko:[260,70,.6,.05],fight:[320,650,.2,.04],tap:[800,1000,.03,.015],assist:[450,800,.1,.04],break:[230,35,.25,.06],cancel:[900,100,.1,.03],unique:[520,900,.14,.045],teleport:[900,220,.16,.035],grabbed:[180,80,.18,.05],throw:[120,40,.22,.07],counter:[1100,300,.2,.06],aoe:[1600,400,.3,.05],tech:[700,1200,.08,.03]};const [from,to,duration,volume]=params[kind]||params.select;osc.type=['super','burst','clash','unique','counter','aoe','heavyHit'].includes(kind)?'sawtooth':'triangle';osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duration);this.voices++;osc.onended=()=>{this.voices--;osc.disconnect();gain.disconnect();};if(['hit','heavyHit','burst','guard','clashEnd','break','throw','counter'].includes(kind)){const n=ctx.createBufferSource(),ng=ctx.createGain();n.buffer=this.noise;ng.gain.setValueAtTime(volume*.7,t);ng.gain.exponentialRampToValueAtTime(.001,t+Math.min(.3,duration));n.connect(ng);ng.connect(ctx.destination);n.start();n.stop(t+Math.min(.3,duration));n.onended=()=>{n.disconnect();ng.disconnect();};}}
  playHit(heavy){this.play(heavy?'heavyHit':'hit');}
 }
 class App{
  constructor(){
    this.active=false;this.screen='select';this.side=0;this.step=0;this.indices=[1,13];this.assistIndices=[3,4];this.assistSpecMode=false;this.stageIndex=0;this.filter='ALL';this.visible=[];this.cursor=0;this.mode='cpu';this.difficulty='normal';this.format='single';this.timer='99';this.sound=DV.BT3Sound?new DV.BT3Sound(new Sound()):new Sound();this.pressed=new Set();this.modalKind=null;this.lastTime=0;this.noticeUntil=0;this.paintRevision=0;this.selectPreviewSeconds=0;this.tournament=null;this.tournamentResultHandled=false;this.lastGameOutcome=null;this.restore();
   this.root=document.createElement('section');this.root.id='dv-root';this.root.hidden=true;this.root.setAttribute('aria-label','龙珠天下一对战');document.body.appendChild(this.root);
   for(const name of ['pointerdown','click','touchstart','touchend'])this.root.addEventListener(name,e=>e.stopPropagation());
   root.addEventListener('keydown',e=>this.key(e,true),true);root.addEventListener('keyup',e=>this.key(e,false),true);
   root.addEventListener('blur',()=>this.autoPause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.autoPause();});
  }
  restore(){
   try{
    const v=JSON.parse(localStorage.getItem('dragon-versus-v1')||'null');
    if(v&&typeof v==='object'){
     const validIndex=(value,length)=>Number.isInteger(value)&&value>=0&&value<length;
     const pair=(saved,fallback,length)=>[0,1].map(side=>Array.isArray(saved)&&validIndex(saved[side],length)?saved[side]:fallback[side]);
     this.indices=pair(v.indices,this.indices,DV.roster.length);
     this.assistSpecMode=!!v.assistSpecMode;
     this.assistIndices=pair(v.assistIndices,this.assistIndices,this.assistSpecMode?DV.roster.length:(DV.characters?.length||DV.roster.length));
     this.stageIndex=validIndex(v.stageIndex,DV.stages.length)?v.stageIndex:0;
     this.difficulty=['easy','normal','hard','inferno'].includes(v.difficulty)?v.difficulty:'normal';
     this.format=v.format==='bo3'?'bo3':'single';this.timer=v.timer==='infinite'?'infinite':'99';
     this.mode=['cpu','local','training','tournament'].includes(v.mode)?v.mode:'cpu';this.sound.muted=!!v.muted;
    }
   }catch{}
   try{const saved=JSON.parse(localStorage.getItem('dragon-tournament-v1')||'null'),cup=DV.upgradeTournament(saved,DV.roster);if(DV.validateTournament(cup,DV.roster)&&cup.stageIndex<DV.stages.length)this.tournament=cup;}catch{}
  }
  normalizeAssists(){if(this.assistSpecMode)return;this.assistIndices=this.assistIndices.map(i=>DV.roster.findIndex(s=>s.characterId===DV.characters[Number(i)]?.id)).map((i,n)=>i>=0?i:n);this.assistSpecMode=true;}
  save(){if(this.tutorial)return;try{localStorage.setItem('dragon-versus-v1',JSON.stringify({indices:this.indices,assistIndices:this.assistIndices,assistSpecMode:true,stageIndex:this.stageIndex,difficulty:this.difficulty,format:this.format,timer:this.timer,mode:this.mode,muted:this.sound.muted}));}catch{}}
  saveTournament(){try{localStorage.setItem('dragon-tournament-v1',JSON.stringify(this.tournament));}catch{}}
  open(onExit,entry='versus'){if(this.active)return;this.onExit=onExit||(()=>{});this.active=true;this.root.hidden=false;document.body.classList.add('dv-active');this.sound.unlock();if(entry==='tournament'){this.mode='tournament';this.stageIndex=0;this.showTournamentSettings();}else{if(this.mode==='tournament')this.mode='cpu';this.showSelect();}this.lastTime=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));}
  close(){this.touchControls?.destroy();this.touchControls=null;this.network?.leave();this.restoreTutorialSelection();this.artLoading=false;this.sound.stop?.();this.active=false;this.root.hidden=true;document.body.classList.remove('dv-active');cancelAnimationFrame(this.raf);this.clearHeld();this.save();this.onExit();}
  el(q){return this.root.querySelector(q);}
  fighter(side){return DV.roster[this.indices[side]]||DV.roster[0];}
  showTransforms(side=0){
   if(this.mode==='online')side=this.localSide();
   if(!this.match||this.match.phase!=='fight'||this.modalKind)return;
   const f=this.match.fighters[side],options=this.match.transformOptions(side);
   if(!options.length){this.notice('该时期暂无可切换形态；融合、吸收与跨时期角色在选人界面选择。',2400);return;}
   if(f.transformCooldown>0){this.notice(`变身冷却 ${Math.ceil(f.transformCooldown/60)} 秒`);return;}
   if(!f.grounded||!['idle','run','guard','charge'].includes(f.state)){this.notice('落地并结束当前动作后可变身');return;}
   this.sound.stop?.();if(this.mode!=='online')this.match.paused=true;this.clearHeld();
   this.showModal('transform',`P${side+1} · ${f.spec.name} 变身`, `<p>当前：${esc(f.spec.form)}　·　气力 ${Math.floor(f.ki)}</p><p>选择形态后开始变身；准备动作会被攻击打断。<br>保留剩余体力比例与援助冷却，变身冷却 3 秒。</p>`,options.map(o=>({id:`form:${side}:${o.spec.id}`,label:`${o.spec.form} · ${o.cost}气${f.ki<o.cost?'（气力不足）':''}`,disabled:f.ki<o.cost,primary:!o.returning})).concat({id:'back',label:'取消 / Esc'}));
  }
   helpHTML(){return `<div class="dv-help"><strong>PLAYER 01</strong><span><kbd>A D</kbd> 左右移动</span><span><kbd>S</kbd> 防御</span><span><kbd>J</kbd> 轻击三段连（可早按衔接）</span><span><kbd>H</kbd> 重击（浮空起手）</span><span><kbd>G</kbd> 投技（抛空→瞬移追击→砸地）</span><span><kbd>C</kbd> 反击</span><span><kbd>K</kbd> 跳跃／二段跳</span><span><kbd>L</kbd> 冲刺／取消后摇</span><span><kbd>U</kbd> 气弹 · 8气</span><span><kbd>I</kbd> 必杀 · 40气</span><span><kbd>O</kbd> 援助 · 18气</span><span><kbd>W</kbd> 按住蓄气</span><span><kbd>T</kbd> 变身菜单</span><span><kbd>S I</kbd> 爆气 · 50气</span><strong>连段与援助</strong><span><kbd>J → J → J</kbd> 可在前一击动作中提前按下一击；<kbd>H</kbd> 命中后用空中 <kbd>J → J</kbd> 追击。</span><span><kbd>O</kbd> 由选定伙伴执行其真实援助技：近战、抓取、护罩、控制或剑击；HUD 显示招式和实际冷却。</span><strong>角色专属机制</strong><span><kbd>S + U</kbd> <b>副技能组合键</b>（P2 为 <kbd>↓ + 4</kbd>）自动发动该角色的副技能：太阳拳／魔封波／万国惊天掌／吸收／念动力／巨大化／沙鲁Jr.／变化光线／负面能量…</span><span><kbd>Z</kbd> 吸收 · 沙鲁／布欧</span><span><kbd>V</kbd> 念动力 · 弗利萨／古拉</span><span><kbd>X</kbd> 巨大化 · 比克</span><span>完整键位见暂停菜单「出招表」</span><strong>PLAYER 02 · 本地双人</strong><span><kbd>← →</kbd> 移动　<kbd>↓</kbd> 防御　<kbd>↑</kbd> 蓄气</span><span><kbd>1 2 3</kbd> 轻击／跳跃／冲刺</span><span><kbd>4 5 6</kbd> 气弹／必杀／援助</span><span><kbd>7 8</kbd> 重击／投技</span><span><kbd>9</kbd> 吸收　<kbd>.</kbd> 反击　<kbd>0</kbd> 变身菜单</span><span><kbd>↓ + 4</kbd> 副技能（含念动力、巨大化等）　<kbd>+</kbd> 脱身</span><strong>对波与爆气</strong></div><p class="dv-help-notes">相向光束相撞自动进入对波。有节奏地连按 J（P2 为 1）推动波心，每次按键至少间隔6帧。爆气能解除受击硬直、弹开近身敌人，并获得6秒攻击强化。G 投技近身抓取，被抓后在窗口内按任意键可拆投；C 反击架势可在对手出招时反制。U / I 可预输入衔接远攻或必杀，结束完整动作后出招。防御槽耗尽会破防。每个角色都有各自的正传招式与被动。方向键下＋远程攻击（P1 为 S+U）是副技能组合键。完整键位见<b>暂停菜单「出招表」</b>。</p><p class="dv-help-notes">Esc 暂停（内含出招表）　·　F 全屏　·　M 静音<br>训练模式：对手不主动攻击，气力快速回复，脱离连击后对手恢复体力；HUD 会标示 TRAINING。训练中可按 F3 查看判定框、按 B 打开出招表。手机建议横屏。</p>`;}
  showHelp(){this.sound.stop?.();if(this.match&&this.screen==='battle')if(this.mode!=='online')this.match.paused=true;this.clearHeld();this.showModal('help','操作指南',this.helpHTML(),[{id:'back',label:'了解，返回',primary:true}]);}
  showModal(kind,title,html,buttons){this.modalKind=kind;this.el('.dv-modal-shade')?.remove();const shade=document.createElement('div');shade.className='dv-modal-shade';shade.innerHTML=`<div class="dv-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><small>DRAGON BALL · TENKAICHI</small><h2>${esc(title)}</h2>${html}<div class="dv-modal-buttons">${buttons.map(b=>`<button data-modal-action="${b.id}" ${b.disabled?'disabled':''} class="${b.primary?'primary':''}">${esc(b.label)}</button>`).join('')}</div></div>`;this.root.appendChild(shade);shade.querySelectorAll('button').forEach(b=>b.onclick=()=>{this.sound.play('confirm');this.modalAction(b.dataset.modalAction);});shade.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}
   modalAction(action){const previous=this.modalKind;this.el('.dv-modal-shade')?.remove();this.modalKind=null;if(action.startsWith('moves')){const side=action.includes(':')?(action.split(':')[1]==='p2'?1:0):((this.match&&this.screen==='battle')?0:(this.side||0));this.showMoveList(side);return;}if(action.startsWith('form:')){const [,side,id]=action.split(':');this.match.paused=false;this.sendCommand('transform',id,this.mode==='online'?0:+side);return;}if(action==='layout'){this.editTouchLayout();return;}if(action==='online-room'){this.returnOnlineRoom();return;}if(action==='online-leave'){this.showSelect();return;}if(action==='confirm-new-tournament'){this.beginTournament(true);return;}if(action==='select'){this.showSelect();return;}if(action==='bracket'){this.showTournament();return;}if(action==='new-tournament'){this.beginTournament();return;}if(action==='rematch'){this.start();return;}if(action==='exit'){this.close();return;}if(previous==='help'&&this.screen==='battle'&&this.match.phase==='over'){this.result();return;}if(this.match&&this.screen==='battle'&&!this.artLoading&&!this.tutorial?.complete)this.match.paused=false;}
  pause(){if(this.mode==='online')return this.onlinePause();this.sound.stop?.();if(!this.match||this.screen!=='battle'||this.match.phase==='over')return;if(this.modalKind){this.modalAction('back');return;}if(this.mode!=='online')this.match.paused=true;this.clearHeld();const local=this.mode==='local',cup=this.mode==='tournament';this.showModal('pause','对战暂停',cup?'<p>赛程已存档。离开后可从本轮重新开始。</p>':'<p>调整呼吸，下一回合见真章。</p>',[{id:'back',label:'继续对战',primary:true}].concat(local?[{id:'moves:p1',label:'P1 出招表'},{id:'moves:p2',label:'P2 出招表'}]:[{id:'moves',label:'出招表'}]).concat([{id:'layout',label:'自定义按键'},{id:'rematch',label:cup?'重开本场':'重新对战'},...(cup?[{id:'bracket',label:'返回签表 · 重开本场'}]:[]),{id:'select',label:cup?'存档并返回选人':'返回选人'}]));}
  autoPause(){if(this.active&&this.screen==='battle'&&!this.modalKind&&this.match.phase!=='over')this.pause();this.clearHeld();}
  clearHeld(){this.pressed.clear();this.touchControls?.releaseAll();if(this.mode==='online')this.network?.releaseAll();else this.match?.clearInput();}
  localSide(){return this.mode==='online'?(this.network?.side??0):0;}
  sendCommand(action,arg,side=0){if(this.touchControls?.editing)return false;if(this.mode==='online'){if(side===0)return this.network?.command(action,arg);return false;}return this.match?.command(side,action,arg);}
  sendHeld(key,value,side=0){if(value&&this.touchControls?.editing)return false;if(this.mode==='online'){if(side===0)return this.network?.input(key,value);return false;}return this.match?.setInput(side,key,value);}
  bindTouchControls(){
   this.touchControls?.destroy();this.touchControls=null;
   const element=this.el('.dv-touch');if(!element||!DV.TouchControls)return;
   let storage=null;try{storage=root.localStorage;}catch{}
   this.touchControls=new DV.TouchControls(element,{storage,command:(action,arg)=>{if(this.modalKind||this.artLoading)return;this.sound.unlock();this.sendCommand(action,arg);},input:(key,value)=>{if(value&&(this.modalKind||this.artLoading))return;this.sendHeld(key,value);},moves:()=>DV.resolveMoves(this.match.fighters[this.localSide()]),onEdit:editing=>{this.clearHeld();if(this.mode!=='online')this.match.paused=editing||!!this.modalKind;}});
  }
  editTouchLayout(){if(!this.touchControls)return;this.el('.dv-modal-shade')?.remove();this.modalKind=null;this.clearHeld();this.touchControls.openEditor();}
  sidePanel(side){const isRight=side===1;return `<aside class="dv-fighter-panel ${isRight?'p2':''}" data-side="${side}"><div class="dv-side-head"><button data-side-choice="${side}">${isRight?'02 · RIVAL':'01 · PLAYER'}</button><span class="dv-panel-status"></span></div><canvas class="dv-hero" width="440" height="460" aria-label="角色预览"></canvas><div class="dv-fighter-copy"><div class="dv-era-label"></div><h2></h2><div class="dv-form"></div><div class="dv-super-name"><small>SUPER ATTACK</small><span></span></div><div class="dv-stats"><span>力量<i><em></em></i></span><span>速度<i><em></em></i></span><span>体力<i><em></em></i></span></div></div><div class="dv-assist-select"><label>援助</label><select data-assist="${side}" aria-label="${isRight?'P2':'P1'} 援助角色"></select><small class="dv-assist-copy"></small></div></aside>`;}
  settingsMarkup(){
   const choice=(key,value,label,detail)=>`<button class="dv-cup-choice ${this[key]===value?'selected':''}" data-setting="${key}" data-value="${value}" aria-pressed="${this[key]===value}"><strong>${label}</strong><small>${detail}</small></button>`;
   const saved=this.tournament?`<div class="dv-cup-saved"><span>已存赛程</span><b>${esc(DV.roster[this.tournament.playerIndex].name)} · ${this.tournament.status==='active'?['八强赛','半决赛','决赛'][this.tournament.round]:'赛程已结束'}</b><button data-settings-action="resume">${this.tournament.status==='active'?'继续赛程':'查看总结'} →</button></div>`:'';
   return `<div class="dv-cup-screen dv-cup-settings"><div class="dv-cup-topline"><span>DRAGON CLASH / TENKAICHI BUDOKAI</span><button data-settings-action="exit">返回主界面 ×</button></div><div class="dv-cup-settings-grid"><div class="dv-cup-intro"><div class="dv-cup-step">01 / 03　赛制设置</div><div class="dv-cup-emblem">武</div><h1>天下第一<br><em>武道大会</em></h1><p>八名战士随机抽签。闯过八强、半决赛与决赛，赢下冠军。每场胜负与赛程自动存档。</p><div class="dv-cup-intro-foot"><span>08　参赛战士</span><span>03　淘汰阶段</span><span>01　最终冠军</span></div></div><main class="dv-cup-settings-panel"><div class="dv-cup-panel-head"><small>TOURNAMENT RULES</small><h2>赛制设置</h2><p>规则将用于整届大会，抽签后保持不变。</p></div><section class="dv-cup-setting"><h3><span>01</span> 对战难度</h3><div class="dv-cup-choice-grid four">${choice('difficulty','easy','简单','轻松热身')}${choice('difficulty','normal','标准','均衡对战')}${choice('difficulty','hard','困难','积极进攻')}${choice('difficulty','inferno','炼狱','极限挑战')}</div></section><section class="dv-cup-setting"><h3><span>02</span> 晋级赛制</h3><div class="dv-cup-choice-grid">${choice('format','single','一局定胜负','每场赢一局即可晋级')}${choice('format','bo3','三局两胜','每场先赢两局晋级')}</div></section><section class="dv-cup-setting"><h3><span>03</span> 单局时长</h3><div class="dv-cup-choice-grid">${choice('timer','99','99 秒','时间到按剩余体力判胜')}${choice('timer','infinite','无限时长','直到一方倒下')}</div></section><div class="dv-cup-settings-actions"><span>下一步：选择参赛战士</span><button data-settings-action="next">进入选人界面 <b>→</b></button></div>${saved}</main></div></div>`;
  }
  showTournamentSettings(){
   this.clearHeld();this.match=null;this.mode='tournament';this.stageIndex=0;this.screen='settings';this.modalKind=null;this.resultPending=0;
   this.root.innerHTML=this.settingsMarkup();
   this.root.querySelectorAll('[data-setting]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.setting;this[key]=button.dataset.value;
    this.root.querySelectorAll(`[data-setting="${key}"]`).forEach(peer=>{const selected=peer===button;peer.classList.toggle('selected',selected);peer.setAttribute('aria-pressed',String(selected));});
    this.sound.play('select');this.save();
   });
   this.root.querySelectorAll('[data-settings-action]').forEach(button=>button.onclick=()=>{this.sound.play('confirm');const action=button.dataset.settingsAction;if(action==='next')this.showSelect();if(action==='resume')this.resumeTournament();if(action==='exit')this.close();});
   this.save();
  }
  showSelect(){
   this.touchControls?.destroy();this.touchControls=null;if(this.mode==='online'){this.network?.leave();this.mode='cpu';}
   this.restoreTutorialSelection();this.artLoading=false;
   this.sound.stop?.();this.sound.preload?.([this.fighter(0),this.fighter(1)]);
   this.screen='select';this.match=null;this.modalKind=null;this.clearHeld();this.step=0;this.side=0;this.resultPending=0;this.normalizeAssists();
   this.root.innerHTML=`<div class="dv-select"><header class="dv-top"><div class="dv-logo"><div class="dv-dragonball">★★★★</div><div><b>DRAGON <span>BALL</span></b><small>天下一 · 极限对战</small></div></div><div class="dv-top-title"><b>选择你的战士</b><small>CHOOSE YOUR FIGHTER</small></div><div class="dv-top-actions"><button data-ui="online" class="dv-online-entry">房间联机</button><button data-ui="sound" aria-label="切换声音">${this.sound.muted?'声音 关':'声音 开'}</button><button data-ui="settings-back" hidden>赛制设置</button><button data-ui="tutorial" class="dv-tutorial-entry">一分钟教学</button><button data-ui="help">操作指南</button><button data-ui="exit">返回大厅 ↗</button></div></header><div class="dv-subnav"><div class="dv-count"><strong>50</strong> 战士　/　<strong>100</strong> 时期与形态</div><nav class="dv-tabs" aria-label="系列筛选"></nav><span class="dv-count">THE ULTIMATE SHOWDOWN</span></div><div class="dv-roster-layout">${this.sidePanel(0)}<main class="dv-roster-center"><div class="dv-grid" role="group" aria-label="100名可选战士"></div><div class="dv-grid-caption"><strong class="dv-selection-hint"></strong><span>点击选人 · J 确定 · TAB 切换</span></div></main>${this.sidePanel(1)}</div><section class="dv-bottom"><div><div class="dv-stage-heading"><b>选择战场 <span class="dv-stage-name"></span></b><span>SELECT STAGE</span></div><div class="dv-stages" aria-label="经典地图"></div><div class="dv-cup-select-rules" hidden><small>02 / 03　选定参赛战士</small><strong>天下第一武道会场</strong><span class="dv-cup-rule-summary"></span><span>对手将在选人后随机抽签决定</span></div></div><div class="dv-start-box"><div class="dv-options-line"><select data-option="mode" aria-label="对战模式"><option value="cpu">单人对战</option><option value="tournament">天下武道大会</option><option value="local">本地双人</option><option value="training">训练模式</option></select><select data-option="difficulty" aria-label="电脑难度"><option value="easy">简单 AI</option><option value="normal">标准 AI</option><option value="hard">困难 AI</option><option value="inferno">炼狱 AI</option></select></div><button class="dv-start" data-ui="start">开始对战 <small>J →</small></button><button class="dv-resume" data-ui="resume-tournament" hidden></button></div></section><footer class="dv-footer"><span><kbd>A D</kbd> 选择　<kbd>W S</kbd> 换行　<kbd>Q E</kbd> 地图　<kbd>J</kbd> 确定　<kbd>Tab</kbd> P1 / P2</span><span class="dv-version">FAN-MADE ARCADE · DB / Z / SUPER / GT / DAIMA</span><button class="dv-small-button" data-ui="random">随机对决 ↻</button></footer></div>`;
   const labels={ALL:'全系列',DB:'龙珠',Z:'龙珠 Z',SUPER:'超',GT:'GT',DAIMA:'DAIMA',MOVIE:'剧场 / 外传'};
   this.el('.dv-tabs').innerHTML=Object.entries(labels).map(([id,l])=>`<button data-filter="${id}" class="${id===this.filter?'active':''}">${l}</button>`).join('');
   this.root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{this.filter=b.dataset.filter;this.root.querySelectorAll('[data-filter]').forEach(t=>t.classList.toggle('active',t===b));this.buildGrid();this.sound.play('select');});
   this.root.querySelectorAll('[data-side-choice]').forEach(b=>b.onclick=()=>this.chooseSide(+b.dataset.sideChoice));
   this.el('[data-option="mode"]').value=this.mode;this.el('[data-option="difficulty"]').value=this.difficulty;
   this.root.querySelectorAll('[data-option]').forEach(s=>s.onchange=()=>{this[s.dataset.option]=s.value;if(s.dataset.option==='mode'&&s.value==='tournament'){this.showTournamentSettings();return;}this.save();this.updatePanels();this.updateSelectMode();this.markGrid();this.buildForms();});
   this.root.querySelectorAll('[data-assist]').forEach(s=>{s.innerHTML=DV.roster.map((ch,i)=>`<option value="${i}">${esc(ch.name)} · ${esc(ch.form)}</option>`).join('');s.value=this.assistIndices[+s.dataset.assist];s.onchange=()=>{this.assistIndices[+s.dataset.assist]=+s.value;this.save();this.updatePanels();};});
   this.el('.dv-stages').innerHTML=DV.stages.map((s,i)=>`<button class="dv-stage ${this.stageIndex===i?'active':''}" data-stage="${i}" aria-label="${esc(s.name)}"><canvas width="240" height="135"></canvas><span>${esc(s.name)}</span></button>`).join('');
   this.root.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>this.chooseStage(+b.dataset.stage));
   this.bindUI();this.buildGrid();this.updatePanels();this.updateSelectMode();this.paintStages();this.loadArt();this.save();
  }
  updateSelectMode(){
   const active=this.mode==='tournament',select=this.el('.dv-select');if(!select)return;
   select.classList.toggle('tournament-mode',active);
   this.el('.dv-top-title b').textContent=active?'选择参赛战士':'选择你的战士';
   this.el('[data-ui="settings-back"]').hidden=!active;
   this.el('.dv-start').innerHTML=active?'创建八人赛程 <small>J →</small>':'开始对战 <small>J →</small>';
   const resume=this.el('.dv-resume');resume.hidden=!this.tournament;
   if(this.tournament)resume.textContent=this.tournament.status==='active'?'继续武道大会 · '+['八强赛','半决赛','决赛'][this.tournament.round]:'查看武道大会赛果';
   const hint=this.el('.dv-grid-caption span');if(hint)hint.textContent=active?'选择 P1 战士 · 对手由签表随机安排':'点击选人 · J 确定 · TAB 切换';
   const footer=this.el('.dv-footer span:first-child');if(footer)footer.innerHTML=active?'<kbd>A D</kbd> 选人　<kbd>W S</kbd> 换行　<kbd>Q E</kbd> 地图　<kbd>R</kbd> 形态　<kbd>J</kbd> 创建赛程':'<kbd>A D</kbd> 选择　<kbd>W S</kbd> 换行　<kbd>Q E</kbd> 地图　<kbd>J</kbd> 确定　<kbd>Tab</kbd> P1 / P2';
   this.el('[data-ui="random"]').hidden=active;
   const rules=this.el('.dv-cup-select-rules');rules.hidden=!active;
   if(active)this.el('.dv-cup-rule-summary').textContent=`${this.format==='bo3'?'三局两胜':'一局定胜负'} · ${this.timer==='infinite'?'无限时长':'99 秒'} · ${({'easy':'简单','normal':'标准','hard':'困难','inferno':'炼狱'})[this.difficulty]}难度`;
   this.el('.dv-selection-hint').textContent=active?`参赛战士 · ${this.fighter(0).name} · ${this.fighter(0).form}`:this.el('.dv-selection-hint').textContent;
  }
   beginTournament(confirmed=false){
    if(this.tournament?.status==='active'&&!confirmed){
     this.showModal('replace-tournament','覆盖现有赛程？','<p>新建赛程会替换当前武道大会的存档。若想接着打，请先选择「继续武道大会」。</p>',[{id:'back',label:'保留现有赛程'},{id:'confirm-new-tournament',label:'覆盖并创建',primary:true}]);
     return;
    }
   this.stageIndex=0;
   this.tournament=DV.createTournament(DV.roster,this.indices[0],{assistIndex:this.assistIndices[0],difficulty:this.difficulty,stageIndex:0,format:this.format,timer:this.timer});
   this.mode='tournament';this.lastGameOutcome=null;this.saveTournament();this.save();this.showTournament(true);
  }
  resumeTournament(){
   if(!this.tournament||!DV.validateTournament(this.tournament,DV.roster))return;
   this.mode='tournament';this.indices[0]=this.tournament.playerIndex;this.assistIndices[0]=this.tournament.assistIndex;
   this.difficulty=this.tournament.difficulty;this.stageIndex=this.tournament.stageIndex;this.format=this.tournament.format;this.timer=this.tournament.timer;
   if(this.tournament.status==='active')this.showTournament();else this.showTournamentSummary();
  }
  tournamentMarkup(draw=false){
   const cup=this.tournament,roundNames=['八强赛','半决赛','决赛'],player=DV.roster[cup.playerIndex];
   const rivalIndex=cup.status==='active'?DV.currentOpponent(cup):cup.history.at(-1)?.opponentIndex;
   const rival=DV.roster[rivalIndex],score=`${cup.duel.playerWins} : ${cup.duel.opponentWins}`;
    const headline=draw?'抽签完成':cup.status==='champion'?'冠军诞生':cup.status==='eliminated'?'赛程结束':this.lastGameOutcome==='draw'?'本局平局':this.lastGameOutcome==='win'&&cup.duel.playerWins>0?'本局获胜':this.lastGameOutcome==='loss'&&cup.duel.opponentWins>0?'本局失利':cup.round===0?'八强赛待开始':`晋级${roundNames[cup.round]}`;
   const columns=cup.rounds.map((rounds,round)=>`<section class="dv-cup-round"><h2><small>0${round+1}</small> ${roundNames[round]}</h2>${rounds.map((match,index)=>{
    const current=cup.status==='active'&&round===cup.round&&match.slots.includes(cup.playerIndex);
    return `<div class="dv-cup-match ${current?'current':''}"><small>第 ${index+1} 场 ${current?'· 当前对阵':''}</small>${match.slots.map(slot=>{
     const spec=slot===null?null:DV.roster[slot];return `<div class="dv-cup-fighter ${slot===cup.playerIndex?'player':''} ${slot!==null&&match.winner===slot?'winner':''}"><span>${spec?esc(spec.name):'待定'}</span><small>${spec?esc(spec.form):'—'}</small></div>`;
    }).join('')}</div>`;
   }).join('')}</section>`).join('');
   const nextLabel=this.lastGameOutcome==='draw'?'重赛本局':cup.duel.games.length?`开始第 ${cup.duel.games.length+1} 局`:`开始${roundNames[cup.round]}`;
   return `<div class="dv-tournament ${draw?'is-draw':''}"><div class="dv-cup-topline"><span>03 / 03　大会签表</span><button data-cup="exit">返回主界面 ×</button></div><header><span class="dv-cup-kicker">TENKAICHI BUDOKAI · OFFICIAL DRAW</span><h1>${headline}</h1><p>${cup.status==='active'?`${roundNames[cup.round]} · ${cup.format==='bo3'?'三局两胜':'一局定胜负'} · ${cup.timer==='infinite'?'无限时长':'99 秒'}`:'本届大会全部对局已结束'}</p></header><section class="dv-cup-feature"><div class="dv-cup-contender"><canvas data-cup-portrait="${cup.playerIndex}" width="260" height="270" aria-label="${esc(player.name)}立绘"></canvas><strong>${esc(player.name)}</strong><small>${esc(player.form)}</small></div><div class="dv-cup-versus"><span>NEXT MATCH</span><b>VS</b><strong>${cup.status==='active'?score:'赛程结束'}</strong><small>${cup.status==='active'?`第 ${cup.duel.games.length+1} 局 · 先胜 ${cup.format==='bo3'?2:1} 局晋级`:'查看完整签表与赛程总结'}</small></div><div class="dv-cup-contender rival"><canvas data-cup-portrait="${rivalIndex}" width="260" height="270" aria-label="${esc(rival.name)}立绘"></canvas><strong>${esc(rival.name)}</strong><small>${esc(rival.form)}</small></div></section><div class="dv-cup-bracket">${columns}</div><footer><span>每局结束后自动存档 · 离开战斗将从本局重新开始</span><div>${cup.status==='active'?`<button class="dv-cup-primary" data-cup="fight">${nextLabel} →</button>`:'<button class="dv-cup-primary" data-cup="summary">查看赛程总结 →</button>'}<button data-cup="select">返回选人</button></div></footer></div>`;
  }
  paintCupPortraits(){this.root.querySelectorAll('[data-cup-portrait]').forEach(canvas=>{const spec=DV.roster[+canvas.dataset.cupPortrait];if(!spec)return;const src=DV.resolvePortraitSource?.(spec),im=src&&DV.asset?.(src);if(im&&DV.assetReady&&!DV.assetReady(im))im.addEventListener('load',()=>{if(this.active&&['tournament','summary'].includes(this.screen))this.paintCupPortraits();},{once:true});const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);DV.portrait(c,spec,0,0,canvas.width,canvas.height);});}
  showTournament(draw=false){
   if(!this.tournament)return;
   this.clearHeld();this.match=null;this.screen='tournament';this.modalKind=null;this.resultPending=0;
   this.root.innerHTML=this.tournamentMarkup(draw);this.paintCupPortraits();
   this.root.querySelectorAll('[data-cup]').forEach(button=>button.onclick=()=>{this.sound.play('confirm');const action=button.dataset.cup;if(action==='fight')this.startTournamentMatch();if(action==='summary')this.showTournamentSummary();if(action==='select')this.showSelect();if(action==='exit')this.close();});
  }
  summaryMarkup(){
   const cup=this.tournament,won=cup.status==='champion',player=DV.roster[cup.playerIndex],roundNames=['八强赛','半决赛','决赛'];
   const games=cup.history.reduce((total,record)=>[total[0]+record.score[0],total[1]+record.score[1]],[0,0]);
   const journey=cup.history.map(record=>`<div class="dv-cup-journey-row"><span>${roundNames[record.round]}</span><strong>${esc(DV.roster[record.opponentIndex].name)}</strong><b class="${record.score[0]>record.score[1]?'won':'lost'}">${record.score.join(' : ')}</b></div>`).join('');
   return `<div class="dv-cup-screen dv-cup-summary ${won?'is-champion':'is-eliminated'}"><div class="dv-cup-topline"><span>TOURNAMENT REPORT / 本届赛程</span><button data-summary="exit">返回主界面 ×</button></div><main class="dv-cup-summary-grid"><section class="dv-cup-summary-hero"><span class="dv-cup-step">${won?'CHAMPION / 冠军':'ELIMINATED / 止步'}</span><div class="dv-cup-summary-seal">${won?'冠':'终'}</div><h1>${won?'天下第一<br>武道会冠军':'本届赛程<br>到此结束'}</h1><p>${esc(player.name)} · ${esc(player.form)}</p><canvas data-cup-portrait="${cup.playerIndex}" width="320" height="330" aria-label="${esc(player.name)}立绘"></canvas></section><section class="dv-cup-report"><small>OFFICIAL RESULT</small><h2>${won?'冠军总结':'赛程总结'}</h2><div class="dv-cup-report-stats"><div><strong>${cup.history.length}</strong><span>完成对阵</span></div><div><strong>${games[0]}</strong><span>获胜局数</span></div><div><strong>${games[1]}</strong><span>失利局数</span></div></div><h3>${won?'夺冠之路':'参赛历程'}</h3><div class="dv-cup-journey">${journey}</div><div class="dv-cup-report-rules">${cup.format==='bo3'?'三局两胜':'一局定胜负'}　/　${cup.timer==='infinite'?'无限时长':'99 秒'}　/　${({'easy':'简单','normal':'标准','hard':'困难','inferno':'炼狱'})[cup.difficulty]}难度</div><div class="dv-cup-report-actions"><button class="primary" data-summary="new">再办一届 →</button><button data-summary="bracket">查看完整签表</button><button data-summary="select">返回选人</button></div></section></main></div>`;
  }
  showTournamentSummary(){
   if(!this.tournament)return;
   this.clearHeld();this.match=null;this.screen='summary';this.modalKind=null;this.resultPending=0;
   this.root.innerHTML=this.summaryMarkup();this.paintCupPortraits();
   this.root.querySelectorAll('[data-summary]').forEach(button=>button.onclick=()=>{this.sound.play('confirm');const action=button.dataset.summary;if(action==='new')this.showTournamentSettings();if(action==='bracket')this.showTournament();if(action==='select')this.showSelect();if(action==='exit')this.close();});
  }
  startTournamentMatch(){
   const cup=this.tournament,opponent=DV.currentOpponent(cup);if(opponent===null)return;
   this.indices[0]=cup.playerIndex;this.indices[1]=opponent;this.assistIndices[0]=cup.assistIndex;
   this.assistIndices[1]=opponent;this.difficulty=cup.difficulty;this.stageIndex=cup.stageIndex;this.format=cup.format;this.timer=cup.timer;
   this.lastGameOutcome=null;this.tournamentResultHandled=false;this.start();
  }
  loadArt(){for(const path of [DV.portraitAtlas,'assets/versus-expanded/classic-stages.png','assets/versus-tournament-arena.png','assets/vegeta-saga/stages/backgrounds/canyon-pursuit.png']){const im=DV.asset(path);if(!DV.assetReady(im))im.addEventListener('load',()=>{if(this.active&&this.screen==='select'){this.paintTiles();this.paintStages();this.paintHeroes();}},{once:true});}}
  bindUI(){this.root.querySelectorAll('[data-ui]').forEach(b=>b.onclick=()=>{this.sound.unlock();const act=b.dataset.ui;this.sound.play('select');if(act==='online')this.showOnline();if(act==='layout')this.editTouchLayout();if(act==='transform')this.showTransforms(0);if(act==='transform2')this.showTransforms(1);if(act==='moves'){this.showMoveList();}if(act==='boxes'){this.match.debugBoxes=!this.match.debugBoxes;}if(act==='reset-training'&&!this.artLoading){this.clearHeld();if(this.tutorial)this.tutorial.retry();else this.match.restart(false);}if(act==='tutorial')this.startTutorial();if(act==='tutorial-retry'){this.clearHeld();this.tutorial?.retry();}if(act==='tutorial-exit')this.endTutorial();if(act==='start')this.start();if(act==='resume-tournament')this.resumeTournament();if(act==='settings-back')this.showTournamentSettings();if(act==='help')this.showHelp();if(act==='exit')this.close();if(act==='pause')this.pause();if(act==='sound'){this.sound.muted=!this.sound.muted;b.textContent=this.sound.muted?'声音 关':'声音 开';this.save();}if(act==='fullscreen'){if(!document.fullscreenElement)this.root.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();}if(act==='random'){this.indices=[Math.floor(Math.random()*100),Math.floor(Math.random()*100)];this.stageIndex=Math.floor(Math.random()*DV.stages.length);this.markGrid();this.updatePanels();this.chooseStage(this.stageIndex);}});}
  buildGrid(){this.visible=DV.characters.map(ch=>{const i=DV.roster.findIndex(s=>s.characterId===ch.id&&(this.filter==='ALL'||s.era===this.filter));return {s:DV.roster[i],i};}).filter(v=>v.i>=0);this.cursor=Math.max(0,this.visible.findIndex(v=>v.s.characterId===this.fighter(this.side).characterId));this.el('.dv-grid').innerHTML=this.visible.map(({s,i})=>`<button class="dv-tile" data-index="${i}" title="${esc(s.name)}" aria-label="${esc(s.name)}"><canvas width="120" height="110"></canvas><span class="dv-form-tag">${esc(s.name)}</span><span class="dv-variant-count">${DV.roster.filter(f=>f.characterId===s.characterId).length}</span></button>`).join('');this.root.querySelectorAll('[data-index]').forEach(b=>{b.onclick=()=>this.select(+b.dataset.index);b.onpointerenter=()=>{const s=DV.roster[+b.dataset.index];this.el('.dv-selection-hint').textContent=s.name+' · '+DV.roster.filter(f=>f.characterId===s.characterId).length+'个时期／形态';};});if(!this.el('.dv-form-options')){const forms=document.createElement('div');forms.className='dv-form-options';forms.setAttribute('aria-label','时期与形态');this.el('.dv-grid').after(forms);}this.paintTiles();this.markGrid();this.buildForms();}
  buildForms(){const holder=this.el('.dv-form-options');if(!holder)return;const fighter=this.fighter(this.side);holder.innerHTML=`<span class="dv-forms-label">${esc(fighter.name)}<small>时期 / 形态</small></span>`+DV.roster.map((s,i)=>({s,i})).filter(({s})=>s.characterId===fighter.characterId).map(({s,i})=>`<button data-form="${i}" class="${i===this.indices[this.side]?'active':''}" style="--form-color:${s.color}">${esc(s.form)}</button>`).join('');holder.querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{this.indices[this.side]=+b.dataset.form;this.updatePanels();this.updateSelectMode();this.buildForms();this.markGrid();this.save();this.sound.play('select');});}
  shortForm(s){const form=s.form.replace(/孙悟空|贝吉塔|孙悟饭|人造人/g,'').replace(/超级赛亚人/g,'超赛').replace(/超级赛亚/g,'超赛');return form.length>8?form.slice(-8):form;}
  paintTiles(){this.root.querySelectorAll('[data-index]').forEach(b=>{const s=DV.roster[+b.dataset.index],cv=b.querySelector('canvas'),c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);DV.portrait(c,s,0,0,cv.width,cv.height,'tile');if(/超|界王|野兽|极意|黄金|潜能/.test(s.form)){const g=c.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,s.color+'33');g.addColorStop(1,s.color+'00');c.fillStyle=g;c.fillRect(0,0,cv.width,cv.height);c.fillStyle=s.color;c.fillRect(cv.width-5,0,5,cv.height);}});}
  markGrid(){this.root.querySelectorAll('[data-index]').forEach(b=>{const i=+b.dataset.index,id=DV.roster[i].characterId,p1=id===this.fighter(0).characterId,p2=this.mode!=='tournament'&&id===this.fighter(1).characterId;b.classList.toggle('selected-p1',p1);b.classList.toggle('selected-p2',p2);b.classList.toggle('electric-p1',p1&&!p2);b.classList.toggle('cursor',i===this.visible[this.cursor]?.i);b.querySelector('.dv-pbadge')?.remove();if(p1||p2){const badge=document.createElement('span');badge.className='dv-pbadge';badge.textContent=p1&&p2?'P1/P2':p1?'P1':'P2';b.appendChild(badge);}});}
  chooseSide(side){if(this.mode==='tournament'&&side===1)return;this.side=side;this.step=side;this.cursor=Math.max(0,this.visible.findIndex(v=>v.s.characterId===this.fighter(side).characterId));this.markGrid();this.updatePanels();this.buildForms();this.sound.play('select');}
  select(index){this.indices[this.side]=index;this.sound.select?.(this.fighter(this.side),this.side);this.cursor=Math.max(0,this.visible.findIndex(v=>v.s.characterId===this.fighter(this.side).characterId));this.markGrid();this.updatePanels();this.updateSelectMode();this.buildForms();this.save();this.sound.play('select');}
  updatePanels(){for(const side of [0,1]){const s=this.fighter(side),helper=DV.roster[this.assistIndices[side]],panel=this.el(`[data-side="${side}"]`);panel.querySelector('h2').textContent=s.name;panel.querySelector('.dv-form').textContent=s.form;panel.querySelector('.dv-era-label').textContent=(DV.eraLabels?.[s.era]||s.era).toUpperCase();const mv=DV.resolveMoves?DV.resolveMoves({spec:s,assist:helper}):null;const supLabel=(mv&&mv.super&&mv.super.label&&mv.super.label!=='super')?mv.super.label:s.moves.super;panel.querySelector('.dv-super-name span').textContent=supLabel;panel.querySelector('.dv-panel-status').textContent=this.side===side?'◈ 选择中':this.step>side?'✓ 已就绪':'待命';const info=assistText(helper,s),copy=panel.querySelector('.dv-assist-copy');if(copy)copy.textContent=`${info.role} · ${info.name}${info.maxUses?' · 每局 '+info.maxUses+' 次':''}${info.bond?' · '+info.bond:''}${info.condition?'（'+info.condition+'）':''} ${info.guide}`;[s.stats.power/1.3,s.stats.speed/370,s.stats.health/1300].forEach((v,i)=>panel.querySelectorAll('.dv-stats em')[i].style.setProperty('--value',Math.min(100,v*100)+'%'));}this.el('.dv-selection-hint').textContent=this.step===2?'战士已就绪 · J 开始对战':`P${this.side+1} · ${this.fighter(this.side).name} · ${this.fighter(this.side).form}`;const stageLabel=this.el('.dv-stage-name');if(stageLabel&&DV.stages[this.stageIndex])stageLabel.textContent=' / '+DV.stages[this.stageIndex].name;this.paintHeroes();this.warmSelectionArt();}
   paintHeroes(){if(!DV.drawFighter)return;const frame=selectPreviewFrame(this.selectPreviewSeconds);for(const side of [0,1]){const cv=this.el(`[data-side="${side}"] .dv-hero`);if(!cv)continue;const c=cv.getContext('2d'),s=this.fighter(side);c.clearRect(0,0,cv.width,cv.height);c.save();c.globalAlpha=.08;DV.portrait(c,s,0,10,440,400);c.restore();const g=c.createRadialGradient(220,340,10,220,330,180);g.addColorStop(0,s.color+'30');g.addColorStop(1,s.color+'00');c.fillStyle=g;c.fillRect(0,0,440,460);c.fillStyle=s.color+'50';c.beginPath();c.ellipse(220,437,117,10,0,0,Math.PI*2);c.fill();DV.drawFighter(c,{spec:s,facing:side?-1:1,state:'idle',frame,grounded:true},220,430,2.55);}}
  paintStages(){this.root.querySelectorAll('[data-stage]').forEach(b=>{const cv=b.querySelector('canvas');DV.stageArt(cv.getContext('2d'),DV.stages[+b.dataset.stage],0,0,240,135,0);});}
  chooseStage(index){this.stageIndex=(index+DV.stages.length)%DV.stages.length;this.root.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',+b.dataset.stage===this.stageIndex));const label=this.el('.dv-stage-name');if(label)label.textContent=' / '+DV.stages[this.stageIndex].name;this.sound.play('select');this.save();}
  confirm(){if(this.mode==='tournament'){this.beginTournament();return;}if(this.step===0){this.chooseSide(1);this.sound.play('confirm');}else if(this.step===1){this.step=2;this.updatePanels();this.sound.play('confirm');}else this.start();}
  start(){
   if(this.screen==='select'&&this.mode==='tournament'){this.beginTournament();return;}
   if(this.mode==='tournament')this.tournamentResultHandled=false;
   this.touchControls?.destroy();this.touchControls=null;this.save();this.clearHeld();this.resultPending=0;this.feedbackUntil=0;this.lastFeedback=null;this.tutorialPaint=null;this.tutorial?.retry();this.screen='battle';this.modalKind=null;this.sound.unlock();this.sound.play('confirm');
   const assist=side=>DV.roster[this.assistIndices[side]]||this.fighter(side);
   this.match=new DV.Match({p1:this.fighter(0),p2:this.fighter(1),assist1:assist(0),assist2:assist(1),mode:['local','online'].includes(this.mode)?'local':'cpu',difficulty:this.difficulty,training:this.mode==='training',timeLimit:this.mode==='tournament'&&this.timer==='infinite'?null:99,onEvent:(type,data)=>this.combatEvent(type,data)});
   this.sound.stop?.();this.sound.preload?.(this.match.fighters.flatMap(f=>[f.spec,f.assist]));
   this.root.innerHTML=`<div class="dv-battle"><canvas id="dv-arena" width="1280" height="720" aria-label="龙珠对战场地"></canvas><div class="dv-battlebar"><span>${this.mode==='tournament'?`<b>${['八强赛','半决赛','决赛'][this.tournament.round]} · 第 ${this.tournament.duel.games.length+1} 局 · ${this.tournament.duel.playerWins}:${this.tournament.duel.opponentWins}</b>　`:''}${this.battleHints()}</span><div><button data-ui="moves">出招表</button><button data-ui="transform">变身 T</button>${this.mode==='local'?'<button data-ui="transform2">P2 变身 0</button>':''}${this.mode==='training'?`${this.tutorial?'':'<button data-ui="tutorial">一分钟教学</button>'}<button data-ui="boxes">判定 F3</button><button data-ui="reset-training">重置训练</button>`:''}<button data-ui="help">键位</button><button data-ui="fullscreen">全屏 F</button><button data-ui="layout" class="dv-layout-entry">按键</button><button data-ui="pause">${this.mode==='online'?'菜单':'暂停 Esc'}</button></div></div><div class="dv-toast" role="status"></div><div class="dv-bond-toast" role="status"></div>${this.tutorial?this.tutorialMarkup():''}${this.touchMarkup()}</div>`;
   this.ctx=this.el('#dv-arena').getContext('2d');this.bindUI();this.bindTouchControls();
   this.match.options.tutorial=!!this.tutorial;this.updateTutorial();this.prepareBattleArt();
  }
  startTutorial(){
   if(this.tutorial||!DV.Tutorial)return;
   this.tutorialReturn={mode:this.mode,screen:this.screen,indices:this.indices.slice(),assistIndices:this.assistIndices.slice(),stageIndex:this.stageIndex,side:this.side,step:this.step};
   this.tutorial=new DV.Tutorial();this.mode='training';
   this.indices=['goku-ssj','vegeta-scouter'].map(id=>DV.roster.findIndex(s=>s.id===id));this.stageIndex=0;this.start();
  }
  restoreTutorialSelection(){
   if(!this.tutorialReturn)return null;
   const saved=this.tutorialReturn;this.tutorial=null;this.tutorialReturn=null;
   for(const key of ['mode','indices','assistIndices','stageIndex','side','step'])this[key]=saved[key];
   return saved;
  }
  endTutorial(){
   this.clearHeld();const saved=this.restoreTutorialSelection();
   if(saved?.mode==='training'&&saved.screen==='battle')this.start();else this.showSelect();
  }
  tutorialMarkup(){
   return `<aside class="dv-tutorial" aria-label="四步互动教学"><div class="dv-tutorial-copy" aria-live="polite"></div><div class="dv-tutorial-progress"><i></i></div><div class="dv-tutorial-actions"><button data-ui="tutorial-retry">重试本步</button><button data-ui="tutorial-exit">跳过教学</button></div></aside>`;
  }
  updateTutorial(){
   if(!this.tutorial)return;const panel=this.el('.dv-tutorial');if(!panel)return;
   const state=this.tutorial.snapshot(this.match),signature=`${state.step}:${state.complete}:${state.telegraph}`;
   if(this.tutorialPaint!==signature){
    this.tutorialPaint=signature;
    panel.querySelector('.dv-tutorial-copy').innerHTML=`<small>${state.complete?'教学完成':`互动教学 · ${state.step+1} / 4`}</small><h2>${esc(state.info.title)}</h2><p>${esc(state.telegraph?'对手即将出拳 · 按住防御':state.info.task)}</p>${state.complete?'':`<div class="dv-tutorial-control"><kbd class="dv-tutorial-key">${esc(state.info.key)}</kbd><b class="dv-tutorial-touch">${esc(state.info.touch)}</b><span>${esc(state.telegraph?'对手即将出拳 · 按住防御':state.info.tip)}</span></div>`}`;
    panel.classList.toggle('is-telegraph',!!state.telegraph);panel.classList.toggle('is-complete',state.complete);
    panel.querySelector('[data-ui="tutorial-retry"]').hidden=state.complete;
    panel.querySelector('[data-ui="tutorial-exit"]').textContent=state.complete?'完成，返回':'跳过教学';
   }
   panel.querySelector('.dv-tutorial-progress i').style.width=`${state.complete?100:Math.round(state.progress*100)}%`;
   if(state.complete){if(this.mode!=='online')this.match.paused=true;this.clearHeld();}
  }
  async prepareBattleArt(){
   if(!DV.preloadFighterArt||!this.match)return;
   const match=this.match,token=this.artLoadToken={};if(this.mode!=='online')match.paused=true;this.artLoading=true;
   this.el('.dv-loading')?.remove();const panel=document.createElement('div');panel.className='dv-loading';
   panel.innerHTML='<div class="dv-loading-card" role="status"><small>准备对战</small><h2>正在加载战士动作…</h2><p>马上就好</p></div>';this.root.appendChild(panel);
   let result;try{result=await DV.preloadFighterArt(match.fighters.flatMap(f=>[f.spec,f.assist]));}catch(_){result={ready:false,failed:[]};}
   if(this.match!==match||this.screen!=='battle'||!this.active||this.artLoadToken!==token)return;
   if(result.ready){panel.remove();this.artLoading=false;if(this.mode!=='online'&&!this.modalKind&&!this.tutorial?.complete)match.paused=false;return;}
   panel.innerHTML=`<div class="dv-loading-card" role="alert"><small>暂时无法开始</small><h2>战士动作加载失败</h2><p>请重试，或返回选人界面。</p><div><button data-loading="retry">重新加载</button><button data-loading="select">返回选人</button></div></div>`;
   panel.querySelectorAll('[data-loading]').forEach(b=>b.onclick=()=>b.dataset.loading==='retry'?this.prepareBattleArt():this.showSelect());
  }
  inputFeedback(type,data){
   if(data.side!==this.localSide()&&this.mode!=='local')return;
   if(type==='inputBuffered'&&this.mode!=='training')return;
   const now=performance.now(),key=`${data.side}:${type}:${data.reason||data.action}`;
   if(this.lastFeedback===key&&now<(this.feedbackUntil||0))return;
   this.lastFeedback=key;this.feedbackUntil=now+500;
   const label=({light:'轻击',heavy:'重击',ki:'气弹',super:'必杀',dash:'冲刺'})[data.action]||'下一招';
   const message=type==='inputBuffered'?`${label}已预输入 · 等待动作衔接`:data.message;
   if(message)this.notice((this.mode==='local'?`P${(data.side??0)+1} · `:'')+message,type==='commandRejected'?1500:850,type==='commandRejected'?'error':'info');
  }
  warmSelectionArt(){
   if(!this.active||this.screen!=='select'||!DV.preloadFighterArt)return;
   clearTimeout(this.selectionArtTimer);this.selectionArtTimer=setTimeout(()=>{
    if(this.active&&this.screen==='select')DV.preloadFighterArt([this.fighter(0),this.fighter(1)]).catch(()=>{});
   },180);
  }
  /* 战斗条提示：只列出「这个角色真的有」的键位，
     否则玩家根本不知道布欧／沙鲁有吸收这种招牌机制。 */
  battleHints(){
   const base='<b>AD</b> 移动　<b>S</b> 防御　<b>J</b> 轻击　<b>H</b> 重击　<b>G</b> 投技　<b>C</b> 反击　<b>K</b> 跳　<b>L</b> 冲刺　<b>U</b> 远攻　<b>I</b> 必杀　<b>O</b> 援助　<b>W</b> 蓄气　<b>S+U</b> 副技能　<b>Y</b> 脱身';
   try{
    const spec=this.fighter(0),mv=DV.resolveMoves?DV.resolveMoves(spec):{};
    const extra=[];
    if(mv.absorb)extra.push('<b>Z</b> '+(mv.absorb.label||'吸收')+(mv.absorb.absorb&&mv.absorb.absorb.swallow?'（吞入体内）':''));
    if(mv.psycho)extra.push('<b>V</b> '+(mv.psycho.label||'念动力'));
    if(mv.giant)extra.push('<b>X</b> '+(mv.giant.label||'巨大化'));
    return base+(extra.length?'　'+extra.join('　'):'');
   }catch(err){return base;}
  }
  /* 触屏按钮：吸收／念动力／巨大化只在该角色拥有时出现 */
  currentTouchMoves(){const side=this.localSide();return DV.resolveMoves?DV.resolveMoves(this.match?.fighters?.[side]||{spec:this.fighter(side),assist:DV.roster[this.assistIndices[side]]}):{};}
  touchButtons(){
   try{const moves=this.currentTouchMoves();return DV.mobileControlGroups?DV.mobileControlGroups(moves):DV.touchControlGroups(moves);}
   catch(err){return DV.touchControlGroups({});}
  }
  touchMarkup(){
   if(DV.touchControlsMarkup)return DV.touchControlsMarkup(this.currentTouchMoves());
   const groups=this.touchButtons(),button=item=>`<button data-action="${item.action}" aria-label="${item.label}">${item.label}</button>`;
   return `<div class="dv-touch" aria-label="触屏战斗控制"><div class="dv-touch-pad"><button class="dv-direction" data-input="left" aria-label="向左">◀</button><button class="dv-direction" data-input="right" aria-label="向右">▶</button><button class="dv-direction" data-input="charge" aria-label="蓄气">蓄气</button><button class="dv-direction" data-input="guard" aria-label="防御">防御</button></div><div class="dv-touch-actions">${groups.primary.map(button).join('')}<button class="dv-touch-more-toggle" data-touch-more aria-expanded="false">更多</button></div><div class="dv-touch-extra" hidden>${groups.extra.map(button).join('')}</div><div class="dv-touch-hint">横屏游玩更舒适</div></div>`;
  }
  presentationEvent(kind,data={}){
   const m=this.match;if(!m)return;const side=data.side??0,target=m.fighters[kind==='guard'?side:(data.targetSide??(1-side))],attacker=m.fighters[data.attackerSide??side];if(!target)return;
   const p=m.presentation||(m.presentation={effects:[],hpTrail:m.fighters.map(f=>f.hp/f.maxHp),hpHold:[0,0],lastTick:m.tick});
   p.effects.push({kind,x:data.x??target.x,y:data.y??target.y+80,dir:data.facing??attacker?.facing??1,life:kind==='heavy'?15:9,max:kind==='heavy'?15:9});
   if(kind==='guard'||['melee','heavy','launcher'].includes(data.hitType)){
    p.effects=p.effects.filter(e=>e.kind!=='feedback'||Math.abs(e.x-target.x)>80);
    p.effects.push({kind:'feedback',label:kind==='guard'?'防御成功':data.hitType==='launcher'?'浮空命中':kind==='heavy'?'重击命中':'命中',color:kind==='guard'?'#9cedff':kind==='heavy'?'#ffe08a':'#fff',x:target.x,y:target.y+180,life:32,max:32});
   }
   if(kind==='hit'||kind==='heavy'){p.hpTrail[target.side]=Math.max(p.hpTrail[target.side]??1,target.hp/target.maxHp);p.hpHold[target.side]=18;}
  }
  updatePresentation(){const m=this.match;if(!m)return;const p=m.presentation||(m.presentation={effects:[],hpTrail:m.fighters.map(f=>f.hp/f.maxHp),hpHold:[0,0],lastTick:m.tick});const frames=Math.max(0,Math.min(4,m.tick-(p.lastTick??m.tick)));p.lastTick=m.tick;p.effects=p.effects.filter(e=>(e.life-=frames)>0);m.fighters.forEach((f,i)=>{const prev=p.previous?.[i]||{};if(prev.grounded===false&&f.grounded)p.effects.push({kind:'landing',x:f.x,y:0,life:13,max:13});const hold=(p.hpHold[i]??0)-frames;p.hpHold[i]=Math.max(0,hold);if(hold<=0)p.hpTrail[i]=Math.max(f.hp/f.maxHp,(p.hpTrail[i]??1)-frames*.0025);(p.previous||(p.previous=[]))[i]={grounded:f.grounded};});}
  bondNotice(data={}){const el=this.el('.dv-bond-toast'),side=data.side??data.ownerSide??0;if(!el||!this.match)return;const main=this.match.fighters[side]?.spec,helper=this.match.fighters[side]?.assist,bond=data.label||(DV.assistBond&&DV.assistBond(main,helper)?.label);if(!bond)return;el.textContent=`◉ ${main?.name||''}  ×  ${helper?.name||''} ◉  ${bond}`;el.classList.add('visible');clearTimeout(this.bondTimer);this.bondTimer=setTimeout(()=>el.classList.remove('visible'),1300);}
  combatEvent(type,data={}){if(['transformEnd','swallow','release'].includes(type))this.touchControls?.refresh();this.tutorial?.event(type,data);if(['commandRejected','inputBuffered','whiff'].includes(type)){this.inputFeedback(type,data);return;}const bt3=typeof this.sound.event==='function';if(bt3)this.sound.event(this.match,type,data);if(type==='hit'){this.presentationEvent(data.heavy?'heavy':'hit',data);if(!bt3)this.sound.playHit(!!data.heavy);}else if(type==='guard'||type==='barrier'){this.presentationEvent('guard',data);if(!bt3)this.sound.play('guard');}else if(!bt3)this.sound.play(type==='transformStart'?'super':type==='transformEnd'?'burst':type==='throwLaunch'?'grabbed':type==='throwTeleport'?'teleport':type==='throwSlam'?'throw':type);if(type==='transformStart')this.notice('变身 · '+data.name,1000);else if(type==='transformEnd')this.notice(data.name+'！',1300);else if(type==='super')this.notice(data.name,1400);else if(type==='unique')this.notice(data.name,1100);else if(type==='aoe')this.notice(data.name,1100);else if(type==='burst')this.notice('爆气觉醒 · SPARKING!',1200);else if(type==='assist')this.notice((data.label||data.name||'援助')+' · 援护登场',850);else if(type==='assistStrike')this.notice('发动 · '+(data.label||'援助技'),650);else if(type==='bond')this.bondNotice(data);else if(type==='break')this.notice('GUARD BREAK · 破防',1000);else if(type==='counter')this.notice('COUNTER · 反击成功',1100);else if(type==='tech')this.notice('挣脱！',900);else if(type==='throw')this.notice('投技命中',900);else if(type==='throwLaunch')this.notice('抛空！',550);else if(type==='throwTeleport')this.notice('瞬移追击！',550);else if(type==='throwSlam')this.notice('砸地追击！',900);else if(type==='teleport')this.notice('瞬间移动',700);else if(type==='escape')this.notice((data.label||'脱身')+'！　剩余脱身 '+(data.left!=null?data.left:0)+' 次',1100);else if(type==='comboBreak')this.notice('连段中断！',900);
   /* 吸收的完整反馈链：起手 → 命中（吸取/回复数值）→ 吞入体内（继承招式）→ 吐出 */
   else if(type==='absorbStart')this.notice(data.label||'吸收',700);
   else if(type==='absorb')this.notice((data.label||'吸收')+'！　吸取 '+Math.round(data.drain||0)+' 生命　回复 '+Math.round(data.healed||0),1300);
   else if(type==='swallow')this.notice('吸入体内 · 已继承 '+(data.label||'对方招式'),1500);
   else if(type==='release')this.notice('被吐了出来！',1100);else if(type==='clashEnd')this.notice(data.winner===null?'势均力敌！':`P${data.winner+1} 对波胜出！`,1300);else if(type==='ko'){this.resultPending=performance.now()+2500;}}
  notice(message,duration=1000,tone='info'){const el=this.el('.dv-toast');if(!el)return;el.textContent=message;el.dataset.tone=tone;el.classList.add('visible');this.noticeUntil=performance.now()+duration;}
  result(){if(this.mode==='online')return this.onlineResult();if(!this.match||this.match.phase!=='over')return;const winner=this.match.winner;
   if(this.mode==='tournament'&&this.tournament){
    if(!this.tournamentResultHandled){
     this.lastGameOutcome=winner===null?'draw':winner===0?'win':'loss';
     if(winner!==null){this.tournament=DV.settleTournament(this.tournament,this.lastGameOutcome,Math.random,DV.roster);this.saveTournament();}
     this.tournamentResultHandled=true;
    }
    if(this.tournament.status==='active')this.showTournament();else this.showTournamentSummary();
    return;
   }
   const title=winner===null?'DRAW · 平局':this.match.fighters[winner].spec.name+' 获胜';const description=winner===null?'双方势均力敌，再战一局。':`${this.match.fighters[winner].spec.form} · ${DV.stages[this.stageIndex].name}`;this.showModal('result',title,`<p>${esc(description)}</p><p>${winner===null?'':`剩余体力 ${Math.ceil(this.match.fighters[winner].hp)}　·　剩余时间 ${this.match.time} 秒`}</p>`,[{id:'rematch',label:'再战一局',primary:true},{id:'select',label:'返回选人'},{id:'exit',label:'返回大厅'}]);}
  key(e,down){
   if(this.active&&(this.screen==='online'||this.touchControls?.editing)){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();if(down){if(this.touchControls?.editing)this.touchControls.closeEditor(false);else this.showSelect();}}return;}
   if(!this.active)return;if(e.target?.isContentEditable||['INPUT','TEXTAREA'].includes(e.target?.tagName)){e.stopImmediatePropagation();return;}const relevant=['Space','Enter','Escape','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','KeyJ','KeyH','KeyK','KeyL','KeyU','KeyI','KeyO','KeyG','KeyC','KeyB','KeyY','KeyZ','KeyV','KeyX','KeyQ','KeyE','KeyF','KeyM','KeyR','KeyT','Digit0','Numpad0','NumpadAdd','Minus','F3',...Object.keys(P2)];if(!relevant.includes(e.code)){e.stopImmediatePropagation();return;}
   // Preserve native select navigation, but never let the old adventure listener see it.
   if(e.target instanceof HTMLSelectElement||(['settings','tournament','summary'].includes(this.screen)||this.modalKind)&&e.code==='Tab'){e.stopImmediatePropagation();return;}
   e.preventDefault();e.stopImmediatePropagation();
   if(down){if(this.pressed.has(e.code)||e.repeat)return;this.pressed.add(e.code);this.sound.unlock();}else this.pressed.delete(e.code);
   if(this.modalKind){
    if(!down)return;
    if(e.code==='Escape'){this.modalAction(this.modalKind==='result'?'select':'back');return;}
    const buttons=[...this.root.querySelectorAll('.dv-modal button:not(:disabled)')];
    if(['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
     const index=buttons.indexOf(document.activeElement),direction=['KeyA','KeyW','ArrowLeft','ArrowUp'].includes(e.code)?-1:1;
     buttons[(index+direction+buttons.length)%buttons.length]?.focus();return;
    }
    if(['KeyJ','Enter','Space'].includes(e.code))(this.root.querySelector('.dv-modal button:focus')||this.root.querySelector('.dv-modal button.primary')||buttons[0])?.click();
    return;
   }
   if(down&&e.code==='KeyM'){this.sound.muted=!this.sound.muted;this.save();return;}
   if(down&&e.code==='KeyF'){if(document.fullscreenElement)document.exitFullscreen?.();else this.root.requestFullscreen?.().catch(()=>{});return;}
   if(this.screen==='settings'){
    if(!down)return;
    if(e.code==='Escape'){this.close();return;}
    if(['KeyJ','Enter','Space'].includes(e.code)){if(e.target?.dataset?.setting||e.target?.dataset?.settingsAction)e.target.click();else this.showSelect();return;}
    return;
   }
   if(this.screen==='summary'){
    if(!down)return;
    if(e.code==='Escape'){this.close();return;}
    if(['KeyJ','Enter','Space'].includes(e.code)&&e.target?.dataset?.summary)e.target.click();
    return;
   }
   if(this.screen==='tournament'){
    if(!down)return;
    if(e.code==='Escape'){this.showSelect();return;}
    if(['KeyJ','Enter','Space'].includes(e.code)){if(e.target?.dataset?.cup)e.target.click();else if(this.tournament?.status==='active')this.startTournamentMatch();return;}
    return;
   }
   if(this.screen==='online'){if(down&&e.code==='Escape')this.showSelect();return;}
   if(this.touchControls?.editing)return;
   if(this.screen==='select'){
    if(!down)return;
    if(e.code==='Escape'){if(this.mode==='tournament')this.showTournamentSettings();else this.close();return;}if(e.code==='Tab'){this.chooseSide(1-this.side);return;}
    if(e.code==='KeyQ'||e.code==='KeyE'){this.chooseStage(this.stageIndex+(e.code==='KeyQ'?-1:1));return;}
    if(e.code==='KeyR'){const forms=DV.roster.map((s,i)=>({s,i})).filter(({s})=>s.characterId===this.fighter(this.side).characterId);const n=forms.findIndex(v=>v.i===this.indices[this.side]);this.indices[this.side]=forms[(n+1)%forms.length].i;this.updatePanels();this.updateSelectMode();this.buildForms();this.save();return;}
    if(e.code==='KeyJ'||e.code==='Enter'){this.confirm();return;}
    const delta=({KeyA:-1,ArrowLeft:-1,KeyD:1,ArrowRight:1,KeyW:-10,ArrowUp:-10,KeyS:10,ArrowDown:10})[e.code];if(delta){this.cursor=(this.cursor+delta+this.visible.length)%this.visible.length;this.select(this.visible[this.cursor].i);}return;
   }
   if(!this.match)return;if(this.artLoading){if(down&&e.code==='Escape')this.pause();return;}if(this.tutorial?.complete){if(down&&['KeyJ','Enter','Space','Escape'].includes(e.code))this.endTutorial();return;}if(down&&e.code==='KeyT'){this.showTransforms(0);return;}if(down&&['Digit0','Numpad0'].includes(e.code)&&this.mode==='local'){this.showTransforms(1);return;}if(down&&e.code==='F3'&&this.mode==='training'){this.match.debugBoxes=!this.match.debugBoxes;return;}if(down&&e.code==='KeyR'&&this.mode==='training'){this.clearHeld();if(this.tutorial)this.tutorial.retry();else this.match.restart(false);return;}if(down&&e.code==='KeyB'&&this.mode==='training'){this.showMoveList();return;}if(down&&e.code==='Escape'){this.pause();return;}
   /* 组合键：按住「方向下」（P1 S / P2 ↓）+ 远程攻击键（P1 U / P2 4）
      → 发动该角色的副技能（太阳拳、魔封波、吸收、念动力…）。
      必须先于普通 holds／按键转发判断，否则会被当成普通防御或普通远程攻击。 */
   if(HOLD_DOWN_P1[e.code]){
    if(down){this.pressed.add('__holdDown0');this.sendHeld('guard',true);}
    else{this.pressed.delete('__holdDown0');this.sendHeld('guard',false);}
   }
   if(HOLD_DOWN_P2[e.code]&&this.mode==='local'){
    if(down)this.pressed.add('__holdDown1');else this.pressed.delete('__holdDown1');
   }
   if(down){
    if(COMBO_ATTACK_P1[e.code]&&this.pressed.has('__holdDown0')){this.sendCommand('combo');return;}
    if(COMBO_ATTACK_P2[e.code]&&this.mode==='local'&&this.pressed.has('__holdDown1')){this.sendCommand('combo',undefined,1);return;}
   }
   const holds={KeyA:[0,'left'],KeyD:[0,'right'],KeyS:[0,'guard'],KeyW:[0,'charge'],ArrowLeft:[1,'left'],ArrowRight:[1,'right'],ArrowDown:[1,'guard'],ArrowUp:[1,'charge']};
   if(holds[e.code]){const [side,key]=holds[e.code];if(side===0||this.mode==='local')this.sendHeld(key,down,side);}
   if(down){if(P1[e.code])this.sendCommand(e.code==='KeyI'&&this.pressed.has('KeyS')?'burst':P1[e.code]);if(P2[e.code]&&this.mode==='local'&&(e.code!=='Equal'||e.shiftKey))this.sendCommand(P2[e.code]==='super'&&this.pressed.has('ArrowDown')?'burst':P2[e.code],undefined,1);}
  }
  /* 出招表：既用于训练模式，也挂在暂停菜单里。按当前真实可用的招式生成，
     并标出键位与正传来源；不编造招式。 */
  moveListRows(side){
   const live=this.match?this.match.fighters[side]:null;
   /* 对战中必须显示当前形态真正能用的招式；选人预览才使用所选席位。 */
   const runtime=live||{spec:this.fighter(side||0),assist:DV.roster[this.assistIndices[side||0]]};
   const spec=runtime.spec||runtime;
   const skills=DV.resolveSkills?DV.resolveSkills(spec):{};
   const chain=(DV.lightChain?DV.lightChain(spec):['punch1','punch2','kick']);
   const moves=DV.resolveMoves?DV.resolveMoves(runtime):{};
   const sup=(moves.super||skills.super||{});
   const uniq=Object.entries(DV.uniqueMapOf?DV.uniqueMapOf(spec):(skills.unique||{}));
   const inBattle=!!live;
   const cost=m=>m&&m.cost?('<span class="dv-ml-cost">'+m.cost+' 气</span>'):'';
   const rows=[];
   const push=(k,v)=>{ if(v&&v!=='—') rows.push([k,v]); };
   push('轻击连段　<kbd>'+this.primaryKey(side,'light')+'</kbd>', chain.length+' 段连续攻击');
   push('重击　<kbd>'+this.primaryKey(side,'heavy')+'</kbd>', '浮空起手，可接空中连段');
   push('投技　<kbd>'+this.primaryKey(side,'grab')+'</kbd>', '近身抓取后抛空、瞬移追击并砸地；被抓方可拆投');
   push('反击　<kbd>'+this.primaryKey(side,'counter')+'</kbd>', '架势内被攻击则反制');
   /* 脱身：每局限量，被连段锁住时的兜底手段（正传里各角色用自己的机动手段完成） */
   {
    const left=(live&&Number.isFinite(live.escapes))?live.escapes:3;
    const label=(this.match&&this.match.escapeLabel)?this.match.escapeLabel(spec):'脱身';
    push('脱身 · '+esc(label)+'　<kbd>'+this.primaryKey(side,'escape')+'</kbd>',
      '每局 3 次 · 剩余 '+left+' 次　·　被打中、被抓、被吞入体内时也能发动，立刻摆脱并绕到对手背后');
   }
   push('气弹　<kbd>'+this.primaryKey(side,'ki')+'</kbd>', (moves.ki&&moves.ki.cost?moves.ki.cost:8)+' 气');
   push('必杀　<kbd>'+this.primaryKey(side,'super')+'</kbd>',
     (sup.label||spec.moves.super||'—')+(sup.damage?('　'+Math.round(sup.damage)+' 伤害'):'')+(sup.cost?('　'+sup.cost+' 气'):'')+(sup.teamAnimation?'　悟饭生命≤50% · 悟空超赛支援就绪 · 每局一次':''));
    {const helper=live?.assist||DV.roster[this.assistIndices[side]],info=assistText(helper,spec),left=live?.assistCooldown||0,assistCost=Number.isFinite(moves.assist?.cost)?moves.assist.cost:0;
     push('援助　<kbd>'+this.primaryKey(side,'assist')+'</kbd>',`${assistCost} 气 · ${esc(info.role)} · ${esc(info.name)}${info.maxUses?'　<span class="dv-ml-tag">每局 '+info.maxUses+' 次</span>':''}${info.bond?'　<span class="dv-ml-tag">羁绊：'+esc(info.bond)+(info.condition?'（'+esc(info.condition)+'）':'')+'</span>':''}${left>0?'　<span class="dv-ml-tag warn">冷却 '+Math.ceil(left/60)+' 秒</span>':''} · ${esc(info.guide)}`);}
   push('爆气　<kbd>'+this.primaryKey(side,'burst')+'</kbd>', '50 气 · 解除硬直并获得 6 秒强化');
   push('变身　<kbd>'+this.primaryKey(side,'transform')+'</kbd>', '正传形态切换（有冷却）');
   /* 机制类招式：只在该角色真的拥有时列出 */
   if(moves.absorb)push('吸收 · '+esc(moves.absorb.label||'吸收')+'　<kbd>'+this.primaryKey(side,'absorb')+'</kbd>',
     cost(moves.absorb)+'　判定 '+(Number.isFinite(moves.absorb.at)?moves.absorb.at:'?')+'~'+(Number.isFinite(moves.absorb.end)?moves.absorb.end:'?')+' 帧　距离 '+moves.absorb.reach
     +(moves.absorb.absorb&&moves.absorb.absorb.swallow
       ?'　<span class="dv-ml-tag">抓住即吞入体内</span>　<span class="dv-ml-tag">继承对方招式</span>　空格键以外的任意键连打可加速挣脱'
       :'　<span class="dv-ml-tag">吸取生命并强化自身</span>')
     +(live&&live.absorbCooldown>0?('　<span class="dv-ml-tag warn">冷却 '+Math.ceil(live.absorbCooldown/60)+' 秒</span>'):''));
   if(moves.psycho)push('念动力　<kbd>'+this.primaryKey(side,'psycho')+'</kbd>', (moves.psycho.label||'念动力')+'　'+cost(moves.psycho));
   if(moves.giant)push('巨大化　<kbd>'+this.primaryKey(side,'giant')+'</kbd>', (moves.giant.label||'巨大化')+'　'+cost(moves.giant));
   /* 组合键提示：该角色的副技能可以用「方向下＋远程攻击」发动 */
   const combo=DV.comboSkillsOf?DV.comboSkillsOf(spec):[];
   if(combo.length){
    const names=combo.slice(0,3).map(k=>{
      const m=(moves[k]||(DV.uniqueMapOf?DV.uniqueMapOf(spec):{})[k]||{});
      return m.label||k;
    }).filter(Boolean);
    push('副技能　<kbd>'+this.primaryKey(side,'combo')+'</kbd>',
      '组合键发动：'+names.join(' → ')+'（自动取当前可用者）');
   }
   /* 吸收继承说明 */
   if(live&&live.inheritedFrom){
    push('已吸收　'+esc(live.inheritedFrom),'<span class="dv-ml-tag">已继承对方招式，被吐出后失效</span>');
   }
   for(const [key,m] of uniq){
    push('专属技 · '+esc(m.label||key)+'　<kbd>'+this.primaryKey(side,'unique',key)+'</kbd>',
      cost(m)+(m.pierce?'　<span class="dv-ml-tag">穿透</span>':'')+(m.selfCost?'　<span class="dv-ml-tag warn">消耗自身生命</span>':'')+(m.selfHeal?'　<span class="dv-ml-tag">回复自身</span>':'')+(m.damage?('　'+Math.round(m.damage)+' 伤害'):''));
   }
   /* 形态特性（正传形态机制）：直接展示正传里的机制名与出处，
      让「为什么这个形态是这样」在游戏内可查。 */
   if(DV.traitInfo){
    const trait=DV.traitInfo(spec);
    if(trait&&trait.label){
     push('形态特性 · '+esc(trait.label),esc(trait.source||'')+(trait.note?('　'+esc(trait.note)):''));
    }
   }
   /* 被动：用 passiveOf 取，这样 traits.js 的形态特性数值也算在内 */
   const passives=DV.passiveOf?DV.passiveOf(spec):(skills.passive||{});
   if(passives&&Object.keys(passives).length){
    const label={infiniteEnergy:'无限能量（气力被动回复大幅提升）',regen:'再生（脱战后自愈）',absorbKi:'吸收气弹（被气弹命中反而回气）',teleport:'瞬移回避／残像',guardRegenScale:'防御槽回复强化',speedScale:'移动速度强化',pride:'濒死强化（血量低时伤害提升）',rage:'愤怒爆发（血量低时伤害提升）',lowHpDamage:'血量低时伤害提升',damageResist:'硬气防御（减伤）',kaioken:'界气增幅',energyBarrier:'能量障壁（格挡大幅减伤）',kiDrain:'形态维持耗气（正传：该形态无法久持）',hpDrain:'形态维持掉血（正传：界王拳的剧痛与肌肉损伤）',kiRegenBonus:'气力回复强化（正传：不需要分心维持形态）',powerFade:'力量随时间流失（正传：体力耗尽／融合时限）',rampUp:'力量随时间增长（正传：传说型超级赛亚人）',traitPower:'形态固有力量修正',reachScale:'攻击范围修正（正传：未来悟饭独臂）',airJumps:'跳跃次数修正（正传：不会舞空术）'};
    for(const key of Object.keys(passives))rows.push(['被动 · '+esc(label[key]||key),'']);
   }
   return {spec,skills,rows,inBattle};
  }
  showMoveList(side){
   if(this.mode==='online')side=this.localSide();
   const s=(side==null)?((this.match&&this.screen==='battle')?0:(this.side||0)):side;
   const {spec,skills,rows,inBattle}=this.moveListRows(s);
   if(inBattle){this.sound?.stop?.();if(this.mode!=='online')this.match.paused=true;this.clearHeld();}
   const title='出招表 · P'+(s+1)+' '+spec.name+(spec.form?' · '+spec.form:'');
   const sub='<p class="dv-move-source">'+esc(skills.label||spec.form||'')+(skills.style?('　·　'+esc(skills.style)):'')+'</p>';
   const body='<dl class="dv-movelist">'+rows.map(([k,v])=>'<dt>'+k+'</dt><dd>'+(v||'')+'</dd>').join('')+'</dl>';
   const src='<p class="dv-help-notes">按正传设定生成 · 来源：'+esc(skills.source||'通用格斗体系')+(inBattle?'':'（选人界面预览）')+'</p>';
   const buttons=(inBattle&&this.mode==='local'&&s===0)
     ?[{id:'moves:p2',label:'P2 出招表'},{id:'back',label:'返回',primary:true}]
     :[{id:'back',label:'返回',primary:true}];
   this.showModal('moves',title,sub+body+src,buttons);
  }
  /* 键位提示：给玩家看的实际按键 */
  primaryKey(side,action,uniqueKey){
   if(this.mode==='online')side=0;
    if(action==='unique')return side===0?'S+U':'↓+4';
   const map=side===0
     ?{light:'J',heavy:'H',grab:'G',counter:'C',ki:'U',super:'I',assist:'O',burst:'S+I',transform:'T',combo:'S + U',escape:'Y',absorb:'Z',psycho:'V',giant:'X'}
      :{light:'1',heavy:'7',grab:'8',counter:'.',ki:'4',super:'5',assist:'6',burst:'↓+5',transform:'0',combo:'↓ + 4',escape:'+',absorb:'9',psycho:'↓ + 4',giant:'↓ + 4'};
   return map[action]||'—';
  }
  /* 帧步进必须与渲染隔离：requestAnimationFrame 回调里抛出的异常会终止整个
     循环，表现为画面永久卡死且不留任何提示。这里把「推进战斗」和「绘制」分开
     处理——战斗推进出错才中断，绘制出错只记录并跳过该帧，下一帧继续。 */
  loop(time){
   if(!this.active)return;
   const dt=Math.min(.05,(time-this.lastTime)/1000);this.lastTime=time;
   try{
    if(this.screen==='battle'&&this.match){
      if(this.tutorial?.prepare(this.match))this.clearHeld();
      if(this.mode!=='online')this.match.update(dt);           // 联机只接收服务器结果
      this.tutorial?.observe(this.match);this.updateTutorial();
      this.sound.syncCharge?.(this.match);
      this.updatePresentation();
      try{
        DV.renderBattle(this.ctx,this.onlineRenderMatch?.()||this.match,DV.stages[this.stageIndex]);
      }catch(err){ this.reportFrameError('draw',err); }        // 绘制：出错只跳过本帧
      if(time>this.noticeUntil)this.el('.dv-toast')?.classList.remove('visible');
      if(this.resultPending&&time>=this.resultPending){this.resultPending=0;this.result();}
    }
    else if(this.screen==='select'&&!this.modalKind){
      this.selectPreviewSeconds+=dt;
      this.paintRevision++;
      if(this.paintRevision%2===0){ try{ this.paintHeroes(); }catch(err){ this.reportFrameError('paintHeroes',err); } }
    }
   }catch(err){
    this.reportFrameError('update',err);
   }finally{
    this.raf=requestAnimationFrame(t=>this.loop(t));           // 无论如何都要续上循环
   }
  }
  /* 限速上报：同一错误每秒最多打印一次，避免刷爆控制台 */
  reportFrameError(where,err){
   const now=(typeof performance!=='undefined'?performance.now():Date.now());
   if(this._lastFrameErrorAt&&now-this._lastFrameErrorAt<1000)return;
   this._lastFrameErrorAt=now;
   this._lastFrameError={where,message:err&&err.message};
   try{console.error('[DV] frame error in '+where+':',err);}catch{}
  }
 }
 DV.open=function(onExit){if(!DV.roster?.length||!DV.drawFighter)throw new Error('Dragon Versus resources are not ready');if(!DV.app)DV.app=new App();DV.app.open(onExit,'versus');};
 DV.openTournament=function(onExit){if(!DV.roster?.length||!DV.drawFighter)throw new Error('Dragon Versus resources are not ready');if(!DV.app)DV.app=new App();DV.app.open(onExit,'tournament');};
 Object.assign(DV,{App,selectPreviewFrame,touchControlGroups});
})(globalThis);
