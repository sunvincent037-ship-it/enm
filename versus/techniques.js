/* 共享正传武技层 —— 一条正传武技，按「正传里真正用过它的角色」派发给对应席位。
 *
 * 为什么独立成层：正传里同一门武技往往被多个角色用过（例如残像拳是龟仙流的共通技法，
 * 太阳拳由天津饭首创后被克林与沙鲁使用）。写一次、按正传使用者派发，比在每个席位表里
 * 各抄一份更不容易抄错，也便于逐条核对出处。
 *
 * 严格约束：每个条目都必须给出正传出处，并且只派发给正传里确实使用过该技的席位。
 * 出处不明确的一律不派发（例如「魔人乌普是否继承布欧的变化光线」正传未明确 → 不派发），
 * 绝不为了「让角色更有趣」而凭空给招。
 *
 * 加载顺序：必须在 skills.js 之后（需要 DV.move / DV.SKILLS / DV.COMBO_ORDER）。
 */
(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};
  const SKILLS = DV.SKILLS || {};
  const move = DV.move;
  if (typeof move !== 'function' || !Object.keys(SKILLS).length) {
    /* 两种情况的区别很重要：
       · DV.SKILLS 也不存在 → 只是被当成普通模块先解析了一次（载荷顺序无关紧要），安静退出；
       · DV.SKILLS 存在但没有 DV.move → 是真的加载顺序错了，必须出声。 */
    if (typeof console !== 'undefined' && console.warn && Object.keys(SKILLS).length === 0 && DV.SKILLS) {
      console.warn('[DV] techniques.js 需要先加载 skills.js');
    }
    return;
  }

  /* 招式构造助手：与 skills.js 里的原型保持同一手感 */
  const buffMove = (id, label, extra) => move(id, 'charge', 'burst', Object.assign({
    label, frames: 30, at: 0, end: 0, damage: 0, reach: 0, cost: 20, stun: 0, push: 0, step: 0
  }, extra || {}));
  const aoeMove = (id, label, def, extra) => move(id, 'burst', 'super', Object.assign({
    label, frames: 52, spawnFrame: 14, cost: 30, damage: 0, reach: 0,
    superKind: 'aoe', superAoe: def
  }, extra || {}));

  /* ------------------------------------------------------------------ *
   * 正传武技表
   * ------------------------------------------------------------------ */
  const TECHNIQUES = [
    {
      key: 'uniqueAfterimage', label: '残像拳',
      source: '龙珠 第21届天下一武道会（龟仙人以「成龙」身份对悟空用残像拳）；Z 悟空沿用',
      note: '正传：以极快的移动留下残影，让对手打中残像。机制转译＝短暂无敌＋后撤。',
      seats: ['goku-early', 'goku-ssj2', 'goku-gt-kid', 'roshi-max'],
      build: () => move('uniqueAfterimage', 'dash', 'movement', {
        label: '残像拳', frames: 24, at: 0, end: 0, damage: 0, reach: 0, stun: 0, push: 0,
        step: -9, cost: 14, invuln: 22
      })
    },
    {
      key: 'uniqueFlare', label: '太阳拳',
      source: '龙珠 第22届天下一武道会（天津饭首创）；Z 克林（对那巴、弗利萨）、沙鲁使用',
      note: '正传：非伤害技，只让对手暂时失明。',
      seats: ['tien-z', 'krillin-z', 'cell-perfect'],
      build: () => aoeMove('uniqueFlare', '太阳拳',
        { radius: 440, status: { blind: 1 }, statusTicks: 150, damage: 0, stun: 0 },
        { frames: 50, spawnFrame: 12, cost: 25 })
    },
    {
      key: 'uniqueDiscTech', label: '气圆斩',
      source: 'Z 赛亚人篇（悟空对巨猿贝吉塔，用来争取蓄力时间）',
      note: '正传：可切断对手的圆盘状气刃，能切开直线防守。',
      seats: ['goku-early'],
      build: () => move('uniqueDiscTech', 'ki', 'super', {
        label: '气圆斩', frames: 34, spawnFrame: 16, cost: 24, damage: 0, reach: 0,
        superKind: 'disc', superDisc: { damage: 76, speed: 12, radius: 30, life: 150, pierce: true, hitstop: 5, shake: 9 }
      })
    },
    {
      key: 'uniqueMafuba', label: '魔封波',
      source: '龙珠（武泰斗首创）；龟仙人对短笛大魔王、天津饭亦使用',
      note: '正传：封印技，不造成杀伤。',
      seats: ['roshi-max', 'tien-z'],
      build: () => aoeMove('uniqueMafuba', '魔封波',
        { radius: 300, status: { seal: 1 }, statusTicks: 160, damage: 0, stun: 0, unblockable: true },
        { frames: 70, spawnFrame: 30, cost: 45 })
    },
    {
      key: 'uniqueSenzu', label: '仙豆',
      source: 'Z（亚奇洛贝负责把仙豆送到战场；克林亦随身携带）',
      note: '正传：吃下仙豆立刻恢复伤势与体力。机制转译＝自身回复道具。',
      seats: ['yajirobe-db', 'krillin-z'],
      build: () => buffMove('uniqueSenzu', '仙豆', {
        frames: 36, cost: 0, selfHeal: 0.22, buff: { frames: 240, damageScale: 1.06 }
      })
    },
    {
      key: 'uniqueFourArms', label: '四妖拳',
      source: '龙珠 第23届天下一武道会（天津饭对悟空）',
      note: '正传：从背部生出两只手臂、四手同时攻击；代价是力量分散。',
      seats: ['tien-z'],
      build: () => move('uniqueFourArms', 'burst', 'giant', {
        label: '四妖拳', frames: 38, at: 0, end: 0, cost: 28, damage: 0, reach: 0,
        giant: { frames: 300, scale: 1.10, damageScale: 0.92, speedScale: 1.10 }
      })
    },
    {
      key: 'uniqueVolleyPunch', label: '排球拳',
      source: '龙珠 第22届天下一武道会（天津饭对悟空）',
      note: '正传：把对手当成排球一样连续击打并扣杀。',
      seats: ['tien-z'],
      build: () => move('uniqueVolleyPunch', 'kick', 'grab', {
        label: '排球拳', frames: 40, at: 10, end: 16, damage: 0, reach: 92,
        grab: { techWindow: 22, hold: 34, throwDamage: 132, throwPush: 30 }
      })
    },
    {
      key: 'uniquePetrify', label: '石化唾液',
      source: 'Z 布欧篇（达普拉对克林、比克）',
      note: '正传：唾液命中即把对手石化。机制转译＝长时间冻结。',
      seats: ['dabura-z'],
      build: () => move('uniquePetrify', 'ki', 'ki', {
        label: '石化唾液', frames: 34, at: 0, end: 0, damage: 0, stun: 0, push: 0, cost: 22,
        projectile: { kind: 'ball', speed: 11, radius: 14, life: 120, spawnFrame: 14, damage: 0,
          status: { freeze: 1 }, statusTicks: 120 }
      })
    },
    {
      key: 'uniqueDragonFist', label: '龙拳',
      source: '剧场版第13作《龙拳爆发! 舍我其谁》（超赛3 悟空）；GT 沿用',
      note: '正传（剧场版）：以龙形气包裹拳头的突进近身技，属直接打击、不穿透。',
      seats: ['goku-ssj3', 'goku-ssj4'],
      build: () => move('uniqueDragonFist', 'kick', 'super', {
        label: '龙拳', frames: 44, at: 16, end: 24, damage: 150, reach: 190, stun: 52, push: 24, step: 5.2,
        cost: 34, hitstop: 7, shake: 14
      })
    },
    {
      key: 'uniqueSpiritBomb', label: '元气弹',
      source: 'GT 一星龙篇（超四悟空）；GT 少年悟空沿用（正传：界王处习得）',
      note: '正传：汇集万物元气形成的巨大球体，必须长时间蓄力，落地前可被躲开。',
      seats: ['goku-ssj4', 'goku-gt-kid'],
      build: () => move('uniqueSpiritBomb', 'super', 'super', {
        label: '元气弹', frames: 108, spawnFrame: 62, cost: 60, damage: 0, reach: 0,
        superKind: 'ball',
        superBall: { damage: 196, speed: 8, radius: 46, life: 190, charge: 34, hitstop: 9, shake: 20 }
      })
    },
    {
      key: 'uniqueKaioken', label: '界王拳',
      source: 'Z 赛亚人篇（界王处习得，对那巴首次使用）',
      note: '正传：气爆发式强化，力量成倍；代价是身体剧痛与肌肉损伤。',
      seats: ['goku-early'],
      build: () => buffMove('uniqueKaioken', '界王拳', {
        frames: 34, cost: 30, buff: { frames: 360, damageScale: 1.16 }, selfCost: { hp: 0.06 }
      })
    },
    {
      key: 'uniqueWarp', label: '瞬间移动',
      source: 'Z 那美克星篇末尾（亚德拉特星习得，此后悟空各形态沿用）；Z 沙鲁篇（沙鲁自称也学会了瞬间移动）',
      note: '正传：空间跳跃，非攻击技。沙鲁在自爆复活后正是用瞬间移动回到地球。',
      seats: ['goku-early', 'goku-ssj', 'goku-ssj2', 'goku-ssj3', 'goku-god',
        'goku-blue', 'goku-ultra', 'goku-gt-kid', 'goku-ssj4', 'cell-perfect', 'cell-super-perfect'],
      build: () => move('uniqueWarp', 'dash', 'movement', {
        label: '瞬间移动', frames: 20, at: 0, end: 0, damage: 0, reach: 0, stun: 0, push: 0,
        step: 22, cost: 18, invuln: 16
      })
    },
    {
      key: 'uniqueHeadbutt', label: '头突',
      source: 'Z 赛亚人篇（幼年悟饭以头槌撞断拉帝兹的护甲）',
      note: '正传：以头顶正面撞击，威力极大。',
      seats: ['gohan-kid'],
      build: () => move('uniqueHeadbutt', 'punch1', 'heavy', {
        label: '头突', frames: 26, at: 8, end: 14, damage: 84, reach: 88, stun: 42, push: 18, step: 2.6,
        hitstop: 5, shake: 10
      })
    },
    {
      key: 'uniqueWolfFang', label: '狼牙风风拳',
      source: '龙珠／Z（雅木茶的招牌突进连击）',
      note: '正传：突进式的连续爪击／掌打。',
      seats: ['yamcha-z'],
      build: () => move('uniqueWolfFang', 'kick', 'super', {
        label: '狼牙风风拳', frames: 46, at: 12, end: 30, damage: 42, reach: 128, stun: 30, push: 8, step: 4.4,
        cost: 26, hitstop: 4, shake: 9
      })
    },
    {
      key: 'uniqueGreatApe', label: '巨猿化',
      source: '龙珠（悟空在皮拉夫城堡满月巨猿化）；Z 赛亚人篇（悟饭、贝吉塔以布鲁兹光波巨猿化）',
      note: '正传：赛亚人看见满月或布鲁兹光波即巨猿化，力量暴涨但失去理智。',
      seats: ['goku-kid', 'gohan-kid', 'vegeta-scouter'],
      build: () => move('uniqueGreatApe', 'burst', 'giant', {
        label: '巨猿化', frames: 40, at: 0, end: 0, damage: 0, reach: 0, cost: 40,
        giant: { frames: 420, scale: 1.60, damageScale: 1.30, speedScale: 0.76 }
      })
    },
    {
      key: 'uniqueHakai', label: '破坏',
      source: '超漫画（悟空模仿比鲁斯使用破坏）；比鲁斯本人的招牌能力',
      note: '正传（漫画）：消解对手的技与物质，具「抹消」性质。',
      seats: ['beerus-super', 'goku-blue'],
      build: () => aoeMove('uniqueHakai', '破坏',
        { radius: 320, damage: 92, stun: 50, push: 8, status: { seal: 1 }, statusTicks: 90 },
        { frames: 60, spawnFrame: 26, cost: 50, hitstop: 7, shake: 16 })
    },
    {
      key: 'uniqueTimeSkipAttack', label: '闪时·杀击',
      source: '超 第6宇宙篇（希特）',
      note: '正传：以时间跳跃绕到对手身后完成一击，动作简洁高效。',
      seats: ['hit-super'],
      build: () => move('uniqueTimeSkipAttack', 'kick', 'super', {
        label: '闪时·杀击', frames: 40, at: 8, end: 14, damage: 128, reach: 150, stun: 46, push: 18, step: 4.6,
        cost: 30, invuln: 10, hitstop: 6, shake: 12
      })
    },
    {
      key: 'uniqueArmStretch', label: '手臂伸缩',
      source: 'Z（比克伸长手臂抓取与缠绕，第23届武道会对悟空）；超漫画（魔罗的长臂抓握）',
      note: '正传：把手臂拉长抓取对手，是那美克星人／魔罗的贴身控制手段。',
      seats: ['piccolo-z', 'piccolo-fused', 'piccolo-orange', 'moro-planet-eater'],
      build: () => move('uniqueArmStretch', 'punch1', 'grab', {
        label: '手臂伸缩', frames: 26, at: 7, end: 12, damage: 0, reach: 210, cost: 12,
        grab: { techWindow: 20, hold: 26, throwDamage: 104, throwPush: 22 }
      })
    },
    {
      key: 'uniqueBarrier', label: '能量障壁',
      source: 'Z／超（人造人17号展开气罩挡下并弹开气弹）',
      note: '正传：以气罩防住并弹开飞行道具。',
      seats: ['android17-ranger'],
      build: () => buffMove('uniqueBarrier', '能量障壁', {
        frames: 26, cost: 18, invuln: 18, buff: { frames: 200, damageScale: 1.0 }
      })
    },
    {
      key: 'uniqueCandy', label: '巧克力光线',
      source: 'Z 布欧篇（魔人布欧把人类与达普拉变成巧克力／饼干）',
      note: '正传：魔法光线，把对手变成食物。机制转译＝短暂无法行动的麻痹。',
      seats: ['buu-fat', 'buu-super', 'buu-gohan', 'buu-kid'],
      build: () => move('uniqueCandy', 'ki', 'ki', {
        label: '巧克力光线', frames: 34, at: 0, end: 0, damage: 0, stun: 0, push: 0, cost: 20,
        projectile: { kind: 'beam', speed: 10, radius: 16, life: 110, spawnFrame: 14, damage: 0,
          status: { paralyze: 1 }, statusTicks: 110 }
      })
    },
    {
      key: 'uniqueSelfDestructTech', label: '自爆',
      source: 'Z 赛亚人篇（饺子对那巴，抱住对手引爆自身）；Z 人造人篇（16号体内的炸弹）；Z 布欧篇（魔人贝吉塔）',
      note: '正传：以自身全部气／体内炸弹引爆，代价是自身生命。'
        + '那巴在正传里没有自爆行为，因此不派发给他。',
      seats: ['chiaotzu-z'],
      build: () => move('uniqueSelfDestructTech', 'burst', 'super', {
        label: '自爆', frames: 70, spawnFrame: 32, cost: 40, damage: 0, reach: 0,
        superKind: 'aoe',
        superAoe: { radius: 300, damage: 250, stun: 70, push: 40, unblockable: true },
        selfCost: { hp: 0.8 }, shake: 20
      })
    },

    /* ================= 第二波：让「正传里没有新命名招式」的形态也有可玩手段 ================= */
    {
      key: 'uniqueGalickGun', label: '加利克炮',
      source: 'Z 赛亚人篇（贝吉塔对悟空首次；名称源自动画／游戏，原作漫画该招式未命名）',
      note: '正传：单手推射的中型能量炮，贝吉塔此后各形态沿用。'
        + '贝吉特／悟吉塔是悟空与贝吉塔的合体，正传中两人确实各自使用过合体双方的招式（大爆炸攻击＝贝吉塔、龟派气功＝悟空）。',
      seats: ['vegeta-ssj', 'vegeta-super', 'vegeta-ssj4', 'vegeta-daima-mini', 'vegeta-daima-ssj3',
        'vegito-base', 'vegito-ssj', 'gogeta-base'],
      build: () => move('uniqueGalickGun', 'super', 'super', {
        label: '加利克炮', frames: 76, spawnFrame: 34, cost: 38, damage: 0, reach: 0,
        superKind: 'beam', beamDamage: 15, hitstop: 6, shake: 12
      })
    },
    {
      key: 'uniqueBigBang', label: '大爆炸攻击',
      source: 'Z 人造人篇（超级赛亚人贝吉塔对19号首次展现，一击摧毁 19 号）',
      note: '正传：单手前推的中型爆裂气弹，可短蓄力、不穿透。',
      seats: ['vegito-base', 'vegeta-super', 'vegeta-god', 'vegeta-blue', 'vegeta-ssj4'],
      build: () => move('uniqueBigBang', 'burst', 'super', {
        label: '大爆炸攻击', frames: 62, spawnFrame: 26, cost: 34, damage: 0, reach: 0,
        superKind: 'ball',
        superBall: { damage: 158, speed: 11, radius: 30, life: 150, charge: 18, hitstop: 7, shake: 13 }
      })
    },
    {
      key: 'uniqueFinalFlash', label: '最终闪光',
      source: 'Z 沙鲁篇（超级贝吉塔对完全体沙鲁首次）',
      note: '正传：双手聚合的超大型宽幅光束，需较长蓄力，可被对波抵消。',
      seats: ['vegeta-god', 'vegeta-blue', 'vegeta-ssj4'],
      build: () => move('uniqueFinalFlash', 'super', 'super', {
        label: '最终闪光', frames: 96, spawnFrame: 48, cost: 52, damage: 0, reach: 0,
        superKind: 'beam', beamDamage: 21, charge: 30, hitstop: 8, shake: 16
      })
    },
    {
      key: 'uniqueMasenko', label: '魔闪光',
      source: 'Z（悟饭的招牌：对那巴、对弗利萨、对沙鲁；外传特别篇中未来悟饭亦使用）',
      note: '正传：双手在额前聚合后向前推射的直线能量波。',
      seats: ['gohan-teen-ssj', 'gohan-teen-ssj2', 'gohan-adult-ssj', 'gohan-future', 'gohan-ultimate'],
      build: () => move('uniqueMasenko', 'super', 'super', {
        label: '魔闪光', frames: 72, spawnFrame: 32, cost: 36, damage: 0, reach: 0,
        superKind: 'beam', beamDamage: 14, hitstop: 6, shake: 11
      })
    },
    {
      key: 'uniqueSpiritSword', label: '气之剑',
      source: '超（超蓝贝吉特对合体扎马斯，以气刃贯穿）',
      note: '正传：把手部气凝成剑刃贯穿对手。',
      seats: ['vegito-blue'],
      build: () => move('uniqueSpiritSword', 'kick', 'super', {
        label: '气之剑', frames: 40, at: 12, end: 18, damage: 138, reach: 176, stun: 48, push: 20, step: 4.4,
        cost: 30, pierce: true, hitstop: 7, shake: 13
      })
    },
    {
      key: 'uniqueStardustBreaker', label: '星尘破碎者',
      source: '剧场版第12作《复活的融合!! 悟空与贝吉塔》（超级悟吉塔对邪念波）',
      note: '正传（剧场版）：以星尘状气弹包裹拳头发动，能净化邪气。',
      seats: ['gogeta-super'],
      build: () => move('uniqueStardustBreaker', 'burst', 'super', {
        label: '星尘破碎者', frames: 58, spawnFrame: 24, cost: 36, damage: 0, reach: 0,
        superKind: 'ball',
        superBall: { damage: 168, speed: 13, radius: 26, life: 150, charge: 16, pierce: true, hitstop: 7, shake: 13 }
      })
    },
    {
      key: 'uniqueBigBangKamehameha', label: '大爆炸龟派气功',
      source: 'GT（超四悟吉塔的招牌；超《布罗利》中亦使用）',
      note: '正传：把大爆炸攻击与龟派气功合一的双掌巨幅光束。',
      seats: ['gogeta-blue', 'gogeta-ssj4'],
      build: () => move('uniqueBigBangKamehameha', 'super', 'super', {
        label: '大爆炸龟派气功', frames: 90, spawnFrame: 44, cost: 50, damage: 0, reach: 0,
        superKind: 'beam', beamDamage: 20, charge: 26, hitstop: 8, shake: 15
      })
    },
    {
      key: 'uniqueHelmetBeam', label: '头盔光束',
      source: '龙珠 第23届天下一武道会（琪琪以带刃头盔射出光束）',
      note: '正传：琪琪在正传中唯一展示过的远程手段（她是纯徒手武斗家，没有气功波）。',
      seats: ['chichi-tournament'],
      build: () => move('uniqueHelmetBeam', 'ki', 'ki', {
        label: '头盔光束', frames: 32, at: 0, end: 0, damage: 26, stun: 22, push: 7, cost: 14,
        projectile: { kind: 'beam', speed: 15, radius: 9, life: 130, spawnFrame: 13, damage: 26 }
      })
    },
    {
      key: 'uniqueDynamite', label: '炸药',
      source: 'Z 布欧篇（撒旦先生对魔人布欧使用手枪与炸药，无效）',
      note: '正传：撒旦没有气功，唯一的远程手段就是道具。机制转译＝低伤害爆裂投掷。',
      seats: ['hercule-z'],
      build: () => move('uniqueDynamite', 'ki', 'ki', {
        label: '炸药', frames: 38, at: 0, end: 0, damage: 30, stun: 24, push: 10, cost: 16,
        projectile: { kind: 'ball', speed: 10, radius: 16, life: 110, spawnFrame: 16, damage: 30,
          heavy: true }
      })
    },
    {
      key: 'uniquePistol', label: '手枪射击',
      source: '龙珠 第1话（布尔玛对悟空开枪，子弹被弹开、完全无效）',
      note: '正传：布尔玛没有任何气功或格斗技，正传里唯一的「攻击」行为就是开枪。'
        + '机制转译＝低伤害远程骚扰。',
      seats: ['bulma-adventure'],
      build: () => move('uniquePistol', 'ki', 'ki', {
        label: '手枪射击', frames: 24, at: 0, end: 0, damage: 12, stun: 12, push: 3, cost: 6,
        projectile: { kind: 'ball', speed: 19, radius: 6, life: 120, spawnFrame: 9, damage: 12 }
      })
    },
    {
      key: 'uniqueFlight', label: '舞空术',
      source: 'Z（比迪丽在布欧篇前学会舞空术；饺子、GT 小芳、乌普均以舞空术机动）',
      note: '正传：把气灌入脚下在空中自由机动。机制转译＝空中冲刺位移。',
      seats: ['videl-z', 'pan-gt', 'uub-majuub', 'chiaotzu-z'],
      build: () => move('uniqueFlight', 'dash', 'movement', {
        label: '舞空术', frames: 18, at: 0, end: 0, damage: 0, reach: 0, stun: 0, push: 0,
        step: 16, cost: 10, air: true, groundedOnly: false
      })
    },
    {
      key: 'uniqueFusionPose', label: '融合术',
      source: 'Z 布欧篇（悟天与特兰克斯向比克学习融合舞步）',
      note: '正传：融合舞步本身不是攻击技。机制转译＝蓄力型强化（融合后战力大幅提升）。',
      seats: ['goten-ssj', 'trunks-kid'],
      build: () => buffMove('uniqueFusionPose', '融合术', {
        frames: 46, cost: 34, buff: { frames: 400, damageScale: 1.14 }, selfHeal: 0.06
      })
    },
    {
      key: 'uniqueKiBlade', label: '气刃斩',
      source: '超 未来特兰克斯篇（扎马斯以手部气刃近身斩击）',
      note: '正传：把手部气凝成刃，兼作近身斩击与投射。',
      seats: ['zamasu-base', 'zamasu-fused'],
      build: () => move('uniqueKiBlade', 'kick', 'heavy', {
        label: '气刃斩', frames: 30, at: 11, end: 18, damage: 100, reach: 154, stun: 38, push: 16, step: 2.8,
        cost: 18, hitstop: 5, shake: 9
      })
    }
  ];

  /* ------------------------------------------------------------------ *
   * 派发：跳过已自带同名招式的席位（手写的正传专属技优先，绝不覆盖）
   * ------------------------------------------------------------------ */
  const report = { applied: [], skipped: [] };
  for (const tech of TECHNIQUES) {
    for (const seat of tech.seats) {
      const entry = SKILLS[seat];
      if (!entry) { report.skipped.push(`${tech.label}→${seat}: 无此席位`); continue; }
      entry.unique = entry.unique || {};
      const inUnique = !!entry.unique[tech.key];
      const inMoves = !!(entry.moves && entry.moves[tech.key]);
      if (inUnique || inMoves) { report.skipped.push(`${tech.label}→${seat}: 已自带`); continue; }
      entry.unique[tech.key] = tech.build();
      report.applied.push(`${tech.label}→${seat}`);
    }
  }

  /* 组合键（方向键下＋远程攻击键）要能选到这些武技：
     插到现有专属技之后、兜底之前。 */
  if (Array.isArray(DV.COMBO_ORDER)) {
    for (const t of TECHNIQUES) if (!DV.COMBO_ORDER.includes(t.key)) DV.COMBO_ORDER.push(t.key);
  }
  /* 派发后必须清缓存，否则 resolveMoves / uniqueMap 读到的是旧表 */
  if (typeof DV._resetCaches === 'function') DV._resetCaches();

  const TECHNIQUE_DOC = TECHNIQUES.map(t => ({
    key: t.key, label: t.label, source: t.source, note: t.note, seats: t.seats.slice()
  }));

  Object.assign(DV, {
    TECHNIQUES, TECHNIQUE_DOC, TECHNIQUE_REPORT: report,
    techniqueSeats: (key) => {
      const t = TECHNIQUES.find(x => x.key === key);
      return t ? t.seats.slice() : [];
    }
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { TECHNIQUES, TECHNIQUE_DOC, TECHNIQUE_REPORT: report };
})(typeof globalThis !== 'undefined' ? globalThis : window);
