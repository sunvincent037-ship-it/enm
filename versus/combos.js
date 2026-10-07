/* 逐身份连段模型：把正传里每个角色的「近身战实际表现」编码成可玩的平A手感。
 *
 * 数据来源：docs/canon-melee-profile.md（正传漫画／东映动画／官方剧场版近身战档案，
 * 每席位三轴：PACE 出招节奏 / RANGE 攻击距离 / WEIGHT 打击分量）。
 * 本文件不含任何原创设定：三轴一律照抄档案，数值只是三轴的机械换算。
 *
 * 三轴 → 数值：
 *   PACE  快/中/慢  → 招式帧数、前冲位移、硬直
 *   RANGE 短/中/长  → 判定距离倍率
 *   WEIGHT 轻/中/重 → 每段伤害、硬直、击退（重级终结段带轻微浮空）
 *
 * 三轴全为「中中中」的席位不加后缀，直接使用默认条目
 * （默认 punch1/punch2/kick 的原始帧表必须保持不变，回归测试依赖它）。 */
(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};

  /* ---------------- 正传近身战三轴档案（100 席位） ---------------- *
   * 值域：pace F 快 / M 中 / S 慢；range S 短 / M 中 / L 长；weight L 轻 / M 中 / H 重
   * 注释里给出正传依据，避免「随手填数值」的发挥。 */
  const MELEE = {
    /* 悟空系 13 */
    'goku-kid': 'FSL',            // 小个子贴身缠斗，拳脚＋尾巴＋如意棒，出手极快但分量轻
    'goku-early': 'FMM',          // 高机动近身连击并频繁抓握（赛亚人篇～那美克星篇）
    'goku-kaioken': 'FMH',        // 界王拳倍增下的爆发性高速拳脚，单发分量随倍率上升
    'goku-ssj': 'FMH',            // 对弗利萨的直线型凶猛压制＋瞬间移动绕背
    'goku-ssj2': 'MMH',           // 与魔人贝吉塔正面对等互殴，硬碰硬换招
    'goku-ssj3': 'MMH',           // 对胖布欧的正面重拳重踢，形态耗气快
    'goku-god': 'FMM',            // 与比鲁斯的高速对拳与闪避，以技巧速度为主
    'goku-blue': 'FMH',           // 瞬移贴脸起手＋正面拳脚连击
    'goku-ultra': 'FMH',          // 自在极意：自动闪避后贴脸反击
    'goku-gt-kid': 'FSL',         // GT 变小后快速拳脚踢击，打击分量明显不足
    'goku-ssj4': 'FMH',           // 龙拳贯穿＋重踢与抓取，正面硬解
    'goku-daima-mini': 'FSL',     // 大魔变小状态：连拳连踢兼用如意棒
    'goku-daima-ssj4': 'MMH',     // 大魔超四对戈玛的近身重拳重踢与抓握
    /* 贝吉塔系 9 */
    'vegeta-scouter': 'MMH',      // 力量型野蛮近身，直接抓握挤压
    'vegeta-ssj': 'MMH',          // 直线型猛攻，正面拳脚后接气弹，不擅迂回
    'vegeta-super': 'MMH',        // 肌肉膨胀后的单发重击连打
    'vegeta-majin': 'MMH',        // 与超级赛亚人2 悟空对等的正面互殴
    'vegeta-god': 'FMM',          // 超赛神形态与布罗利正面近身对拼，速度与力量平衡
    'vegeta-blue': 'FMH',         // 强力连拳连踢的直线猛攻
    'vegeta-ssj4': 'MMH',         // GT 对一星龙的近身对攻
    'vegeta-daima-mini': 'FSM',   // 大魔变小后快速连踢连拳，踢技比例偏高
    'vegeta-daima-ssj3': 'MMH',   // 大魔超三对戈玛的重拳硬拼
    /* 悟饭系 7 */
    'gohan-kid': 'FSH',           // 无技巧的爆发式猛冲与乱打，头槌撞断拉帝兹护甲
    'gohan-teen-ssj': 'MMM',      // 训练过的扎实拳脚，回避后反击
    'gohan-teen-ssj2': 'FMH',     // 爆发式单发重击，速度压制（沙鲁游戏）
    'gohan-adult-ssj': 'MMM',     // 基本功尚在但生疏，不如少年期锐利
    'gohan-ultimate': 'MMH',      // 压倒性力量的重拳重踢正面压制
    'gohan-future': 'MMM',        // 独臂近战，靠单臂打击与腿法规避劣势
    'gohan-beast': 'FMH',         // 野兽悟饭对沙鲁 MAX 的正面拳脚猛攻
    /* 比克系 3 */
    'piccolo-z': 'MLM',           // 拉长肢体的距离欺骗型近身，伸长手臂抓取缠绕
    'piccolo-fused': 'MLH',       // 融合后的力量型近身，重拳重踢＋臂展抓取
    'piccolo-orange': 'MMH',      // 橙色比克巨力正面硬拼，必要时巨大化压制
    /* 地球武术家 10 */
    'krillin-z': 'FSM',           // 速度与技巧型连打，太阳拳致盲后近身追击
    'yamcha-z': 'FMM',            // 突进式连续爪击／掌打（狼牙风风拳）
    'tien-z': 'MMH',              // 硬派正拳＋多臂连打与抓取摔砸
    'chiaotzu-z': 'SML',          // 几乎没有近身格斗描写，主要靠超能力牵制
    'roshi-max': 'MSM',           // 醉拳与残像拳并用，以技巧戏耍并反击
    'yajirobe-db': 'MMM',         // 以刀为主的近身斩击，肉搏很少
    'chichi-tournament': 'MMM',   // 第23届武道会以踢技与掌打的正面近身
    'videl-z': 'FML',             // 空手道式正拳与踢击，但力量不足
    'hercule-z': 'SML',           // 只有表演性质的拳脚，无实战效果
    'bulma-adventure': 'SSL',     // 正传中几乎没有近身战斗描写
    /* 赛亚人后辈 9 */
    'goten-ssj': 'FSM',           // 幼儿体型的高速拳脚乱打，缺技巧
    'trunks-kid': 'FSM',          // 同级的快速连打，以拳脚为主
    'future-trunks-sword': 'MMH', // 以剑斩击为核心的近身战
    'future-trunks-ssj': 'MMH',   // 超赛状态下剑斩与拳脚并用
    'future-trunks-super': 'FMH', // 超对黑悟空的剑击与拳脚组合
    'future-trunks-rage': 'FMH',  // 愤怒爆发形态的正面强攻＋重剑斩
    'gotenks-base': 'FSM',        // 高速连打但带玩闹心态
    'gotenks-ssj': 'FMM',         // 更快的连打并与气弹衔接
    'gotenks-ssj3': 'FMH',        // 超三猛攻，因轻敌被反击
    /* 融合战士 7 */
    'vegito-base': 'FMH',         // 常态贝吉特对超级布欧的戏弄式连打与踢击
    'vegito-ssj': 'FMH',          // 完全压倒的正面连打，并用手部气刃贯穿
    'vegito-blue': 'FMH',         // 对合体扎马斯的连打与气之剑
    'gogeta-base': 'FMM',         // 常态悟吉塔的高效近身连击
    'gogeta-super': 'FMH',        // 超级悟吉塔对布罗利的正面猛攻
    'gogeta-blue': 'FMH',         // 超蓝悟吉塔的连续重击后接气技收尾
    'gogeta-ssj4': 'FMH',         // GT 以闪避＋重击反打
    /* 反派 24 */
    'bardock-z': 'MMH',           // 对弗利萨军团的正面混战，拳脚＋气弹连打
    'raditz-z': 'MLH',            // 长臂重拳与猛踢的正面压制
    'nappa-z': 'MMH',             // 巨汉蛮力正面压制，一击打断天津饭手臂
    'frieza-first': 'FMM',        // 第一形态以尾巴横扫／刺击配合拳脚
    'frieza-final': 'FMH',        // 最终形态对悟空的近身连打
    'frieza-full': 'MMH',         // 100% 全力：肌肉膨胀的重拳重踢，速度下降
    'frieza-golden': 'FMH',       // 黄金弗利萨对超蓝悟空的对等近身战
    'cooler-final': 'MMH',        // 剧场版第5作对悟空的近身压制
    'cell-first': 'MMM',          // 第一形态拳脚近身＋尾部吸收
    'cell-perfect': 'FMH',        // 完全体对悟空的高水平拳脚互换
    'cell-super-perfect': 'FMH',  // 自爆复活后的正面重击
    'buu-fat': 'MMH',             // 软体变形的贴身缠斗＋重拳抓握
    'buu-super': 'FMH',           // 对悟天克斯、悟饭的高速连击＋吸收
    'buu-gohan': 'FMH',           // 吸收悟饭后正面压制终极悟饭
    'buu-kid': 'FMH',             // 疯狂无序的高速乱打与腿法
    'dabura-z': 'MMM',            // 剑的近身斩击与拳脚结合
    'janemba-super': 'FMH',       // 变形剑＋拳脚，靠空间能力贴近
    'broly-z': 'MMH',             // 巨汉蛮力的抓握摔砸与重拳
    'broly-wrath': 'MMH',         // 怒形态硬吃打击后反打
    'broly-full': 'FMH',          // 全力超级赛亚人的暴走式巨力猛攻
    'moro-planet-eater': 'MLH',   // 长臂抓握＋贴身吸取，格斗技巧普通
    'omega-shenron-gt': 'MMH',    // GT 巨力重拳的正面硬拼
    'baby-super2': 'FMH',         // 以贝吉塔身体进行高速近身压制
    'super17-gt': 'FMM',          // 高速拳脚连打，近身吸收气弹
    /* 人造人 4 */
    'android16-z': 'SMH',         // 巨力抓抱与重拳，分量重但不灵巧
    'android17-ranger': 'MMM',    // 无限能量支撑的稳健拳脚＋屏障
    'android18-z': 'FMM',         // 拳脚快到对手跟不上，曾打断超赛贝吉塔手臂
    'android21-majin': 'MMH',     // 【游戏原创】《FighterZ》魔人形态，正传无近身战描写
    /* 神与宇宙强者 12 */
    'beerus-super': 'FMH',        // 与超赛神悟空的高速对拳，以极轻动作化解攻击
    'whis-super': 'FML',          // 正传中几乎没有真正的近身战描写，仅见轻松闪避
    'jiren-full': 'MMH',          // 硬碰硬的正拳对拼，靠绝对力量压制
    'hit-super': 'FMH',           // 以时间跳跃绕到身后的一击，简洁高效
    'kefla-ssj2': 'FMH',          // 高速连打与踢技，动作直率粗放
    'cabba-ssj': 'MMM',           // 基本功扎实的常规拳脚，无特殊近身招式
    'caulifla-ssj2': 'FMM',       // 快速拳脚连打与灵活躲闪，靠本能战斗
    'kale-berserk': 'MMH',        // 暴走状态的蛮力猛攻，动作粗野
    'goku-black-base': 'FMM',     // 借用悟空身体的稳健拳脚＋手部气刃
    'goku-black-rose': 'FMH',     // 桃红形态的高速连打与气刃斩
    'zamasu-base': 'MMM',         // 靠不死之身硬吃攻击的近身对拼
    'zamasu-fused': 'FMH',        // 合体扎马斯的巨力近身压制＋气刃
    /* GT 2 */
    'pan-gt': 'FSL',              // GT 前期小体型高速拳脚，对强敌打击无效
    'uub-majuub': 'MMH'           // 以体术正面交手，兼用气技
  };

  /* ---------------- 三轴 → 机械数值 ---------------- */
  /* 节奏：快=帧数更短、前冲更多、硬直更短；慢=反之 */
  const PACE_FRAME = { F: 0.92, M: 1.00, S: 1.12 };
  const PACE_STEP = { F: 1.14, M: 1.00, S: 0.90 };
  const PACE_STUN = { F: 0.96, M: 1.00, S: 1.06 };
  /* 距离：短/中/长 的判定距离倍率 */
  const RANGE_REACH = { S: 0.94, M: 1.02, L: 1.20 };
  /* 分量：轻/中/重 的伤害、硬直、击退 */
  const WEIGHT_DMG = { L: 0.86, M: 1.00, H: 1.14 };
  const WEIGHT_STUN = { L: 0.92, M: 1.00, H: 1.08 };
  const WEIGHT_PUSH = { L: 0.94, M: 1.00, H: 1.10 };
  /* 连段内的段落权重：首段轻、末段（收尾）重 */
  const SEG_DMG = [0.96, 1.00, 1.08];
  /* 重级收尾把对手打飞一点（正传：重击把人打飞），轻级不收尾浮空 */
  const HEAVY_FINISH_LAUNCH = 5;
  const HEAVY_FINISH_PUSH = 8;

  const TRIPLE_RE = /^[FMS][SML][LMH]$/;
  const DEFAULT_TRIPLE = 'MMM';

  function tripleOf(spec) {
    const id = spec && spec.id;
    const t = id && MELEE[id];
    return TRIPLE_RE.test(t || '') ? t : DEFAULT_TRIPLE;
  }
  function comboSuffix(spec) {
    const t = tripleOf(spec);
    return t === DEFAULT_TRIPLE ? '' : '-' + t.toLowerCase();
  }
  /* 兼容旧接口：以三轴字符串作为「原型名」 */
  function archetypeOf(spec) { return tripleOf(spec); }

  const profileCache = new Map();
  function profileOf(spec) {
    const t = tripleOf(spec);
    if (profileCache.has(t)) return profileCache.get(t);
    const [p, r, w] = t.split('');
    const prof = {
      name: t, pace: p, range: r, weight: w,
      frameMul: PACE_FRAME[p], stepMul: PACE_STEP[p], paceStun: PACE_STUN[p],
      reachMul: RANGE_REACH[r],
      dmgMul: WEIGHT_DMG[w], weightStun: WEIGHT_STUN[w], pushMul: WEIGHT_PUSH[w],
      finisherLaunch: w === 'H' ? HEAVY_FINISH_LAUNCH : 0,
      finisherPush: w === 'H' ? HEAVY_FINISH_PUSH : 0
    };
    profileCache.set(t, prof);
    return prof;
  }

  /* 该身份在轻攻击链中使用的招式 id（非均衡三轴用带后缀的独立条目） */
  function segmentIds(spec) {
    const sfx = comboSuffix(spec);
    return ['punch1', 'punch2', 'kick'].map(b => b + sfx);
  }

  /* 把三轴应用到某一段轻攻击上。baseMove=默认该段数据，segIndex/segCount 决定段内权重与收尾 */
  function applyProfile(baseMove, segBase, spec, segIndex, segCount) {
    /* 「中中中」= 标准型：不加任何修正，直接沿用默认条目
       （默认 punch1/punch2/kick 的数值必须逐字节保持不变） */
    if (tripleOf(spec) === DEFAULT_TRIPLE) return {};
    const prof = profileOf(spec);
    const i = Number.isFinite(segIndex) ? segIndex : 0;
    const n = Number.isFinite(segCount) ? segCount : 3;
    const last = i === n - 1;
    const segW = SEG_DMG[Math.min(i, SEG_DMG.length - 1)];
    const out = {};
    if (baseMove.damage) out.damage = Math.max(1, Math.round(baseMove.damage * prof.dmgMul * segW));
    if (baseMove.reach) out.reach = Math.round(baseMove.reach * prof.reachMul);
    if (baseMove.step) out.step = Math.round(baseMove.step * prof.stepMul * 100) / 100;
    if (baseMove.stun) out.stun = Math.round(baseMove.stun * prof.paceStun * prof.weightStun * (last ? 1.06 : 1));
    if (baseMove.push) out.push = Math.max(1, Math.round(baseMove.push * prof.pushMul + (last ? prof.finisherPush : 0)));
    /* 帧数随节奏缩放：快节奏真的出手更快（at/end/frames 同步缩放，保持判定窗口比例） */
    if (prof.frameMul !== 1) {
      if (baseMove.frames) out.frames = Math.max(8, Math.round(baseMove.frames * prof.frameMul));
      if (baseMove.at) out.at = Math.max(2, Math.round(baseMove.at * prof.frameMul));
      if (baseMove.end) out.end = Math.max(3, Math.round(baseMove.end * prof.frameMul));
    }
    /* 重级收尾：轻微浮空，轻级收尾不给（正传里轻拳不打飞人） */
    if (last && prof.finisherLaunch) out.launch = Math.max(baseMove.launch || 0, prof.finisherLaunch);
    return out;
  }

  /* 给清单/调试用的可读标签 */
  const PACE_LABEL = { F: '快', M: '中', S: '慢' };
  const RANGE_LABEL = { S: '短', M: '中', L: '长' };
  const WEIGHT_LABEL = { L: '轻', M: '中', H: '重' };
  function meleeLabel(spec) {
    const [p, r, w] = tripleOf(spec).split('');
    return `${PACE_LABEL[p]}节奏 · ${RANGE_LABEL[r]}距离 · ${WEIGHT_LABEL[w]}分量`;
  }

  Object.assign(DV, {
    COMBO_MELEE: MELEE,
    COMBO_TRIPLE: MELEE,
    /* engine.js 在 Node 下用这个键判断 combos.js 是否已加载 */
    COMBO_PROFILES: MELEE,
    COMBO_PACE_FRAME: PACE_FRAME,
    COMBO_RANGE_REACH: RANGE_REACH,
    COMBO_WEIGHT_DMG: WEIGHT_DMG,
    archetypeOf, profileOf, applyProfile, segmentIds, comboSuffix, tripleOf, meleeLabel
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MELEE, tripleOf, comboSuffix, archetypeOf, profileOf, applyProfile, segmentIds, meleeLabel };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
