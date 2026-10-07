/* Dragon Versus — canonical assist profiles and explicit story bonds.
 * Profiles are keyed by the 50 selectable character identities. Slot overrides are
 * reserved for a form whose known ability is materially different (Zamasu healing).
 * There is no fabricated fallback: callers reject an identity without a known profile. */
(function(root){
  'use strict';
  const DV=root.DV=root.DV||{};
  const TIMINGS=Object.freeze({
    rush:Object.freeze({telegraph:5,enter:9,execute:14,exit:38,end:48}),
    projectile:Object.freeze({telegraph:6,enter:12,execute:20,exit:38,end:50}),
    heavyProjectile:Object.freeze({telegraph:9,enter:16,execute:30,exit:49,end:62}),
    beam:Object.freeze({telegraph:8,enter:15,execute:25,exit:44,end:58}),
    grab:Object.freeze({telegraph:7,enter:12,execute:18,exit:38,end:50}),
    control:Object.freeze({telegraph:9,enter:16,execute:27,exit:45,end:58}),
    barrier:Object.freeze({telegraph:5,enter:10,execute:16,exit:38,end:50}),
    support:Object.freeze({telegraph:12,enter:20,execute:42,exit:58,end:72})
  });
  const profile=(characterId,label,kind,damage,cooldown,extra={})=>Object.freeze({
    id:`${characterId}-${kind}`,characterId,label,kind,damage,cooldown,timing:TIMINGS[kind],...extra
  });

  const ASSISTS=Object.freeze({
    goku:profile('goku','龟派气功','beam',64,720,{beamTicks:4}),
    vegeta:profile('vegeta','连续能量弹','projectile',62,690,{shots:2}),
    gohan:profile('gohan','魔闪光','beam',66,720,{beamTicks:4}),
    piccolo:profile('piccolo','伸长手臂','grab',58,840,{reach:165,allowAir:false,grabTicks:24}),
    krillin:profile('krillin','气圆斩','projectile',68,780,{projectileKind:'disc',pierce:true}),
    yamcha:profile('yamcha','狼牙风风拳','rush',72,720,{hits:3,reach:230}),
    tien:profile('tien','太阳拳','control',0,900,{status:'blind',controlTicks:26,reach:245}),
    chiaotzu:profile('chiaotzu','念动力','control',42,960,{status:'paralyze',controlTicks:24,reach:250}),
    roshi:profile('roshi','万国惊天掌','control',48,960,{status:'paralyze',controlTicks:24,reach:210}),
    bulma:profile('bulma','万能胶囊补给','support',0,780,{restoreKi:16,restoreGuard:20}),
    chichi:profile('chichi','武道连踢','rush',58,690,{hits:2,reach:190}),
    goten:profile('goten','连续气弹','projectile',56,660,{shots:2}),
    'future-trunks':profile('future-trunks','勇者之剑连斩','rush',74,780,{hits:3,reach:230}),
    trunks:profile('trunks','燃烧攻击','projectile',64,720),
    gotenks:profile('gotenks','排球攻击','rush',76,780,{hits:4,reach:235}),
    vegito:profile('vegito','最终龟派气功','beam',78,840,{beamTicks:5}),
    gogeta:profile('gogeta','星尘射击','projectile',72,780,{shots:2}),
    bardock:profile('bardock','叛逆突袭','rush',70,720,{hits:3,reach:225}),
    raditz:profile('raditz','双重星期日','projectile',62,720,{shots:2}),
    nappa:profile('nappa','爆裂冲击','projectile',70,780,{timing:TIMINGS.heavyProjectile}),
    frieza:profile('frieza','念动力束缚','control',44,960,{status:'paralyze',controlTicks:24,reach:260}),
    cell:profile('cell','龟派气功','beam',72,780,{beamTicks:4}),
    buu:profile('buu','魔人橡皮拳','grab',62,840,{reach:175,allowAir:false,grabTicks:24}),
    android17:profile('android17','能量屏障','barrier',0,900,{barrier:95,barrierReduction:.55,barrierTicks:150}),
    android18:profile('android18','无限能量弹','projectile',64,720,{shots:2}),
    android16:profile('android16','火箭飞拳','projectile',72,780,{projectileKind:'fist'}),
    android21:profile('android21','饥饿光束','beam',68,780,{beamTicks:4}),
    beerus:profile('beerus','破坏能量弹','projectile',78,840,{timing:TIMINGS.heavyProjectile}),
    whis:profile('whis','天使杖术','rush',60,840,{hits:3,reach:220}),
    broly:profile('broly','狂暴重击','rush',84,840,{hits:3,reach:235}),
    cooler:profile('cooler','死亡追击','rush',76,780,{hits:3,reach:230}),
    janemba:profile('janemba','魔剑连斩','rush',74,780,{hits:3,reach:225}),
    hit:profile('hit','闪时追击','rush',72,840,{hits:3,reach:245}),
    jiren:profile('jiren','力量冲击','projectile',80,840,{timing:TIMINGS.heavyProjectile}),
    kefla:profile('kefla','巨量爆裂射线','beam',76,780,{beamTicks:4}),
    cabba:profile('cabba','伽力克炮','beam',62,720,{beamTicks:4}),
    caulifla:profile('caulifla','粉碎加农炮','projectile',66,720),
    kale:profile('kale','狂战士重击','rush',82,840,{hits:3,reach:235}),
    'goku-black':profile('goku-black','神裂斩','rush',72,780,{hits:3,reach:230}),
    zamasu:profile('zamasu','治愈术','support',0,960,{heal:70,maxUses:2}),
    baby:profile('baby','复仇死亡弹','projectile',76,840,{timing:TIMINGS.heavyProjectile}),
    super17:profile('super17','电击地狱弹','projectile',74,780),
    'omega-shenron':profile('omega-shenron','负向能源球','projectile',82,840,{timing:TIMINGS.heavyProjectile}),
    pan:profile('pan','空中突击','rush',58,690,{hits:2,reach:205}),
    uub:profile('uub','气功连射','projectile',64,720,{shots:2}),
    hercule:profile('hercule','礼物炸弹','projectile',48,720,{projectileKind:'bomb',speed:9}),
    videl:profile('videl','鹰击突袭','rush',58,690,{hits:2,reach:205}),
    dabura:profile('dabura','魔界火焰','projectile',70,780),
    moro:profile('moro','魔力吸收','control',46,960,{status:'slow',controlTicks:26,reach:250}),
    yajirobe:profile('yajirobe','仙豆救援','support',0,1080,{heal:70,maxUses:2})
  });

  const SLOT_OVERRIDES=Object.freeze({
    'zamasu-fused':profile('zamasu','绝对雷霆','projectile',76,840),
    'gohan-kid':profile('gohan','愤怒冲撞','rush',62,720,{hits:2,reach:195}),
    'trunks-kid':profile('trunks','少年突袭','rush',58,690,{hits:2,reach:185}),
    'gogeta-super':profile('gogeta','灵魂惩罚者','projectile',76,840),
    'gogeta-base':profile('gogeta','星尘射击','projectile',72,780),
    'gogeta-blue':profile('gogeta','究极龟派气功','beam',80,840,{beamTicks:5}),
    'gogeta-ssj4':profile('gogeta','百倍大爆炸龟派气功','beam',82,840,{beamTicks:5})
  });

  const BONDS=Object.freeze([
    Object.freeze({id:'piccolo-protects-gohan',label:'比克的守护',mainIds:['gohan-kid'],assistIds:['piccolo-z'],once:true,condition:Object.freeze({maxHpRatio:.4})}),
    Object.freeze({id:'turtle-school',label:'龟仙流同门',mainIds:['goku-kid','goku-early','krillin-z'],assistIds:['roshi-max','krillin-z','goku-kid','goku-early'],once:true,condition:Object.freeze({minKi:50})})
  ]);

  const identityOf=input=>{
    if(input&&typeof input==='object')return input.characterId||input.id||'';
    const id=String(input||'');
    if(ASSISTS[id])return id;
    return Object.keys(ASSISTS).sort((a,b)=>b.length-a.length).find(key=>id.startsWith(key+'-'))||id;
  };
  function assistProfile(input){
    const slot=input&&typeof input==='object'?input.id:String(input||'');
    return SLOT_OVERRIDES[slot]||ASSISTS[identityOf(input)]||null;
  }
  function assistInstruction(input){
    const p=typeof input==='string'?assistProfile(input):input;
    if(!p)return '支援角色会依据自身招式协同攻击。';
    const seconds=((Number(p.controlTicks)||0)/60).toFixed(1).replace(/\.0$/,'');
    if(p.kind==='beam')return `远程光束：沿直线压制对手${p.beamTicks>1?`，持续${p.beamTicks}段`:''}。`;
    if(p.kind==='projectile')return `远程投射物：用${p.projectileKind==='disc'?'气圆斩':p.projectileKind==='fist'?'火箭飞拳':'气弹'}逼迫对手移动${p.shots>1?`，共${p.shots}发`:''}。`;
    if(p.kind==='rush')return `突进连击：快速接近并造成${p.hits||2}段攻击，适合近身追击。`;
    if(p.kind==='grab')return `地面抓取：近身时克制防御；距离不足会落空，空中目标无效。`;
    if(p.kind==='control'){
      const status=({blind:'致盲',paralyze:'麻痹',freeze:'冻结',seal:'封技',slow:'减速'})[p.status]||'行动限制';
      return `状态控制：${status}对手${p.controlTicks?`约${seconds}秒`:''}，用于打断攻势。`;
    }
    if(p.kind==='barrier')return `能量屏障：吸收${p.barrier||0}点伤害，每次最多减伤${Math.round((p.barrierReduction||0)*100)}%，持续约${((Number(p.barrierTicks)||0)/60).toFixed(1).replace(/\.0$/,'')}秒。`;
    if(p.kind==='support'){
      if(p.heal)return `恢复${p.heal}点生命，每局最多${p.maxUses||1}次。`;
      return `补给：恢复${p.restoreKi||0}点气力和${p.restoreGuard||0}点防御。`;
    }
    return '支援角色会依据自身招式协同攻击。';
  }
  function assistBond(main,assist){
    const mainId=main&&typeof main==='object'?main.id:String(main||'');
    const assistId=assist&&typeof assist==='object'?assist.id:String(assist||'');
    if(identityOf(main)===identityOf(assist))return null;
    return BONDS.find(b=>b.mainIds.includes(mainId)&&b.assistIds.includes(assistId))||null;
  }

  const data={ASSISTS,SLOT_OVERRIDES,ASSIST_BONDS:BONDS,assistProfile,assistInstruction,assistBond};
  Object.assign(DV,data);
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
})(typeof globalThis!=='undefined'?globalThis:window);
