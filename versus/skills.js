/* Dragon Versus — 战斗机制层（数据驱动）。
 *
 * 设计约束：
 *  1) 所有招式名与机制 100% 出自七龙珠正传；查不到正传出处的效果不实现。
 *     招式名与出处见 docs/canon-technique-inventory-group*.md。
 *  2) 姿态只允许引用 sprites.js 既有的 18 个姿态（pose 字段），因此新增机制
 *     不需要任何新贴图：generated-sprite 层对未知 state 会回落到矢量绘制。
 *  3) 数值默认表 DEFAULT_MOVES 与改造前的引擎数值**逐字节一致**，保证既有
 *     回归测试（dv-engine / dv-feel / dv-review）继续通过；身份差异通过
 *     SKILLS 覆盖。
 *
 * 身份表结构：
 *   SKILLS[identityId] = {
 *     label, style, source,
 *     light:  ['punch1','punch2','kick'],   // 轻攻击链（顺序即连段顺序）
 *     moves:  { <id>: move(...) },          // 覆盖/新增普通招式
 *     super:  move(...),                    // 必杀（按正传招式指定原型）
 *     unique: { <id>: move(...) },          // 身份专属技（指令 unique:<id>）
 *     passive:{...}                         // 被动机制
 *   }
 */
(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};

  /* Node 下（测试／探针／离线工具）自举机制层。
     浏览器由 index.html 里的 <script> 顺序保证（combos.js / traits.js 都在本文件之前）。
     放在这里的原因：只 require('skills.js') 的调用方若拿不到这两层，
     resolveMoves 会静默跳过三轴、passiveOf 会静默跳过形态特性——
     整个逐身份差异会无声失效，而且不报任何错。 */
  if (typeof module !== 'undefined' && module.exports) {
    if (!DV.comboSuffix) Object.assign(DV, require('./combos.js'));
    if (!DV.traitEffectOf) Object.assign(DV, require('./traits.js'));
  }
  /* ------------------------------------------------------------------ *
   * 默认招式表：与旧 engine.js 的 ACTIONS / ATTACKS 完全一致
   * ------------------------------------------------------------------ */
  const DEFAULT_ACTIONS = Object.freeze({
    idle: 48, run: 24, jump: 20, fall: 20, dash: 16, guard: 24,
    punch1: 22, punch2: 26, kick: 30, ki: 28, super: 72, charge: 48,
    burst: 32, assist: 36, hit: 20, down: 48, win: 64, transform: 36,
    /* 深度重构新增 */
    heavy: 34,        // 重击（浮空起手）
    airL: 20,         // 空中轻击
    airH: 28,         // 空中重击（下坠砸击）
    grab: 24,         // 投技起手
    grabbed: 54,      // 被投（挣扎窗口）
    thrown: 46,       // 被摔飞
    counter: 30,      // 反击架势
    absorb: 26,       // 吸收（沙鲁尾巴／布欧体内）
    psycho: 34,       // 念动力束缚（弗利萨／古拉）
    giant: 30         // 巨大化起手（比克）
  });

  const DEFAULT_STATES = Object.freeze(Object.keys(DEFAULT_ACTIONS));
  const FREE_STATES = Object.freeze(['idle', 'run', 'jump', 'fall', 'guard', 'charge', 'counter']);
  const LOOP_STATES = Object.freeze(['idle', 'run', 'guard', 'charge', 'fall']);

  function move(id, pose, slot, extra) {
    return Object.assign({
      id, pose, slot, label: id,
      frames: 22, at: 8, end: 13,
      damage: 38, reach: 100, stun: 30, push: 4, step: 2.2,
      chain: [], air: false, groundedOnly: true,
      cost: 0, costType: 'ki',
      guardBreak: false, pierce: false, unblockable: false,
      launch: 0, hitstop: 0, shake: 0,
      projectile: null, buff: null, status: null, self: null,
      selfHeal: 0, selfCost: null
    }, extra || {});
  }

  /* 轻攻击三段链：与旧 ATTACKS 数值一致（作为所有身份的默认链） */
  const LIGHT_1 = move('punch1', 'punch1', 'light', { frames: 22, at: 8, end: 13, damage: 38, reach: 100, stun: 30, push: 4, step: 2.2, chain: ['punch2'] });
  const LIGHT_2 = move('punch2', 'punch2', 'light', { frames: 26, at: 10, end: 16, damage: 48, reach: 112, stun: 33, push: 5, step: 2.8, chain: ['kick'] });
  const LIGHT_3 = move('kick', 'kick', 'light', { frames: 30, at: 12, end: 19, damage: 70, reach: 132, stun: 34, push: 20, step: 2.6, chain: [], heavy: true });

  const DEFAULT_MOVES = Object.freeze({
    punch1: LIGHT_1, punch2: LIGHT_2, kick: LIGHT_3,
    heavy: move('heavy', 'kick', 'heavy', {
      frames: 34, at: 14, end: 21, damage: 92, reach: 124, stun: 40, push: 12, step: 3.2,
      launch: 11, hitstop: 5, shake: 10, chain: []
    }),
    airL: move('airL', 'punch1', 'aerial', {
      frames: 20, at: 6, end: 11, damage: 32, reach: 96, stun: 26, push: 3, step: 1.6,
      air: true, groundedOnly: false, chain: ['airH']
    }),
    airH: move('airH', 'kick', 'aerial', {
      frames: 28, at: 10, end: 16, damage: 62, reach: 118, stun: 34, push: 18, step: 2.2,
      air: true, groundedOnly: false, chain: [], slam: true, hitstop: 4, shake: 8
    }),
    grab: move('grab', 'punch1', 'grab', {
      frames: 24, at: 6, end: 10, damage: 0, reach: 74, stun: 0, push: 0, step: 0,
      grab: { techWindow: 22, hold: 28, throwDamage: 110, throwPush: 26 }
    }),
    counter: move('counter', 'guard', 'counter', {
      frames: 30, at: 0, end: 30, damage: 0, reach: 0, stun: 0, push: 0, step: 0,
      counterMove: { damage: 96, stun: 42, push: 18, invulnAfter: 12 }
    }),
    ki: move('ki', 'ki', 'ki', {
      label: '气弹', frames: 28, at: 0, end: 0, damage: 26, reach: 0, stun: 18, push: 7, step: 0,
      cost: 8, projectile: { kind: 'ball', speed: 13, radius: 11, life: 130, spawnFrame: 12, damage: 26, heavy: false }
    }),
    super: move('super', 'super', 'super', {
      frames: 72, at: null, end: null, reach: 0,
      cost: 40, superKind: 'beam', spawnFrame: 32, beamDamage: 12, hitstop: 5, shake: 8
    }),
    burst: move('burst', 'burst', 'burst', {
      frames: 32, at: 8, end: 8, damage: 25, reach: 220, stun: 28, push: 30, step: 0,
      cost: 50, unblockable: true, buff: { frames: 360, damageScale: 1.18 }, shake: 12
    }),
    assist: move('assist', 'assist', 'assist', {
      frames: 36, at: 16, end: 16, damage: 65, reach: 0, stun: 18, push: 7, step: 0, cost: 18
    }),
    dash: move('dash', 'dash', 'movement', { frames: 16, at: 0, end: 0, damage: 0, reach: 0, stun: 0, push: 0, step: 19, cost: 28, costType: 'stamina' }),
    jump: move('jump', 'jump', 'movement', { frames: 20, at: 0, end: 0, damage: 0, reach: 0, stun: 0, push: 0, step: 0 })
  });

  /* ------------------------------------------------------------------ *
   * 招式构造助手
   * ------------------------------------------------------------------ */
  const chainOf = (ids) => ids.map((id, i) => ({ id, next: ids[i + 1] || null }));

  /* 用轻攻击链描述符生成 moves 覆盖：每段只能接下一段 */
  function lightChainMoves(ids, tweaks) {
    const out = {};
    ids.forEach((id, i) => {
      const base = DEFAULT_MOVES[id] ? Object.assign({}, DEFAULT_MOVES[id]) : move(id, 'punch1', 'light', {});
      const custom = Object.assign({}, base, (tweaks && tweaks[id]) || {});
      custom.id = id;
      custom.slot = 'light';
      custom.chain = ids[i + 1] ? [ids[i + 1]] : [];
      custom.heavy = i === ids.length - 1;
      out[id] = custom;
    });
    return out;
  }

  /* 必杀原型构造：正传三类 + 气圆斩 / 太阳拳 / 突进。
     注意 1：必杀是纯远程/演出技，必须清掉继承来的近身判定（at/end/reach/damage），
             否则贴脸时必杀会额外打出一次近身伤害。
     注意 2：范围技的数据键名必须是 `superAoe`（引擎读这个键）。写成 `aoe`
             不会报错，但会静默回落到默认「太阳拳」致盲效果 —— 招式名与效果不符。
             该约束由 tests/dv-combat-depth.test.cjs 守护。 */
  const NO_MELEE = { at: null, end: null, reach: 0, damage: 0 };
  function superBeam(label, extra) {
    return move('super', 'super', 'super', Object.assign({
      label, superKind: 'beam', frames: 72, spawnFrame: 32, beamDamage: 12,
      cost: 40, hitstop: 5, shake: 8
    }, NO_MELEE, extra || {}));
  }
  function superBall(label, extra) {
    return move('super', 'super', 'super', Object.assign({
      label, superKind: 'ball', frames: 72, spawnFrame: 32,
      cost: 40, hitstop: 5, shake: 8,
      projectile: { kind: 'ball', speed: 10, radius: 38, life: 130, damage: 185, heavy: true, chip: 12 }
    }, NO_MELEE, extra || {}));
  }
  function superDisc(label, extra) {
    /* 气圆斩类：切割型，具穿透性 */
    return move('super', 'super', 'super', Object.assign({
      label, superKind: 'disc', frames: 70, spawnFrame: 30,
      cost: 40, pierce: true, hitstop: 4, shake: 7,
      projectile: { kind: 'disc', speed: 17, radius: 34, life: 110, damage: 150, pierce: true, homing: 1.6 }
    }, NO_MELEE, extra || {}));
  }
  function superAoe(label, aoe, extra) {
    /* 太阳拳 / 超能力类：范围效果（致盲、定身、封技），不属于伤害技 */
    return move('super', 'burst', 'super', Object.assign({
      label, superKind: 'aoe', frames: 54, spawnFrame: 14,
      cost: 25, superAoe: aoe, hitstop: 0, shake: 10
    }, NO_MELEE, extra || {}));
  }
  function superLunge(label, extra) {
    /* 突进类：由超块内的 rush 分支负责伤害，同样不能有普通近身判定 */
    return move('super', 'super', 'super', Object.assign({
      label, superKind: 'lunge', frames: 66, spawnFrame: 26, lungeFrames: 18, lungeSpeed: 22,
      cost: 40, hitstop: 5, shake: 9, invuln: 20
    }, NO_MELEE, extra || {}));
  }

  /* 专属技：小技能，消耗较低 */
  function uniqueKi(label, extra) {
    return move('uk', 'ki', 'ki', Object.assign({
      label, frames: 26, at: 0, end: 0, damage: 34, stun: 20, push: 8, cost: 10,
      projectile: { kind: 'ball', speed: 14, radius: 12, life: 130, spawnFrame: 11, damage: 34 }
    }, extra || {}));
  }
  function uniqueBlast(label, extra) {
    return move('ub', 'kick', 'heavy', Object.assign({
      label, frames: 30, at: 11, end: 17, damage: 78, reach: 118, stun: 36, push: 16, step: 2.4,
      hitstop: 4, shake: 8, chain: []
    }, extra || {}));
  }
  function uniqueGrab(label, extra) {
    return move('ug', 'punch1', 'grab', Object.assign({
      label, frames: 24, at: 6, end: 10, damage: 0, reach: 80,
      grab: { techWindow: 22, hold: 28, throwDamage: 120, throwPush: 28 }
    }, extra || {}));
  }

  /* 吸收：正传中沙鲁以尾尖针管吸取生命体、布欧把对手吸入体内。
     命中后立刻吸取生命并强化自身（沙鲁吸收人造人、布欧吸收战士后战力提升）。
     可用性设计：判定窗口必须是「一段区间」而不是单帧——旧数据 at=end=8 只判定
     恰好第 8 帧，加上判定距离只有 80 左右，实战里 120 次尝试只能命中 0~3 次，
     玩家根本感觉不到这个机制存在。现在改成 12 帧窗口 + 前冲 + 更长的伸展距离。 */
  function moveAbsorb(label, extra) {
    return move('absorb', 'punch1', 'absorb', Object.assign({
      label, frames: 32, at: 7, end: 18, damage: 0, reach: 132, cost: 16, stun: 0, push: 0, step: 3.4,
      absorbCooldown: 150,
      absorb: { drain: 88, healRatio: 0.55, kiDrain: 0.15, powerScale: 1.12, powerFrames: 420 }
    }, extra || {}));
  }
  /* 布欧式吸入：把对手吞进体内。
     正传：布欧的身体可以伸缩，用肚子／身体把对手整个包住吸入体内——
     所以判定距离比沙鲁的尾针更长（身体伸展），并且允许把空中的对手卷下来。
     被吞者仍活着，可以被吐出来、也可以从内部挣脱（正传：贝吉特从布欧体内撕开身体）。 */
  function moveSwallow(label, extra) {
    return move('absorb', 'punch1', 'absorb', Object.assign({
      label, frames: 36, at: 7, end: 20, damage: 0, reach: 152, cost: 20, stun: 0, push: 0, step: 3.8,
      absorbCooldown: 210,
      absorb: { drain: 62, healRatio: 0.60, kiDrain: 0.18, swallow: true, swallowFrames: 420,
        powerScale: 1.14, powerFrames: 450 }
    }, extra || {}));
  }
  /* 念动力：正传中弗利萨／古拉隔空束缚对手并抬离地面 */
  function movePsycho(label, extra) {
    return move('psycho', 'ki', 'psycho', Object.assign({
      label, frames: 34, at: 14, end: 14, damage: 55, reach: 0, cost: 22, stun: 0, push: 0, step: 0,
      psycho: { at: 14, range: 560, hold: 80, damage: 55 }
    }, extra || {}));
  }
  /* 巨大化：正传中比克在第23届天下一武道会对悟空使用 */
  function moveGiant(label, extra) {
    return move('giant', 'burst', 'giant', Object.assign({
      label, frames: 30, at: 0, end: 0, damage: 0, reach: 0, cost: 35, stun: 0, push: 0, step: 0,
      giant: { frames: 360, scale: 1.55, damageScale: 1.3, speedScale: 0.78 }
    }, extra || {}));
  }
  /* 自爆装置：正传中 16 号腹部的炸弹（欲与沙鲁同归于尽）。
     代价为自身生命，与贝吉塔自爆一致。 */
  function moveSelfDestructUnit(label, extra) {
    return move('uniqueSelfDestruct', 'burst', 'super', Object.assign({
      label, frames: 70, spawnFrame: 32, cost: 40, damage: 280,
      superKind: 'aoe', superAoe: { radius: 290, damage: 280, stun: 70, push: 40, unblockable: true },
      selfCost: { hp: 0.85 }, shake: 20
    }, extra || {}));
  }
  /* 四身拳：正传中从背部生出两只手臂同时四手攻击（代价是力量分散） */
  function moveFourWitches(label, extra) {
    return move('uniqueFourWitches', 'burst', 'super', Object.assign({
      label, frames: 40, at: 0, end: 0, damage: 0, reach: 0, cost: 30, stun: 0, push: 0, step: 0,
      giant: { frames: 300, scale: 1.18, damageScale: 0.86, speedScale: 1.06 },
      buff: { frames: 300, damageScale: 1.0 }
    }, extra || {}));
  }

  /* 身体伸缩变形：正传中布欧可伸缩四肢与颈部、把身体拉长包裹对手，
     被炸出洞或打成碎块都能重组（须连所有细胞彻底消灭才会死）。 */
  function moveBuuBody(label, extra) {
    return move('uniqueBuuBody', 'guard', 'giant', Object.assign({
      label, frames: 32, spawnFrame: 14, cost: 25,
      superKind: 'aoe', superAoe: { radius: 0, damage: 0 },
      giant: { frames: 360, scale: 1.25, damageScale: 1.06, speedScale: 1.05 }
    }, extra || {}));
  }

  /* ------------------------------------------------------------------ *
   * 逐身份招式表
   * ------------------------------------------------------------------ */
  const SKILLS = {};

  /* ============ 孙悟空 ============ */
  SKILLS['goku-kid'] = {
    label: '少年篇 · 如意棒',
    style: '以高速近身与龟派气功掌握攻防节奏',
    source: '漫画 龙珠 少年篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
      /* 如意棒：少年篇的招牌长兵器 */
      uniqueStick: move('uniqueStick', 'kick', 'heavy', {
        label: '如意棒突击', frames: 32, at: 12, end: 19, damage: 82, reach: 168, stun: 36, push: 14, step: 3.0,
        chain: [], hitstop: 4, shake: 8
      }),
      /* 正传：第21届天下一武道会对ジャッキー・チュン的三连打击
         （グー＝拳、チョキ＝贯手、パー＝掌底），靠读招取胜 */
      uniqueJanKen: move('uniqueJanKen', 'punch1', 'light', {
        label: '石头剪刀布（ジャン拳）', frames: 30, at: 9, end: 20, damage: 44, reach: 104, stun: 34, push: 8, step: 2.6,
        chain: [], hitstop: 4, shake: 6
      })
    }),
    super: superBeam('龟派气功', { damage: 168, beamDamage: 11 }),
    passive: { speedScale: 1.04 }
  };
  /* goku-early 用界王拳龟派气功（正传：赛亚人篇 ×4 界王拳推动龟派气功压过加力克炮） */
  SKILLS['goku-early'] = {
    label: 'Z 前期 · 龟仙流',
    style: '中距离气弹压制，近身时以界王拳提速',
    source: '漫画 龙珠Z 赛亚人篇～那美克星篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBall('元气弹', {
      damage: 205, cost: 50, projectile: { kind: 'ball', speed: 8, radius: 46, life: 150, damage: 205, heavy: true, chip: 12 }
    }),
    /* 正传中悟空是否使用过太阳拳／魔封波属「不确定」，故不列入 */
    passive: { teleport: { cost: 20, cooldown: 90, invuln: 14, distance: 150 } }
  };
  SKILLS['goku-kaioken'] = {
    label: 'Z · 界王拳',
    style: '以倍率抢短时爆发，绝不恋战（正传：原作明示最高 20 倍）',
    source: '漫画 龙珠Z 赛亚人篇／那美克星篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], {
      punch1: { damage: 42 }, punch2: { damage: 53 }, kick: { damage: 77 }
    }), {
      /* 正传：界王拳是瞬时增幅而非变身，可与拳脚、龟派气功叠加；
         倍率越高身体负担越大。20 倍为原作明示的最大倍率（那美克星篇对弗利萨）。 */
      uniqueKaioken20: move('uniqueKaioken20', 'charge', 'giant', {
        label: '20倍界王拳', frames: 36, spawnFrame: 16, cost: 45,
        superKind: 'aoe', superAoe: { radius: 0, damage: 0 },
        giant: { frames: 300, scale: 1.0, damageScale: 1.45, speedScale: 1.18 }
      })
    }),
    super: superBeam('界王拳龟派气功', { damage: 198, beamDamage: 14 }),
    passive: {
      teleport: { cost: 20, cooldown: 90, invuln: 14, distance: 150 },
      kaioken: { kiDrainPerSecond: 3.2, damageScale: 1.12 }
    }
  };
  for (const id of ['goku-ssj', 'goku-ssj2', 'goku-ssj3']) {
    SKILLS[id] = {
      label: id.replace('goku-', '超赛'),
      style: '形态提升基础战斗力，以龟派气功对拼',
      source: '漫画 龙珠Z',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBeam('龟派气功', { damage: 190, beamDamage: 13 }),
      passive: { teleport: { cost: 20, cooldown: 90, invuln: 14, distance: 150 } }
    };
  }
  SKILLS['goku-god'] = {
    label: '超 · 超级赛亚人之神',
    style: '神之气带来更快的回复与更强的气弹',
    source: '剧场版 龙珠Z 神与神',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('龟派气功', { damage: 196, beamDamage: 13 }),
    passive: { teleport: { cost: 18, cooldown: 80, invuln: 16, distance: 160 }, guardRegenScale: 1.3 }
  };
  SKILLS['goku-blue'] = {
    label: '超 · 超级赛亚人蓝',
    style: '神之气与超赛之力叠加，近身与炮击都强',
    source: '剧场版 龙珠Z 复活的F',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('龟派气功', { damage: 200, beamDamage: 14 }),
    passive: { teleport: { cost: 18, cooldown: 80, invuln: 16, distance: 160 }, guardRegenScale: 1.3 }
  };
  SKILLS['goku-ultra'] = {
    label: '超 · 自在极意功',
    style: '以回避与反击为核心，被动闪避代价最低',
    source: '动画 龙珠超 宇宙生存篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('龟派气功', { damage: 198, beamDamage: 14 }),
    passive: { teleport: { cost: 12, cooldown: 55, invuln: 20, distance: 190 }, guardRegenScale: 1.5 }
  };
  SKILLS['goku-gt-kid'] = {
    label: 'GT · 少年形态',
    style: '小体型高速游走，靠气弹与尾巴周旋',
    source: '动画 龙珠GT',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('十倍龟派气功', { damage: 200, beamDamage: 14 }),
    passive: { speedScale: 1.05, teleport: { cost: 20, cooldown: 90, invuln: 14, distance: 150 } }
  };
  SKILLS['goku-ssj4'] = {
    label: 'GT · 超级赛亚人4',
    style: '纯肉体压制，近身伤害显著提升',
    source: '动画 龙珠GT',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], {
      punch1: { damage: 44 }, punch2: { damage: 55 }, kick: { damage: 80 }
    }),
    super: superBeam('十倍龟派气功', { damage: 206, beamDamage: 15 }),
    passive: { regen: { delay: 240, perSecond: 8 } }
  };
  SKILLS['goku-daima-mini'] = {
    label: 'DAIMA · 迷你',
    style: '以如意棒打突击，靠机动贴脸',
    source: '动画 龙珠DAIMA',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
      uniqueStick: move('uniqueStick', 'kick', 'heavy', {
        label: '如意棒突击', frames: 32, at: 12, end: 19, damage: 86, reach: 172, stun: 36, push: 14, step: 3.1,
        chain: [], hitstop: 4, shake: 8
      })
    }),
    super: superLunge('如意棒突进', { damage: 196 }),
    passive: { speedScale: 1.05 }
  };
  SKILLS['goku-daima-ssj4'] = {
    label: 'DAIMA · 超级赛亚人4',
    style: 'DAIMA 超四，肉体与气弹并重',
    source: '动画 龙珠DAIMA',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 43 } }),
    super: superBeam('龟派气功', { damage: 202, beamDamage: 15 }),
    passive: { regen: { delay: 240, perSecond: 8 } }
  };

  /* ============ 贝吉塔 ============ */
  SKILLS['vegeta-scouter'] = {
    label: 'Z · 那美克星期',
    style: '以加力克炮对拼为核心，靠人造月亮巨猿化翻盘',
    source: '漫画 龙珠Z 赛亚人篇／那美克星篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
      /* 正传：以气制造人造月亮（パワーボール），借其「月光」变成巨猿。
         气圆斩是克林自创技，贝吉塔在正传中从未使用，故删除。 */
      uniquePowerBall: move('uniquePowerBall', 'charge', 'giant', {
        label: '人造月亮', frames: 40, spawnFrame: 20, cost: 40,
        superKind: 'aoe', superAoe: { radius: 0, damage: 0 },
        giant: { frames: 420, scale: 1.6, damageScale: 1.35, speedScale: 0.8 }
      })
    }),
    super: superBeam('加力克炮', { damage: 190, beamDamage: 13 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.08 } }
  };
  SKILLS['vegeta-ssj'] = {
    label: 'Z · 超级赛亚人',
    style: '超赛爆发型重击，以大爆炸攻击收尾',
    source: '漫画 龙珠Z 人造人篇（对 19 号）',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    /* 正传：单手聚能后爆开的能量球，贝吉塔超赛形态最常用的收尾招 */
    super: superBall('大爆炸攻击', { damage: 194 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.08 } }
  };
  SKILLS['vegeta-super'] = {
    label: 'Z · 超级贝吉塔',
    style: '力量与速度高于普通超赛但气的消耗更大，以最终闪光收割',
    source: '漫画 龙珠Z 沙鲁篇（超赛第二阶段）',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 42 }, kick: { damage: 76 } }),
    /* 正传：双手向两侧张开长时间聚气后射出的极粗光束，蓄力时间长是明确缺点 */
    super: superBeam('最终闪光', { damage: 202, beamDamage: 15, frames: 86, spawnFrame: 42 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.10 }, guardRegenScale: 0.92 }
  };
  SKILLS['vegeta-majin'] = {
    label: 'Z · 魔人贝吉塔',
    style: '魔人化后完全放弃防守，攻击性最强',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 44 }, kick: { damage: 80 } }), {
      /* 自爆：把全身的气一次性释放（正传代价为自身死亡） */
      uniqueSelfDestruct: move('uniqueSelfDestruct', 'burst', 'super', {
        label: '自爆', frames: 64, spawnFrame: 30, cost: 60, damage: 300,
        superKind: 'aoe', superAoe: { radius: 300, damage: 300, stun: 70, push: 40, unblockable: true },
        selfCost: { hp: 0.35 }, shake: 20
      })
    }),
    super: superBeam('最终闪光', { damage: 208, beamDamage: 15 }),
    passive: { pride: { threshold: 0.45, damageScale: 1.14 }, guardRegenScale: 0.8 }
  };
  SKILLS['vegeta-god'] = {
    label: '超 · 超级赛亚人之神',
    style: '神之气换来的稳定压制',
    source: '剧场版 龙珠Z 神与神',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('最终闪光', { damage: 202, beamDamage: 14 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.10 }, guardRegenScale: 1.3 }
  };
  SKILLS['vegeta-blue'] = {
    label: '超 · 超级赛亚人蓝',
    style: '神之气与超赛叠加，炮击与近身均衡',
    source: '剧场版 龙珠Z 复活的F',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('最终闪光', { damage: 206, beamDamage: 15 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.10 }, guardRegenScale: 1.3 }
  };
  SKILLS['vegeta-ssj4'] = {
    label: 'GT · 超级赛亚人4',
    style: 'GT 超四：以单手推出的远程光束终结为主',
    source: '动画 龙珠GT 超级17号篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 44 } }),
    /* 正传（GT 原创命名）：最终闪光攻击（ファイナルシャインアタック），
       该次被超级17号吸收 */
    super: superBeam('最终闪光攻击', { damage: 210, beamDamage: 16 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.12 }, regen: { delay: 300, perSecond: 6 } }
  };
  SKILLS['vegeta-daima-mini'] = {
    label: 'DAIMA · 迷你',
    style: '小体型但保持赛亚人王子的进攻性',
    source: '动画 龙珠DAIMA',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('加力克炮', { damage: 190, beamDamage: 13 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.08 }, speedScale: 1.04 }
  };
  SKILLS['vegeta-daima-ssj3'] = {
    label: 'DAIMA · 超级赛亚人3',
    style: 'DAIMA 超三，气量压制',
    source: '动画 龙珠DAIMA',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 43 } }),
    super: superBeam('最终闪光', { damage: 202, beamDamage: 14 }),
    passive: { pride: { threshold: 0.35, damageScale: 1.10 } }
  };

  /* ============ 孙悟饭 ============ */
  SKILLS['gohan-kid'] = {
    label: 'Z · 少年期',
    style: '爆发型：血量越低输出越高',
    source: '漫画 龙珠Z 赛亚人篇／那美克星篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 34 }, punch2: { damage: 42 } }),
    super: superBeam('魔闪光', { damage: 182, beamDamage: 13 }),
    passive: { rage: { threshold: 0.40, damageScale: 1.18 } }
  };
  SKILLS['gohan-teen-ssj'] = {
    label: 'Z · 超赛少年',
    style: '速度型气弹战',
    source: '漫画 龙珠Z 沙鲁篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('魔闪光', { damage: 190, beamDamage: 13 }),
    passive: { rage: { threshold: 0.40, damageScale: 1.14 } }
  };
  SKILLS['gohan-teen-ssj2'] = {
    label: 'Z · 超赛2',
    style: '压倒性近身压制；可与悟空超赛援助完成父子龟派气功',
    source: '漫画 龙珠Z 沙鲁游戏',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 44 }, punch2: { damage: 56 }, kick: { damage: 82 } }),
    super: superBeam('龟派气功', { damage: 190, beamDamage: 13 }),
    passive: { rage: { threshold: 0.45, damageScale: 1.20 } }
  };
  SKILLS['gohan-adult-ssj'] = {
    label: 'Z · 青年超赛',
    style: '稳健的近身战，以龟派气功收尾',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('龟派气功', { damage: 192, beamDamage: 13 }),
    passive: { rage: { threshold: 0.35, damageScale: 1.10 } }
  };
  SKILLS['gohan-ultimate'] = {
    label: 'Z · 潜能解放',
    style: '不依赖变身的基础战斗力，体术为主',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 45 }, punch2: { damage: 57 }, kick: { damage: 84 } }),
    super: superBeam('龟派气功', { damage: 204, beamDamage: 14 }),
    passive: { rage: { threshold: 0.30, damageScale: 1.12 } }
  };
  SKILLS['gohan-future'] = {
    label: 'Z · 未来悟饭',
    style: '独臂拼命的规避型打法，光束为唯一杀招',
    source: '动画特别篇 绝望的反抗!! 残存的超战士',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick']),
    super: superBeam('单手龟派气功', { damage: 188, beamDamage: 14 }),
    passive: { rage: { threshold: 0.40, damageScale: 1.14 } }
  };
  SKILLS['gohan-beast'] = {
    label: '超 · BEAST',
    style: '觉醒型压制，以魔贯光杀炮终结',
    source: '剧场版 龙珠超 超级英雄',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 46 }, kick: { damage: 86 } }), {
      uniqueSbc: move('uniqueSbc', 'super', 'super', {
        label: '魔贯光杀炮', frames: 78, spawnFrame: 40, cost: 55, damage: 235,
        superKind: 'beam', beamDamage: 20, pierce: true, hitstop: 6, shake: 12
      })
    }),
    super: superBeam('魔贯光杀炮', { damage: 232, beamDamage: 19, pierce: true, cost: 55, spawnFrame: 38, frames: 78 }),
    passive: { rage: { threshold: 0.40, damageScale: 1.16 } }
  };

    /* 悟饭：三个形态的必杀已覆盖「潜在能力解放」路线；
       少年期补上正传中的头突（拉帝兹战唯一一次纯身体实质伤害） */
    SKILLS['gohan-kid'].moves = Object.assign(SKILLS['gohan-kid'].moves, {
      uniqueHeadbutt: move('uniqueHeadbutt', 'punch1', 'heavy', {
        label: '头突', frames: 28, at: 9, end: 15, damage: 96, reach: 92, stun: 46, push: 20, step: 2.8,
        chain: [], hitstop: 6, shake: 10
      })
    });
    SKILLS['gohan-kid'].style = '爆发型：血量越低输出越高，以头突强行突破';
    /* 青年超赛与潜能解放：正传中后者的核心就是「潜力解放」这一形态本身，
       已在 label/style 标明；招式沿用龟派气功与魔闪光（正传均有使用） */
    SKILLS['gohan-adult-ssj'].style = '稳健的近身战，以龟派气功收尾';
    SKILLS['gohan-ultimate'].style = '潜在能力解放（老界王神仪式）——不依赖变身的基础战斗力，体术为主';

  /* ============ 比克 ============ */
  function piccoloKit(label, sbcDamage) {
    return {
      label, style: '战术型全能：蓄力杀招配合再生、包围弹与巨大化',
      source: '漫画 龙珠Z',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
        uniqueSbc: move('uniqueSbc', 'super', 'super', {
          label: '魔贯光杀炮', frames: 82, spawnFrame: 42, cost: 50, damage: sbcDamage,
          superKind: 'beam', beamDamage: 18, pierce: true, hitstop: 6, shake: 12
        }),
        uniqueHellzone: move('uniqueHellzone', 'super', 'super', {
          label: '魔空包围弹', frames: 76, spawnFrame: 34, cost: 45, damage: 148,
          superKind: 'ball', projectile: { kind: 'ball', speed: 7, radius: 30, life: 150, damage: 148, heavy: true, homing: 2.2 }
        }),
        /* 正传：那美克星人的身体特性，手臂可伸缩抓取（拉帝兹战抓其尾巴） */
        uniqueArmStretch: move('uniqueArmStretch', 'punch1', 'grab', {
          label: '手臂伸缩', frames: 26, at: 7, end: 12, damage: 0, reach: 210, cost: 12,
          grab: { techWindow: 22, hold: 26, throwDamage: 95, throwPush: 24 }
        }),
        /* 正传：第23届天下一武道会对悟空使用（体型与耐久提升，速度下降） */
        giant: moveGiant('巨大化')
      }),
      super: superBeam('魔贯光杀炮', { damage: sbcDamage, beamDamage: 17, pierce: true, cost: 50, spawnFrame: 38, frames: 80 }),
      passive: { regen: { delay: 200, perSecond: 9 } }
    };
  }
  SKILLS['piccolo-z'] = piccoloKit('Z · 那美克星人', 206);
  SKILLS['piccolo-fused'] = piccoloKit('Z · 同化后', 214);
  /* 橙色比克：正传（剧场版《超级英雄》）中他把身体巨大化到与沙鲁 MAX 同级的体型，
     与比克在第23届武道会用的通用巨大化不是同一回事，因此单独给名字与体型。 */
  const piccoloOrange = piccoloKit('超 · 橙色比克', 226);
  piccoloOrange.label = '超 · 橙色比克';
  piccoloOrange.style = '潜在能力解放（神龙的愿望）后的巨大化压制';
  piccoloOrange.source = '剧场版 龙珠超 超级英雄';
  piccoloOrange.moves.giant = moveGiant('巨大化（橙色形态）', {
    giant: { frames: 420, scale: 1.70, damageScale: 1.34, speedScale: 0.76 }
  });
  SKILLS['piccolo-orange'] = piccoloOrange;

  /* ============ 地球战士 ============ */
  SKILLS['krillin-z'] = {
    label: 'Z · 地球战士',
    style: '战术型：气圆斩切割、太阳拳致盲、残像拳游走',
    source: '漫画 龙珠Z',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'])
      , {
        uniqueFlare: superAoe('太阳拳', { radius: 430, status: { blind: 1 }, statusTicks: 150 }, { cost: 25, frames: 50, spawnFrame: 12 })
      }),
    super: superDisc('气圆斩', { damage: 156 }),
    passive: { teleport: { cost: 18, cooldown: 95, invuln: 12, distance: 130 } }
  };
  SKILLS['yamcha-z'] = {
    label: 'Z · 龟仙流',
    style: '速度型近身连打，以操控气弹追击',
    source: '漫画 龙珠 第22届天下一武道会',
    light: ['punch1', 'punch2', 'kick', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick', 'kick'], {
      kick: { damage: 62 }
    }), {
      uniqueSpiritBall: uniqueKi('操气弹（繰気弾）', {
        label: '操气弹（繰気弾）', damage: 42, cost: 12, homing: true,
        projectile: { kind: 'ball', speed: 11, radius: 14, life: 150, spawnFrame: 11, damage: 42, homing: 3.2 }
      })
    }),
    super: superBall('操气弹·全力', { damage: 176 }),
    passive: { speedScale: 1.03 }
  };
  SKILLS['tien-z'] = {
    label: 'Z · 三眼族',
    style: '鹤仙流全能武技家：太阳拳致盲、气功炮压制、四身拳奇袭',
    source: '漫画 龙珠／龙珠Z',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
      uniqueFlare: superAoe('太阳拳', { radius: 460, status: { blind: 1 }, statusTicks: 160 }, { cost: 25, frames: 50, spawnFrame: 12 }),
      /* 正传：第22届天下一武道会对悟空使用，从背部生出两只手臂四手攻击（力量分散） */
      uniqueFourWitches: moveFourWitches('四身拳'),
      /* 正传：第22届天下一武道会对雅木茶，把对手当排球扣杀传球 */
      uniqueVolleyball: move('uniqueVolleyball', 'kick', 'heavy', {
        label: '排球拳', frames: 34, at: 12, end: 19, damage: 88, reach: 128, stun: 44, push: 22, step: 2.6,
        chain: [], hitstop: 5, shake: 9
      }),
      /* 正传：沙鲁篇以新气功炮连发压住沙鲁第二形态，几乎耗尽自身性命 */
      uniqueShinKikoho: move('uniqueShinKikoho', 'super', 'super', {
        label: '新气功炮', frames: 96, spawnFrame: 40, cost: 60, beamDamage: 22, damage: 0, reach: 0,
        superKind: 'beam', pierce: true, selfCost: { hp: 0.25 }, hitstop: 6, shake: 14
      })
    }),
    super: superBeam('气功炮', { damage: 198, beamDamage: 15 }),
    passive: { guardRegenScale: 1.1 }
  };
  SKILLS['chiaotzu-z'] = {
    label: 'Z · 超能力者',
    style: '以超能力牵制为主，本身战力低；可舍身自爆（正传对那霸使用）',
    source: '漫画 龙珠／龙珠Z',
    light: ['punch1', 'punch2'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2'], { punch1: { damage: 30 }, punch2: { damage: 38 } }), {
      /* 正传：把全部气集中于体内引爆的自杀技（对那霸几乎无效，自身死亡） */
      uniqueKamikaze: move('uniqueKamikaze', 'burst', 'super', {
        label: '自爆（舍身）', frames: 64, spawnFrame: 30, cost: 45,
        damage: 260, superKind: 'aoe',
        superAoe: { radius: 300, damage: 260, stun: 70, push: 40, unblockable: true },
        selfCost: { hp: 0.8 }, shake: 20
      }),
      /* 正传：饺子是原作中第一个展示舞空术的人物；以飞行拉开距离 */
      uniqueFly: move('uniqueFly', 'jump', 'movement', {
        label: '舞空术·脱离', frames: 26, at: 0, end: 0, damage: 0, cost: 12, step: 0,
        selfHeal: 0.06
      })
    }),
    super: move('super', 'burst', 'super', {
      label: '超能力·定身', superKind: 'aoe', frames: 56, spawnFrame: 16, cost: 35, damage: 0,
      superAoe: { radius: 400, status: { paralyze: 1 }, statusTicks: 90, damage: 20, stun: 40, push: 0 }, shake: 8
    }),
    passive: { guardRegenScale: 1.15 }
  };
  SKILLS['roshi-max'] = {
    label: '龙珠 · 全力龟仙人',
    style: '龟仙流宗师：以障眼法、电击封技与封技弥补战力差距',
    source: '漫画 龙珠／动画 龙珠超',
    light: ['punch1', 'punch2'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2'], { punch1: { damage: 36 }, punch2: { damage: 46 } }), {
      uniqueEvil: move('uniqueEvil', 'ki', 'super', {
        label: '魔封波', frames: 90, spawnFrame: 46, cost: 60, damage: 0,
        /* 正传：封技而非伤害技，使用者会消耗自身寿命 */
        superKind: 'aoe', superAoe: { radius: 300, status: { seal: 1 }, statusTicks: 150, damage: 0, stun: 0, unblockable: true }, shake: 10
      }),
      /* 正传：第21届天下一武道会对悟空，双手放出高压电流包裹并电击，封住其行动 */
      uniqueThunder: move('uniqueThunder', 'ki', 'ki', {
        label: '万国惊天掌', frames: 40, spawnFrame: 16, cost: 35, damage: 70,
        superKind: 'aoe', superAoe: { radius: 320, damage: 70, stun: 50, push: 0, status: { paralyze: 1 }, statusTicks: 80 }, shake: 9
      }),
      /* 正传：第21届天下一武道会对悟空，以醉酒般的错乱动作规避并反击 */
      uniqueDrunk: move('uniqueDrunk', 'guard', 'counter', {
        label: '醉拳', frames: 34, at: 0, end: 34, damage: 0, reach: 0, stun: 0, push: 0, step: 0, cost: 15,
        counterMove: { damage: 88, stun: 40, push: 16, invulnAfter: 14 }
      })
    }),
    super: superBeam('龟派气功', { damage: 190, beamDamage: 14 }),
    passive: {}
  };
  SKILLS['chichi'] = undefined; /* 见下方补充 */

  /* ============ 赛亚人后代与融合 ============ */
  SKILLS['goten-ssj'] = {
    label: 'Z · 超赛少年',
    style: '与特兰克斯同源的快速近身连打',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 36 } }),
    super: superBeam('龟派气功', { damage: 184, beamDamage: 13 }),
    passive: { speedScale: 1.03 }
  };
  SKILLS['trunks-kid'] = {
    label: 'Z · 少年特兰克斯',
    style: '顽童式空中游击，以气弹骚扰',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 36 } }),
    /* 正传中少年特兰克斯没有专属命名必杀技（燃烧攻击是未来特兰克斯的招式），
       故必杀采用通用气弹，不做张冠李戴。 */
    super: superBall('气弹', { damage: 184, cost: 40 }),
    passive: { speedScale: 1.03 }
  };
  function trunksKit(label, superMove) {
    return {
      label, style: '剑术近身为核心，中距离以气弹压制',
      source: '漫画 龙珠Z／动画 龙珠超',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 42 }, kick: { damage: 78 } }), {
        uniqueSword: move('uniqueSword', 'kick', 'heavy', {
          label: '剑斩', frames: 30, at: 11, end: 18, damage: 96, reach: 150, stun: 38, push: 16, step: 2.8,
          chain: [], hitstop: 5, shake: 9, pierce: true
        }),
        /* 正传（龙珠超动画第65话）：贝吉塔与未来特兰克斯同时放出加力克炮，
           两束合流成一击。合击威力高于单体。 */
        uniqueFatherSonGalick: move('uniqueFatherSonGalick', 'super', 'super', {
          label: '亲子加力克炮', frames: 84, spawnFrame: 38, cost: 50,
          superKind: 'beam', beamDamage: 20, pierce: true, hitstop: 6, shake: 13
        })
      }),
      super: superMove,
      passive: { rage: { threshold: 0.40, damageScale: 1.10 } }
    };
  }
  SKILLS['future-trunks-sword'] = trunksKit('Z · 未来剑士', superBall('燃烧攻击', { damage: 192 }));
  SKILLS['future-trunks-ssj'] = trunksKit('Z · 超赛剑士', superBeam('燃烧攻击', { damage: 196, beamDamage: 14 }));
  SKILLS['future-trunks-super'] = trunksKit('超 · 超级赛亚人', superBeam('燃烧攻击', { damage: 202, beamDamage: 14 }));
  SKILLS['future-trunks-rage'] = trunksKit('超 · 愤怒超级赛亚人', superLunge('希望之剑', { damage: 226 }));
  SKILLS['gotenks-base'] = {
    label: 'Z · 融合',
    style: '以大量搞怪招式压制，招招都带点花样',
    source: '漫画 龙珠Z 布欧篇',
    light: ['punch1', 'punch2', 'kick'],
    moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
      uniqueDonut: move('uniqueDonut', 'ki', 'ki', {
        label: '银河甜甜圈', frames: 40, spawnFrame: 18, cost: 20, damage: 0,
        superKind: 'aoe', superAoe: { radius: 260, status: { paralyze: 1 }, statusTicks: 70, damage: 30, stun: 30 }, projectile: null
      }),
      uniqueGhost: move('uniqueGhost', 'burst', 'super', {
        label: '超级幽灵神风拳', frames: 62, spawnFrame: 26, cost: 35, damage: 120,
        superKind: 'ball', projectile: { kind: 'ball', speed: 12, radius: 22, life: 120, damage: 120, heavy: true, homing: 2.6 }
      })
    }),
    super: superBall('超级幽灵神风拳', { damage: 190, cost: 45 }),
    passive: { speedScale: 1.04 }
  };
  SKILLS['gotenks-ssj'] = Object.assign({}, SKILLS['gotenks-base'], { label: 'Z · 超赛融合' });
  SKILLS['gotenks-ssj3'] = Object.assign({}, SKILLS['gotenks-base'], {
    label: 'Z · 超赛3融合',
    super: superBeam('胜利加农炮', { damage: 204, beamDamage: 15, cost: 45 })
  });
  SKILLS['yajirobe-db'] = {
    label: '龙珠 · 流浪剑客',
    style: '单段刀击，伤害高但连段极短',
    source: '漫画 龙珠',
    light: ['punch1'],
    moves: Object.assign(lightChainMoves(['punch1'], { punch1: { damage: 52, reach: 118, frames: 24, at: 9, end: 15 } }), {
      uniqueKatana: move('uniqueKatana', 'kick', 'heavy', {
        label: '居合一闪', frames: 30, at: 10, end: 17, damage: 104, reach: 140, stun: 40, push: 18,
        step: 2.6, chain: [], hitstop: 5, shake: 9, pierce: true
      })
    }),
    super: superLunge('背后斩击', { damage: 196 }),
    passive: {}
  };

  (function registerRest(){
    /* ============ 人造人：无限能量（正传设定） ============ */
    const ANDROID = { infiniteEnergy: { kiPerTick: 0.18 } };
    const android = (id, label, style, superMove, extra) => {
      SKILLS[id] = Object.assign({
        label, style, source: '漫画 龙珠Z 人造人篇',
        light: ['punch1', 'punch2', 'kick'],
        moves: lightChainMoves(['punch1', 'punch2', 'kick']),
        super: superMove,
        passive: Object.assign({}, ANDROID, (extra && extra.passive) || {})
      }, (extra && extra.top) || {});
    };
    android('android17-ranger', '超 · 自然保护官', '无限能量战士：以能量障壁与精确连击消耗对手',
      superBall('超电压爆破', { damage: 190 }),
      { passive: { energyBarrier: { reduction: 0.35, frames: 40, cooldown: 180 } } });
    android('android18-z', 'Z · 人造人篇', '冷静的连续踢击衔接人造人火力',
      superBall('无限能量弹', { damage: 188 }));
    android('android16-z', 'Z · 人造人16号', '沉默观察型：以巨体和重击压制，腹部装有自爆装置',
      /* 正传：16号的力量很大但动作迟缓，强项是躯体抗打而不是输出。
         因此把必杀伤害让给「巨力抗打」这一侧。 */
      superBeam('地狱闪光', { damage: 178, beamDamage: 13 }),
      { top: {
        light: ['punch1', 'punch2', 'kick', 'kick'],
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick', 'kick']), {
          /* 正传：腹部炸弹（正传中已被布尔玛拆除），欲与沙鲁同归于尽 */
          uniqueSelfDestruct: moveSelfDestructUnit('自爆装置')
        }),
        passive: {}
      } });
    /* 21 号（魔人形态）出自游戏《龙珠 斗士Z》，属【游戏原创，非正传】。
       按「一切都要 100% 基于龙珠剧情」的约束，不为其编造专属招式与机制，
       保留席位可玩性，采用通用格斗体系。 */
    SKILLS['android21-majin'] = {
      label: '剧场 · 魔人21号【游戏原创，非正传】',
      style: '游戏原创角色：不编造专属招式，采用通用格斗体系',
      source: '游戏 龙珠 斗士Z（非正传漫画／动画）',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBall('气弹', { damage: 186, cost: 40 }),
      passive: {}
    };

    /* ============ 弗利萨一族：死亡光束为高速连射型 ============ */
    const deathBeam = (label, extra) => uniqueKi(label, Object.assign({
      label, damage: 30, cost: 9, frames: 22, at: 0, end: 0,
      projectile: { kind: 'ball', speed: 20, radius: 8, life: 120, spawnFrame: 8, damage: 30 }
    }, extra || {}));
    const frieza = (id, label, superMove, extra) => {
      SKILLS[id] = Object.assign({
        label, style: '以死亡光束连射与念动力束缚做远近压制',
        source: '漫画 龙珠Z 那美克星篇',
        light: ['punch1', 'punch2', 'kick'],
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
          uniqueDeathBeam: deathBeam('死亡光束'),
          /* 正传：隔空操控物体与束缚对手 */
          psycho: movePsycho('念动力')
        }),
        super: superMove,
        passive: {}
      }, (extra && extra.top) || {});
    };
    frieza('frieza-first', 'Z · 第一形态', superBeam('死亡光束·连射', { damage: 176, beamDamage: 10 }),
      { top: { light: ['punch1', 'punch2'] } });
    frieza('frieza-final', 'Z · 最终形态', superBeam('死亡光束·连射', { damage: 192, beamDamage: 13 }));
    frieza('frieza-full', 'Z · 百分百力量', superBall('死亡球', { damage: 200 }),
      { top: { light: ['punch1', 'punch2', 'kick', 'kick'] } });
    frieza('frieza-golden', '超 · 黄金弗利萨', superBeam('死亡光束·连射', { damage: 204, beamDamage: 15 }));
    SKILLS['cooler-final'] = {
      label: '剧场 · 最终形态', style: '弗利萨之兄：以指尖光束与念动力压制',
      source: '剧场版 龙珠Z 激突!!100亿能量的战士们',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
        uniqueDeathBeam: deathBeam('死亡光束'),
        psycho: movePsycho('念动力', { psycho: { at: 14, range: 560, hold: 90, damage: 62 } })
      }),
      /* 正传中其招式为「指尖光束（无名）＋巨大能量弹（无名）」，故不采用无出处的命名 */
      super: superBall('巨大能量弹', { damage: 200 }),
      passive: {}
    };
    SKILLS['moro-planet-eater'] = {
      label: '超漫画 · 食星者', style: '吸收对手能量，越战越强',
      source: '漫画 龙珠超 银河巡警囚犯篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBall('星球能量爆发', { damage: 200 }),
      passive: { absorbKi: { ratio: 2.0 }, infiniteEnergy: { kiPerTick: 0.10 } }
    };

    /* ============ 沙鲁：吸收与再生 ============ */
    const cell = (id, label, superMove, extra) => {
      SKILLS[id] = Object.assign({
        label, style: '吸收型：以太阳拳致盲、以尾巴吸收生命体后战力提升',
        source: '漫画 龙珠Z 沙鲁篇',
        light: ['punch1', 'punch2', 'kick'],
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
          uniqueFlare: superAoe('太阳拳', { radius: 430, status: { blind: 1 }, statusTicks: 140 }, { cost: 25, frames: 50, spawnFrame: 12 }),
          /* 正传：以尾尖针管吸取生命体；吸收 17/18 号后进化（这里表现为战力提升） */
          absorb: moveAbsorb('尾巴吸收', { absorb: { drain: 90, healRatio: 0.6, kiDrain: 0.15, powerScale: 1.12, powerFrames: 420 } }),
          /* 正传：从尾巴生出的小型沙鲁（セルジュニア），具备气弹与格斗能力。
             正传中为复数个体，但一次全灭；此处限制为单体以免失衡。 */
          uniqueCellJr: move('uniqueCellJr', 'ki', 'ki', {
            label: '沙鲁Jr.（セルジュニア）', frames: 46, spawnFrame: 20, cost: 35, damage: 78,
            superKind: 'ball',
            projectile: { kind: 'ball', speed: 12, radius: 18, life: 140, damage: 78, heavy: true, homing: 1.8 }
          }),
          /* 正传：沙鲁会使用气弹（对悟饭、对悟空等场合均有） */
          ki: move('ki', 'ki', 'ki', {
            label: '气弹', frames: 28, at: 0, end: 0, damage: 30, reach: 0, stun: 18, push: 7, step: 0,
            cost: 8, projectile: { kind: 'ball', speed: 13, radius: 12, life: 130, spawnFrame: 12, damage: 30, heavy: false }
          }),
          /* 正传：沙鲁拥有比克细胞，招式库包含魔贯光杀炮
             （动画中完全体沙鲁明确使用；漫画是否有该镜头属不确定） */
          uniqueSbc: move('uniqueSbc', 'super', 'super', {
            label: '魔贯光杀炮', frames: 82, spawnFrame: 42, cost: 50, damage: 198,
            superKind: 'beam', beamDamage: 18, pierce: true, hitstop: 6, shake: 12
          })
        }),
        super: superMove,
        passive: { regen: { delay: 220, perSecond: 8 } }
      }, (extra && extra.top) || {});
    };
    cell('cell-first', 'Z · 第一形态', superBeam('龟派气功', { damage: 180, beamDamage: 12 }));
    cell('cell-perfect', 'Z · 完全体', superBeam('龟派气功', { damage: 198, beamDamage: 14 }));
    cell('cell-super-perfect', 'Z · 超级完全体', superBeam('龟派气功', { damage: 204, beamDamage: 15 }));

    /* ============ 布欧：再生、吸收、变化光线 ============ */
    const buu = (id, label, superMove, extra) => {
      SKILLS[id] = Object.assign({
        label, style: '吸收与变化光线：把对手吞入体内，以回复换取强攻',
        source: '漫画 龙珠Z 布欧篇',
        light: ['punch1', 'punch2', 'kick'],
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
          uniqueCandy: move('uniqueCandy', 'ki', 'ki', {
            label: '变化光线', frames: 40, spawnFrame: 18, cost: 30, damage: 0,
            superKind: 'aoe', superAoe: { radius: 300, status: { paralyze: 1 }, statusTicks: 90, damage: 40, stun: 60 }
          })
        }),
        super: superMove,
        passive: { regen: { delay: 150, perSecond: 12 }, absorbKi: { ratio: 0.8 } }
      }, (extra && extra.top) || {});
    };
    /* 吸收是布欧系共通的本质能力：正传中最初的布欧正是靠吸收南界王神／大界王神
       才变成后来的胖布欧，所以四个布欧形态都保留吸收。
       差别只在「吞入体内后继承招式」的强度（悟饭布欧最强）。 */
    buu('buu-fat', 'Z · 善良布欧', superBall('愤怒爆发', { damage: 190 }), {
      top: { moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
        uniqueCandy: move('uniqueCandy', 'ki', 'ki', {
          label: '变化光线', frames: 40, spawnFrame: 18, cost: 30, damage: 0,
          superKind: 'aoe', superAoe: { radius: 300, status: { paralyze: 1 }, statusTicks: 90, damage: 40, stun: 60 }
        }),
        absorb: moveSwallow('吸收', { absorb: { drain: 50, healRatio: 0.65, kiDrain: 0.15, swallow: true,
          swallowFrames: 330, powerScale: 1.10, powerFrames: 360 } })
      }) }
    });
    buu('buu-super', 'Z · 超级布欧', superBall('人类灭绝攻击', { damage: 198 }), {
      top: {
        style: '残酷高效：把对手吸入体内，并以可伸缩变形的身体战斗',
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
          uniqueCandy: move('uniqueCandy', 'ki', 'ki', {
            label: '变化光线', frames: 40, spawnFrame: 18, cost: 30, damage: 0,
            superKind: 'aoe', superAoe: { radius: 300, status: { paralyze: 1 }, statusTicks: 90, damage: 40, stun: 60 }
          }),
          absorb: moveSwallow('吸收'),
          uniqueBuuBody: moveBuuBody('身体伸缩变形')
        })
      }
    });
    buu('buu-gohan', 'Z · 悟饭布欧', superBeam('人类灭绝攻击', { damage: 170, beamDamage: 13 }),
      {
        top: {
          label: 'Z · 悟饭布欧',
          style: '吸收悟天克斯、比克与悟饭后的最强布欧形态，兼具战术判断',
          light: ['punch1', 'punch2', 'kick', 'kick'],
          moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick', 'kick']), {
            uniqueCandy: move('uniqueCandy', 'ki', 'ki', {
              label: '变化光线', frames: 40, spawnFrame: 18, cost: 30, damage: 0,
              superKind: 'aoe', superAoe: { radius: 300, status: { paralyze: 1 }, statusTicks: 90, damage: 40, stun: 60 }
            }),
            absorb: moveSwallow('吸收', { absorb: { drain: 80, healRatio: 0.7, kiDrain: 0.2, swallow: true, powerScale: 1.18, powerFrames: 480 } }),
            uniqueBuuBody: moveBuuBody('身体伸缩变形')
          })
        }
      });
    buu('buu-kid', 'Z · 纯粹布欧', superBall('星球爆破弹', { damage: 202, cost: 45 }),
      { top: { light: ['punch1', 'punch2', 'kick'],
        moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
          uniqueCandy: move('uniqueCandy', 'ki', 'ki', {
            label: '变化光线', frames: 40, spawnFrame: 18, cost: 30, damage: 0,
            superKind: 'aoe', superAoe: { radius: 300, status: { paralyze: 1 }, statusTicks: 90, damage: 40, stun: 60 }
          }),
          /* 纯粹布欧在正传里没有吞过战士，但他的本质与最初的布欧相同（靠吸收界王神变成胖布欧），
             因此保留吸收，只是继承强度最低、被困时间最短。 */
          absorb: moveSwallow('吸收', { absorb: { drain: 54, healRatio: 0.60, kiDrain: 0.15, swallow: true,
            swallowFrames: 300, powerScale: 1.08, powerFrames: 330 } })
        }),
        passive: { regen: { delay: 150, perSecond: 14 } } } });

    /* ============ 融合战士 ============ */
    const fusion = (id, label, superMove, passive, chain) => {
      SKILLS[id] = {
        label, style: '融合战士：以压倒性基础能力正面压制',
        source: '漫画 龙珠Z／龙珠超',
        light: chain || ['punch1', 'punch2', 'kick'],
        moves: lightChainMoves(chain || ['punch1', 'punch2', 'kick'], { punch1: { damage: 46 }, punch2: { damage: 58 } }),
        super: superMove,
        passive: passive || {}
      };
    };
    /* 正传：贝吉特在布欧篇的招牌是「气之剑」（掌中压缩成剑状近身武器），
       而非大爆炸攻击（那是贝吉塔的技）。 */
    fusion('vegito-base', 'Z · 耳环合体', superBeam('气之剑', { damage: 204, beamDamage: 15, pierce: true }), { guardRegenScale: 1.3 });
    fusion('vegito-ssj', 'Z · 超级贝吉特', superBeam('精神之剑', { damage: 212, beamDamage: 16, pierce: true }), { guardRegenScale: 1.3 });
    fusion('vegito-blue', '超 · 超蓝贝吉特', superBeam('精神之剑', { damage: 206, beamDamage: 16, pierce: true }), { guardRegenScale: 1.22 });
    /* 正传：日文名「スターダストブレイカー」（星尘破碎者）；ソウルパニッシャー
       是海外/游戏名。剧场版《复活的融合!!》中对邪念波使用，使其由邪气构成的身体崩解。 */
    for (const id of ['gogeta-base', 'gogeta-super']) {
      fusion(id, id === 'gogeta-super' ? '剧场 · 超级悟吉塔' : '超 · 常态融合',
        superBall('星尘破碎者', { damage: 204 }), { speedScale: 1.03 });
    }
    fusion('gogeta-blue', '超 · 超蓝悟吉塔', superBeam('星尘破碎者', { damage: 214, beamDamage: 16 }), { speedScale: 1.03 });
    /* GT 中悟吉塔可确认的招式是「大爆炸龟派气功」（超4 是否用星尘破碎者属不确定） */
    fusion('gogeta-ssj4', 'GT · 超四悟吉塔', superBeam('大爆炸龟派气功', { damage: 220, beamDamage: 17 }),
      { regen: { delay: 260, perSecond: 7 } });

    /* ============ 赛亚人战士 ============ */
    SKILLS['bardock-z'] = {
      label: 'Z 外传 · 最后的反抗', style: '赛亚人战士以近身冲锋接最后一击',
      source: 'TV 特别篇 龙珠Z 一夫当关的最后决战',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBeam('最终精神炮', { damage: 198, beamDamage: 14 }),
      passive: { pride: { threshold: 0.40, damageScale: 1.14 } }
    };
    SKILLS['raditz-z'] = {
      label: 'Z · 赛亚人战士', style: '以连续气弹与高速突袭压制',
      source: '漫画 龙珠Z 赛亚人篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick']), {
        uniqueDouble: uniqueKi('双重气弹', {
          label: '双重气弹', damage: 40, cost: 12,
          projectile: { kind: 'ball', speed: 15, radius: 13, life: 130, spawnFrame: 11, damage: 40 }
        })
      }),
      super: superLunge('周末', { damage: 200 }),
      passive: {}
    };
    SKILLS['nappa-z'] = {
      label: 'Z · 赛亚人精英', style: '厚重体格与大范围气爆施压',
      source: '漫画 龙珠Z 赛亚人篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 46 }, punch2: { damage: 58 }, kick: { damage: 84 } }),
      super: move('super', 'burst', 'super', {
        label: '巨人风暴', superKind: 'aoe', frames: 60, spawnFrame: 22, cost: 40, damage: 0,
        superAoe: { radius: 280, damage: 150, stun: 45, push: 34, unblockable: false }, shake: 14
      }),
      passive: {}
    };
    SKILLS['cabba-ssj'] = {
      label: '超 · 第6宇宙赛亚人', style: '第6宇宙的正统赛亚人战法',
      source: '动画 龙珠超 第6宇宙篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBeam('加力克炮', { damage: 190, beamDamage: 13 }),
      passive: { pride: { threshold: 0.35, damageScale: 1.08 } }
    };
    SKILLS['caulifla-ssj2'] = {
      label: '超 · 第6宇宙天才', style: '积极突进抢攻，连段速度快',
      source: '动画 龙珠超 宇宙生存篇',
      light: ['punch1', 'punch2', 'kick', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick', 'kick'], { kick: { damage: 58 } }),
      super: superBall('粉碎加农炮', { damage: 190 }),
      passive: { speedScale: 1.04 }
    };
    SKILLS['kale-berserk'] = {
      label: '超 · 狂暴超级赛亚人', style: '失控的绿色气焰，伤害极高但防御脆弱',
      source: '动画 龙珠超 宇宙生存篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 50 }, kick: { damage: 90 } }),
      super: superBall('巨量冲击', { damage: 206 }),
      passive: { pride: { threshold: 0.50, damageScale: 1.16 }, guardRegenScale: 0.75 }
    };
    SKILLS['kefla-ssj2'] = {
      label: '超 · 第6宇宙融合', style: '融合后的高速气弹连射与巨量能量弹',
      source: '动画 龙珠超 宇宙生存篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 47 } }),
      super: superBeam('巨量加农炮', { damage: 204, beamDamage: 15 }),
      passive: { speedScale: 1.04, pride: { threshold: 0.35, damageScale: 1.10 } }
    };

    /* ============ 神与宇宙强者 ============ */
    SKILLS['beerus-super'] = {
      label: '超 · 第7宇宙破坏神', style: '以破坏能量直接抹消对手',
      source: '剧场版 龙珠Z 神与神／动画 龙珠超',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 48 } }), {
        uniqueHakai: move('uniqueHakai', 'super', 'super', {
          label: '破坏', frames: 84, spawnFrame: 44, cost: 70, damage: 230,
          superKind: 'beam', beamDamage: 22, pierce: true, unblockable: true, hitstop: 7, shake: 14
        })
      }),
      super: superBeam('破坏神之怒', { damage: 204, beamDamage: 16, pierce: true, cost: 50 }),
      /* 正传：比鲁斯是爱玩、懒散的破坏神，多数时候并不认真出手。
         因此不给他「最强防御回复」这类全能优势。 */
      passive: { guardRegenScale: 1.12 }
    };
    SKILLS['whis-super'] = {
      label: '超 · 天使', style: '天使教练：速度与防御最强，正传无命名攻击技',
      source: '剧场版 龙珠Z 神与神／动画 龙珠超',
      light: ['punch1', 'punch2', 'kick'],
      /* 正传中维斯没有命名攻击技，必杀沿用通用气弹（天使族的气弹表现）。
         专属技采用其正传能力：时间回溯——把时间倒退约 3 分钟，撤销已发生的事。 */
      super: superBall('气弹', { damage: 188, cost: 40 }),
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 42 } }), {
        uniqueRewind: move('uniqueRewind', 'charge', 'super', {
          label: '时间回溯', frames: 76, spawnFrame: 24, cost: 55,
          selfHeal: 0.30, hitstop: 0, shake: 6
        })
      }),
      passive: { speedScale: 1.06, teleport: { cost: 10, cooldown: 45, invuln: 20, distance: 210 }, guardRegenScale: 1.25 }
    };
    SKILLS['jiren-full'] = {
      label: '超 · 全力吉连', style: '纯粹力量与绝对防御的正面压制',
      source: '动画 龙珠超 宇宙生存篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 52 }, punch2: { damage: 64 }, kick: { damage: 92 } }),
      /* 正传：吉连以眼力/气墙硬挡攻击 */
      /* 正传：吉连以气墙硬挡攻击。减伤 0.90 会让等效生命翻倍（全表最超标一项），
         故收到 0.95——仍有明确的硬气特色，但不再是压倒性优势。 */
      /* 正传：吉连以气墙硬挡攻击。减伤会让等效生命成倍增长，是全表最超标的一项，
         故收到 0.97——保留「硬气防御」的特色，但不再是压倒性优势。
         吉连在正传里也几乎没有花招与技巧类手段（见 traits.js 的形态特性），
         所以他的强项被限定为正面力量与抗打，而不是全能。 */
      super: superBeam('力量冲击', { damage: 194, beamDamage: 15 }),
      passive: { guardRegenScale: 1.10, damageResist: 0.97 }
    };
    SKILLS['hit-super'] = {
      label: '超 · 传说杀手', style: '闪时：在对手动作之间插入攻击',
      source: '动画 龙珠超 第6宇宙篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 44 } }), {
        /* 闪时：短时间停止对手动作（正传：0.1 秒的时间跳跃） */
        uniqueTimeSkip: move('uniqueTimeSkip', 'burst', 'super', {
          label: '闪时', frames: 44, spawnFrame: 14, cost: 35, damage: 0,
          superKind: 'aoe', superAoe: { radius: 520, status: { freeze: 1 }, statusTicks: 40 }, shake: 6
        })
      }),
      super: superLunge('闪时·杀击', { damage: 212 }),
      passive: { speedScale: 1.06 }
    };

    /* ============ 剧场版强者 ============ */
    SKILLS['broly-z'] = {
      label: 'Z 剧场 · 传说超级赛亚人', style: '不断膨胀的力量，越打越强',
      source: '剧场版 龙珠Z 燃烧吧!!热战·烈战·超激战',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 50 }, kick: { damage: 90 } }),
      super: superBall('巨量流星', { damage: 214, cost: 45 }),
      passive: { pride: { threshold: 0.60, damageScale: 1.20 }, guardRegenScale: 0.85 }
    };
    SKILLS['broly-wrath'] = {
      label: '超 · 怒形态', style: '愤怒驱动的狂暴近身压制',
      source: '剧场版 龙珠超 布罗利',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 50 } }),
      super: superLunge('愤怒咆哮', { damage: 216 }),
      passive: { pride: { threshold: 0.55, damageScale: 1.18 } }
    };
    SKILLS['broly-full'] = {
      label: '超 · 全力超级赛亚人', style: '由怒形态进一步解放大猿之力，达到最高出力的直球对撞',
      source: '剧场版 龙珠超 布罗利（超赛全力／スーパーサイヤ人フルパワー）',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 54 }, kick: { damage: 96 } }),
      super: superBall('全力巨量流星', { damage: 222, cost: 45 }),
      passive: { pride: { threshold: 0.60, damageScale: 1.22 }, guardRegenScale: 0.85 }
    };
    SKILLS['janemba-super'] = {
      label: '剧场 · 超级邪念波', style: '空间转移与魔剑连斩',
      source: '剧场版 龙珠Z 复活的融合!!悟空与贝吉塔',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 46 } }), {
        uniqueWarp: move('uniqueWarp', 'dash', 'movement', {
          label: '空间转移', frames: 20, cost: 18, invuln: 22, step: 0,
          teleportBurst: true
        })
      }),
      super: superBeam('地狱魔剑', { damage: 208, beamDamage: 16, pierce: true }),
      passive: { teleport: { cost: 14, cooldown: 60, invuln: 18, distance: 200 } }
    };
    SKILLS['dabura-z'] = {
      label: 'Z · 魔界之王', style: '魔界剑术与石化唾液',
      source: '漫画 龙珠Z 布欧篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { kick: { damage: 82 } }), {
        uniqueSpit: move('uniqueSpit', 'ki', 'ki', {
          label: '石化唾液', frames: 34, spawnFrame: 14, cost: 30, damage: 0,
          superKind: 'aoe', superAoe: { radius: 260, status: { freeze: 1 }, statusTicks: 110, damage: 30, stun: 50 }
        })
      }),
      super: superBeam('暗黑魔剑', { damage: 200, beamDamage: 15, pierce: true }),
      passive: {}
    };

    /* ============ 第6宇宙／第11宇宙以外 ============ */
    SKILLS['goku-black-base'] = {
      label: '超 · 黑悟空', style: '以气刃与神之斩压迫对手',
      source: '动画 龙珠超 未来特兰克斯篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 46 } }), {
        uniqueBlade: move('uniqueBlade', 'kick', 'heavy', {
          label: '气刃斩', frames: 30, at: 11, end: 18, damage: 100, reach: 152, stun: 38, push: 16,
          step: 2.8, chain: [], pierce: true, hitstop: 5, shake: 9
        })
      }),
      super: superBeam('神裂斩', { damage: 206, beamDamage: 15, pierce: true }),
      passive: { teleport: { cost: 18, cooldown: 80, invuln: 14, distance: 160 } }
    };
    SKILLS['goku-black-rose'] = {
      label: '超 · 超级赛亚人桃红', style: '桃红形态：气刃与神之斩威力更高',
      source: '动画 龙珠超 未来特兰克斯篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 48 } }), {
        uniqueBlade: move('uniqueBlade', 'kick', 'heavy', {
          label: '神裂演武斩', frames: 30, at: 11, end: 18, damage: 106, reach: 156, stun: 40, push: 16,
          step: 2.8, chain: [], pierce: true, hitstop: 5, shake: 10
        })
      }),
      super: superBeam('神裂斩', { damage: 212, beamDamage: 16, pierce: true }),
      passive: { teleport: { cost: 18, cooldown: 80, invuln: 14, distance: 160 } }
    };
    SKILLS['zamasu-base'] = {
      label: '超 · 不死之身', style: '不死之身：受伤后持续恢复',
      source: '动画 龙珠超 未来特兰克斯篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBall('神圣逆鳞', { damage: 192 }),
      source2: '正传：扎马斯以超级神龙许愿获得不死之身',
      passive: { regen: { delay: 90, perSecond: 16 } }
    };
    SKILLS['zamasu-fused'] = {
      label: '超 · 合体扎马斯', style: '合体后不死之身与神之力叠加',
      source: '动画 龙珠超 未来特兰克斯篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 48 } }),
      super: superBeam('神圣逆鳞', { damage: 208, beamDamage: 15 }),
      passive: { regen: { delay: 80, perSecond: 20 } }
    };

    /* ============ GT ============ */
    SKILLS['baby-super2'] = {
      label: 'GT · 超级贝比2', style: '寄生贝吉塔后的兹夫尔人复仇者',
      source: '动画 龙珠GT 贝比篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBall('复仇死亡弹', { damage: 202 }),
      passive: { absorbKi: { ratio: 1.2 } }
    };
    SKILLS['super17-gt'] = {
      label: 'GT · 地狱合体', style: '两个17号合体：吸收气弹化为己用',
      source: '动画 龙珠GT 超级17号篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick']),
      super: superBall('能量吸收·放出', { damage: 200 }),
      /* 正传：吸收对手气功波并转化为自身力量，因此对能量攻击近乎无效化 */
      passive: { infiniteEnergy: { kiPerTick: 0.18 }, absorbKi: { ratio: 2.4 } }
    };
    SKILLS['omega-shenron-gt'] = {
      label: 'GT · 邪恶龙之力', style: '向对手体内灌入负面能量，抑制其气与恢复',
      source: '动画 龙珠GT 邪恶龙篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 52 }, kick: { damage: 92 } }), {
        /* 正传：负面能量（マイナスエネルギーパワー）灌入对手体内造成伤害并抑制其气 */
        uniqueMinus: move('uniqueMinus', 'ki', 'ki', {
          label: '负面能量', frames: 44, spawnFrame: 18, cost: 35, damage: 85,
          superKind: 'aoe',
          superAoe: { radius: 420, damage: 85, stun: 45, push: 10, status: { seal: 1, slow: 1 }, statusTicks: 180 },
          shake: 11
        })
      }),
      super: superBall('负向能源球', { damage: 208, cost: 45 }),
      passive: { regen: { delay: 220, perSecond: 8 } }
    };
    SKILLS['pan-gt'] = {
      label: 'GT · 小芳', style: '小型高速型，以舞空术与近身连踢进攻',
      source: '动画 龙珠GT',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 30 }, punch2: { damage: 38 } }),
      super: superBeam('龟派气功', { damage: 176, beamDamage: 11 }),
      passive: { speedScale: 1.06 }
    };
    SKILLS['uub-majuub'] = {
      label: 'GT · 魔人乌普', style: '布欧转世之力：再生与重击',
      source: '动画 龙珠GT',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 46 } }),
      super: superBeam('魔人加农炮', { damage: 198, beamDamage: 14 }),
      passive: { regen: { delay: 200, perSecond: 9 } }
    };

    /* ============ 地球武术家 ============ */
    SKILLS['hercule-z'] = {
      label: 'Z · 世界冠军', style: '夸张表演式的格斗技巧，体力异常顽强',
      source: '漫画 龙珠Z 沙鲁篇',
      light: ['punch1', 'punch2'],
      moves: lightChainMoves(['punch1', 'punch2'], { punch1: { damage: 34 }, punch2: { damage: 44 } }),
      super: superLunge('炸裂撒旦拳', { damage: 174 }),
      passive: { guardRegenScale: 1.2 }
    };
    SKILLS['videl-z'] = {
      label: 'Z · 武道会', style: '撒旦之女：以地球武术与舞空术进攻',
      source: '漫画 龙珠Z 布欧篇',
      light: ['punch1', 'punch2', 'kick'],
      moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 33 } }),
      super: superLunge('鹰击突袭', { damage: 178 }),
      passive: { speedScale: 1.04 }
    };
    SKILLS['bulma-adventure'] = {
      label: '龙珠 · 冒险装备',
      style: '科学家的战斗方式：用万能胶囊里的装备与道具周旋，而非硬拼',
      source: '漫画 龙珠 少年篇／龙珠超（布尔玛的道具与发明）',
      light: ['punch1', 'punch2'],
      moves: Object.assign(lightChainMoves(['punch1', 'punch2'], { punch1: { damage: 34 }, punch2: { damage: 42 } }), {
        /* 正传：布尔玛是科学家，靠发明与装备作战而非体术 */
        uniqueSmoke: move('uniqueSmoke', 'burst', 'super', {
          label: '烟雾弹脱身', frames: 34, spawnFrame: 12, cost: 20, damage: 0,
          superKind: 'aoe', superAoe: { radius: 300, status: { blind: 1 }, statusTicks: 90 }, shake: 6
        }),
        /* 正传：万能胶囊（ホイポイカプセル）——收纳与取出各种装备 */
        uniqueCapsule: move('uniqueCapsule', 'ki', 'ki', {
          label: '万能胶囊·装备展开', frames: 40, spawnFrame: 16, cost: 25, damage: 45,
          superKind: 'ball',
          projectile: { kind: 'ball', speed: 11, radius: 20, life: 130, damage: 45, heavy: false, status: { slow: 1 }, statusTicks: 90 }
        })
      }),
      /* 正传：胶囊里的机械装备（如飞机、摩托）支援，非本人气功 */
      super: superBall('胶囊火力支援', { damage: 186 })
    };
  })();

  SKILLS['chichi-tournament'] = {
    label: '龙珠 · 第23届武道会',
    style: '牛魔流近身突进，纯体术型',
    source: '漫画 龙珠 第23届天下一武道会',
    light: ['punch1', 'punch2', 'kick'],
    moves: lightChainMoves(['punch1', 'punch2', 'kick'], { punch1: { damage: 40 } }),
    super: superLunge('武道会突进连打', { damage: 186 }),
    passive: {}
  };

  /* ------------------------------------------------------------------ *
   * 自检：每个席位都必须有显式条目，避免静默回落到默认表
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 解析器
   * ------------------------------------------------------------------ */
  function baseSkills(id) { return SKILLS[id] || null; }

  /* 专属技归一化：既支持 skills.unique 里的条目，也支持写在 moves 里、
     以 "unique" 前缀命名的招式（以其 map key 作为状态名与指令名）。 */
  const uniqueCache = new Map();
  function uniqueMap(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const id = spec && spec.id;
    if (uniqueCache.has(id)) return uniqueCache.get(id);
    const skills = baseSkills(id) || {};
    const out = Object.assign({}, skills.unique || {});
    for (const key of Object.keys(skills.moves || {})) {
      if (/^unique/i.test(key)) out[key] = skills.moves[key];
    }
    uniqueCache.set(id, out);
    return out;
  }

  const moveCache = new Map();
  const fatherSonMoveCache = new WeakMap();
  function moveTableForSupport(fighter, table){
    const runtime=fighter&&fighter.spec?fighter:null;
    if(!runtime||runtime.spec.id!=='gohan-teen-ssj2'||runtime.assist?.id!=='goku-ssj'
       ||runtime.assistCooldown>0||runtime.assistUses>=(DV.assistProfile?.(runtime.assist)?.maxUses||Infinity)
       ||runtime.teamSuperUses>0)return table;
    if(Number.isFinite(runtime.hp)&&Number.isFinite(runtime.maxHp)&&runtime.hp>runtime.maxHp*.5)return table;
    let variant=fatherSonMoveCache.get(table);
    if(!variant){
      const base=table.super;
      const combinedCost=(Number(base?.cost)||0)+(Number(table.assist?.cost)||0);
      variant=Object.assign({},table,{super:Object.assign({},base,{
        label:'父子龟派气功',damage:214,beamDamage:34,cost:combinedCost,
        teamAnimation:'father-son-kamehameha',teamAssistId:'goku-ssj',oncePerMatch:true
      })});
      fatherSonMoveCache.set(table,variant);
    }
    return variant;
  }
  function resolveMoves(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const id = spec && spec.id;
    if (moveCache.has(id)) return moveTableForSupport(fighter,moveCache.get(id));
    const skills = baseSkills(id) || {};
    const table = Object.assign({}, DEFAULT_MOVES, skills.moves || {});
    if (skills.super) table.super = skills.super;
    /* 专属技：unique 前缀条目以 map key 注册为状态名 */
    for (const key of Object.keys(uniqueMap(fighter))) {
      const m = uniqueMap(fighter)[key];
      if (m) table[key] = m;
    }
    /* 系统机制招式（吸收／念动力／巨大化）本身就住在同名状态下，
       但仍需支持 unique:<同名> 的指令写法，故用同名键再登记一次。 */
    for (const sys of ['absorb', 'psycho', 'giant']) {
      if (table[sys]) table['unique:' + sys] = table[sys];
    }
    /* 逐身份连段原型：把近身风格编码成不同的平A手感
       （伤害／判定距离／招式帧表／出招位移／硬直）。
       非均衡原型使用带后缀的独立条目，默认 punch1/punch2/kick 保持原值不动。 */
    if (DV.applyProfile && DV.segmentIds && spec && spec.id) {
      const explicit = (skills.moves || {});
      const ids = DV.segmentIds(spec);
      const bases = ['punch1', 'punch2', 'kick'];
      const chainList = lightChain(spec);
      ids.forEach((newId, i) => {
        const base = DEFAULT_MOVES[bases[i]];
        if (!base) return;
        const custom = explicit[bases[i]];
        /* 以该身份自己的该段数据为底（它可能来自正传专属数值） */
        const src = custom ? Object.assign({}, base, custom) : base;
        /* 三轴（节奏／距离／分量）套在该身份自己的数值上 */
        const patch = DV.applyProfile(src, bases[i], spec, i, ids.length);
        /* 若该身份为正传招式显式指定了伤害，尊重专属数值，只套用非伤害维度 */
        if (custom && ('damage' in custom) && custom.damage !== base.damage) delete patch.damage;
        const merged = Object.assign({}, src, patch, { id: newId });
        /* 链与终结标记沿用该身份自己的链信息（4 段链的末段与第 3 段同 id） */
        merged.chain = chainList[i + 1] ? [chainList[i + 1]] : [];
        merged.heavy = chainList[chainList.length - 1] === newId;
        /* 该条目内部的链引用也要指向原型变体 */
        if (merged.chain.length) {
          merged.chain = merged.chain.map(c => {
            const seg = ['punch1', 'punch2', 'kick'].indexOf(c);
            return seg >= 0 ? ids[seg] : c;
          });
        }
        table[newId] = merged;
      });
    }
    moveCache.set(id, table);
    return moveTableForSupport(fighter,table);
  }

  const actionCache = new Map();
  function resolveActions(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const id = spec && spec.id;
    if (actionCache.has(id)) return actionCache.get(id);
    const skills = baseSkills(id) || {};
    const table = Object.assign({}, DEFAULT_ACTIONS, skills.actions || {});
    const applyFrames = (src) => {
      for (const key of Object.keys(src || {})) {
        const custom = src[key];
        if (custom && custom.frames) table[custom.id || key] = custom.frames;
      }
    };
    applyFrames(skills.moves);
    applyFrames(skills.unique);
    if (skills.super && skills.super.frames) table.super = skills.super.frames;
    /* 非均衡三轴的连段变体（punch1-fmh 等）必须在这里登记帧数，
       否则 durationOf 回落到 48 帧，让这些席位的轻攻击凭空慢一倍。 */
    if (DV.segmentIds && DV.applyProfile && spec && spec.id) {
      const ids = DV.segmentIds(spec);
      const bases = ['punch1', 'punch2', 'kick'];
      const explicitMoves = skills.moves || {};
      ids.forEach((newId, i) => {
        const base = DEFAULT_MOVES[bases[i]];
        if (!base || newId === bases[i]) return;
        const custom = explicitMoves[bases[i]];
        const src = custom ? Object.assign({}, base, custom) : base;
        const patch = DV.applyProfile(src, bases[i], spec, i, ids.length);
        table[newId] = patch.frames || src.frames || base.frames || 22;
      });
    }
    actionCache.set(id, table);
    return table;
  }

  function resolveSkills(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    return baseSkills(spec && spec.id) || {};
  }

  function passiveOf(fighter) {
    const s = resolveSkills(fighter);
    /* 形态特性（正传形态机制）先铺底，招式自身的正传被动可覆盖同名键 */
    const trait = DV.traitEffectOf ? DV.traitEffectOf(fighter) : null;
    const p = Object.assign({}, trait || {}, s.passive);
    /* 濒死强化 / 愤怒爆发：血量低于阈值时提升伤害 */
    const trigger = p.pride || p.rage;
    if (trigger) p.lowHpDamage = trigger;
    return p;
  }

  function lightChain(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const s = resolveSkills(fighter);
    const raw = Array.isArray(s.light) && s.light.length ? s.light : ['punch1', 'punch2', 'kick'];
    /* 非均衡三轴使用带后缀的独立条目，链要指向这些条目 */
    const sfx = DV.comboSuffix ? DV.comboSuffix(spec) : '';
    if (!sfx) return raw;
    return raw.map(id => (id === 'punch1' || id === 'punch2' || id === 'kick') ? id + sfx : id);
  }

  /* 副技能优先级：方向键下＋远程攻击键（组合键）依次尝试这些招式，
     取该角色真正拥有的第一个。这样不必给每个角色单独加按键。 */
  const COMBO_ORDER = [
    'absorb', 'psycho', 'giant',
    'uniqueFlare', 'uniqueEvil', 'uniqueThunder', 'uniqueDrunk',
    'uniqueCellJr', 'uniqueCandy', 'uniqueBuuBody', 'uniqueMinus',
    'uniqueTimeSkip', 'uniqueSpit', 'uniqueDonut', 'uniqueRewind',
    'uniqueSbc', 'uniqueHellzone', 'uniqueStick', 'uniqueSword', 'uniqueBlade',
    'uniqueDeathBeam', 'uniqueDouble', 'uniqueSpiritBall', 'uniqueHeadbutt',
    'uniqueJanken', 'uniqueKaioken20', 'uniquePowerBall', 'uniqueFourWitches',
    'uniqueVolleyball', 'uniqueShinKikoho', 'uniqueArmStretch', 'uniqueGhost',
    'uniqueKatana', 'uniqueWarp', 'uniqueHakai', 'uniqueFatherSonGalick',
    'uniqueSelfDestruct'
  ];
  const comboCache = new Map();
  function comboSkillsOf(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const id = spec && spec.id;
    if (comboCache.has(id)) return comboCache.get(id);
    const um = uniqueMap(fighter);
    const table = resolveMoves(fighter);
    const out = [];
    /* 先看专属技，再看系统机制招式 */
    for (const key of COMBO_ORDER) {
      if (out.includes(key)) continue;
      if (um[key] || (table[key] && table[key] !== DEFAULT_MOVES[key])) out.push(key);
    }
    /* 兜底：若该角色的招牌「必杀」本身就是范围／束缚／突进型
       （如饺子的超能力定身、琪琪的突进连打），也允许用组合键发动。
       这样不必为这类角色单独加键。 */
    const sup = table.super;
    if (sup && (sup.superKind === 'aoe' || sup.superKind === 'lunge')) out.push('super');
    comboCache.set(id, out);
    return out;
  }

  function registerSkills(id, def) { SKILLS[id] = def; moveCache.clear(); actionCache.clear(); uniqueCache.clear(); comboCache.clear(); }
  function registerAllSkills(map) { for (const k of Object.keys(map)) SKILLS[k] = map[k]; moveCache.clear(); actionCache.clear(); uniqueCache.clear(); comboCache.clear(); }

  Object.assign(DV, {
    DEFAULT_ACTIONS, DEFAULT_MOVES, DEFAULT_STATES, FREE_STATES, LOOP_STATES,
    SKILLS, move, lightChainMoves, superBeam, superBall, superDisc, superAoe, superLunge,
    uniqueKi, uniqueBlast, uniqueGrab,
    resolveMoves, resolveActions, resolveSkills, passiveOf, lightChain,
    uniqueMapOf: uniqueMap,
    comboSkillsOf, COMBO_ORDER,
    registerSkills, registerAllSkills,
    _resetCaches() { moveCache.clear(); actionCache.clear(); uniqueCache.clear(); comboCache.clear(); }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DEFAULT_ACTIONS, DEFAULT_MOVES, DEFAULT_STATES, FREE_STATES, LOOP_STATES,
      SKILLS, move, resolveMoves, resolveActions, resolveSkills, passiveOf, lightChain,
      uniqueMapOf: uniqueMap,
      comboSkillsOf, COMBO_ORDER,
      registerSkills, registerAllSkills
    };
    /* Node 下自举「共享正传武技层」。必须在 DV.SKILLS / DV.COMBO_ORDER 挂上去之后，
       否则 techniques.js 会以为 skills.js 还没加载而安静退出，
       于是每个被派发的正传武技都会无声消失（浏览器侧由 index.html 的脚本顺序保证）。 */
    if (!DV.TECHNIQUES) Object.assign(DV, require('./techniques.js'));
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
