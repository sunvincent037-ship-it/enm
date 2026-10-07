/* 形态特性（正传形态机制）—— 逐席位把「正传里这个形态/角色的固有代价与特性」做成机制。
 *
 * 为什么需要这一层：正传里很多形态本身**没有新的命名招式**（例如超级赛亚人2／3、超级赛亚人蓝、
 * 自在极意、超级赛亚人4），它们的差异全部体现在「形态机制」上——消耗、时间限制、力量流失、
 * 再生、不死、自动规避、越打越强。只做招式表的话这些形态会变成同一个角色换皮。
 *
 * 严格约束：本文件的每一条都必须是正传（原作漫画／东映动画／官方剧场版／官方 TV 动画）里
 * 明确写出的形态机制。凡是查不到正传依据的，一律不写；凡是「把正传描述翻译成数值」的，
 * 在 note 里标注【机制转译】并写清依据原句。
 *
 * 字段：
 *   label  正传里的机制名
 *   source 出处（作品／篇章）
 *   note   正传原句或【机制转译】说明
 *   effect 引擎可执行的数值（见 engine.js 的被动读取点）
 */
(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};

  /* effect 支持的键：
     kiDrain       每帧气力流失（正传：形态维持消耗）
     hpDrain       每帧生命流失（正传：界王拳副作用）
     kiRegenBonus  每帧额外回气
     traitPower    固定伤害倍率（形态本身的力量差）
     powerFade     {after,perTick,min} 越打越弱（正传：体力耗尽力量流失）
     rampUp        {after,perTick,max} 越打越强（正传：传说型超级赛亚人力量持续增长）
     reachScale    判定距离倍率（正传：未来悟饭独臂）
     airJumps      额外跳跃次数（正传：不会舞空术的角色）
     damageResist  受伤倍率（正传：硬气防御／异常耐久）
     regen / infiniteEnergy / absorbKi / teleport / guardRegenScale / speedScale / damageResist
                   —— 已在 engine.js 中实现的既有被动，这里只做归口说明 */
  const TRAITS = {
    /* ---------------- 悟空系 ---------------- */
    'goku-kaioken': {
      label: '界王拳的代价', source: 'Z 赛亚人篇～那美克星篇',
      note: '正传：界王拳是气爆发式强化，倍率越高身体负担越重——剧痛、肌肉损伤，越高倍率越危险。',
      effect: { hpDrain: 0.010, traitPower: 1.05 }
    },
    'goku-ssj2': {
      label: '超赛2 的体力消耗', source: 'Z 布欧篇',
      note: '正传：超级赛亚人2 力量与速度超越超赛1，但体力消耗也高于超赛1（尚未失去理智）。',
      effect: { kiDrain: 0.05 }
    },
    'goku-ssj3': {
      label: '超赛3 的时间限制', source: 'Z 布欧篇',
      note: '正传：在阳间维持超级赛亚人3 极耗体力，停留时间被大幅压缩，无法久战。',
      effect: { kiDrain: 0.17, powerFade: { after: 1500, perTick: 0.00006, min: 0.86 } }
    },
    'goku-god': {
      label: '神之气的暂时性', source: '剧场版《神与神》',
      note: '正传（剧场版）：超级赛亚人之神的力量是暂时性的，战斗后半段会流失。',
      effect: { powerFade: { after: 1200, perTick: 0.00007, min: 0.88 } }
    },
    'goku-blue': {
      label: '超赛蓝的体力消耗', source: '超 第6宇宙篇～力之大会',
      note: '正传：超级赛亚人蓝 力气可内敛、能长时间维持，但消耗体力较大（动画）。',
      effect: { kiDrain: 0.06 }
    },
    'goku-ultra': {
      label: '自在极意的维持代价', source: '超 力之大会',
      note: '正传：完成版自在极意消耗极大、维持时间极短，且需心境平静才能触发。',
      effect: { kiDrain: 0.20, powerFade: { after: 1400, perTick: 0.00007, min: 0.86 },
        teleport: { cost: 10, cooldown: 45, invuln: 20, distance: 210 }, guardRegenScale: 1.25 }
    },
    'goku-gt-kid': {
      label: '变小后的体格劣势', source: 'GT 黑星龙珠篇',
      note: '正传：被黑星龙珠变成小孩后体格退化、战力下降（超赛3 等形态难以久持）。',
      effect: { traitPower: 0.97 }
    },
    'goku-daima-mini': {
      label: '魔界神龙造成的变小', source: '大魔 第1话',
      note: '正传：被魔界神龙变小，体格退化、战力受限。',
      effect: { traitPower: 0.97 }
    },
    /* ---------------- 贝吉塔系 ---------------- */
    'vegeta-super': {
      label: '肌肉膨胀的代价', source: 'Z 沙鲁篇',
      note: '正传：超级贝吉塔（第二阶）力量与速度上升，但气消耗更大、无法久持。',
      effect: { kiDrain: 0.15 }
    },
    'vegeta-blue': {
      label: '超赛蓝的体力消耗', source: '超 复活的F～力之大会',
      note: '正传：超级赛亚人蓝 消耗体力较大。',
      effect: { kiDrain: 0.06 }
    },
    'vegeta-daima-ssj3': {
      label: '超赛3 的剧烈消耗', source: '大魔',
      note: '正传（大魔）：贝吉塔首次实现超赛3，力量大幅提升但消耗剧烈、难以久持。',
      effect: { kiDrain: 0.17 }
    },
    /* ---------------- 悟饭系 ---------------- */
    'gohan-ultimate': {
      label: '潜能解放（非变身）', source: 'Z 布欧篇 · 老界王神仪式',
      note: '正传：不是变身，而是由老界王神引出全部潜力，力量常驻、不需要分心维持形态。'
        + '【机制转译】因此给予额外回气（不必分神维持变身）。',
      effect: { kiRegenBonus: 0.08 }
    },
    'gohan-future': {
      label: '独臂作战', source: 'Z 外传 · 特兰克斯回忆',
      note: '正传：未来悟饭断臂后以单臂正拳与踢击战斗，攻击范围因此受限于单侧。'
        + '【机制转译】判定距离小幅下调。',
      effect: { reachScale: 0.90 }
    },
    /* ---------------- 赛亚人后辈 / 融合 ---------------- */
    'future-trunks-super': {
      label: '肌肉膨胀的代价', source: 'Z 沙鲁篇',
      note: '正传：超级特兰克斯同为第二阶肌肉膨胀形态，气消耗更大、无法久持。',
      effect: { kiDrain: 0.15 }
    },
    'gotenks-ssj3': {
      label: '融合时限', source: 'Z 布欧篇',
      note: '正传：舞步融合有时限，超三状态会进一步大幅压缩维持时间。'
        + '【机制转译】战斗后期力量随时间流失，且维持耗气。',
      effect: { kiDrain: 0.16, powerFade: { after: 1500, perTick: 0.00016, min: 0.72 } }
    },
    'gotenks-base': {
      label: '融合时限', source: 'Z 布欧篇',
      note: '正传：舞步融合为限时合体。【机制转译】长时间战斗后力量流失。',
      effect: { powerFade: { after: 3000, perTick: 0.00006, min: 0.85 } }
    },
    'gotenks-ssj': {
      label: '融合时限', source: 'Z 布欧篇',
      note: '正传：舞步融合为限时合体。【机制转译】长时间战斗后力量流失。',
      effect: { powerFade: { after: 2700, perTick: 0.00007, min: 0.84 } }
    },
    'gogeta-super': {
      label: '融合时限', source: '剧场版《复活的融合》',
      note: '正传（剧场版）：舞步融合限时 30 分钟。【机制转译】长时间战斗后力量流失。',
      effect: { powerFade: { after: 3000, perTick: 0.00005, min: 0.88 } }
    },
    'gogeta-ssj4': {
      label: '融合时限', source: 'GT',
      note: '正传（GT）：超四悟吉塔为限时融合。【机制转译】长时间战斗后力量流失。',
      effect: { powerFade: { after: 3000, perTick: 0.00005, min: 0.88 } }
    },
    'vegito-blue': {
      label: '超赛蓝＋耳环合体的消耗', source: '超 未来特兰克斯篇',
      note: '正传：超蓝贝吉特的融合时限极短，且超赛蓝本身消耗体力较大。',
      effect: { kiDrain: 0.09, powerFade: { after: 2100, perTick: 0.00010, min: 0.80 } }
    },
    'vegito-ssj': {
      label: '耳环合体时限', source: 'Z 布欧篇',
      note: '正传：界王神耳环的合体为限时。【机制转译】长时间战斗后力量流失。',
      effect: { powerFade: { after: 3300, perTick: 0.00005, min: 0.88 } }
    },
    /* ---------------- 弗利萨一族 ---------------- */
    'frieza-full': {
      label: '100% 力量的体力流失', source: 'Z 那美克星篇',
      note: '正传：100% 全力形态肌肉膨胀、速度下降，越打越喘，力量随体力流失。',
      effect: { powerFade: { after: 900, perTick: 0.00013, min: 0.62 }, kiDrain: 0.05 }
    },
    'frieza-golden': {
      label: '黄金形态的体力消耗', source: '剧场版《复活的F》／超',
      note: '正传：黄金弗利萨力量极强但体力消耗剧烈，长时间战斗后力量明显下滑。',
      effect: { powerFade: { after: 1200, perTick: 0.00011, min: 0.72 }, kiDrain: 0.07 }
    },
    /* ---------------- 传说型 / 暴走 ---------------- */
    'broly-z': {
      label: '传说型超级赛亚人的力量增长', source: '剧场版第8作',
      note: '正传（剧场版）：传说型超级赛亚人的力量会随战斗持续增长。',
      effect: { rampUp: { after: 600, perTick: 0.00005, max: 1.22 } }
    },
    'broly-full': {
      label: '传说型超级赛亚人的力量增长', source: '剧场版《布罗利》',
      note: '正传：全力超级赛亚人布罗利的力量随战斗持续上升，越打越强。',
      effect: { rampUp: { after: 600, perTick: 0.00006, max: 1.24 } }
    },
    'kale-berserk': {
      label: '传说型力量的失控增长', source: '超 力之大会',
      note: '正传：开尔的传说型超级赛亚人力量失控且持续攀升。',
      effect: { rampUp: { after: 600, perTick: 0.00005, max: 1.20 } }
    },
    /* ---------------- 再生 / 不死 ---------------- */
    'zamasu-base': {
      label: '不死之身', source: '超 未来特兰克斯篇',
      note: '正传：扎马斯向超级龙珠许愿获得不死之身，受到的伤害会不断恢复。',
      effect: { regen: { delay: 90, perSecond: 22 } }
    },
    'zamasu-fused': {
      label: '半不死之身', source: '超 未来特兰克斯篇',
      note: '正传：合体扎马斯继承了不死之身（但肉体开始崩坏）。',
      effect: { regen: { delay: 120, perSecond: 16 }, damageResist: 0.96 }
    },
    'buu-kid': {
      label: '以再生硬吃打击', source: 'Z 布欧篇',
      note: '正传：纯粹布欧靠再生硬吃打击换伤。',
      effect: { regen: { delay: 100, perSecond: 18 }, damageResist: 0.96 }
    },
    /* ---------------- 人造人 ---------------- */
    'android16-z': {
      label: '永久能源炉', source: 'Z 人造人篇',
      note: '正传：人造人的永久能源炉提供无限能量。',
      effect: { infiniteEnergy: { kiPerTick: 0.16 }, damageResist: 0.97 }
    },
    'android18-z': {
      label: '永久能源炉', source: 'Z 人造人篇',
      note: '正传：人造人的永久能源炉提供无限能量。',
      effect: { infiniteEnergy: { kiPerTick: 0.18 } }
    },
    'super17-gt': {
      label: '永久能源炉＋吸收气弹', source: 'GT 超级17号篇',
      note: '正传：超级17号由两个17号合体而成，能吸收气弹化为自身能量。',
      effect: { infiniteEnergy: { kiPerTick: 0.20 }, absorbKi: { ratio: 2.4 } }
    },
    /* ---------------- 异常耐久 / 不会舞空术 ---------------- */
    'hercule-z': {
      label: '世界冠军的异常耐久', source: 'Z 沙鲁游戏～布欧篇',
      note: '正传：撒旦被沙鲁、布欧正面击中后仍然存活（喜剧式耐久）。'
        + '【机制转译】减免伤害。另：撒旦不会舞空术。',
      effect: { damageResist: 0.93, airJumps: -1 }
    },
    'yajirobe-db': {
      label: '不会舞空术', source: '龙珠／Z',
      note: '正传：亚奇洛贝没有气功与舞空术，靠体重臂力与刀。',
      effect: { airJumps: -1 }
    },
    'bulma-adventure': {
      label: '非战斗员', source: '龙珠 冒险篇',
      note: '正传：布尔玛没有任何战斗招式（第1话持手枪对悟空开枪，子弹被弹开、完全无效），'
        + '定位是后勤与科技支援。另：不会舞空术。本席位的招式全部来自她的正传装备（万能胶囊等）。',
      effect: { airJumps: -1 }
    },
    /* ---------------- 神与宇宙强者 ---------------- */
    'whis-super': {
      label: '天使的身法', source: '超',
      note: '正传：维斯在正传里只展现过轻松闪避与随手压制，没有实战近身交锋记录。',
      effect: { speedScale: 1.06, teleport: { cost: 10, cooldown: 45, invuln: 20, distance: 210 },
        guardRegenScale: 1.25 }
    },
    'jiren-full': {
      label: '硬气防御', source: '超 力之大会',
      note: '正传：吉连以气墙硬挡攻击，靠纯粹力量正面压制，极少使用花招。'
        + '【机制转译】减伤但缺乏位移类技巧。',
      effect: { damageResist: 0.93 }
    },
    'hit-super': {
      label: '闪时', source: '超 第6宇宙篇',
      note: '正传：希特用闪时（时间跳跃）在对手反应前完成打击，动作简洁高效。',
      effect: { teleport: { cost: 12, cooldown: 60, invuln: 12, distance: 150 } }
    },
    'beerus-super': {
      label: '破坏神的化解', source: '剧场版《神与神》／超',
      note: '正传：比鲁斯以极轻的动作化解攻击（对超赛神悟空的高速对拳与闪避）。',
      effect: { teleport: { cost: 8, cooldown: 70, invuln: 16, distance: 140 }, damageResist: 0.96 }
    },
    'moro-planet-eater': {
      label: '魔力吸收', source: '超漫画 银河巡警囚犯篇',
      note: '正传（漫画）：魔罗能吸取星球与对手的气，靠吸能与再生硬撑。',
      effect: { absorbKi: { ratio: 1.6 }, regen: { delay: 150, perSecond: 12 } }
    },
    /* ---------------- 其他恢复型 ---------------- */
    'piccolo-fused': {
      label: '那美克星人再生', source: 'Z／超',
      note: '正传：那美克星人受伤后可再生（与神明融合后战力与耐久进一步提升）。',
      effect: { regen: { delay: 150, perSecond: 14 } }
    },
    'cell-super-perfect': {
      label: '自爆复活后的恢复力', source: 'Z 沙鲁篇',
      note: '正传：沙鲁自爆后凭核心再生并变得更强。',
      effect: { regen: { delay: 140, perSecond: 12 } }
    },
    'buu-super': {
      label: '魔人再生', source: 'Z 布欧篇',
      note: '正传：魔人布欧的身体可以再生，并且能吸收对手。',
      effect: { regen: { delay: 110, perSecond: 16 } }
    },
    'baby-super2': {
      label: '寄生吸取', source: 'GT 贝比篇',
      note: '正传（GT）：贝比通过寄生夺取宿主力量并吸取能量。',
      effect: { absorbKi: { ratio: 1.3 } }
    },
    'uub-majuub': {
      label: '布欧系的力量与再生', source: 'GT 贝比篇',
      note: '正传（GT）：乌普与善良布欧融合为魔人乌普，获得布欧系力量。',
      effect: { regen: { delay: 160, perSecond: 10 } }
    },
    'nappa-z': {
      label: '巨汉体格的抗打', source: 'Z 赛亚人篇',
      note: '正传：那巴硬吃饺子自爆与天津饭的气功炮后仍能继续战斗。'
        + '【机制转译】减免伤害。他没有任何花招，正面蛮力就是他全部的战斗方式。',
      effect: { damageResist: 0.95, traitPower: 1.03 }
    },
    'bardock-z': {
      label: '预知梦', source: 'Z 外传特别篇《独自一人的最终决战》',
      note: '正传（TV 特别篇）：巴达克获得看见未来的预知能力，因此能预判弗利萨的背叛。'
        + '【机制转译】转译为短距离的预判回避。',
      effect: { teleport: { cost: 16, cooldown: 110, invuln: 12, distance: 120 } }
    },
    'broly-wrath': {
      label: '怒形态的力量增长', source: '剧场版《布罗利》',
      note: '正传：布罗利的怒形态在战斗中人形战力持续上升（传说型赛亚人的特性）。',
      effect: { rampUp: { after: 700, perTick: 0.00005, max: 1.20 } }
    }
  };

  /* 与 SKILLS.passive 合并：招式的正传被动优先，形态特性只补齐缺的键。 */
  function traitsOf(fighter) {
    const spec = fighter && (fighter.spec || fighter);
    const id = spec && spec.id;
    return (id && TRAITS[id]) || null;
  }
  function traitEffectOf(fighter) {
    const t = traitsOf(fighter);
    return (t && t.effect) || null;
  }
  /* 展示用：给「出招表」列出该席位的形态特性 */
  function traitInfo(fighter) { return traitsOf(fighter); }

  Object.assign(DV, { TRAITS, traitsOf, traitEffectOf, traitInfo });
  if (typeof module !== 'undefined' && module.exports) module.exports = { TRAITS, traitsOf, traitEffectOf, traitInfo };
})(typeof globalThis !== 'undefined' ? globalThis : window);
