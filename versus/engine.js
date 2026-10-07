/* Deterministic 60 Hz combat. A rendered tick never skips animation indices.
 *
 * 深度重构：招式数据化。帧表与判定来自 versus/skills.js 的逐身份招式表；
 * 默认表 DEFAULT_MOVES 与改造前逐字节一致，因此既有回归测试行为不变。
 * 新增机制（全部有正传出处）：重击浮空、空中连段、投技/拆投、反击、
 * 穿透（气圆斩类）、状态效果（致盲/麻痹/封技）、被动（无限能量/再生/吸气）。
 */
(function(root){
  'use strict';
  const DV=root.DV=root.DV||{};
  if(typeof module!=='undefined'&&!DV.transformationOptions)Object.assign(DV,require('./transformations.js'));
  if(typeof module!=='undefined'&&!DV.DEFAULT_MOVES)Object.assign(DV,require('./skills.js'));
  if(typeof module!=='undefined'&&!DV.COMBO_PROFILES)Object.assign(DV,require('./combos.js'));
  if(typeof module!=='undefined'&&!DV.ASSISTS)Object.assign(DV,require('./assists.js'));

  const STEP=1/60, W=1280, FLOOR=564;
  /* 旧常量保留导出，保证外部与既有测试引用不失效 */
  const ACTIONS=DV.DEFAULT_ACTIONS, ATTACKS=DV.DEFAULT_MOVES;
  const FREE=new Set(DV.FREE_STATES), LOOPS=new Set(DV.LOOP_STATES);
  const WALK_SPEED_CAP=560;
  const COMMAND_MESSAGES=Object.freeze({
    paused:'对局已暂停',phase:'当前还不能进行战斗操作',invalidSide:'没有可操作的角色',defeated:'角色已经倒下',
    controlled:'正在受击或受控，暂时无法发动；可尝试脱身',busy:'当前动作尚未结束',
    swallowed:'正在被吸收，连按方向或防御挣扎，也可脱身',techWindowClosed:'拆投窗口已结束，可尝试脱身',
    clash:'正在对波，请连按轻击',clashRateLimit:'对波输入过快，请继续有节奏地连按',
    unavailable:'当前角色没有这项招式',unknownAction:'未识别的操作',holdInput:'防御和蓄气需要按住对应按键',
    insufficientKi:'气力不足，按住蓄气键补充气力',insufficientStamina:'耐力不足，稍等恢复后再冲刺',
    assistCooldown:'援助正在冷却',assistActive:'援助仍在场上',burstCooldown:'爆气正在冷却',
    escapeCooldown:'刚刚脱身，稍等后再使用',absorbCooldown:'吸收正在冷却',teleportCooldown:'瞬移正在冷却',
    usesExhausted:'本局使用次数已用完',airborne:'这项招式需要落地后发动',jumpLimit:'空中跳跃次数已用完，落地后恢复',
    transformCooldown:'变身正在冷却',invalidTransform:'当前形态不能切换到这个目标',giantActive:'巨大化仍在持续'
  });
  const WHIFF_MESSAGES=Object.freeze({
    outOfRange:'攻击落空：距离不够，靠近后再出招',targetAirborne:'攻击落空：对手在空中',
    targetInvulnerable:'攻击落空：对手处于短暂无敌',heightMismatch:'攻击落空：双方高度不一致',
    targetUnavailable:'攻击落空：对手当前无法被命中',missed:'攻击落空：有效帧内没有接触对手'
  });

  /* 状态效果：命中后附加的减益 / 增益，按帧递减，归零即恢复。 */
  const BAD_STATUS=Object.freeze({blind:1,paralyze:1,stun:1,slow:1,burn:1,poison:1,seal:1,freeze:1});
  const BUFF_STATUS=Object.freeze({regen:1,absorb:1,armor:1,hasten:1});

  /* ---------------- 连段保护（防止被连到死） ----------------
   * 问题：命中时把对手的硬直重置成「整段满值」，且连段计数只涨不减益，
   * 于是只要攻击方每次都能在硬直内再打中一下，受击方就永远没有一帧自由行动，
   * 格挡／跳跃／反击的输入全部被静默丢弃 —— 表现就是「被 A 到死」。
   *
   * 这里做三件事（都是格斗游戏的通行做法，与正传设定不冲突）：
   *   1) 硬直衰减：同一套连段里第 N 段给的硬直递减，连到一定段数自然接不上；
   *   2) 击退增长：段数越高把对手推得越远，攻击距离自然够不到；
   *   3) 连段强制保护：达到上限直接切断连段并把受击方弹开，保证一定终止。
   */
  const COMBO_LIMIT=10;            // 单套连段的硬上限（超过即触发连段保护）
  const COMBO_STUN_DECAY=0.13;     // 每段递减的硬直比例
  const COMBO_STUN_FLOOR=0.22;     // 硬直衰减下限（不会衰减到 0）
  const COMBO_PUSH_GROWTH=0.22;    // 每段的击退增长比例
  const COMBO_BREAK_INVULN=20;     // 连段保护给予的无敌帧
  /* 支援不走主战角色的完整招式帧表，但伤害发生时仍必须显示动作的接触帧。
     这些值与默认轻击/气弹动作的有效帧一致，避免先结算命中、画面却还在第 0 帧。 */
  const ASSIST_IMPACT_FRAME=Object.freeze({punch1:8,punch2:10,kick:12,ki:12,super:14});
  /* 受击硬直的最小帧数。注意旧代码这里写的是 Math.max(20, stun)，
     而轻攻击的整套收招刚好也是 ~20 帧——于是「硬直下限」正好等于
     「攻击方再次出招的间隔」，连段就永远接得上。改成 8 帧后，
     衰减过的硬直会真的短于攻击间隔，受击方必然拿到自由帧。 */
  const HIT_MIN_FRAMES=8;
  /* 命中后取消窗口：只在确认命中的当前动作内短暂开放。
     12 帧足够玩家反应，同时会在重击剩余后摇前结束。 */
  const HIT_CONFIRM_WINDOW=12;
  const PURSUIT_WINDOW=12;
  /* ---------------- 脱身（每局限量使用） ----------------
   * 被连段锁住时的兜底手段：一次性消耗「脱身次数」，立刻解除受控状态、
   * 移到对手背后并获得短暂无敌。次数按局重置，用光就没有了。
   * 命名按角色正传里真实拥有的机动手段取名（瞬间移动／残像拳／舞空术／
   * 不会舞空术的角色则表现为翻身脱身），不虚构不存在的招式。 */
  const ESCAPE_CHARGES=3;          // 每局每方的脱身次数（用户要求 2~3 次，取 3）
  const ESCAPE_INVULN=26;          // 脱身后的无敌帧
  const ESCAPE_LOCK=14;            // 脱身后的短暂再使用锁定，避免连按浪费次数
  const ESCAPE_DISTANCE=185;       // 脱身位移距离

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  /* ---------------- 招式与状态查询 ---------------- */
  /* 吸收来的招式优先：正传中布欧吸收对手后继承其力量与招式。
     覆盖只作用于本局该角色，不影响其他对局。 */
  function moveTable(f){
    const base=DV.resolveMoves(f);
    const gained=f&&f.gainedMoves;
    if(!gained)return base;
    return Object.assign({},base,gained);
  }
  function moveOf(f,state){return moveTable(f)[state]||null;}
  function durationOf(f,state){const t=DV.resolveActions(f);return Number.isFinite(t[state])?t[state]:48;}
  function poseOf(f,state){const m=moveOf(f,state);return (m&&m.pose)||state;}
  function hurtbox(f){
    /* 巨大化时判定框随体型放大（正传：比克巨大化） */
    const g=f.giantFrames>0?(f.giantScale||1):1;
    const h=144*clamp(f.spec.height||1,.65,1.4)*g;
    return {left:f.x-28*g,right:f.x+28*g,bottom:f.y+8,top:f.y+h};
  }
  function activeMove(f){
    const m=moveOf(f,f.state);
    if(!m||!Number.isFinite(m.at))return null;
    const end=Number.isFinite(m.end)?m.end:m.at;
    if(f.frame<m.at||f.frame>end)return null;
    return m;
  }
  function attackBox(f){
    const m=activeMove(f);if(!m)return null;
    const h=clamp(f.spec.height||1,.65,1.4),reach=Number.isFinite(m.reach)?m.reach:100;
    /* 巨大化时攻击范围随体型放大 */
    const g=f.giantFrames>0?(f.giantScale||1):1;
    /* 形态特性：正传里攻击范围受限于单侧的（未来悟饭独臂） */
    const traitReach=DV.passiveOf(f).reachScale||1;
    const r=reach*g*traitReach;
    return {left:f.x+(f.facing>0?8:-r),right:f.x+(f.facing>0?r:-8),bottom:f.y+35*h,top:f.y+(116*h*g)};
  }
  const overlaps=(a,b)=>a&&b&&a.left<=b.right&&a.right>=b.left&&a.bottom<=b.top&&a.top>=b.bottom;

  function statusFrames(f,key){return (f.status&&f.status[key])||0;}
  function blocked(f,key){return statusFrames(f,key)>0;}
  function hasBadStatus(f){
    if(!f.status)return false;
    for(const key of Object.keys(BAD_STATUS))if(f.status[key]>0)return true;
    return false;
  }
  function applyStatus(target,status,ticks){
    if(!target||!status||!ticks)return;
    const next=Object.assign({},target.status);
    for(const key of Object.keys(status)){
      const value=status[key];
      const frames=Math.round(ticks*(Number.isFinite(value)?value:1));
      if(frames<=0)continue;
      if(BAD_STATUS[key]||BUFF_STATUS[key])next[key]=Math.max(next[key]||0,frames);
    }
    target.status=next;
  }

  function actor(spec,side,assist){
    return {spec,side,assist:assist||spec,x:side?944:336,y:0,vy:0,vx:0,facing:side?-1:1,
      hp:spec.stats.health,maxHp:spec.stats.health,ki:100,guard:100,stamina:100,
      state:'idle',frame:0,visualFrame:0,grounded:true,jumps:0,invuln:0,stun:0,hitstun:0,launched:false,
      burstFrames:0,burstCooldown:0,assistCooldown:0,combo:0,comboTimer:0,damageCombo:0,
      assistUses:0,teamSuperUses:0,
      buffer:null,bufferTicks:0,bufferAction:null,attackFeedback:null,used:false,trail:[],aiWait:45,aiGuard:0,flash:0,
      counter:0,counterMove:null,grabbedBy:null,grabTicks:0,grabHold:0,
      barrierCooldown:0,
      assistBarrier:0,assistBarrierReduction:.55,assistBarrierTicks:0,assistGrabTicks:0,
      /* 吸收强化（正传：吸收后战力提升）／巨大化（正传：比克） */
      absorPower:0,absorbPowerScale:1,absorbSpeedScale:1,absorbCooldown:0,
      giantFrames:0,giantScale:1,giantDamage:1,giantSpeedScale:1,
      psychoDrain:0,
      /* 吸收：被吞入体内 / 继承来的招式 */
      swallowedBy:null,swallowTicks:0,swallowMax:0,gainedMoves:null,inheritedFrom:null,
      status:{},regenTicks:0,teleportCooldown:0,superMove:null,
      /* 形态特性计时（正传：形态维持消耗／力量增长或流失） */
      formTicks:0,formScale:1,
      /* 脱身：每局限量次数（防被连到死），局内用掉就不再恢复 */
      escapes:ESCAPE_CHARGES,escapeLock:0,escapeUsed:0,
      /* 命中确认与浮空追击只属于当前短窗口，不跨防御、受击或落地保留。 */
      confirmTicks:0,confirmState:null,pursuitTicks:0};
  }

  class Match{
    constructor(options){
      this.options={mode:'cpu',difficulty:'normal',training:false,...options};
      this.onEvent=options.onEvent||(()=>{});
      this.seed=options.seed||21891;
      this.input=[{},{}];
      this.restart(options.intro!==false);
    }
    restart(intro=true){
      const o=this.options;
      this.fighters=[actor(o.p1,0,o.assist1),actor(o.p2,1,o.assist2)];
      this.projectiles=[];this.beams=[];this.effects=[];this.assists=[];this.clash=null;
      this.phase=intro?'intro':'fight';this.intro=intro?150:0;this.time=o.timeLimit===null?Infinity:99;this.clock=0;
      this.tick=0;this.hitstop=0;this.shake=0;this.flash=0;this.winner=null;this.paused=false;
      this.throwSequence=null;this.overFrames=0;
      this.accumulator=0;this.input=[{},{}];this.lastHit=null;this.pendingHits=[];this.usedBonds=[new Set(),new Set()];
    }
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    event(type,data={}){this.onEvent(type,data);}
    setInput(side,key,value){if(this.input[side])this.input[side][key]=value;}
    clearInput(){this.input=[{},{}];}
    transition(f,state){
      if(f.state!==state){
        if(f.state==='transform')f.transformTarget=null;
        if(state==='idle'||state==='guard'||state==='hit'||state==='down'||state==='grabbed'||state==='thrown'){
          f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
        }
        f.state=state;f.frame=0;f.visualFrame=0;f.justStarted=true;f.used=false;f.buffer=null;f.bufferTicks=0;f.bufferAction=null;
        /* 跟踪的是这一招的实际接触；中断或取消只会丢弃记录，不报告落空。 */
        const m=moveOf(f,state),normal=m&&(m.grab||['light','heavy','aerial'].includes(m.slot));
        f.attackFeedback=normal?{state,action:m.grab?'grab':m.slot==='heavy'||state==='airH'?'heavy':'light',connected:false,reason:null}:null;
        if(state!=='counter'){f.counter=0;f.counterMove=null;}
      }
    }
    transformOptions(side){return DV.transformationOptions?.(this.fighters[side].spec)||[];}
    uniqueMoves(f){return Object.values(DV.uniqueMapOf?DV.uniqueMapOf(f):{})||[];}

    command(side,action,targetId){
      return this.runCommand(side,action,targetId);
    }
    runCommand(side,action,targetId,feedbackAction=action){
      const context={action:feedbackAction,failure:null,buffered:false},previous=this.commandContext;
      const f=this.fighters[side],before=f&&f.attackFeedback;
      this.commandContext=context;
      let accepted;
      try{accepted=this.executeCommand(side,action,targetId);}finally{this.commandContext=previous;}
      if(accepted){
        if(f&&f.attackFeedback&&f.attackFeedback!==before)f.attackFeedback.action=feedbackAction;
        if(context.buffered)this.event('inputBuffered',{side,action:feedbackAction});
      }else{
        const failure=context.failure||{reason:'unavailable',message:COMMAND_MESSAGES.unavailable};
        this.event('commandRejected',{side,action:feedbackAction,...failure});
      }
      return accepted;
    }
    rejectCommand(reason){
      if(this.commandContext)this.commandContext.failure={reason,message:COMMAND_MESSAGES[reason]};
      return false;
    }
    rejectState(f){
      return this.rejectCommand(['hit','down','grabbed','thrown'].includes(f.state)||f.grabbedBy!==null?'controlled':'busy');
    }
    bufferCommand(f,action,ticks){
      f.buffer=action;f.bufferTicks=ticks;
      f.bufferAction=this.commandContext?this.commandContext.action:(f.bufferAction||action);
      if(this.commandContext)this.commandContext.buffered=true;
      return true;
    }
    noteMiss(f,enemy,box,grabMove){
      const feedback=f.attackFeedback;
      if(!feedback||feedback.state!==f.state||feedback.connected)return;
      let reason;
      if(!enemy||enemy.hp<=0||(grabMove&&enemy.state==='grabbed'))reason='targetUnavailable';
      else if(grabMove){
        const inRange=Math.abs(enemy.x-f.x)<=Math.max(74,grabMove.reach||74);
        if(!inRange)reason='outOfRange';
        else if(enemy.grounded!==f.grounded)reason=!enemy.grounded?'targetAirborne':'heightMismatch';
        else if(Math.abs(enemy.y-f.y)>=96)reason='heightMismatch';
        else if(enemy.invuln>0)reason='targetInvulnerable';
      }else{
        const hurt=hurtbox(enemy);
        if(!box||box.right<hurt.left||box.left>hurt.right)reason='outOfRange';
        else if(box.top<hurt.bottom||box.bottom>hurt.top)reason=!enemy.grounded&&f.grounded?'targetAirborne':'heightMismatch';
        else if(enemy.invuln>0)reason='targetInvulnerable';
      }
      /* 碰到无敌帧是具体的拒绝接触，比之后对手移出距离更能解释这一招。 */
      if(reason&&feedback.reason!=='targetInvulnerable')feedback.reason=reason;
    }
    finishAttackFeedback(f){
      const feedback=f.attackFeedback;
      f.attackFeedback=null;
      if(!feedback||feedback.state!==f.state||feedback.connected)return;
      const reason=feedback.reason||'missed';
      this.event('whiff',{side:f.side,action:feedback.action,reason,message:WHIFF_MESSAGES[reason]});
    }
    executeCommand(side,action,targetId){
      if(this.paused)return this.rejectCommand('paused');
      if(this.phase!=='fight')return this.rejectCommand('phase');
      const f=this.fighters[side];
      if(!f)return this.rejectCommand('invalidSide');
      if(f.hp<=0)return this.rejectCommand('defeated');
      /* 脱身优先于一切：即使正在被连段打、被抓、被摔、被吞入体内也能发动。
         这是「被连到死」的兜底手段，因此必须放在所有受控早退之前。 */
      if(action==='escape')return this.escapeCombo(side);
      /* 被抓期间任意输入 → 在挣脱窗口内拆投（正传：龙珠大量抓取与挣脱） */
      if(f.swallowedBy!==null&&f.swallowedBy!==undefined)return this.rejectCommand('swallowed');
      if(f.state==='grabbed')return this.breakGrab(f)||this.rejectCommand('techWindowClosed');
      if(this.throwSequence)return this.rejectCommand('controlled');
      if(f.grabbedBy!==null||f.state==='thrown')return this.rejectCommand('controlled');
      if(this.clash){if(action==='attack'||action==='light')return this.tapClash(side)||this.rejectCommand('clashRateLimit');return this.rejectCommand('clash');}

      /* 组合键：方向键下 + 远程攻击键 → 副技能。
         例：太阳拳（克林／天津饭／沙鲁）、魔封波（龟仙人）、万国惊天掌、
         沙鲁Jr.、变化光线、身体伸缩变形、负面能量、四身拳……
         取该角色「第一个可用的副技能」，避免为每个角色单独加键。 */
      if(action==='combo'){
        const cm=moveTable(f);
        const list=(DV.comboSkillsOf?DV.comboSkillsOf(f):[]);
        for(const key of list){
          if(!cm[key])continue;
          if(this.executeCommand(side,'unique:'+key))return true;
        }
        /* 没有副技能时退回普通气弹，不让按键落空 */
        return this.executeCommand(side,'ki');
      }

      const airborne=!f.grounded||f.y>0;

      /* 变身：正传形态切换 */
      if(action==='transform'){
        if(!FREE.has(f.state))return this.rejectState(f);
        if(!f.grounded)return this.rejectCommand('airborne');
        if(f.transformCooldown>0)return this.rejectCommand('transformCooldown');
        const option=this.transformOptions(side).find(o=>o.spec.id===targetId);
        if(!option)return this.rejectCommand('invalidTransform');
        if(f.ki<option.cost)return this.rejectCommand('insufficientKi');
        f.ki-=option.cost;f.transformCooldown=180;this.transition(f,'transform');f.transformTarget=option.spec;
        this.event('transformStart',{side,name:option.spec.form});return true;
      }
      /* 爆气：解硬直 + 短无敌 + 强化窗口（正传：爆气觉醒） */
      if(action==='burst'){
        const m=moveTable(f).burst;
        if(!m)return this.rejectCommand('unavailable');
        if(f.burstCooldown>0)return this.rejectCommand('burstCooldown');
        if(f.state==='burst'||f.state==='down')return this.rejectState(f);
        if(f.ki<m.cost)return this.rejectCommand('insufficientKi');
        f.ki-=m.cost;f.burstFrames=(m.buff&&m.buff.frames)||360;f.burstCooldown=600;
        f.stun=0;f.hitstun=0;f.invuln=45;f.buffer=null;f.status={};
        this.transition(f,'burst');this.event('burst',{side});return true;
      }
      /* 专属技指令：unique:<key>。key 可以是 unique map 的键，也可以是
         absorb／psycho／giant 这类系统机制状态名。 */
      if(typeof action==='string'&&action.startsWith('unique:')){
        const key=action.slice(7);
        const um=DV.uniqueMapOf?DV.uniqueMapOf(f):{};
        const m=um[key]||moveTable(f)[key]||null;
        if(!m)return this.rejectCommand('unavailable');
        const cur=moveOf(f,f.state);
        /* 系统技原本可以从攻击中直接衔接，保留这种取消；受击/倒地等
           不属于进攻动作，不能借 unique 指令覆盖受控状态。 */
        const systemCancel=(m.absorb||m.psycho||m.giant)&&cur&&['light','heavy','aerial','ki','super'].includes(cur.slot);
        if(!FREE.has(f.state)&&f.state!=='dash'&&!systemCancel)return this.rejectState(f);
        /* 系统机制类走各自的专用流程 */
        if(m.absorb){
          if(airborne)return this.rejectCommand('airborne');
          if(f.absorbCooldown>0)return this.rejectCommand('absorbCooldown');
          if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
          if(m.cost)f.ki-=m.cost;
          this.transition(f,'absorb');this.event('absorbStart',{side});return true;
        }
        if(m.psycho){
          if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
          if(m.cost)f.ki-=m.cost;
          this.transition(f,'psycho');return true;
        }
        if(m.giant){
          if(airborne)return this.rejectCommand('airborne');
          if(f.giantFrames>0)return this.rejectCommand('giantActive');
          if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
          if(m.cost)f.ki-=m.cost;
          this.transition(f,'burst');
          this.applyGiantForm(f,m.giant,m.giant.frames||300);
          return true;
        }
        if(m.groundedOnly!==false&&!f.grounded)return this.rejectCommand('airborne');
        if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
        if(m.cost)f.ki-=m.cost;
        /* 自爆类：以自身生命为代价（正传：贝吉塔／16 号自爆的代价是自身死亡） */
        if(m.selfCost&&m.selfCost.hp)f.hp=Math.max(1,Math.round(f.hp-f.maxHp*m.selfCost.hp));
        /* 自身回复类（正传：维斯的时间回溯可撤销已发生的事） */
        if(m.selfHeal)f.hp=clamp(f.hp+f.maxHp*m.selfHeal,0,f.maxHp);
        /* 体型/形态变化类专属技（正传：四身拳＝生出两臂） */
        if(m.giant)this.applyGiantForm(f,m.giant,m.giant.frames||300);
        const state=m.state||key;
        this.transition(f,state);
        if(m.slot==='super'||m.superKind)f.superMove=m;
        this.event('unique',{side,name:m.label||key});
        return true;
      }
      /* 空间转移（正传：邪念波的空间能力） */
      if(action==='warp'){
        const p=DV.passiveOf(f).teleport;
        if(!p)return this.rejectCommand('unavailable');
        if(f.teleportCooldown>0)return this.rejectCommand('teleportCooldown');
        if(f.ki<p.cost)return this.rejectCommand('insufficientKi');
        f.ki-=p.cost;f.teleportCooldown=p.cooldown||60;f.invuln=p.invuln||18;
        f.x=clamp(this.fighters[1-f.side].x+(this.fighters[1-f.side].facing||1)*(p.distance||170),50,W-50);
        f.facing=this.fighters[1-f.side].x>=f.x?1:-1;
        this.effect('burst',f.x,f.y+70,24,f.spec.color);this.event('teleport',{side});
        return true;
      }

      /* 非自由状态：预输入 / 收招取消 */
      if(!FREE.has(f.state)){
        const cur=moveOf(f,f.state);
        /* 轻击命中确认：只允许转重击／气弹／必杀。先验证资源，再回到自由态
           复用正常起手流程，因此费用只会在 command 的标准分支扣一次。 */
        if(f.confirmTicks>0&&f.confirmState===f.state&&['heavy','ki','super'].includes(action)){
          const next=moveTable(f)[action];
          const cost=next&&Number.isFinite(next.cost)?next.cost:0;
          if(next&&f.ki>=cost){
            f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
            this.transition(f,f.grounded?'idle':'fall');
            return this.executeCommand(side,action,targetId);
          }
        }
        /* 浮空追击：命中 launcher 后只有短窗口可立刻跳／冲刺。追击冲刺朝向
           当前对手；窗口结束后仍保留原本的收招预输入，不产生永久跟随。 */
        if(f.pursuitTicks>0&&(action==='jump'||action==='dash')){
          const enemy=this.fighters[1-side];
          const dir=enemy&&enemy.x!==f.x?(enemy.x>f.x?1:-1):f.facing;
          if(action==='jump'){
            const maxJumps=clamp(2+(DV.passiveOf(f).airJumps||0),1,2);
            if(f.jumps<maxJumps){
              f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
              f.jumps++;f.grounded=false;f.vy=f.jumps===1?13:11;f.vx=dir*6;f.facing=dir;
              this.transition(f,'jump');
              this.effect('dust',f.x,f.y,24,'#ded7b9');this.event('jump',{side});return true;
            }
          }else{
            const dash=moveTable(f).dash,cost=dash&&Number.isFinite(dash.cost)?dash.cost:28;
            if(f.stamina>=cost){
              f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
              f.stamina-=cost;f.invuln=7;f.facing=dir;f.dashDir=dir;
              /* 指令通常发生在命中停顿中，先给一次有限贴近，保证追击反馈立即可见；
                 后续仍是普通 dash 位移，不持续吸附目标。 */
              if(enemy){
                const gap=Math.abs(enemy.x-f.x);
                f.x+=dir*Math.max(0,Math.min(19,gap-62));
              }
              this.transition(f,'dash');this.event('dash',{side});return true;
            }
          }
        }
        /* 重击起手阶段允许只记录一次追击方向输入；只有随后真实造成浮空，
           stepFighter 才会在命中停顿结束后兑现。未命中时仍等普通后摇。 */
        if(action==='dash'&&cur&&cur.slot==='heavy'&&f.frame<durationOf(f,f.state)-7){
          return this.bufferCommand(f,'dash',durationOf(f,f.state)-f.frame+3);
        }
        const chainable=cur&&['light','heavy','aerial','ki','super','jump','grab','attack'].includes(action);
        if(chainable)return this.bufferCommand(f,action,durationOf(f,f.state)-f.frame+3);
        /* 受击硬直中也要记住玩家的脱身类输入（格挡／跳跃／冲刺／反击），
           硬直一结束立刻执行。否则按下去了却毫无反应，玩家会以为按键坏了。
           这是「被连到死」体感的一半来源：输入被静默丢弃。 */
        if(f.state==='hit'&&['guard','jump','dash','counter','escape'].includes(action)){
          return this.bufferCommand(f,action,Math.max(f.bufferTicks||0,f.stun||0)+6);
        }
        if(f.state==='dash'&&f.frame>=8&&['light','heavy','ki','super','jump'].includes(action)){
          return this.bufferCommand(f,action,durationOf(f,'dash')-f.frame+3);
        }
        /* 冲刺取消后摇：招式进入收招尾段即可取消（与改造前判定一致）。
           必须先于通用预输入判断，否则 dash 会被缓冲而无法立即取消。 */
        if(action==='dash'&&cur&&f.frame>=durationOf(f,f.state)-7){
          if(f.stamina<35)return this.rejectCommand('insufficientStamina');
          f.stamina-=35;f.invuln=8;
          f.dashDir=(this.input[side].right?1:0)-(this.input[side].left?1:0)||f.facing;
          this.transition(f,'dash');return true;
        }
        return this.rejectState(f);
      }

      if(action==='jump'){
        /* 形态特性：正传里不会舞空术的角色只能起跳一次（亚奇洛贝／撒旦／布尔玛） */
        const jumpTrait=DV.passiveOf(f).airJumps||0;
        const maxJumps=clamp(2+jumpTrait,1,2);
        if(f.jumps>=maxJumps)return this.rejectCommand('jumpLimit');
        f.jumps++;f.grounded=false;f.vy=f.jumps===1?13:11;
        this.transition(f,'jump');
        this.effect('dust',f.x,f.y,24,'#ded7b9');this.event('jump',{side});return true;
      }
      if(action==='dash'){
        const m=moveTable(f).dash;
        const cost=m&&Number.isFinite(m.cost)?m.cost:28;
        if(f.stamina<cost)return this.rejectCommand('insufficientStamina');
        f.stamina-=cost;f.invuln=7;
        const direction=(this.input[side].right?1:0)-(this.input[side].left?1:0);
        f.dashDir=direction||f.facing;this.transition(f,'dash');this.event('dash',{side});return true;
      }
      /* 攻击：attack 为兼容别名（等价轻击） */
      if(action==='attack'||action==='light'||action==='heavy'){
        const wantHeavy=action==='heavy';
        /* 已在空中攻击中：预输入交给连段链处理（airL → airH），不要重新起手。
           已缓冲则直接接受，避免缓冲过期前把输入挡掉。 */
        if(airborne&&['airL','airH'].includes(f.state)){
          const cur=moveTable(f)[f.state];
          if(f.buffer==='light'&&f.bufferTicks>0)return this.bufferCommand(f,'light',f.bufferTicks);
          if(cur&&cur.chain&&cur.chain.length){
            return this.bufferCommand(f,'light',durationOf(f,f.state)-f.frame+6);
          }
          if(wantHeavy&&moveTable(f).airH&&f.state!=='airH')return this.bufferCommand(f,'heavy',durationOf(f,f.state)-f.frame+6);
          return this.rejectCommand('busy');
        }
        if(airborne){
          if(wantHeavy&&moveTable(f).airH){this.transition(f,'airH');return true;}
          if(moveTable(f).airL){this.transition(f,'airL');return true;}
          this.transition(f,DV.lightChain(f)[0]);return true;
        }
        if(wantHeavy&&moveTable(f).heavy){this.transition(f,'heavy');return true;}
        this.transition(f,DV.lightChain(f)[0]);return true;
      }
      if(action==='grab'){
        const m=moveTable(f).grab;
        if(!m)return this.rejectCommand('unavailable');
        if(airborne)return this.rejectCommand('airborne');
        this.transition(f,'grab');this.event('grab',{side});return true;
      }
      /* 吸收（正传：沙鲁尾巴吸收、布欧吸入体内） */
      if(action==='absorb'){
        const m=moveTable(f).absorb;
        if(!m||!m.absorb)return this.rejectCommand('unavailable');
        if(airborne)return this.rejectCommand('airborne');
        if(f.absorbCooldown>0)return this.rejectCommand('absorbCooldown');
        if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
        if(m.cost)f.ki-=m.cost;
        this.transition(f,'absorb');this.event('absorbStart',{side});return true;
      }
      /* 念动力（正传：弗利萨／古拉隔空束缚） */
      if(action==='psycho'){
        const m=moveTable(f).psycho;
        if(!m||!m.psycho)return this.rejectCommand('unavailable');
        if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
        if(m.cost)f.ki-=m.cost;
        this.transition(f,'psycho');return true;
      }
      /* 巨大化（正传：比克） */
      if(action==='giant'){
        const m=moveTable(f).giant;
        if(!m||!m.giant)return this.rejectCommand('unavailable');
        if(airborne)return this.rejectCommand('airborne');
        if(f.giantFrames>0)return this.rejectCommand('giantActive');
        if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
        if(m.cost)f.ki-=m.cost;
        this.transition(f,'burst');
        this.applyGiantForm(f,m.giant,m.giant.frames||300);
        return true;
      }
      if(action==='counter'){
        const m=moveTable(f).counter;
        if(!m)return this.rejectCommand('unavailable');
        if(airborne)return this.rejectCommand('airborne');
        if(f.ki<(m.cost||0))return this.rejectCommand('insufficientKi');
        if(m.cost)f.ki-=m.cost;
        f.counterMove=m.counterMove||{damage:96,stun:42,push:18,invulnAfter:12};
        f.counter=durationOf(f,'counter');
        this.transition(f,'counter');return true;
      }
      if(action==='ki'){
        const m=moveTable(f).ki;
        if(!m)return this.rejectCommand('unavailable');
        if(f.ki<m.cost)return this.rejectCommand('insufficientKi');
        f.ki-=m.cost;this.transition(f,'ki');return true;
      }
      if(action==='super'){
        const m=moveTable(f).super;
        if(!m)return this.rejectCommand('unavailable');
        if(f.ki<m.cost)return this.rejectCommand('insufficientKi');
        if(m.teamAnimation){
          const profile=DV.assistProfile&&DV.assistProfile(f.assist);
          if(!profile)return this.rejectCommand('unavailable');
          if(f.assistCooldown>0)return this.rejectCommand('assistCooldown');
          if((profile.maxUses&&f.assistUses>=profile.maxUses)||f.teamSuperUses>0)return this.rejectCommand('usesExhausted');
          f.assistCooldown=profile.cooldown;f.assistUses++;f.teamSuperUses++;
        }
        f.ki-=m.cost;f.superMove=m;this.transition(f,'super');
        this.event('super',{side,name:m.label||f.spec.moves.super,color:f.spec.color,
          teamAnimation:m.teamAnimation||null,assistId:m.teamAnimation?f.assist?.id:null});
        return true;
      }
      if(action==='assist'){
        const m=moveTable(f).assist;
        const profile=DV.assistProfile&&DV.assistProfile(f.assist);
        if(!m||!profile)return this.rejectCommand('unavailable');
        if(f.assistCooldown>0)return this.rejectCommand('assistCooldown');
        if(profile.maxUses&&f.assistUses>=profile.maxUses)return this.rejectCommand('usesExhausted');
        if(this.assists.some(a=>a.ownerSide===side&&!a.dead))return this.rejectCommand('assistActive');
        if(f.ki<m.cost)return this.rejectCommand('insufficientKi');
        const beforeKi=f.ki;
        f.ki-=m.cost;f.assistCooldown=profile.cooldown;f.assistUses++;this.transition(f,'assist');
        this.callAssist(f,profile,beforeKi);return true;
      }
      /* 瞬移回避（正传：瞬间移动 / 残像拳） */
      if(action==='teleport'){
        const p=DV.passiveOf(f).teleport;
        if(!p)return this.rejectCommand('unavailable');
        if(f.teleportCooldown>0)return this.rejectCommand('teleportCooldown');
        if(f.ki<p.cost)return this.rejectCommand('insufficientKi');
        f.ki-=p.cost;f.teleportCooldown=p.cooldown||90;f.invuln=p.invuln||14;
        const dir=(this.input[side].right?1:0)-(this.input[side].left?1:0);
        f.x=clamp(f.x+(dir||-f.facing)*(p.distance||150),50,W-50);
        this.effect('burst',f.x,f.y+70,22,f.spec.color);this.event('teleport',{side});
        return true;
      }
      if(action==='guard'||action==='charge')return this.rejectCommand('holdInput');
      return this.rejectCommand('unknownAction');
    }

    effect(kind,x,y,life,color,extra={}){
      this.effects.push({kind,x,y,life,max:life,color,...extra});
      if(this.effects.length>120)this.effects.shift();
    }

    callAssist(owner,profile,beforeKi=owner.ki){
      const timing=profile.timing;
      const a={type:'assist',spec:owner.assist,side:owner.side,ownerSide:owner.side,
        assistId:owner.assist.id,profileId:profile.id,profile,kind:profile.kind,
        x:clamp(owner.x-owner.facing*90,60,W-60),y:0,facing:owner.facing,
        state:'idle',frame:0,
        phase:'telegraph',age:0,duration:timing.end,life:timing.end,dead:false,
        executed:false,strikes:0,hitVictims:new Set()};
      this.assists.push(a);
      this.effect('summon',a.x,80,timing.enter,owner.assist.color);
      this.event('assist',{side:owner.side,name:owner.assist.name,label:profile.label,
        assistId:a.assistId,kind:profile.kind,phase:'telegraph'});
      const bond=DV.assistBond&&DV.assistBond(owner.spec,owner.assist);
      const condition=bond&&bond.condition||{};
      const eligible=bond&&(!condition.maxHpRatio||owner.hp/owner.maxHp<=condition.maxHpRatio)
        &&(!condition.minKi||beforeKi>=condition.minKi);
      if(eligible&&!this.usedBonds[owner.side].has(bond.id)){
        this.usedBonds[owner.side].add(bond.id);
        this.event('bond',{side:owner.side,id:bond.id,label:bond.label,assistId:a.assistId});
      }
      return a;
    }

    interruptAssist(side){
      const a=this.assists.find(x=>x.ownerSide===side&&!x.dead&&!x.executed);
      if(!a)return false;
      a.phase='interrupted';a.dead=true;a.life=0;
      this.effect('burst',a.x,a.y+70,18,a.spec.color,{small:true});
      this.event('assistInterrupted',{side,assistId:a.assistId,kind:a.kind,phase:'interrupted'});
      return true;
    }

    executeAssist(a){
      const p=a.profile,owner=this.fighters[a.ownerSide],target=this.fighters[1-a.ownerSide];
      if(!owner||!target||owner.hp<=0||target.hp<=0)return;
      const distance=Math.abs(target.x-a.x),vertical=Math.abs(target.y-a.y);
      const inRange=(reach=p.reach||300)=>distance<=reach&&(p.allowAir||target.grounded)&&vertical<=(p.allowAir?150:92);
      if(p.kind==='beam'){
        const ticks=Math.max(1,p.beamTicks||4);
        this.beams.push({side:owner.side,x:a.x+a.facing*45,y:a.y+80,dir:a.facing,end:a.x+a.facing*60,
          life:ticks*8+1,age:0,color:a.spec.color,damage:p.damage/ticks,hitTick:-9,owner,pierce:false,assist:true});
      }else if(p.kind==='projectile'){
        const shots=Math.max(1,p.shots||1),shot=Math.max(1,p.damage/shots);
        for(let i=0;i<shots;i++)this.spawnProjectile(owner,1,{x:a.x-a.facing*i*22,spec:a.spec,assist:true,
          projectile:{kind:p.projectileKind||'ball',speed:(p.speed||12)-i*.6,radius:p.projectileKind==='disc'?18:15,
            life:130,damage:shot,pierce:!!p.pierce,assist:true}});
      }else if(p.kind==='grab'){
        if(inRange(p.reach||170)&&target.invuln<=0){
          const hp=target.hp;
          this.hit(owner,target,p.damage,{stun:p.grabTicks||24,push:5,assist:true,assistGrab:true,unblockable:true});
          if(target.hp<hp){
            target.assistGrabTicks=p.grabTicks||24;target.stun=Math.max(target.stun,target.assistGrabTicks);
            this.event('assistGrab',{side:owner.side,targetSide:target.side,assistId:a.assistId});
          }
        }else this.event('assistWhiff',{side:owner.side,assistId:a.assistId,kind:'grab'});
      }else if(p.kind==='control'){
        if(inRange(p.reach||240)&&target.invuln<=0){
          const frontal=(owner.x-target.x)*target.facing>=-15;
          if(target.state==='guard'&&frontal){
            target.guard=Math.max(0,target.guard-10);this.effect('guard',target.x,target.y+80,14,'#a4f6ff');
            this.event('guard',{side:target.side,attackerSide:owner.side,blocked:true,guardDamage:10});
          }else{
            const hp=target.hp;
            if(p.damage>0)this.hit(owner,target,p.damage,{stun:18,push:4,assist:true});
            if(p.damage===0||target.hp<hp)applyStatus(target,{[p.status||'slow']:1},clamp(p.controlTicks||24,20,30));
          }
        }
      }else if(p.kind==='barrier'){
        owner.assistBarrier=Math.max(owner.assistBarrier,p.barrier||90);
        owner.assistBarrierReduction=clamp(p.barrierReduction==null ? .55 : p.barrierReduction,0,.55);
        owner.assistBarrierTicks=Math.max(owner.assistBarrierTicks,p.barrierTicks||150);
        this.effect('guard',owner.x,owner.y+80,28,a.spec.color);
      }else if(p.kind==='support'){
        if(p.heal)owner.hp=Math.min(owner.maxHp,owner.hp+p.heal);
        if(p.restoreKi)owner.ki=clamp(owner.ki+p.restoreKi,0,100);
        if(p.restoreGuard)owner.guard=clamp(owner.guard+p.restoreGuard,0,100);
        this.effect('burst',owner.x,owner.y+70,24,a.spec.color,{small:true});
      }
    }

    stepAssists(){
      for(const a of this.assists){
        if(a.dead)continue;
        const p=a.profile,t=p.timing,owner=this.fighters[a.ownerSide],target=this.fighters[1-a.ownerSide];
        if(!owner||owner.hp<=0){a.dead=true;continue;}
        a.age++;a.life=Math.max(0,t.end-a.age);a.frame++;
        if(!a.executed&&(owner.state==='hit'||owner.state==='down'||owner.state==='thrown')){
          this.interruptAssist(a.ownerSide);continue;
        }
        if(a.age===t.enter){
          a.phase='enter';
          a.state=a.kind==='rush'||a.kind==='grab'?'dash':'idle';a.frame=0;
          this.event('assistStart',{side:a.ownerSide,assistId:a.assistId,kind:a.kind,phase:a.phase,x:a.x,y:a.y,facing:a.facing});
        }
        if(a.phase==='enter'&&target&&(a.kind==='rush'||a.kind==='grab')){
          /* 支援入场按召唤时朝向作固定突进，不能逐帧吸附或追踪空中目标。 */
          a.x=clamp(a.x+a.facing*(p.dashSpeed||18),60,W-60);
          a.y=0;
        }
        if(a.age===t.execute){
          a.phase='execute';a.executed=true;
          a.state=a.kind==='beam'||a.kind==='projectile'?'ki':a.kind==='rush'?'punch1':a.kind==='grab'?'punch2'
            :a.kind==='control'?'super':a.kind==='barrier'?'guard':'charge';
          a.frame=ASSIST_IMPACT_FRAME[a.state]||0;
          this.event('assistStrike',{side:a.ownerSide,assistId:a.assistId,kind:a.kind,phase:a.phase,x:a.x,y:a.y,facing:a.facing});
          this.executeAssist(a);
        }
        if(a.kind==='rush'&&a.executed&&a.strikes<(p.hits||3)){
          const interval=5,offset=a.age-t.execute;
          if(offset>=0&&offset%interval===0){
            a.state=a.strikes%2===0?'punch1':'kick';a.frame=ASSIST_IMPACT_FRAME[a.state];
            const reach=p.reach||220;
            if(target&&Math.abs(target.x-a.x)<=reach&&Math.abs(target.y-a.y)<115&&!a.hitVictims.has(`${target.side}:${a.strikes}`)){
              a.hitVictims.add(`${target.side}:${a.strikes}`);
              this.hit(owner,target,p.damage/(p.hits||3),{melee:true,stun:16,push:3,assist:true});
            }
            a.strikes++;
          }
        }
        if(a.age===t.exit){
          a.phase='exit';a.state='idle';a.frame=0;
          this.event('assistEnd',{side:a.ownerSide,assistId:a.assistId,kind:a.kind,phase:a.phase});
        }
        if(a.age>=t.end)a.dead=true;
      }
      this.assists=this.assists.filter(a=>!a.dead);
    }

    update(seconds){
      this.accumulator=Math.min(STEP*2,this.accumulator+Math.min(Math.max(seconds,0),STEP*1.25));
      if(this.accumulator+1e-9>=STEP){this.accumulator-=STEP;this.step();return true;}return false;
    }

    step(){
      if(this.paused)return;
      this.tick++;
      if(this.shake>0)this.shake*=.85;
      if(this.flash>0)this.flash--;
      for(const e of this.effects)e.life--;
      this.effects=this.effects.filter(e=>e.life>0);
      if(this.phase==='intro'){this.intro--;if(this.intro===42)this.event('fight');if(this.intro<=0)this.phase='fight';return;}
      if(this.phase==='over'){
        this.overFrames++;
        for(const f of this.fighters){
          const koHold=DV.generatedSpriteManifest?.fighters?.[f.spec.id]?.koHoldTick;
          const limit=f.state==='down'?(Number.isInteger(koHold)?koHold:14):Math.max(1,durationOf(f,f.state))-1;
          f.frame=Math.min(f.frame+1,limit);
        }
        return;
      }
      if(this.hitstop>0){this.hitstop--;return;}
      if(this.clash){this.stepClash();return;}
      if(this.throwSequence){this.stepThrowSequence();return;}
      if(this.options.mode==='cpu'&&!this.options.training)this.ai();
      this.clock++;if(!this.options.training&&this.clock%60===0)this.time--;
      this.pendingHits=[];
      for(const f of this.fighters)this.stepFighter(f);
      /* 反击／吸收／念动力都在双方帧结算后判定，早于普通命中收集 */
      this.stepCounters();
      this.stepAbsorbs();
      this.stepPsychokinesis();
      /* 双方移动结算后再做对称的招式判定 */
      for(const f of this.fighters){
        const m=activeMove(f),enemy=this.fighters[1-f.side];
        if(m&&!f.used&&!m.grab&&m.damage>0){
          const box=attackBox(f);
          this.noteMiss(f,enemy,box);
          if(overlaps(box,hurtbox(enemy)))this.pendingHits.push([f,enemy,m,{melee:true},f.attackFeedback]);
        }
      }
      for(const args of this.pendingHits){
        if(this.hit(...args)&&args[3]&&args[3].melee){
          args[0].used=true;
          if(args[4])args[4].connected=true;
        }
      }
      this.pendingHits=[];
      this.separate();
      this.stepGrabHolds();
      this.stepProjectiles();this.stepBeams();this.stepAssists();
      if(this.options.training){
        const opponent=this.fighters[1];
        if(opponent.hp<opponent.maxHp&&!(opponent.recoveryTimer>0)&&FREE.has(opponent.state))opponent.hp=opponent.maxHp;
        this.fighters[0].ki=Math.min(100,this.fighters[0].ki+.5);
      }
      this.checkEnd();
    }

    /* 投技：抓住 → 窗口内可拆投 → 未挣脱则摔投 */
    grabHolderFor(victim){
      if(victim.grabbedBy===null||victim.grabbedBy===undefined)return null;
      return this.fighters[victim.grabbedBy]||null;
    }
    breakGrab(victim){
      if(victim.state!=='grabbed'||victim.grabTicks<=0)return false;
      const holder=this.grabHolderFor(victim);
      victim.grabbedBy=null;victim.grabTicks=0;victim.invuln=12;
      this.transition(victim,'idle');
      if(holder){holder.grabHold=0;this.transition(holder,'idle');}
      this.effect('burst',victim.x,victim.y+60,20,'#a8e9ff');
      this.event('tech',{side:victim.side});
      return true;
    }
    stepGrabHolds(){
      for(const holder of this.fighters){
        /* 已经抓住对手时，保持阶段与当前状态无关（做招动画早已结束）。 */
        let victim=this.fighters.find(f=>f.grabbedBy===holder.side);
        /* 抓取类招式可能以专属技状态名存在（如「手臂伸缩」），
           因此按「当前招式是否带 grab 数据」判断，而不是写死状态名。 */
        const holderMove=moveOf(holder,holder.state)||{};
        if(!victim&&!holderMove.grab)continue;
        const m=holderMove.grab?holderMove:(moveOf(holder,'grab')||{});
        const g=m.grab||{techWindow:22,hold:28,throwDamage:110,throwPush:26};
        const at=m.at, end=Number.isFinite(m.end)?m.end:at;
        /* 抓取判定：只在有效窗口内、且尚未抓住时执行 */
        if(!victim&&holder.grabHold===0
           &&holder.frame>=at&&holder.frame<=end){
          for(const other of this.fighters){
            if(other===holder)continue;
            this.noteMiss(holder,other,null,m);
            if(other.hp<=0||other.invuln>0||other.state==='grabbed')continue;
            if(other.grounded!==holder.grounded)continue;
            if(Math.abs(other.x-holder.x)<=Math.max(74,m.reach||74)&&Math.abs(other.y-holder.y)<96){
              other.grabbedBy=holder.side;other.grabTicks=g.techWindow||22;
              other.vx=0;other.vy=0;other.grounded=true;other.y=0;
              holder.grabHold=g.hold||28;
              if(holder.attackFeedback)holder.attackFeedback.connected=true;
              this.transition(other,'grabbed');
              this.event('grabbed',{side:other.side});
              this.effect('impact',other.x,other.y+70,16,'#ffe9a8');
              victim=other;
              break;
            }
          }
        }
        if(!victim){
          if(holder.frame>=durationOf(holder,holder.state)-1){this.finishAttackFeedback(holder);this.transition(holder,'idle');}
          continue;
        }
        /* 抓住后保持贴身（那美克星人手臂伸缩类长距离抓取不强制贴身） */
        const grabReach=m.reach||74;
        const keepDistance=Math.min(grabReach*0.7,140);
        if(Math.abs(victim.x-holder.x)>keepDistance+40)victim.x=clamp(holder.x+holder.facing*keepDistance,50,W-50);
        victim.y=holder.y;
        if(victim.grabTicks>0)victim.grabTicks--;
        if(holder.grabHold>0)holder.grabHold--;
        if(victim.grabTicks<=0||holder.grabHold<=0)this.resolveThrow(holder);
      }
    }

    /* 脱身（每局限量）——「被连到死」的兜底手段。
       规则层：消耗 1 次脱身次数 → 解除一切受控状态 → 绕到对手背后 → 短暂无敌 →
       对方的连段计数清零（连段被彻底打断）。
       命名层：按该角色正传里真实拥有的机动手段取名，不虚构招式：
         · 正传有瞬间移动（悟空各形态、沙鲁）      → 瞬间移动
         · 正传有残像拳（龟仙流等）                → 残像拳
         · 正传不会舞空术（亚奇洛贝／撒旦／布尔玛） → 翻滚脱身
         · 其余会舞空术的角色                      → 舞空术脱身 */
    escapeLabel(f){
      const sk=DV.resolveSkills?DV.resolveSkills(f):{};
      const own=Object.assign({},(sk&&sk.unique)||{},(sk&&sk.moves)||{});
      if(own.uniqueWarp)return '瞬间移动';
      if(own.uniqueAfterimage)return '残像拳';
      if((DV.passiveOf(f).airJumps||0)<0)return '翻滚脱身';
      return '舞空术脱身';
    }
    escapeCombo(side){
      const f=this.fighters[side];
      if(!f)return this.rejectCommand('invalidSide');
      if(f.hp<=0)return this.rejectCommand('defeated');
      if(f.escapes<=0)return this.rejectCommand('usesExhausted');
      if(f.escapeLock>0)return this.rejectCommand('escapeCooldown');
      const enemy=this.fighters[1-f.side];
      if(this.throwSequence?.victimSide===side){
        this.throwSequence=null;
        if(enemy){enemy.y=0;enemy.vy=0;enemy.grounded=true;this.transition(enemy,'idle');}
      }
      f.escapes--;f.escapeUsed++;
      /* 被吞入体内也能挣脱（正传：贝吉特从布欧体内把人扯出来） */
      if(f.swallowedBy!==null&&f.swallowedBy!==undefined){
        const holder=this.fighters[f.swallowedBy];
        if(holder)this.releaseAbsorbed(holder);
      }
      /* 解除抓取／被摔：双方的抓取状态一起清掉 */
      f.grabbedBy=null;f.grabTicks=0;f.grabHold=0;f.assistGrabTicks=0;
      if(enemy){enemy.grabbedBy=null;enemy.grabTicks=0;enemy.grabHold=0;}
      /* 绕到对手背后（与 passive.teleport 同一套表现） */
      const dir=(this.input[side].right?1:0)-(this.input[side].left?1:0);
      const base=enemy?enemy.x:f.x;
      f.x=clamp(base+(dir||1)*ESCAPE_DISTANCE,50,W-50);
      f.facing=enemy&&enemy.x>=f.x?1:-1;
      /* 清掉受控状态与束缚类状态（不触碰再生／吸收等增益状态） */
      for(const key of Object.keys(BAD_STATUS))delete f.status[key];
      f.y=0;f.vy=0;f.vx=0;f.grounded=true;f.launched=false;
      f.stun=0;f.hitstun=0;f.airHold=0;
      f.psychoDrain=0;
      f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
      f.invuln=Math.max(f.invuln,ESCAPE_INVULN);
      f.escapeLock=ESCAPE_LOCK;
      /* 脱身彻底打断对手的连段 */
      if(enemy){
        enemy.combo=0;enemy.damageCombo=0;enemy.comboTimer=0;
        enemy.confirmTicks=0;enemy.confirmState=null;enemy.pursuitTicks=0;
      }
      this.transition(f,'dash');
      this.effect('burst',f.x,f.y+70,26,f.spec.color);
      this.shake=6;
      this.event('escape',{side,label:this.escapeLabel(f),left:f.escapes});
      return true;
    }

    /* 通用投技：先抛空，再瞬移追击，最后砸地。拆投窗口保持不变。 */
    resolveThrow(holder){
      const victim=this.fighters.find(f=>f.grabbedBy===holder.side);
      if(!victim)return;
      const m=moveOf(holder,holder.state)||{},g=m.grab||{};
      victim.grabbedBy=null;victim.grabTicks=0;
      holder.grabHold=0;
      this.transition(victim,'thrown');
      victim.stun=Math.max(30,durationOf(victim,'thrown'));
      victim.vx=0;victim.vy=0;victim.grounded=false;
      this.throwSequence={attackerSide:holder.side,victimSide:victim.side,tick:0,
        damage:g.throwDamage||110,push:g.throwPush||26};
      this.effect('burst',victim.x,victim.y+70,28,'#ffd98a');
      this.event('throwLaunch',{side:holder.side,targetSide:victim.side});
    }

    stepThrowSequence(){
      const seq=this.throwSequence;
      if(!seq)return;
      const holder=this.fighters[seq.attackerSide],victim=this.fighters[seq.victimSide];
      if(!holder||!victim||holder.hp<=0||victim.hp<=0){this.throwSequence=null;return;}
      seq.tick++;
      holder.frame++;victim.frame++;
      if(seq.tick<=10){victim.y=26*seq.tick;victim.grounded=false;}
      else if(seq.tick<=16){victim.y=260;victim.grounded=false;}
      else if(seq.tick<24){victim.y=260*(24-seq.tick)/8;victim.grounded=false;}
      if(seq.tick===11){
        holder.x=clamp(victim.x-holder.facing*42,50,W-50);
        this.transition(holder,'dash');
        this.effect('burst',holder.x,260,22,holder.spec.color);
        this.event('throwTeleport',{side:holder.side,targetSide:victim.side});
      }
      if(seq.tick>=11&&seq.tick<24){
        holder.y=Math.min(285,victim.y+46);holder.grounded=false;
        if(seq.tick===16)this.transition(holder,'heavy');
      }
      if(seq.tick<24)return;
      holder.y=0;holder.vy=0;holder.grounded=true;
      victim.y=0;victim.vy=0;victim.grounded=true;
      this.throwSequence=null;
      this.hit(holder,victim,{damage:seq.damage,stun:36,push:seq.push,heavy:true},
        {heavy:true,push:seq.push,stun:36,unblockable:true});
      this.transition(victim,'down');victim.vx=0;victim.vy=0;
      this.transition(holder,'idle');
      this.effect('burst',victim.x,65,38,'#ffd98a');
      this.shake=15;
      this.event('throwSlam',{side:holder.side,targetSide:victim.side});
      this.checkEnd();
    }

    /* 反击判定：必须在双方帧都推进完毕后再执行，否则会因攻击方 frame 领先
       半帧而永远错过有效窗口（正传：反击技） */
    stepCounters(){
      for(const f of this.fighters){
        if(f.state!=='counter'||f.counter<=0||!f.counterMove)continue;
        const enemy=this.fighters[1-f.side];
        const incoming=activeMove(enemy);
        if(!incoming||incoming.damage<=0)continue;
        if(!overlaps(attackBox(enemy),hurtbox(f)))continue;
        const cd=f.counterMove;
        f.invuln=cd.invulnAfter||12;
        this.hit(f,enemy,{damage:cd.damage||96,stun:cd.stun||42,push:cd.push||18},
          {heavy:true,stun:cd.stun||42,push:cd.push||18,unblockable:true});
        /* 被反制的招式本帧作废，否则攻方同帧的有效判定仍会命中反击方 */
        enemy.used=true;
        enemy.lastCountered=this.tick;
        this.effect('burst',f.x,f.y+70,30,f.spec.color);
        this.event('counter',{side:f.side});
        this.transition(f,'idle');
        this.pendingHits=this.pendingHits.filter(args=>args[1]!==f);
      }
    }

    /* 吸收判定（正传：沙鲁尾巴吸收生命体、布欧把对手吸入体内）。
       必须在双方帧结算后执行，与反击同一时机，避免半帧错位。
       判定窗口是 at..end 的**区间**：旧写法只认 f.frame===at 那一帧，
       等于把「吸收」做成 1 帧的极限操作，实战命中率接近 0。 */
    stepAbsorbs(){
      for(const f of this.fighters){
        if(f.state!=='absorb')continue;
        const m=moveOf(f,'absorb');
        if(!m||!m.absorb)continue;
        const A=m.absorb;
        const at=Number.isFinite(m.at)?m.at:0;
        const end=Number.isFinite(m.end)?m.end:at;
        if(f.frame<at||f.frame>end)continue;
        if(f.absorbCooldown>0)continue;
        const enemy=this.fighters[1-f.side];
        if(enemy.hp<=0||enemy.invuln>0)continue;
        if(enemy.swallowedBy!==null&&enemy.swallowedBy!==undefined)continue;
        if(enemy.state==='grabbed'||enemy.state==='thrown')continue;
        /* 布欧的身体伸缩可以把空中的对手卷下来；沙鲁的尾针则要贴身。
           因此这里按招式自身声明的伸展距离判定，不再强制双方站在地面。 */
        const reach=Math.max(96,m.reach||96);
        if(Math.abs(enemy.x-f.x)>reach)continue;
        if(Math.abs(enemy.y-f.y)>130)continue;
        this.resolveAbsorb(f,enemy,A,m);
      }
    }

    resolveAbsorb(f,victim,A,m){
      /* 吸取：立刻造成伤害并把一部分转化为自身恢复与强化 */
      const damage=Math.round((A.drain||0)*(f.burstFrames>0?1.18:1));
      if(damage>0){
        victim.hp=Math.max(0,victim.hp-damage);
        victim.flash=5;
        f.hp=clamp(f.hp+damage*(A.healRatio!=null?A.healRatio:0.5),0,f.maxHp);
        f.ki=clamp(f.ki+damage*0.08,0,100);
        victim.ki=Math.max(0,victim.ki-damage*(A.kiDrain||0.1));
      }
      /* 强化：正传中吸收后战力提升（沙鲁吸收人造人、布欧吸收战士） */
      if(A.powerScale&&A.powerFrames){
        f.absorbPower=Math.max(f.absorbPower||0,A.powerFrames);
        f.absorbPowerScale=Math.max(f.absorbPowerScale||1,A.powerScale);
      }
      if(A.speedScale&&A.powerFrames)f.absorbSpeedScale=Math.max(f.absorbSpeedScale||1,A.speedScale);
      if(A.status)applyStatus(victim,A.status,A.statusTicks||120);
      /* 布欧式：把对手吞入体内。正传中对手被封闭在体内仍然活着，
         布欧因此继承其力量与招式；之后会被「吐出来」。
         被吞期间受害者无法行动，但可以从内部挣脱（正传：贝吉特撕开布欧的身体），
         按任意键连打会明显缩短被困时间，也可以用脱身直接冲出来。 */
      if(A.swallow){
        victim.grabbedBy=null;
        victim.swallowedBy=f.side;
        victim.swallowTicks=A.swallowFrames||420;
        victim.swallowMax=victim.swallowTicks;
        victim.vx=0;victim.vy=0;victim.invuln=0;victim.stun=0;
        victim.hp=Math.max(1,victim.hp);
        this.transition(victim,'grabbed');
        /* 正传：布欧吸收后继承被吸收者的招式与力量 */
        this.inheritMoves(f,victim);
        this.event('swallow',{side:f.side,absorbed:victim.spec.id,
          inherited:f.inheritedFrom,label:m.label||'吸收'});
      }
      /* 吸收后的再使用冷却：否则一次贴身就能连续吞人 */
      f.absorbCooldown=m.absorbCooldown||A.cooldown||150;
      this.effect('burst',victim.x,victim.y+70,A.swallow?38:28,f.spec.color);
      this.shake=A.swallow?15:11;this.flash=A.swallow?6:3;
      this.event('absorb',{side:f.side,swallow:!!A.swallow,label:m.label||'吸收',
        drain:damage,healed:Math.round(damage*(A.healRatio!=null?A.healRatio:0.5))});
      this.transition(f,'idle');
    }

    /* 继承被吸收者的招式（正传：布欧吸收后可使用对方的能力） */
    inheritMoves(f,victim){
      const src=DV.resolveMoves(victim);
      const gained=f.gainedMoves||(f.gainedMoves={});
      /* 只继承「攻击性」招式，且不覆盖自身的必杀与投技槽位 */
      const slots=['heavy','airH','ki','super','counter'];
      for(const slot of slots){
        const m=src[slot];
        if(!m)continue;
        if(slot==='super'&&src.super&&src.super.label==='super')continue;  // 通用必杀不值得继承
        gained[slot]=Object.assign({},m,{inheritedFrom:victim.spec.id,inheritedLabel:m.label||slot});
      }
      /* 继承来的必杀以「对方必杀」的名义使用 */
      const enemySuper=src.super;
      if(enemySuper){
        gained.super=Object.assign({},enemySuper,{inheritedFrom:victim.spec.id});
      }
      f.inheritedFrom=victim.spec.id;
    }

    /* 把吸收进体内的对手吐出来：扣血 + 击飞，并交还继承的招式。
       正传中布欧被外力撕开后会把人放出（贝吉特从体内扯出悟饭等人）。 */
    releaseAbsorbed(holder,opts={}){
      const victim=this.fighters.find(f=>f.swallowedBy===holder.side);
      if(!victim)return null;
      const A=opts.absorb||{};
      victim.swallowedBy=null;victim.swallowTicks=0;
      /* 吐出时对双方都造成伤害（正传：被放出者虚弱，放出者承受反噬） */
      const victimDamage=Math.round((A.releaseDamage!=null?A.releaseDamage:60));
      if(!opts.noDamage)victim.hp=Math.max(1,victim.hp-victimDamage);
      victim.flash=6;
      if(!opts.noDamage)holder.hp=Math.max(1,holder.hp-Math.round(victimDamage*(A.releaseSelfRatio!=null?A.releaseSelfRatio:0.35)));
      /* 交还继承的招式 */
      holder.gainedMoves=null;holder.inheritedFrom=null;
      /* 对手被抛到放出者身前并倒地 */
      victim.x=clamp(holder.x+holder.facing*70,50,W-50);
      victim.y=0;victim.grounded=true;victim.vx=holder.facing*10;victim.vy=0;
      this.transition(victim,'down');
      victim.stun=Math.max(30,durationOf(victim,'down'));
      victim.invuln=30;
      this.effect('burst',victim.x,victim.y+70,34,'#ffe6a8');
      this.shake=14;
      this.event('release',{side:holder.side,victim:victim.side});
      return victim;
    }

    /* 念动力（正传：弗利萨／古拉隔空束缚对手） */
    stepPsychokinesis(){
      for(const f of this.fighters){
        if(f.state!=='psycho')continue;
        const m=moveOf(f,'psycho');
        if(!m||!m.psycho)continue;
        const P=m.psycho;
        if(f.frame!==(P.at||0))continue;
        const enemy=this.fighters[1-f.side];
        if(enemy.hp<=0||enemy.invuln>0)continue;
        if(Math.abs(enemy.x-f.x)>(P.range||520))continue;
        /* 浮空束缚：把对手抬离地面并封锁行动。
           正传：弗利萨维持光栅摆布悟空极耗力气，因此束缚期间持续流失气力。 */
        enemy.grounded=false;enemy.y=Math.max(enemy.y,90);enemy.vy=0;enemy.airHold=P.hold||70;
        enemy.hitstun=P.hold||70;
        applyStatus(enemy,{paralyze:1},P.hold||70);
        f.psychoDrain=(P.hold||70)+10;   // 束缚期间持续消耗
        const dmg=P.damage||0;
        if(dmg>0){enemy.hp=Math.max(0,enemy.hp-dmg);enemy.flash=5;}
        this.effect('summon',enemy.x,enemy.y+70,26,f.spec.color);
        this.event('psycho',{side:f.side});
        this.transition(f,'idle');
      }
    }

    /* 巨大化（正传：比克在第23届天下一武道会对悟空使用） */
    applyGiantForm(f,spec,ticks){
      if(f.giantFrames>0)return false;
      f.giantFrames=ticks;
      f.giantScale=spec.scale||1.5;
      f.giantDamage=spec.damageScale||1.25;
      f.giantSpeedScale=spec.speedScale||0.8;
      this.effect('burst',f.x,f.y+70,40,f.spec.color);
      this.shake=14;this.flash=4;
      this.event('giant',{side:f.side});
      return true;
    }

    stepFighter(f){
      const enemy=this.fighters[1-f.side], input=this.input[f.side];
      const pass=DV.passiveOf(f);
      /* Gameplay frame drives hitboxes and move timing. Looping generated art gets
         its own clock so authored 16/40-tick poses never inherit a 24/48-tick
         gameplay cycle. This runs only on a live logical step: pause and hitstop
         return before stepFighter is reached. */
      if(LOOPS.has(f.state))f.visualFrame=(Number.isFinite(f.visualFrame)?f.visualFrame:0)+1;
      for(const key of ['invuln','burstFrames','burstCooldown','assistCooldown','assistBarrierTicks','assistGrabTicks','comboTimer','bufferTicks','flash','recoveryTimer','airHold','transformCooldown','teleportCooldown','counter','barrierCooldown','absorbPower','giantFrames','escapeLock','absorbCooldown','confirmTicks','pursuitTicks'])
        if(f[key]>0)f[key]--;
      if(f.assistBarrierTicks===0)f.assistBarrier=0;
      if(f.confirmTicks===0)f.confirmState=null;
      if(f.comboTimer===0){f.combo=0;f.damageCombo=0;}
      if(!f.bufferTicks){f.buffer=null;f.bufferAction=null;}
      /* 早按输入在真实命中前只是普通 buffer。只有 hit() 授予确认/追击窗口后，
         才在完整 hitstop 结束的首个活动帧走同一 command 路径兑现与扣费。 */
      if(f.buffer){
        const queued=f.buffer;
        const confirmReady=f.confirmTicks>0&&f.confirmState===f.state&&['heavy','ki','super'].includes(queued);
        const pursuitReady=f.pursuitTicks>0&&(queued==='jump'||queued==='dash');
        /* 这是同一笔预输入的内部尝试，不能在每帧反复发缓冲/拒绝提示。
           真正未能执行的预输入会在收招结束后走 runCommand 报一次原因。 */
        if(confirmReady||pursuitReady)this.executeCommand(f.side,queued);
      }
      /* 状态效果递减 */
      if(f.status&&Object.keys(f.status).length){
        for(const key of Object.keys(f.status)){
          f.status[key]--;
          if(f.status[key]<=0)delete f.status[key];
        }
      }
      /* 资源回复（正传被动：人造人无限能量 / 再生） */
      f.stamina=clamp(f.stamina+.22,0,100);
      /* 念动力束缚维持中：持续消耗气力（正传：维持光栅极耗力） */
      if(f.psychoDrain>0){f.psychoDrain--;f.ki=Math.max(0,f.ki-.35);}
      const guardRegen=pass.guardRegenScale?pass.guardRegenScale*.19:.19;
      if(f.state!=='guard')f.guard=clamp(f.guard+guardRegen,0,100);
      if(FREE.has(f.state)){
        const regen=pass.infiniteEnergy?((pass.infiniteEnergy.kiPerTick)||.18):.025;
        let gain=regen+(pass.kiRegenBonus||0);
        /* 形态维持消耗（正传：超赛3／超赛蓝／黄金弗利萨等形态持续耗气） */
        if(pass.kiDrain)gain-=pass.kiDrain;
        f.ki=clamp(f.ki+gain,0,100);
        f.facing=enemy.x>=f.x?1:-1;
      }
      /* 形态维持的生命代价（正传：界王拳的剧痛与肌肉损伤） */
      if(pass.hpDrain)f.hp=Math.max(1,f.hp-pass.hpDrain);
      /* 形态力量随时间的变化：
         正传里「力量会流失」（100% 弗利萨越打越喘、剧场版超赛神的力量是暂时性的、
         融合为限时合体）与「力量会增长」（传说型超级赛亚人）都是形态机制。 */
      if(pass.powerFade||pass.rampUp){
        f.formTicks=(f.formTicks||0)+1;
        if(pass.powerFade){
          const pf=pass.powerFade,min=Number.isFinite(pf.min)?pf.min:0.7;
          f.formScale=Math.max(min,1-Math.max(0,f.formTicks-(pf.after||0))*(pf.perTick||0));
        }else{
          const ru=pass.rampUp,max=Number.isFinite(ru.max)?ru.max:1.2;
          f.formScale=Math.min(max,1+Math.max(0,f.formTicks-(ru.after||0))*(ru.perTick||0));
        }
      }else f.formScale=1;
      /* 再生：脱离受击一段时间后自愈 */
      if(pass.regen&&f.hp<f.maxHp&&f.state!=='hit'&&f.state!=='down'&&f.state!=='grabbed'&&f.state!=='thrown'){
        f.regenTicks=(f.regenTicks||0)+1;
        if(f.regenTicks>=(pass.regen.delay||180))f.hp=clamp(f.hp+(pass.regen.perSecond||0)/60,0,f.maxHp);
      }else if(f.state==='hit'||f.state==='down'){f.regenTicks=0;}

      /* 重力。被浮空（launched）时降低重力以便空中连段 */
      if((f.y>0||!f.grounded)&&!(f.airHold>0)){
        const floating=f.state==='hit'&&f.hitstun>0&&f.launched;
        f.y+=f.vy;f.vy-=floating?.16:.55;
        if(f.y<=0){
          f.y=0;f.vy=0;f.grounded=true;f.jumps=0;f.launched=false;
          f.confirmTicks=0;f.confirmState=null;f.pursuitTicks=0;
          if(f.state==='jump'||f.state==='fall')this.transition(f,'idle');
          else if(f.state==='thrown'){this.transition(f,'down');f.stun=Math.max(f.stun,durationOf(f,'down'));}
          this.effect('dust',f.x,0,20,'#ded7b9');
        }
      }
      f.x+=f.vx;f.vx*=.72;

      /* 被吞入体内：无法行动，直到被吐出或到时自动放出。
         必须放在 grabbed/thrown 早退之前，否则永远不会生效。
         正传里贝吉特是从布欧体内硬撕出来的，因此这里允许「连打挣脱」：
         被困者每按一次键都会明显缩短剩余时间（受击方不会只能干等）。 */
      if(f.swallowedBy!==null&&f.swallowedBy!==undefined){
        const inp=this.input[f.side]||{};
        const mashing=inp.left||inp.right||inp.guard||inp.charge||inp.attack||inp.jump||inp.dash;
        f.swallowTicks-=mashing?4:1;
        const holder=this.fighters[f.swallowedBy];
        if(holder){f.x=holder.x;f.y=holder.y;}
        f.hp=Math.max(1,f.hp-0.25);          // 正传：被封在体内持续消耗
        /* 每半秒给一次可见反馈，让「正在被消化」这件事看得见 */
        if(this.tick%30===0){
          this.effect('burst',holder?holder.x:f.x,(holder?holder.y:f.y)+80,14,'#ffb0e0',{small:true});
          this.event('absorbDrain',{side:f.swallowedBy,victim:f.side,ticks:f.swallowTicks});
        }
        if(f.swallowTicks<=0&&holder)this.releaseAbsorbed(holder);
        if(f.justStarted)f.justStarted=false;else f.frame++;
        return;
      }

      if(f.state==='grabbed'||f.state==='thrown'){
        if(f.justStarted)f.justStarted=false;else f.frame++;
        f.x=clamp(f.x,50,W-50);
        return;
      }

      const canAct=!hasBadStatus(f);
      /* 反击架势优先于普通自由移动，必须是第一个分支，否则会被 idle 覆盖 */
      if(f.state==='counter'&&f.counter>0&&moveTable(f).counter&&moveTable(f).counter.counterMove){
        /* 保持架势；等帧推进后的反击判定处理 */
      }
      else if(FREE.has(f.state)&&canAct){
        const move=(input.right?1:0)-(input.left?1:0);
        if(input.guard&&f.grounded){this.transition(f,'guard');}
        else if(input.charge&&f.grounded){
          this.transition(f,'charge');f.ki=clamp(f.ki+.4,0,100);
          if(this.tick%10===0)this.effect('rise',f.x+(this.random()-.5)*60,10,28,f.spec.color);
        }
        else if(move){
          const base=pass.speedScale?f.spec.stats.speed*pass.speedScale:f.spec.stats.speed;
          const giantSlow=f.giantFrames>0?(f.giantSpeedScale||1):1;
          const absorbFast=f.absorbPower>0?(f.absorbSpeedScale||1):1;
          const speed=base*giantSlow*absorbFast;
          f.x+=move*Math.min(speed,WALK_SPEED_CAP)/60*(f.burstFrames>0?1.14:1);
          this.transition(f,f.grounded?'run':f.vy>0?'jump':'fall');
        }
        else if(f.grounded)this.transition(f,'idle');
        else if(f.vy<0&&f.state==='jump')this.transition(f,'fall');
      }
      if(f.justStarted)f.justStarted=false;else f.frame++;
      const m2=moveOf(f,f.state)||{};
      f.counterMove=(f.state==='counter'&&m2.counterMove)?m2.counterMove:null;
      if(f.state==='dash'){
        const base=Number.isFinite(m2.step)?m2.step:19;
        f.x+=(f.dashDir||f.facing)*(f.frame<9?base:base*8/19);
        if(f.frame%3===0)f.trail.push({x:f.x,y:f.y,life:12,frame:f.frame});
      }
      for(const t of f.trail)t.life--;f.trail=f.trail.filter(t=>t.life>0);
      /* 攻击前冲：贴近到 reach 内 */
      if(m2.damage>0&&!m2.grab&&f.frame<=m2.at&&Math.abs(enemy.y-f.y)<110){
        const distance=(enemy.x-f.x)*f.facing,step=Number.isFinite(m2.step)?m2.step:0;
        if(step>0&&distance>76&&distance<180)f.x+=f.facing*Math.min(step,distance-76);
      }
      if(m2.damage>0&&f.frame===m2.at){
        this.event('swing',{side:f.side});
        this.effect('slash',f.x+f.facing*((Number.isFinite(m2.reach)?m2.reach:100)-28),f.y+80,
          (Number.isFinite(m2.end)?m2.end:m2.at)-m2.at+1,f.spec.color,{facing:f.facing});
      }
      /* 反击判定已在上方（帧推进之后）统一处理 */
      if(f.state==='ki'&&m2.projectile&&f.frame===(m2.projectile.spawnFrame||12))this.spawnProjectile(f,0,{move:m2});
      if(f.state==='burst'&&f.frame===8){
        this.effect('burst',f.x,f.y+65,35,f.spec.color);this.shake=12;this.flash=5;
        if(Math.abs(enemy.x-f.x)<220&&Math.abs(enemy.y-f.y)<150)
          this.pendingHits.push([f,enemy,m2,{unblockable:true,push:30,stun:28}]);
        this.projectiles=this.projectiles.filter(p=>p.side===f.side||Math.abs(p.x-f.x)>240);
      }
      /* 必杀／专属必杀：沿用正传三分类（光束 / 气弹 / 突进）＋气圆斩／范围技 */
      if(f.state==='super'||(m2&&(m2.slot==='super'||m2.superKind))){
        const sm=f.superMove||m2||moveTable(f).super||m;
        const spawnFrame=sm.spawnFrame||32;
        const kind=sm.superKind||f.spec.beam||'beam';
        if(f.frame<spawnFrame&&f.frame%4===0)this.effect('gather',f.x+f.facing*40,f.y+76,14,f.spec.color);
        if(f.frame===spawnFrame){
          this.shake=sm.shake||8;
          if(kind==='ball'){
            this.spawnProjectile(f,2,{move:sm,projectile:Object.assign({kind:'ball',speed:10,radius:38,life:130,damage:185,heavy:true,chip:12},sm.projectile||{})});
          }else if(kind==='disc'){
            /* 气圆斩类：高速扁平气刃，具穿透性 */
            this.spawnProjectile(f,2,{move:sm,projectile:Object.assign({kind:'disc',speed:17,radius:34,life:110,damage:150,pierce:true,homing:1.6,chip:0},sm.projectile||{})});
          }else if(kind==='aoe'){
            /* 太阳拳 / 超能力：以自身为中心的范围效果（致盲、定身等） */
            const spec2=sm.superAoe||sm.aoe||{radius:430,damage:0,status:{blind:1},statusTicks:150};
            this.effect('burst',f.x,f.y+70,34,'#ffffff',{small:false});
            this.flash=9;this.shake=Math.max(this.shake,10);
            if(spec2.damage>0&&Math.abs(enemy.x-f.x)<(spec2.radius||430)&&Math.abs(enemy.y-f.y)<170)
              this.pendingHits.push([f,enemy,{damage:spec2.damage,stun:spec2.stun||30,push:spec2.push||18},
                {stun:spec2.stun||30,push:spec2.push||18,unblockable:!!spec2.unblockable}]);
            if(spec2.status){
              /* 致盲类效果只对敌人生效，且不造成伤害 */
              for(const other of this.fighters){
                if(other===f)continue;
                if(Math.abs(other.x-f.x)<(spec2.radius||430))applyStatus(other,spec2.status,spec2.statusTicks||150);
              }
            }
            this.event('aoe',{side:f.side,name:sm.label});
          }else if(kind==='rush'||kind==='lunge'){f.rushHit=false;f.invuln=sm.invuln||20;}
          else{
            this.beams.push({side:f.side,x:f.x+f.facing*45,y:f.y+80,dir:f.facing,end:f.x+f.facing*60,
              life:48,age:0,color:f.spec.color,damage:sm.beamDamage||12,hitTick:-9,owner:f,pierce:!!sm.pierce});
          }        }
        if((kind==='rush'||kind==='lunge')&&f.frame>=spawnFrame&&f.frame<=spawnFrame+(sm.lungeFrames||20)){
          f.x+=f.facing*(sm.lungeSpeed||20);
          if(!f.rushHit&&Math.abs(f.x-enemy.x)<115&&Math.abs(f.y-enemy.y)<120){
            f.rushHit=true;
            this.pendingHits.push([f,enemy,{damage:sm.damage||205,stun:45,push:36,heavy:true},{heavy:true,stun:45,push:36}]);
            this.effect('burst',enemy.x,enemy.y+70,30,f.spec.color);
          }
          if(f.frame%3===0)f.trail.push({x:f.x,y:f.y,life:14,frame:12});
        }
      }
      if(f.state==='transform'&&f.frame===16){
        this.effect('burst',f.x,f.y+70,24,(f.transformTarget&&f.transformTarget.color)||f.spec.color);this.shake=8;
      }
      const duration=f.state==='hit'?Math.max(HIT_MIN_FRAMES,f.stun):durationOf(f,f.state);
      if(f.frame>=duration){
        this.finishAttackFeedback(f);
        if(f.state==='transform'&&f.transformTarget){
          const ratio=f.hp/f.maxHp;f.spec=f.transformTarget;
          f.maxHp=f.spec.stats.health;f.hp=Math.round(f.maxHp*ratio);
          this.transition(f,'idle');this.flash=4;
          this.event('transformEnd',{side:f.side,name:f.spec.form});
        }
        else if(LOOPS.has(f.state))f.frame=0;
        else if(f.state==='down')this.transition(f,f.grounded?'idle':'fall');
        else if(f.state==='win')f.frame=duration-1;
        else if(f.buffer){
          const queued=f.buffer,queuedAction=f.bufferAction||queued,cur=moveOf(f,f.state)||{};
          /* 连段推进：只认当前招式的 chain，不再假定槽位名称（兼容空中链 airL→airH） */
          const isAttackQueued=queued==='light'||queued==='attack';
          if(isAttackQueued&&cur.chain&&cur.chain.length){
            this.transition(f,cur.chain[0]);
            if(f.attackFeedback)f.attackFeedback.action=queuedAction;
          }else{
            this.transition(f,f.grounded?'idle':'fall');
            this.runCommand(f.side,queued,undefined,queuedAction);
          }
        }
        else this.transition(f,f.grounded?'idle':'fall');
      }
      f.x=clamp(f.x,50,W-50);
    }

    separate(){
      const [a,b]=this.fighters, dx=b.x-a.x;
      if(a.grabbedBy!==null||b.grabbedBy!==null)return;
      if(Math.abs(dx)<62&&Math.abs(a.y-b.y)<98){
        const push=(62-Math.abs(dx))/2,dir=dx>=0?1:-1;
        a.x=clamp(a.x-dir*push,50,W-50);b.x=clamp(b.x+dir*push,50,W-50);
      }
    }

    /* base 既可为招式对象，也可为数字（向后兼容） */
    hit(attacker,target,base,opts={}){
      if(!target||target.hp<=0)return false;
      const m=typeof base==='object'&&base?base:null;
      const raw=m?m.damage:base;
      if(!(raw>0))return false;
      if(target.invuln>0)return false;
      let resolvedRaw=raw;
      if(target.assistBarrier>0&&target.assistBarrierTicks>0){
        const reduction=clamp(target.assistBarrierReduction==null ? .55 : target.assistBarrierReduction,0,.55);
        const absorbed=Math.min(target.assistBarrier,resolvedRaw*reduction);
        target.assistBarrier=Math.max(0,target.assistBarrier-absorbed);
        resolvedRaw=Math.max(0,resolvedRaw-absorbed);
        this.effect('guard',target.x,target.y+80,18,'#8fe6ff');
        this.event('assistBarrier',{side:target.side,absorbed,left:target.assistBarrier,reduction});
        if(target.assistBarrier<=0)target.assistBarrierTicks=0;
      }
      let guardBroken=false;

      const frontal=(attacker.x-target.x)*target.facing>=-15;
      const unblockable=!!(opts.unblockable||(m&&m.unblockable));
      const pierce=!!(opts.pierce||(m&&m.pierce));
      const cannotGuard=blocked(target,'blind')||blocked(target,'paralyze')||blocked(target,'freeze');
      const guarded=target.state==='guard'&&!cannotGuard&&frontal&&!unblockable&&!pierce;

      if(guarded){
        const guardDamage=resolvedRaw*.62+8;
        target.guard-=guardDamage;target.vx=attacker.facing*3;
        attacker.confirmTicks=0;attacker.confirmState=null;attacker.pursuitTicks=0;
        target.confirmTicks=0;target.confirmState=null;target.pursuitTicks=0;
        this.effect('guard',target.x+target.facing*25,target.y+80,14,'#a4f6ff');
        this.hitstop=2;
        this.event('guard',{side:target.side,attackerSide:attacker.side,blocked:true,
          guardDamage,hitstop:this.hitstop,x:target.x,y:target.y+80,
          position:{x:target.x,y:target.y+80},facing:attacker.facing,type:'guard',strength:'light'});
        /* 能量障壁（正传：17号展开气罩挡下／弹开气弹）：成功格挡即触发，有冷却。
           必须放在「防御成功即返回」之前，否则只在破防帧才生效。 */
        const barrier=DV.passiveOf(target).energyBarrier;
        if(barrier&&target.barrierCooldown<=0){
          target.barrierCooldown=barrier.cooldown||180;
          this.effect('guard',target.x,target.y+80,22,'#8fe6ff');
          this.event('barrier',{side:target.side});
        }
        if(target.guard>0){
          const chip=opts.chip||(m&&m.chip)||0;
          /* 穿透技不削血：防不住就只能吃全额伤害，而不是被慢慢磨死 */
          if(chip&&!pierce)target.hp=Math.max(1,target.hp-chip);
          return true;
        }
        target.guard=0;this.transition(target,'hit');target.stun=64;guardBroken=true;
        this.effect('break',target.x,target.y+95,35,'#ffffff');this.event('break',{side:target.side});
      }

      /* 命中附带状态必须在成功穿过防御判定后施加。
         projectile 状态通过 opts 传入，招式本体状态仍走 m.status；两者都不能
         让一个正常成功的防御先被 paralyze/freeze 等状态改写成不可防御。 */
      const hitStatus=opts.status||(m&&m.status);
      if(hitStatus)applyStatus(target,hitStatus,opts.statusTicks||opts.statusFrames||(m&&(m.statusTicks||m.statusFrames))||120);

      if(target.state!=='hit'){attacker.combo=0;attacker.damageCombo=0;}
      const scaling=Math.max(.45,1-attacker.combo*.075);
      const assistAttack=!!opts.assist;
      const powerScale=assistAttack?1:(attacker.spec.stats.power||1)*(opts.powerScale||1);
      const burstScale=!assistAttack&&attacker.burstFrames>0?1.18:1;
      /* 吸收后的强化（正传：吸收对手后战力提升） */
      const absorbScale=!assistAttack&&attacker.absorbPower>0?(attacker.absorbPowerScale||1):1;
      /* 巨大化后的力量提升（正传：比克巨大化） */
      const giantScale=!assistAttack&&attacker.giantFrames>0?(attacker.giantDamage||1):1;
      /* 濒死强化 / 愤怒爆发（正传：赛亚人濒死复原、悟饭愤怒爆发） */
      const attackerPass=assistAttack?{}:DV.passiveOf(attacker);
      const low=attackerPass.lowHpDamage;
      const rageScale=(low&&attacker.maxHp>0&&attacker.hp/attacker.maxHp<=low.threshold)
        ? (low.damageScale||1.10):1;
      /* 硬气防御（正传：吉连以气墙硬挡） */
      const resist=DV.passiveOf(target).damageResist||1;
      /* 形态特性的固定力量差（正传：界王拳爆发、变小后战力下降） */
      const traitScale=attackerPass.traitPower||1;
      /* 形态力量随时间增减（正传：100% 弗利萨越打越喘／传说型越打越强／融合时限） */
      const formScale=assistAttack?1:(attacker.formScale||1);
      const damage=Math.max(1,Math.round(resolvedRaw*powerScale*scaling*burstScale*rageScale*resist*absorbScale*giantScale*traitScale*formScale));
      target.hp=Math.max(0,target.hp-damage);
      this.interruptAssist(target.side);
      target.recoveryTimer=100;
      target.ki=clamp(target.ki+damage*.04,0,100);
      attacker.ki=clamp(attacker.ki+damage*.075,0,100);
      /* 吸收气弹（正传：人造人吸收能量） */
      const absorb=DV.passiveOf(target).absorbKi;
      if(absorb&&opts.projectile)target.ki=clamp(target.ki+damage*(absorb.ratio||1),0,100);

      if(target.state!=='hit'){
        this.transition(target,'hit');
      }
      /* 连段保护 1／3：硬直衰减。
         同一套连段里第 N 段的硬直逐段递减（有下限），
         于是「一直在硬直内再打中一下」的循环会自然接不上，
         受击方必然拿到自由帧。注意这里不再取 Math.max 保留旧值——
         旧写法每次都把硬直刷回满值，正是被连到死的直接原因。
         破防（GUARD BREAK）本身要给出更长的惩罚硬直，所以它的基准值取 64。 */
      const comboIdx=attacker.combo;
      const stunDecay=Math.max(COMBO_STUN_FLOOR,1-comboIdx*COMBO_STUN_DECAY);
      const rawStun=guardBroken?64:(opts.stun||(m&&m.stun)||20);
      const stunValue=Math.max(6,Math.round(rawStun*stunDecay));
      target.frame=0;
      target.stun=stunValue;
      /* 连段保护 2／3：击退随段数增长，把对手推出攻击距离 */
      const rawPush=opts.push||(m&&m.push)||8;
      const push=rawPush*(1+comboIdx*COMBO_PUSH_GROWTH);
      target.vx=attacker.facing*push;target.flash=5;
      /* 浮空起手（正传：把对手打上天）。连段越长浮空越小，避免无限空连。 */
      const rawLaunch=opts.launch||(m&&m.launch)||0;
      const launch=comboIdx>=4?Math.min(rawLaunch,6):rawLaunch;
      if(launch&&target.grounded){
        target.grounded=false;target.launched=true;target.y=Math.max(target.y,1);target.vy=launch;
        target.hitstun=Math.max(target.stun,30);
      }
      /* 权限只由真实命中授予。轻击可确认到重击／气技；真实浮空起手另给
         很短的 jump／dash 追击窗口。格挡和挥空不会走到这里。 */
      if(!assistAttack&&m&&m.slot==='light'){
        attacker.confirmTicks=HIT_CONFIRM_WINDOW;
        attacker.confirmState=attacker.state;
      }else{
        attacker.confirmTicks=0;attacker.confirmState=null;
      }
      attacker.pursuitTicks=!assistAttack&&launch&&target.launched?PURSUIT_WINDOW:0;
      /* 空中近身命中：双方短暂悬停（保留原有空中连段手感） */
      if(opts.melee&&!attacker.grounded&&!target.grounded&&!opts.heavy){
        attacker.airHold=26;target.airHold=30;
        attacker.vy=Math.max(-1,attacker.vy);target.vy=0;
      }
      /* 下坠砸击（正传：空中重击把对手砸向地面） */
      if(m&&m.slam&&!target.grounded){target.vy=-13;target.airHold=0;target.launched=false;}
      /* 被摔飞 */
      if(opts.thrown){target.launched=false;target.vy=9;target.grounded=false;}

      attacker.combo++;attacker.comboTimer=100;attacker.damageCombo+=damage;
      this.lastHit={side:attacker.side,damage,total:attacker.damageCombo,combo:attacker.combo,tick:this.tick};
      /* 连段保护 3／3：硬上限。达到上限就强制切断连段——
         即使攻击方帧表完美、每次都卡在硬直内命中，也一定有终止。
         受击方被弹开并获得短暂无敌，攻击方的连段计数清零。 */
      if(attacker.combo>=COMBO_LIMIT){
        attacker.combo=0;attacker.damageCombo=0;
        attacker.confirmTicks=0;attacker.confirmState=null;attacker.pursuitTicks=0;
        target.stun=Math.max(target.stun,26);
        target.invuln=Math.max(target.invuln,COMBO_BREAK_INVULN);
        target.vx=attacker.facing*28;
        if(target.grounded){target.grounded=false;target.launched=true;target.vy=10;}
        this.effect('break',target.x,target.y+92,32,'#ffe9a8');
        this.shake=Math.max(this.shake,10);
        this.event('comboBreak',{side:target.side,hits:COMBO_LIMIT});
      }
      const heavyFlag=!!(opts.heavy||(m&&m.heavy));
      const configured=Number.isFinite(opts.hitstop)?opts.hitstop:(m&&Number.isFinite(m.hitstop)?m.hitstop:0);
      this.hitstop=clamp(configured>0?Math.round(configured):(opts.beam?1:heavyFlag?6:4),1,7);
      this.shake=opts.shake||(m&&m.shake)||(heavyFlag?10:4);
      this.effect('impact',target.x,target.y+80,heavyFlag?22:14,attacker.spec.color,{heavy:heavyFlag});
      const hitType=opts.assistGrab?'assistGrab':launch?'launcher':opts.beam?'beam':opts.projectile?'projectile':heavyFlag?'heavy':'melee';
      const strength=heavyFlag||this.hitstop>=5?'heavy':this.hitstop>=4?'medium':'light';
      this.event('hit',{side:attacker.side,targetSide:target.side,heavy:heavyFlag,blocked:false,assist:!!opts.assist,action:m?.slot||null,
        damage,hitstop:this.hitstop,shake:this.shake,x:target.x,y:target.y+80,
        position:{x:target.x,y:target.y+80},facing:attacker.facing,type:hitType,hitType,strength});
      return true;
    }

    spawnProjectile(f,type,override={}){
      const s=override.spec||f.spec;
      const m=(override.move)||moveOf(f,f.state)||{};
      const p=override.projectile||m.projectile||{};
      const isSuper=type===2;
      const projectile={
        side:f.side,x:override.x!=null?override.x:f.x+f.facing*50,y:f.y+78,dir:f.facing,
        vx:f.facing*(p.speed||(isSuper?10:13)),
        r:p.radius||(isSuper?38:type===1?16:11),
        damage:p.damage||(isSuper?185:type===1?65:26),
        life:p.life||130,color:s.color,type,age:0,
        heavy:!!p.heavy,chip:p.chip||0,pierce:!!p.pierce,homing:p.homing||0,
        kind:p.kind||'ball',moveId:m.id||null,
        status:p.status||null,statusTicks:p.statusTicks||0,
        assist:!!(override.assist||p.assist)
      };
      this.projectiles.push(projectile);
      this.event('ki',{side:f.side,heavy:isSuper});
    }

    stepProjectiles(){
      for(const p of this.projectiles){
        if(p.dead)continue;
        p.x+=p.vx;p.life--;p.age++;
        /* 诱导（正传：追踪气弹） */
        if(p.homing){
          const t=this.fighters[1-p.side],dy=(t.y+78)-p.y;
          if(Math.abs(dy)>2)p.y+=Math.sign(dy)*Math.min(Math.abs(dy),p.homing);
        }
        const target=this.fighters[1-p.side];
        if(Math.abs(target.x-p.x)<p.r+28&&p.y>target.y+8&&p.y<target.y+145){
          const owner=this.fighters[p.side];
          const extra=p.status?{status:p.status,statusTicks:p.statusTicks}:{};
          const landed=this.hit(owner,target,p.damage,Object.assign({
            heavy:p.heavy,push:p.heavy?25:7,stun:p.heavy?35:18,
            /* 穿透弹不削血：防不住就吃全额伤害 */
            chip:p.pierce?0:p.chip,
            pierce:p.pierce,projectile:true,assist:!!p.assist
          },extra));
          if(landed||p.pierce){p.dead=true;this.effect('burst',p.x,p.y,20,p.color,{small:!p.heavy});}
        }
        if(p.x<-60||p.x>W+60||p.life<=0)p.dead=true;
      }
      for(let i=0;i<this.projectiles.length;i++)for(let j=i+1;j<this.projectiles.length;j++){
        const a=this.projectiles[i],b=this.projectiles[j];
        if(!a.dead&&!b.dead&&a.side!==b.side&&Math.abs(a.x-b.x)<a.r+b.r&&Math.abs(a.y-b.y)<a.r+b.r){
          if(a.heavy&&!b.heavy)b.dead=true;
          else if(b.heavy&&!a.heavy)a.dead=true;
          else a.dead=b.dead=true;
          this.effect('impact',(a.x+b.x)/2,(a.y+b.y)/2,20,'#fff4c6');this.event('cancel');
        }
      }
      this.projectiles=this.projectiles.filter(p=>!p.dead);
    }

    stepBeams(){
      for(const b of this.beams){b.age++;b.life--;b.end=clamp(b.end+b.dir*58,-50,W+50);}
      const a=this.beams.find(b=>b.side===0),b=this.beams.find(b=>b.side===1);
      if(a&&b&&a.dir!==b.dir&&Math.abs(a.y-b.y)<70
         &&Math.max(Math.min(a.x,a.end),Math.min(b.x,b.end))<=Math.min(Math.max(a.x,a.end),Math.max(b.x,b.end))){
        this.clash={left:a.x<b.x?a:b,right:a.x<b.x?b:a,balance:0,timer:240,age:0,lastTap:[-10,-10],taps:[0,0]};
        this.beams=[];this.projectiles=[];this.hitstop=4;this.shake=14;this.event('clash');return;
      }
      for(const beam of this.beams){
        const target=this.fighters[1-beam.side];
        if(beam.age-beam.hitTick>=8&&target.x>Math.min(beam.x,beam.end)-20
           &&target.x<Math.max(beam.x,beam.end)+20&&Math.abs(target.y+80-beam.y)<90){
          /* 与改造前一致：光束被防御时只消耗防御槽，不削血 */
          if(this.hit(beam.owner,target,beam.damage,{beam:true,stun:18,push:2,pierce:!!beam.pierce,assist:!!beam.assist}))
            beam.hitTick=beam.age;
        }
      }
      this.beams=this.beams.filter(b=>b.life>0);
    }
    tapClash(side){
      const c=this.clash;if(!c||c.age-c.lastTap[side]<6)return false;
      c.lastTap[side]=c.age;c.taps[side]++;
      const sign=side===c.left.side?1:-1;
      c.balance=clamp(c.balance+sign*.055,-1,1);this.event('tap',{side});return true;
    }
    stepClash(){
      const c=this.clash;c.age++;c.timer--;
      this.fighters.forEach(f=>{f.ki=Math.max(0,f.ki-.065);});
      if(this.options.mode==='cpu'&&!this.options.training){
        const interval=this.difficulty().clashTapInterval;
        if(c.age%interval===0)this.tapClash(1);
      }
      if(c.age%6===0)this.effect('spark',this.clashX(),(c.left.y+c.right.y)/2,18,'#ffffff');
      if(Math.abs(c.balance)>=.99||c.timer<=0){
        const tied=Math.abs(c.balance)<.09;
        const winner=c.balance>=0?c.left.side:c.right.side;
        this.clash=null;
        for(const f of this.fighters){this.transition(f,'idle');f.invuln=0;}
        if(tied){
          this.hit(this.fighters[0],this.fighters[1],80,{heavy:true,unblockable:true,push:26});
          this.hit(this.fighters[1],this.fighters[0],80,{heavy:true,unblockable:true,push:26});
        }else this.hit(this.fighters[winner],this.fighters[1-winner],240,{heavy:true,unblockable:true,push:40,stun:48});
        this.effect('burst',640,100,45,'#e9faff');this.shake=23;this.flash=10;
        this.event('clashEnd',{winner:tied?null:winner});this.checkEnd();
      }
    }
    clashX(){const c=this.clash;return c?(c.left.x+c.right.x)/2+c.balance*(c.right.x-c.left.x)*.42:640;}

    checkEnd(){
      if(this.options.training||this.phase==='over')return;
      if(this.fighters.some(f=>f.hp<=0)||this.time<=0){
        /* 正传：吸收的人会被吐出来 —— 每局结束时先把吞入的对手放出，
           并交还继承的招式，避免被吸收状态跨局残留。 */
        for(const holder of this.fighters){
          // Settlement only clears capture state; release damage must never alter
          // the result or resurrect a fighter whose HP already reached zero.
          if(this.fighters.some(f=>f.swallowedBy===holder.side))this.releaseAbsorbed(holder,{noDamage:true});
        }
        const [a,b]=this.fighters;const ar=a.hp/a.maxHp,br=b.hp/b.maxHp;
        this.winner=ar===br?null:ar>br?0:1;
        this.phase='over';this.clearInput();this.projectiles=[];this.beams=[];this.assists=[];
        this.throwSequence=null;this.overFrames=0;
        for(const f of this.fighters){
          this.transition(f,f.side===this.winner?'win':'down');
          f.y=0;f.grabbedBy=null;
        }
        this.event('ko',{winner:this.winner,timeout:this.time<=0});
      }
    }

    /* ---------------- 四档难度 ---------------- */
    difficulty(){return DIFFICULTY[this.options.difficulty]||DIFFICULTY.normal;}

    ai(){
      const D=this.difficulty();
      const cpu=this.fighters[1],p=this.fighters[0],input=this.input[1];
      const d=Math.abs(cpu.x-p.x);
      if(cpu.aiGuard>0){cpu.aiGuard--;input.guard=true;}else input.guard=false;
      if(cpu.aiWait>0)cpu.aiWait--;
      input.left=false;input.right=false;input.charge=false;

      /* 逃生：受击且气力足够时爆气 */
      if(cpu.state==='hit'&&cpu.burstCooldown===0&&cpu.ki>=50
         &&cpu.hp<cpu.maxHp*D.burstHpThreshold&&this.random()<D.burstChance)this.command(1,'burst');
      /* 脱身：被连段锁住时用掉一次脱身次数。
         与玩家完全同规则、同次数（每局 3 次），高难度才舍得用，
         既不会被无限连，也不会变成 AI 的免死金牌。 */
      if(cpu.state==='hit'&&cpu.escapes>0&&cpu.escapeLock===0
         &&this.fighters[0].combo>=D.escapeComboHits&&this.random()<D.escapeChance)this.command(1,'escape');

      /* 吸收：正传里布欧／沙鲁都是主动贴上去把对手吸进去的，而且常常是
         打完一套连击后顺势吸走（对悟天克斯、对悟饭都是这样）。
         所以这一条必须放在「非自由状态早退」之前，允许在攻击收招尾段直接接吸收；
         否则 AI 几乎永远处在出招状态，一辈子也不会用这个机制。 */
      if(D.useAbsorb&&cpu.absorbCooldown===0&&!p.invuln
         &&(p.swallowedBy===null||p.swallowedBy===undefined)
         &&d<=(D.absorbRange||140)&&cpu.ki>=20){
        const ab=moveTable(cpu).absorb;
        const busy=!FREE.has(cpu.state);
        const inRecovery=busy&&cpu.frame>=durationOf(cpu,cpu.state)-10;
        if(ab&&ab.absorb&&(!busy||inRecovery)&&this.random()<D.absorbChance){
          if(this.command(1,'unique:absorb'))return;
        }
      }

      if(!FREE.has(cpu.state)){
        const cm=moveOf(cpu,cpu.state);
        if(cm&&cm.slot==='light'&&cpu.frame>durationOf(cpu,cpu.state)-8&&d<165&&this.random()<D.chainChance)
          this.command(1,'light');
        return;
      }
      if(d>D.approachRange&&!input.guard&&!blocked(cpu,'blind')){input.left=cpu.x>p.x;input.right=!input.left;}
      if(cpu.aiWait>0)return;
      cpu.aiWait=D.reactionFrames;

      /* 对方持续防御时，近身投技比照常格挡更合理；仍受正常反应间隔和投技判定限制。 */
      if(D.useGrab&&p.state==='guard'&&d<80&&this.random()<D.grabChance
          &&this.command(1,'grab'))return;

      const incoming=this.projectiles.some(b=>b.side===0&&Math.abs(b.x-cpu.x)<310);
      const playerAttacking=!!activeMove(p)&&d<160;
      /* 只对「正在发生的威胁」防御：难度越高越少浪费架势，因此压迫感更强 */
      const threat=incoming||playerAttacking;
      if(threat&&!blocked(cpu,'blind')){
        if(D.teleportEvade&&playerAttacking&&DV.passiveOf(cpu).teleport
           &&cpu.teleportCooldown===0&&cpu.ki>=60&&this.random()<D.teleportChance){
          this.command(1,'teleport');return;
        }
        const chance=(incoming?D.guardProjectileChance:D.guardChance)*D.guardGreed;
        if(this.random()<chance){cpu.aiGuard=D.guardHoldFrames;input.guard=true;return;}
      }
      /* 只有看到对手正在蓄气、处在光束射程且自己有气时才尝试远程惩罚。 */
      if(p.state==='charge'&&d>180&&d<500&&cpu.ki>=40&&cpu.spec.beam==='beam'
          &&this.random()<D.chargePunishChance&&this.command(1,'super'))return;
      /* 惩罚窗口：对手在收招/硬直中，难度越高越会立刻抓 */
      const punishable=(p.state==='hit'||p.state==='down'||(activeMove(p)===null&&!FREE.has(p.state)))
        ||(p.state==='super'&&p.frame>=40);
      if(punishable&&d<220&&this.random()<D.punishChance){
        if(d<130){ if(D.launchCombo&&this.random()<.6)this.command(1,'heavy'); else this.command(1,'light'); }
        else this.command(1,'dash');
        return;
      }
      if(p.state==='super'&&p.frame<30&&cpu.ki>=40&&cpu.spec.beam==='beam'&&p.spec.beam==='beam'
         &&this.random()<D.counterSuperChance){this.command(1,'super');return;}
      const r=this.random();
      if(d>350&&cpu.ki>=65&&!(cpu.transformCooldown>0)&&r<D.transformChance){
        const form=this.transformOptions(1).find(o=>!o.returning);
        if(form){this.command(1,'transform',form.spec.id);return;}
      }
      if(cpu.ki<D.chargeKiThreshold&&d>380){input.left=input.right=false;input.charge=true;cpu.aiWait=0;return;}
      const assistProfile=DV.assistProfile&&DV.assistProfile(cpu.assist);
      const assistUseful=assistProfile&&(assistProfile.kind==='barrier'?(incoming||playerAttacking)
        :assistProfile.kind==='support'?((assistProfile.heal&&cpu.hp<cpu.maxHp*.72)
          ||(assistProfile.restoreGuard&&cpu.guard<45)||(assistProfile.restoreKi&&cpu.ki<55))
        :assistProfile.kind==='grab'?p.grounded&&d<=(assistProfile.reach||180)
        :assistProfile.kind==='control'?d<=(assistProfile.reach||250)&&!hasBadStatus(p)
        :d<520);
      if(assistProfile&&cpu.assistCooldown===0&&cpu.ki>=D.assistMinKi&&r<D.assistChance){
        if(assistUseful&&this.command(1,'assist'))return;
      }
      if(D.useCounter&&playerAttacking&&d<140&&this.random()<D.counterChance){this.command(1,'counter');return;}
      if(d<130){
        if(r<D.meleeBias){
          if(D.launchCombo&&this.random()<.5)this.command(1,'heavy');
          else this.command(1,'light');
        }
        else if(r<D.meleeBias+.10)this.command(1,'jump');
        else if(cpu.ki>=40&&r<D.meleeBias+.30)this.command(1,'super');
      }else if(d>260){
        if(r<D.rangedSuperBias&&cpu.ki>=40)this.command(1,'super');
        else if(r<.38)this.command(1,'ki');
        else if(r<.48&&assistUseful&&cpu.assistCooldown===0&&cpu.ki>=D.assistMinKi)this.command(1,'assist');
        else if(r>.83-D.dashBiasBonus)this.command(1,'dash');
      }else if(r<D.midRangeKiBias)this.command(1,'ki');
    }
  }

  /* 四档难度。底线：反应 ≥5 帧、不做数值作弊、只对「已发生」的动作反应。
     guardGreed 越低，AI 越少浪费架势，压迫感越强（避免高难度变成一直龟缩）。 */
  const DIFFICULTY=Object.freeze({
    easy:Object.freeze({
      reactionFrames:26,guardChance:.30,guardProjectileChance:.25,guardHoldFrames:26,guardGreed:1.25,
      punishChance:.05,
      clashTapInterval:15,burstHpThreshold:.30,burstChance:.01,
       teleportEvade:false,teleportChance:0,useGrab:false,grabChance:0,chargePunishChance:0,
      useCounter:false,counterChance:0,launchCombo:false,
      approachRange:145,chargeKiThreshold:25,transformChance:.12,
      chainChance:.15,meleeBias:.72,rangedSuperBias:.18,dashBiasBonus:0,
      midRangeKiBias:.24,counterSuperChance:.35,
      escapeChance:0,escapeComboHits:99,
      assistChance:.04,assistMinKi:55,
      /* 电脑的吸收：简单难度完全不用，避免新手一头雾水被吞 */
      useAbsorb:false,absorbChance:0,absorbRange:110
    }),    normal:Object.freeze({
      reactionFrames:18,guardChance:.57,guardProjectileChance:.55,guardHoldFrames:24,guardGreed:1.0,
      punishChance:.25,
      clashTapInterval:11,burstHpThreshold:.45,burstChance:.04,
       teleportEvade:false,teleportChance:0,useGrab:true,grabChance:.12,chargePunishChance:.15,
      useCounter:false,counterChance:0,launchCombo:false,
      approachRange:145,chargeKiThreshold:25,transformChance:.12,
      chainChance:.35,meleeBias:.72,rangedSuperBias:.18,dashBiasBonus:0,
      midRangeKiBias:.24,counterSuperChance:.55,
      /* 电脑的脱身：与玩家同规则同次数，被连到 6 段以上才开始考虑 */
      escapeChance:.22,escapeComboHits:6,
      assistChance:.09,assistMinKi:42,
      useAbsorb:true,absorbChance:.30,absorbRange:145
    }),
    hard:Object.freeze({
      reactionFrames:10,guardChance:.80,guardProjectileChance:.85,guardHoldFrames:20,guardGreed:.82,
      punishChance:.55,
      clashTapInterval:8,burstHpThreshold:.50,burstChance:.14,
       teleportEvade:true,teleportChance:.20,useGrab:true,grabChance:.38,chargePunishChance:.42,
      useCounter:true,counterChance:.18,launchCombo:true,
      approachRange:165,chargeKiThreshold:35,transformChance:.16,
      chainChance:.60,meleeBias:.66,rangedSuperBias:.24,dashBiasBonus:.06,
      midRangeKiBias:.28,counterSuperChance:.72,
      escapeChance:.45,escapeComboHits:5,
      assistChance:.15,assistMinKi:34,
      useAbsorb:true,absorbChance:.50,absorbRange:150
    }),
    inferno:Object.freeze({
      reactionFrames:5,guardChance:.94,guardProjectileChance:.97,guardHoldFrames:16,guardGreed:.62,
      punishChance:.88,
      clashTapInterval:6,burstHpThreshold:.60,burstChance:.30,
       teleportEvade:true,teleportChance:.42,useGrab:true,grabChance:.62,chargePunishChance:.72,
      useCounter:true,counterChance:.30,launchCombo:true,
      approachRange:190,chargeKiThreshold:45,transformChance:.20,
      chainChance:.85,meleeBias:.62,rangedSuperBias:.28,dashBiasBonus:.10,
      midRangeKiBias:.32,counterSuperChance:.85,
      escapeChance:.65,escapeComboHits:4,
      assistChance:.21,assistMinKi:28,
      useAbsorb:true,absorbChance:.75,absorbRange:155
    })
  });

  Object.assign(DV,{
    Match,ACTIONS,ATTACKS,DIFFICULTY,hurtbox,attackBox,activeMove,moveOf,durationOf,poseOf,
    applyStatus,blocked,statusFrames,hasBadStatus,STEP,WIDTH:W,FLOOR
  });
  if(typeof module!=='undefined')module.exports={Match,ACTIONS,ATTACKS,DIFFICULTY,hurtbox,attackBox,activeMove,moveOf,durationOf,poseOf,applyStatus,STEP,WIDTH:W,FLOOR};
})(globalThis);
