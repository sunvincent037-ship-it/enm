(function (root) {
  'use strict';

  // Identity order is the contract for the 10 × 5 generated portrait atlas.
  // Era/form slots are authored, not random variants; every exported slot is self-contained.
  const characters = [];
  const roster = [];
  const eraLabels = { DB: '龙珠', Z: '龙珠 Z', SUPER: '龙珠 超', GT: '龙珠 GT', DAIMA: '龙珠 DAIMA', MOVIE: '剧场 / 外传' };
  const BLACK = '#172037', GOLD = '#ffe568', BLUE = '#3ae0ff', RED = '#fa4766', SILVER = '#dceeff';
  const basic = {
    color: '#62cfff', skin: '#efb18b', hair: BLACK, outfit: '#ee772d', accent: '#245cad',
    species: 'human', silhouette: 'athletic', height: 1, head: 'spiky',
    cape: false, armor: false, tail: false, sword: false, horns: false, longHair: false,
    beard: false, glasses: false, hat: false, antenna: false, ears: false,
    beam: 'beam', stats: { health: 1035, speed: 314, power: 1.01 }
  };
  function F(id, form, era, superMove, look = {}, stats = {}) {
    return { id, form, era, superMove, ...look, stats };
  }
  function add(id, name, look, normal, superMove, assist, description, forms) {
    const portraitIndex = characters.length;
    const base = { ...basic, ...look, stats: { ...basic.stats, ...look.stats } };
    const identity = { ...base, id, name, portraitIndex, description, moves: { normal, super: superMove, assist } };
    characters.push(identity);
    for (const entry of forms) {
      const { id: suffix, superMove: special, stats, moves, ...traits } = entry;
      roster.push({ ...base, ...traits, id: `${id}-${suffix}`, characterId: id, name,
        portraitIndex, stats: { ...base.stats, ...stats },
        moves: { ...identity.moves, super: special || superMove, ...moves },
        description: entry.description || `${description} · ${entry.form}`
      });
    }
  }

  add('goku', '孙悟空', { species: 'saiyan' }, '龟仙流连击', '龟派气功', '瞬间移动追击', '以高速近身与龟派气功掌握攻防节奏', [
    F('kid', '少年篇 · 如意棒', 'DB', '少年龟派气功', { silhouette: 'small', height: .8, tail: true, outfit: '#d82f34', accent: '#163b8c', sword: true }, { health: 990, speed: 334, power: 0.97 }),
    F('early', 'Z 前期 · 龟仙流', 'Z', '元气弹', { beam: 'ball' }, { health: 1050, speed: 314, power: 1.01 }),
    F('kaioken', 'Z 前期 · 界王拳', 'Z', '界王拳龟派气功', { color: RED, skin: '#ed927d' }, { health: 1000, speed: 340, power: 1.06 }),
    F('ssj', 'Z 中期 · 超级赛亚人', 'Z', '愤怒龟派气功', { hair: GOLD, color: GOLD, outfit: '#ed6c28' }, { health: 1050, speed: 319, power: 1.05 }),
    F('ssj2', 'Z 后期 · 超级赛亚人2', 'Z', '瞬间移动龟派气功', { hair: '#ffef8a', color: '#a4dfff' }, { health: 1035, speed: 328, power: 1.05 }),
    F('ssj3', 'Z 后期 · 超级赛亚人3', 'Z', '超龟派气功', { hair: GOLD, color: '#ffc750', head: 'long', longHair: true }, { health: 1085, speed: 303, power: 1.08 }),
    F('god', '超 · 超级赛亚人之神', 'SUPER', '神之龟派气功', { hair: '#ee334f', color: RED, silhouette: 'slim' }, { health: 1015, speed: 336, power: 1.02 }),
    F('blue', '超 · 超级赛亚人蓝', 'SUPER', '神越龟派气功', { hair: BLUE, color: BLUE }, { health: 1060, speed: 327, power: 1.05 }),
    F('ultra', '超 · 自在极意功', 'SUPER', '极意龟派气功', { hair: SILVER, color: SILVER, outfit: '#ec752c', accent: '#253770', chest: '#efb18b' }, { health: 1000, speed: 348, power: 1.06 }),
    F('gt-kid', 'GT · 少年', 'GT', '逆转龟派气功', { silhouette: 'small', height: .82, outfit: '#4676bb', accent: '#e8ca58', tail: true }, { health: 990, speed: 336, power: 1 }),
    F('ssj4', 'GT · 超级赛亚人4', 'GT', '十倍龟派气功', { color: '#ff6545', outfit: '#ddb22f', accent: '#1c55b9', chest: '#bf2452', longHair: true, tail: true }, { health: 1115, speed: 306, power: 1.08 }),
    F('daima-mini', 'DAIMA · 迷你', 'DAIMA', '如意棒突击', { silhouette: 'small', height: .8, outfit: '#d97337', accent: '#214586', sword: true, beam: 'rush' }, { health: 985, speed: 342, power: 0.98 }),
    F('daima-ssj4', 'DAIMA · 超级赛亚人4', 'DAIMA', '魔界决战龟派气功', { hair: '#e33a66', color: '#ff557e', outfit: '#df842c', chest: '#c62857', tail: true, longHair: true }, { health: 1110, speed: 311, power: 1.08 })
  ]);
  add('vegeta', '贝吉塔', { species: 'saiyan', outfit: '#2549a2', accent: '#f4f3e9', armor: true, head: 'spiky', height: .96 }, '王子猛攻', '伽力克炮', '连续能量弹', '爆发火力与王子式近身压制', [
    F('scouter', 'Z 前期 · 战斗服', 'Z', '伽力克炮', { color: '#c96dff', tail: true, scouter: true, accent: '#d5bb7d' }, { health: 1065, speed: 306, power: 1.03 }),
    F('ssj', 'Z 中期 · 超级赛亚人', 'Z', '大爆炸攻击', { hair: GOLD, color: GOLD, beam: 'ball' }, { health: 1060, speed: 317, power: 1.03 }),
    F('super', 'Z 中期 · 超级贝吉塔', 'Z', '终极闪光', { hair: GOLD, color: '#ffd849', silhouette: 'heavy' }, { health: 1135, speed: 289, power: 1.09 }),
    F('majin', 'Z 后期 · 魔人贝吉塔', 'Z', '最终爆发', { armor: false, hair: GOLD, color: '#ffcd55', beam: 'ball', mark: 'M' }, { health: 1100, speed: 312, power: 1.06 }),
    F('god', '超 · 超级赛亚人之神', 'SUPER', '神之伽力克炮', { hair: '#d62b4a', color: RED, silhouette: 'slim' }, { health: 1015, speed: 335, power: 1.03 }),
    F('blue', '超 · 超级赛亚人蓝', 'SUPER', '终极闪光·蓝', { hair: BLUE, color: BLUE }, { health: 1075, speed: 323, power: 1.06 }),
    F('ssj4', 'GT · 超级赛亚人4', 'GT', '终极闪耀攻击', { armor: false, tail: true, longHair: true, hair: '#37251f', outfit: '#223954', chest: '#bc315f', color: '#ef4858', beam: 'ball' }, { health: 1125, speed: 306, power: 1.08 }),
    F('daima-mini', 'DAIMA · 迷你', 'DAIMA', '迷你伽力克炮', { armor: false, silhouette: 'small', height: .8, outfit: '#273958' }, { health: 1000, speed: 337, power: 1 }),
    F('daima-ssj3', 'DAIMA · 超级赛亚人3', 'DAIMA', '魔界终极闪光', { armor: false, silhouette: 'small', height: .86, hair: GOLD, color: GOLD, longHair: true, head: 'long' }, { health: 1065, speed: 317, power: 1.07 })
  ]);
  add('gohan', '孙悟饭', { species: 'hybrid', outfit: '#593c9c', accent: '#cf394b' }, '魔族流连击', '魔闪光', '愤怒追击', '继承魔族流训练与赛亚人潜力', [
    F('kid', 'Z 前期 · 幼年', 'Z', '愤怒魔闪光', { silhouette: 'small', height: .8, head: 'round', hair: '#182136', tail: true }, { health: 1000, speed: 318, power: 1.01 }),
    F('teen-ssj', 'Z 中期 · 少年超赛', 'Z', '魔闪光', { silhouette: 'small', height: .9, hair: GOLD, color: GOLD, cape: true }, { health: 1035, speed: 328, power: 1.03 }),
    F('teen-ssj2', 'Z 中期 · 少年超赛2', 'Z', '父子龟派气功', { silhouette: 'small', height: .91, hair: GOLD, color: '#ade7ff' }, { health: 1040, speed: 327, power: 1.07 }),
    F('adult-ssj', 'Z 后期 · 青年超赛', 'Z', '超级魔闪光', { hair: GOLD, color: GOLD, outfit: '#222d43', accent: '#f67b29' }, { health: 1060, speed: 316, power: 1.05 }),
    F('ultimate', 'Z 后期 · 潜能解放', 'Z', '爆裂冲击', { outfit: '#ed7b30', accent: '#265fbb', color: '#efefff', beam: 'rush' }, { health: 1090, speed: 321, power: 1.06 }),
    F('future', 'Z 外传 · 未来超赛', 'Z', '单手龟派气功', { hair: GOLD, color: GOLD, outfit: '#e78332', accent: '#264d99', scar: true }, { health: 1025, speed: 317, power: 1.08 }),
    F('beast', '超 · 野兽悟饭', 'SUPER', '魔贯光杀炮', { hair: '#e5e3f5', color: '#d08bff', head: 'spiky', height: 1.08 }, { health: 1075, speed: 311, power: 1.1 })
  ]);
  add('piccolo', '比克', { species: 'namekian', skin: '#77b958', hair: '#2c552b', outfit: '#66508c', accent: '#f7f3e1', head: 'bald', antenna: true, cape: true, height: 1.13 }, '魔族连击', '魔贯光杀炮', '魔空包围弹', '以伸缩攻击与集中贯穿炮控制距离', [
    F('z', 'Z · 魔族战士', 'Z', '魔贯光杀炮', {}, { health: 1100, speed: 306, power: 1.05 }),
    F('fused', 'Z · 神与魔王融合', 'Z', '激烈光弹', { cape: false, color: '#8df4ba' }, { health: 1135, speed: 300, power: 1.06 }),
    F('orange', '超 · 橙色比克', 'SUPER', '橙色魔族强袭', { cape: false, skin: '#e49c37', silhouette: 'heavy', height: 1.22, color: '#ffb350', beam: 'rush' }, { health: 1200, speed: 283, power: 1.09 })
  ]);
  add('krillin', '克林', { head: 'bald', height: .88, silhouette: 'small', color: '#ffe968' }, '多林寺连击', '气圆斩', '扩散龟派气功', '小体型武道家，气圆斩突破直线防守', [F('z', 'Z · 地球战士', 'Z', '气圆斩', { beam: 'ball' }, { health: 1000, speed: 333, power: 1 })]);
  add('yamcha', '雅木茶', { head: 'long', longHair: true, scar: true, outfit: '#dc692e', color: '#68e2d5' }, '狼牙风风拳', '操气弹', '狼牙旋风', '狼牙拳接操气弹形成追击', [F('z', 'Z · 龟仙流', 'Z', '操气弹', { beam: 'ball' }, { health: 1010, speed: 330, power: 1 })]);
  add('tien', '天津饭', { head: 'bald', thirdEye: true, outfit: '#3b9670', accent: '#b54139', chest: '#e4ae85', height: 1.06, color: '#fff0a1' }, '鹤仙流四身拳', '新气功炮', '洞洞波', '三目武道家的气功炮牵制', [F('z', 'Z · 鹤仙流', 'Z', '新气功炮', {}, { health: 1050, speed: 306, power: 1.08 })]);
  add('chiaotzu', '饺子', { head: 'round', hat: true, skin: '#eeeae5', outfit: '#526957', accent: '#bd3c38', silhouette: 'small', height: .8, color: '#efb0ff' }, '鹤仙拳', '洞洞波', '超能力束缚', '超能力与洞洞波协助压制', [F('z', 'Z · 超能力', 'Z', '洞洞波', {}, { health: 950, speed: 339, power: 0.99 })]);
  add('roshi', '龟仙人', { head: 'bald', beard: true, glasses: true, hair: '#f5f4eb', outfit: '#e7af3f', accent: '#603960', silhouette: 'heavy', height: .94, color: '#b0edff' }, '醉拳', '万国惊天掌', '龟派气功', '龟仙流宗师，招式变化丰富', [F('max', '龙珠 · 最大功率', 'DB', '最大龟派气功', { chest: '#e7b18b' }, { health: 1065, speed: 291, power: 1.07 })]);
  add('bulma', '布尔玛', { head: 'bob', hair: '#59d8d1', outfit: '#d8699b', accent: '#f7e8d0', silhouette: 'slim', color: '#4cf2d7', beam: 'ball', stats: { health: 950, speed: 331, power: 0.96 } }, '胶囊工具连击', '胶囊火力支援', '万能胶囊投掷', '以万能胶囊装备参与的娱乐对战席位，招式为本作改编', [F('adventure', '龙珠 · 冒险装备', 'DB', '胶囊火力支援')]);
  add('chichi', '琪琪', { head: 'long', longHair: true, outfit: '#3059a0', accent: '#d94869', silhouette: 'slim', color: '#ffa8bd', beam: 'rush' }, '牛魔流掌击', '武道会突进连打', '旋风飞踢', '天下一武道会时期的近身武术，招式名称为本作改编', [F('tournament', '龙珠 · 第23届武道会', 'DB', '武道会突进连打', {}, { health: 1010, speed: 334, power: 0.98 })]);
  add('goten', '孙悟天', { species: 'hybrid', silhouette: 'small', height: .8, color: GOLD }, '少年突击', '龟派气功', '兄弟追击', '小体型赛亚人，以灵活连击接气功', [F('ssj', 'Z · 超级赛亚人', 'Z', '龟派气功', { hair: GOLD }, { health: 985, speed: 340, power: 1 })]);
  add('future-trunks', '未来特兰克斯', { species: 'hybrid', head: 'bob', hair: '#b8a1e6', outfit: '#536eb1', accent: '#cb573a', sword: true, color: '#a9d9ff' }, '剑术连斩', '燃烧攻击', '闪光热波', '背负未来的剑士，剑击接远程爆发', [
    F('sword', 'Z · 未来剑士', 'Z', '燃烧攻击', { beam: 'ball' }, { health: 1035, speed: 325, power: 1.03 }),
    F('ssj', 'Z · 超级赛亚人', 'Z', '闪光热波', { hair: GOLD, head: 'spiky', color: GOLD }, { health: 1040, speed: 324, power: 1.05 }),
    F('super', 'Z · 超级特兰克斯', 'Z', '终极破坏炮', { hair: GOLD, head: 'spiky', armor: true, sword: false, outfit: '#284b86', accent: '#f2edcf', silhouette: 'heavy', color: '#ffdd6a' }, { health: 1150, speed: 283, power: 1.09 }),
    F('rage', '超 · 愤怒超级赛亚人', 'SUPER', '希望之剑', { hair: GOLD, head: 'spiky', outfit: '#647baa', accent: '#c73f38', color: '#8de8ff', beam: 'rush' }, { health: 1075, speed: 319, power: 1.07 })
  ]);
  add('trunks', '特兰克斯', { species: 'hybrid', silhouette: 'small', height: .81, head: 'bob', hair: '#bca7e2', outfit: '#46876d', accent: '#d48e3b', color: '#efcfff' }, '淘气连击', '双手破坏炮', '高速飞踢', '现时空的少年特兰克斯，与未来剑士分列身份', [F('kid', 'Z · 少年', 'Z', '双手破坏炮', {}, { health: 990, speed: 338, power: 1 })]);
  add('gotenks', '悟天克斯', { species: 'hybrid', silhouette: 'small', height: .86, outfit: '#f1eae0', accent: '#c99739', color: '#fbe56c' }, '银河甜甜圈连击', '超级幽灵神风拳', '连续死死导弹', '融合少年的奇招与幽灵攻击', [
    F('base', 'Z · 融合', 'Z', '银河甜甜圈', { beam: 'ball' }, { health: 1010, speed: 335, power: 1.01 }),
    F('ssj', 'Z · 超级赛亚人', 'Z', '超级幽灵神风拳', { hair: GOLD, beam: 'ball' }, { health: 1025, speed: 333, power: 1.05 }),
    F('ssj3', 'Z · 超级赛亚人3', 'Z', '超强龟派气功', { hair: GOLD, head: 'long', longHair: true, color: '#fff0a1' }, { health: 1065, speed: 317, power: 1.08 })
  ]);
  add('vegito', '贝吉特', { species: 'saiyan', outfit: '#315aae', accent: '#ee752b', earrings: true }, '完美融合连击', '最终龟派气功', '气剑追击', '耳环合体战士的高速压制与气剑', [
    F('base', 'Z · 耳环合体', 'Z', '大爆炸攻击', { beam: 'ball', color: '#a6bfff' }, { health: 1085, speed: 318, power: 1.05 }),
    F('ssj', 'Z · 超级贝吉特', 'Z', '精神之剑', { hair: GOLD, color: GOLD, beam: 'rush', sword: true }, { health: 1100, speed: 317, power: 1.06 }),
    F('blue', '超 · 超级赛亚人蓝', 'SUPER', '最终龟派气功', { hair: BLUE, color: BLUE }, { health: 1090, speed: 321, power: 1.08 })
  ]);
  add('gogeta', '悟吉塔', { species: 'saiyan', outfit: '#eee7d8', accent: '#e5a834', vest: true, color: GOLD }, '融合猛袭', '大爆炸龟派气功', '灵魂惩罚者', '舞步融合战士以迅猛突进终结连击', [
    F('super', '剧场 · 超级悟吉塔', 'MOVIE', '灵魂惩罚者', { hair: GOLD, beam: 'ball' }, { health: 1075, speed: 325, power: 1.06 }),
    F('base', '超 · 常态融合', 'SUPER', '星尘射击', { color: '#c5e9ff', beam: 'ball' }, { health: 1060, speed: 331, power: 1.03 }),
    F('blue', '超 · 超级赛亚人蓝', 'SUPER', '究极龟派气功', { hair: BLUE, color: BLUE }, { health: 1075, speed: 327, power: 1.08 }),
    F('ssj4', 'GT · 超级赛亚人4', 'GT', '百倍大爆炸龟派气功', { hair: '#da3e36', color: '#ff6d5d', longHair: true, tail: true, chest: '#ca3457', accent: '#2c72c5' }, { health: 1135, speed: 305, power: 1.1 })
  ]);
  add('bardock', '巴达克', { species: 'saiyan', armor: true, outfit: '#37684e', accent: '#a92e37', tail: true, headband: '#b3323e', scar: true, color: '#83d4ff' }, '反抗连拳', '最终精神炮', '叛逆突击', '赛亚人战士以近身冲锋接最后一击', [F('z', 'Z 外传 · 最后的反抗', 'Z', '最终精神炮', { beam: 'ball' }, { health: 1085, speed: 316, power: 1.03 })]);
  add('raditz', '拉蒂兹', { species: 'saiyan', armor: true, tail: true, head: 'long', longHair: true, height: 1.12, outfit: '#342e3a', accent: '#b49356', color: '#b97af3', scouter: true }, '赛亚人连打', '双手能量波', '周日爆发', '长发与尾巴形成鲜明轮廓的赛亚人战士', [F('z', 'Z · 赛亚人来袭', 'Z', '双手能量波', {}, { health: 1085, speed: 307, power: 1.03 })]);
  add('nappa', '那巴', { species: 'saiyan', head: 'bald', silhouette: 'heavy', height: 1.2, armor: true, tail: true, outfit: '#3c3340', accent: '#a88746', color: '#f1cb71', beard: true }, '重装猛击', '巨人风暴', '口中气功波', '以厚重体格和大范围气爆施压', [F('z', 'Z · 赛亚人精英', 'Z', '巨人风暴', { beam: 'ball' }, { health: 1190, speed: 282, power: 1.07 })]);
  add('frieza', '弗利萨', { species: 'frost', skin: '#f0e8f3', hair: '#985bc2', outfit: '#eee4ef', accent: '#9457bc', head: 'helmet', tail: true, color: '#db91ff', height: .97 }, '帝王连击', '死亡光束', '死亡光盘', '精准光束与尾击构成帝王式压制', [
    F('first', 'Z · 第一形态', 'Z', '超新星', { armor: true, horns: true, silhouette: 'small', height: .83, skin: '#dfb3c3', accent: '#a87954', beam: 'ball' }, { health: 1035, speed: 318, power: 1.02 }),
    F('final', 'Z · 最终形态', 'Z', '死亡光束', {}, { health: 1065, speed: 324, power: 1.04 }),
    F('full', 'Z · 百分百力量', 'Z', '死亡能量弹', { silhouette: 'heavy', color: '#e19cf6', beam: 'ball' }, { health: 1160, speed: 291, power: 1.09 }),
    F('golden', '超 · 黄金弗利萨', 'SUPER', '黄金死亡光束', { skin: '#e8bf4f', outfit: '#e2af3b', accent: '#7e40a7', color: '#ffe16a' }, { health: 1065, speed: 323, power: 1.07 })
  ]);
  add('cell', '沙鲁', { species: 'cell', skin: '#6aaa42', hair: '#20372e', outfit: '#548d37', accent: '#353553', head: 'helmet', horns: true, tail: true, armor: true, height: 1.13, color: '#b5f15d' }, '生化连击', '龟派气功', '太阳拳追击', '融合战士细胞的人工生命体', [
    F('first', 'Z · 第一形态', 'Z', '生体能量吸收', { silhouette: 'slim', beam: 'rush' }, { health: 1100, speed: 306, power: 1.03 }),
    F('perfect', 'Z · 完全体', 'Z', '完美龟派气功', { tail: false, silhouette: 'athletic', skin: '#a9b885' }, { health: 1125, speed: 306, power: 1.06 }),
    F('super-perfect', 'Z · 超完全体', 'Z', '太阳系龟派气功', { tail: false, silhouette: 'heavy', color: '#d4e8ff', accent: '#534481' }, { health: 1150, speed: 294, power: 1.1 })
  ]);
  add('buu', '魔人布欧', { species: 'majin', skin: '#ed9fb9', hair: '#d9789d', outfit: '#f5ece4', accent: '#76569e', head: 'antenna', antenna: true, color: '#ffa2da' }, '魔人橡皮拳', '巧克力光线', '魔人气弹', '身体伸缩与魔法气功的多形态魔人', [
    F('fat', 'Z · 善良布欧', 'Z', '愤怒爆发', { silhouette: 'heavy', height: 1.09, cape: true, beam: 'ball' }, { health: 1200, speed: 280, power: 1.05 }),
    F('super', 'Z · 超级布欧', 'Z', '人类灭绝攻击', { silhouette: 'athletic', height: 1.18, beam: 'ball' }, { health: 1150, speed: 300, power: 1.06 }),
    F('gohan', 'Z · 悟饭吸收', 'Z', '超级龟派气功', { silhouette: 'athletic', height: 1.17, outfit: '#e07732', accent: '#2955a8' }, { health: 1135, speed: 307, power: 1.08 }),
    F('kid', 'Z · 纯粹布欧', 'Z', '星球爆破弹', { silhouette: 'small', height: .88, beam: 'ball', color: '#ff74d0' }, { health: 1075, speed: 337, power: 1.04 })
  ]);
  add('android17', '人造人17号', { species: 'android', head: 'bob', outfit: '#28394c', accent: '#d68232', color: '#81ddc8', silhouette: 'slim' }, '人造人连击', '超电压爆破', '能量屏障冲击', '无限能源战士的屏障与精确连击', [F('ranger', '超 · 自然保护官', 'SUPER', '超电压爆破', { outfit: '#66836a', accent: '#f4f0dc', beam: 'ball' }, { health: 1065, speed: 323, power: 1.03 })]);
  add('android18', '人造人18号', { species: 'android', head: 'bob', hair: '#e8cf77', outfit: '#527ead', accent: '#2e3546', color: '#ffde7a', silhouette: 'slim' }, '优雅连踢', '无限能量弹', '破坏光盘', '冷静的连续踢击衔接人造人火力', [F('z', 'Z · 人造人篇', 'Z', '无限能量弹', { beam: 'ball' }, { health: 1040, speed: 328, power: 1.03 })]);
  add('android16', '人造人16号', { species: 'android', head: 'mohawk', hair: '#c86837', outfit: '#438456', accent: '#292d39', armor: true, silhouette: 'heavy', height: 1.25, color: '#bcf49a' }, '机械重拳', '地狱闪光', '火箭飞拳', '高防护机械躯体搭配双臂重炮', [F('z', 'Z · 温柔的巨人', 'Z', '地狱闪光', {}, { health: 1200, speed: 280, power: 1.08 })]);
  add('android21', '人造人21号', { origin: 'GAME', species: 'majin', skin: '#eaa3bb', hair: '#f3e9e7', outfit: '#efe7e0', accent: '#382934', head: 'long', longHair: true, tail: true, silhouette: 'slim', color: '#f591da' }, '魔人甜蜜连击', '饥饿光束', '绝妙全餐', '《龙珠 FighterZ》原创角色，归入剧场／外传筛选', [F('majin', '游戏外传 · 魔人形态', 'MOVIE', '饥饿光束', {}, { health: 1075, speed: 321, power: 1.03 })]);
  add('beerus', '比鲁斯', { species: 'god', skin: '#a285c2', hair: '#8864ab', outfit: '#4a8cc1', accent: '#edd087', head: 'bald', ears: true, tail: true, silhouette: 'slim', height: 1.11, color: '#c682ff', beam: 'ball' }, '破坏神掌击', '破坏神之怒', '破坏能量弹', '紫色破坏能量与敏捷掌击', [F('super', '超 · 第7宇宙破坏神', 'SUPER', '破坏神之怒', {}, { health: 1065, speed: 321, power: 1.08 })]);
  add('whis', '维斯', { species: 'angel', skin: '#abd5e8', hair: '#f5f1e9', outfit: '#8a3b52', accent: '#6dd8df', head: 'swept', silhouette: 'slim', height: 1.23, staff: true, color: '#c6f3ff', beam: 'rush' }, '天使杖术', '天使演武', '神速点破', '天使教练以权杖与轻巧步伐演武', [F('super', '超 · 天使', 'SUPER', '天使演武', {}, { health: 1015, speed: 348, power: 1.03 })]);
  add('broly', '布罗利', { species: 'saiyan', silhouette: 'heavy', height: 1.28, hair: '#b8ed78', outfit: '#ece7df', accent: '#9d334b', chest: '#e9ba8d', color: '#a2ff65' }, '狂暴重击', '巨量流星', '爆发能量波', '巨大体格与强烈绿色气焰的赛亚人', [
    F('z', 'Z 剧场 · 传说超级赛亚人', 'MOVIE', '巨量流星', { beam: 'ball', necklace: true }, { health: 1200, speed: 280, power: 1.1 }),
    F('wrath', '超 · 怒形态', 'SUPER', '愤怒咆哮', { hair: BLACK, outfit: '#3a3465', accent: '#82a950', color: '#b2ec8a', beam: 'rush', height: 1.19 }, { health: 1160, speed: 290, power: 1.07 }),
    F('full', '超 · 全力超级赛亚人', 'SUPER', '全力巨量流星', { hair: '#c9f28a', outfit: '#42346d', accent: '#7baa49', beam: 'ball', color: '#b9ff6b' }, { health: 1200, speed: 282, power: 1.1 })
  ]);
  add('cooler', '古拉', { species: 'frost', skin: '#766bb0', hair: '#e7e6ee', outfit: '#d9dbe5', accent: '#5b5299', head: 'helmet', horns: true, tail: true, silhouette: 'heavy', height: 1.18, color: '#be8fe9' }, '冷酷连击', '超新星', '死亡追击', '弗利萨的兄长，以最终形态迎战', [F('final', '剧场 · 最终形态', 'MOVIE', '超新星', { beam: 'ball' }, { health: 1160, speed: 291, power: 1.08 })]);
  add('janemba', '邪念波', { species: 'demon', skin: '#d74862', hair: '#6d4599', outfit: '#6d4691', accent: '#bd83bd', head: 'helmet', horns: true, tail: true, sword: true, height: 1.14, color: '#e972dd', beam: 'rush' }, '魔剑连斩', '地狱魔剑', '空间突袭', '地狱邪气凝成的魔剑战士', [F('super', '剧场 · 超级邪念波', 'MOVIE', '地狱魔剑', {}, { health: 1100, speed: 317, power: 1.06 })]);
  add('hit', '希特', { species: 'alien', skin: '#a68cba', hair: '#836b9d', outfit: '#4c4369', accent: '#8f81a5', head: 'bald', silhouette: 'slim', height: 1.09, color: '#b893ff', beam: 'rush' }, '杀手连拳', '闪时·杀击', '闪时追击', '第6宇宙杀手，以闪时印象表现高速突袭', [F('super', '超 · 传说杀手', 'SUPER', '闪时·杀击', {}, { health: 1010, speed: 345, power: 1.05 })]);
  add('jiren', '吉连', { species: 'alien', skin: '#b8b7c2', hair: '#5b6073', outfit: '#c83144', accent: '#20283b', head: 'bald', silhouette: 'heavy', height: 1.2, color: '#ff6947' }, '绝对力量连击', '力量冲击', '炽热磁星', '力量大会中的灰色战士，以纯粹力量施压', [F('full', '超 · 全力吉连', 'SUPER', '力量冲击', { chest: '#b8b7c2', beam: 'ball' }, { health: 1185, speed: 289, power: 1.1 })]);
  add('kefla', '开芙拉', { species: 'saiyan', hair: '#b7ee7b', outfit: '#b92f70', accent: '#e9d197', head: 'spiky', silhouette: 'slim', earrings: true, color: '#b5ff78' }, '爆裂融合连击', '巨量爆裂射线', '雷霆光束', '第6宇宙女赛亚人的耳环融合', [F('ssj2', '超 · 超级赛亚人2', 'SUPER', '巨量爆裂射线', {}, { health: 1050, speed: 333, power: 1.05 })]);
  add('cabba', '加贝', { species: 'saiyan', silhouette: 'slim', height: .92, armor: true, outfit: '#4c6fa0', accent: '#c39a6b', color: GOLD }, '沙拉达连击', '伽力克炮', '赛亚人突进', '第6宇宙沙拉达战士，灵活使用能量炮', [F('ssj', '超 · 超级赛亚人', 'SUPER', '伽力克炮', { hair: GOLD }, { health: 990, speed: 339, power: 1 })]);
  add('caulifla', '卡莉芙拉', { species: 'saiyan', hair: GOLD, outfit: '#9d3c72', accent: '#423767', silhouette: 'slim', color: '#ffe887' }, '不良少女连拳', '粉碎加农炮', '爆裂能量弹', '第6宇宙的天才赛亚人，以积极突进抢攻', [F('ssj2', '超 · 超级赛亚人2', 'SUPER', '粉碎加农炮', { beam: 'ball' }, { health: 1010, speed: 341, power: 1.01 })]);
  add('kale', '开尔', { species: 'saiyan', hair: '#b8e979', outfit: '#b3445a', accent: '#dfa63f', silhouette: 'heavy', height: 1.18, color: '#b6ff80' }, '狂战士重击', '巨量冲击', '狂暴追击', '失控力量化为绿色气焰的第6宇宙赛亚人', [F('berserk', '超 · 狂暴超级赛亚人', 'SUPER', '巨量冲击', { beam: 'ball' }, { health: 1165, speed: 289, power: 1.08 })]);
  add('goku-black', '黑悟空', { species: 'saiyan', outfit: '#35354a', accent: '#c33f5c', earrings: true, color: '#c67ff3' }, '神罚连击', '黑色龟派气功', '神裂斩', '夺取悟空身体的扎马斯，以气刃施行神罚', [
    F('base', '超 · 黑悟空', 'SUPER', '黑色龟派气功', {}, { health: 1050, speed: 323, power: 1.03 }),
    F('rose', '超 · 超级赛亚人桃红', 'SUPER', '神裂演武斩', { hair: '#f29bbd', color: '#f58fca', sword: true, beam: 'rush' }, { health: 1060, speed: 328, power: 1.06 })
  ]);
  add('zamasu', '扎马斯', { species: 'god', skin: '#8cbc91', hair: '#f0ece3', head: 'swept', outfit: '#665076', accent: '#bd744b', earrings: true, color: '#d595f3' }, '界王神掌击', '神圣逆鳞', '神裂斩', '第10宇宙界王神候补与其合体形态', [
    F('base', '超 · 不死之身', 'SUPER', '神圣逆鳞', { beam: 'ball' }, { health: 1135, speed: 305, power: 1.01 }),
    F('fused', '超 · 合体扎马斯', 'SUPER', '绝对雷霆', { outfit: '#423b5b', accent: '#b53940', color: '#ead5ff', height: 1.11, halo: true }, { health: 1150, speed: 300, power: 1.08 })
  ]);
  add('baby', '贝比', { species: 'android', skin: '#c6bec9', hair: '#eee9ed', head: 'swept', outfit: '#454662', accent: '#d9bc64', armor: true, height: 1.08, color: '#beb6ff' }, '寄生连击', '复仇死亡弹', '复仇终极闪光', '寄生贝吉塔后的兹夫尔人复仇者', [F('super2', 'GT · 超级贝比2', 'GT', '复仇死亡弹', { beam: 'ball' }, { health: 1125, speed: 303, power: 1.07 })]);
  add('super17', '超级17号', { species: 'android', head: 'long', longHair: true, outfit: '#35414f', accent: '#ce9437', silhouette: 'slim', height: 1.16, color: '#ffb76f' }, '地狱连击', '电击地狱弹', '地狱风暴', '两个17号合体而成的高大人造人', [F('gt', 'GT · 地狱合体', 'GT', '电击地狱弹', { beam: 'ball' }, { health: 1140, speed: 300, power: 1.06 })]);
  add('omega-shenron', '超级一星龙', { species: 'dragon', skin: '#dbdddc', hair: '#253541', outfit: '#e4e5dd', accent: '#244a68', head: 'helmet', horns: true, silhouette: 'heavy', height: 1.27, armor: true, color: '#e77975' }, '邪龙重击', '负向能源球', '龙雷暴', '吸收七颗邪恶龙珠的最终邪龙', [F('gt', 'GT · 邪恶龙之力', 'GT', '负向能源球', { beam: 'ball' }, { health: 1200, speed: 280, power: 1.1 })]);
  add('pan', '小芳', { species: 'hybrid', silhouette: 'small', height: .8, head: 'bob', hat: true, outfit: '#d95140', accent: '#dc9c38', color: '#ffa879' }, '少女飞踢', '少女龟派气功', '空中突击', 'GT 冒险时期的小芳，以轻快拳脚作战', [F('gt', 'GT · 宇宙冒险', 'GT', '少女龟派气功', {}, { health: 965, speed: 344, power: 0.99 })]);
  add('uub', '欧布', { species: 'human', skin: '#a86d49', head: 'mohawk', outfit: '#d9b337', accent: '#e7e1d5', color: '#eedb8a', height: .98 }, '转生武道连击', '巧克力光线', '气功连射', '与善良布欧融合后的地球武道家', [F('majuub', 'GT · 超级欧布', 'GT', '巧克力光线', {}, { health: 1100, speed: 313, power: 1.05 })]);
  add('hercule', '撒旦', { head: 'round', hair: '#27252f', outfit: '#793d38', accent: '#e9c686', beard: true, silhouette: 'heavy', height: 1.06, color: '#ffd488', beam: 'rush' }, '冠军连拳', '炸裂撒旦拳', '礼物炸弹', '世界冠军的夸张表演与格斗技巧', [F('z', 'Z · 世界冠军', 'Z', '炸裂撒旦拳', {}, { health: 1035, speed: 299, power: 0.97 })]);
  add('videl', '比迪丽', { silhouette: 'slim', head: 'bob', outfit: '#ece7d7', accent: '#765090', color: '#edc9ff', beam: 'rush' }, '正义连踢', '鹰击突袭', '腾空连打', '撒旦之女，以地球武术与舞空术进攻', [F('z', 'Z · 武道会', 'Z', '鹰击突袭', {}, { health: 990, speed: 337, power: 0.99 })]);
  add('dabura', '达普拉', { species: 'demon', skin: '#cc7777', hair: '#31273c', head: 'swept', horns: true, cape: true, sword: true, beard: true, outfit: '#4276a2', accent: '#e9e3d8', height: 1.16, color: '#d899f7', beam: 'rush' }, '魔王剑术', '暗黑魔剑', '魔界火焰', '魔界之王的剑术与魔炎', [F('z', 'Z · 魔界之王', 'Z', '暗黑魔剑', {}, { health: 1125, speed: 298, power: 1.07 })]);
  add('moro', '魔罗', { species: 'demon', skin: '#71aeb5', hair: '#eee7d8', head: 'bald', horns: true, beard: true, cape: true, outfit: '#604e52', accent: '#d0b481', silhouette: 'heavy', height: 1.19, color: '#70e4d1', origin: 'MANGA' }, '魔力重击', '星球能量爆发', '魔力吸收', '《龙珠 超》漫画银河巡警囚犯篇的食星魔物', [F('planet-eater', '超漫画 · 食星者', 'SUPER', '星球能量爆发', { beam: 'ball' }, { health: 1165, speed: 284, power: 1.08 })]);
  add('yajirobe', '亚奇洛贝', { head: 'long', longHair: true, sword: true, outfit: '#bc673b', accent: '#473e55', silhouette: 'heavy', height: .93, color: '#e8c080', beam: 'rush' }, '野武士斩击', '居合一闪', '背后斩击', '携带武士刀的山林武人，以刀术接近对手', [F('db', '龙珠 · 流浪剑客', 'DB', '居合一闪', {}, { health: 1100, speed: 290, power: 1.02 })]);

  const stages = [
    { id: 'tournament', name: '天下一武道会', subtitle: '武道家云集的决胜擂台', color: '#ffd074', sky: ['#65b1ed','#d2edee'], ground: ['#e5d4ac','#bba17a'], kind: 'tournament' },
    { id: 'namek', name: '那美克星', subtitle: '绿天穹下的蓝色草原', color: '#61e4c4', sky: ['#348f8c','#9adfb9'], ground: ['#57aaaf','#346f89'], kind: 'namek' },
    { id: 'chamber', name: '精神时光屋', subtitle: '纯白空间中的极限修行', color: '#e6e5ff', sky: ['#e7eaf8','#ffffff'], ground: ['#ece9f3','#cfcede'], kind: 'chamber' },
    { id: 'wasteland', name: '西部荒野', subtitle: '碎岩与峡谷间的宿命对决', color: '#f4b178', sky: ['#5293c8','#b3c4bc'], ground: ['#ba8954','#785941'], kind: 'wasteland' },
    { id: 'cell', name: '沙鲁游戏', subtitle: '寂静石台上的地球决战', color: '#b2e785', sky: ['#78acd0','#cedddd'], ground: ['#c0bba8','#888779'], kind: 'cell' },
    { id: 'kai', name: '界王星', subtitle: '十倍重力下的圆形小行星', color: '#c3a9ff', sky: ['#7669b5','#c3a7dd'], ground: ['#8cbd75','#54764e'], kind: 'kai' },
    { id: 'kame', name: '龟仙屋', subtitle: '碧海小岛与最初的修行', color: '#65def5', sky: ['#54b2eb','#ccedf4'], ground: ['#efdbaf','#c4a576'], kind: 'kame' },
    { id: 'void', name: '力量大会', subtitle: '无之界中的宇宙生存战', color: '#c392fc', sky: ['#15152c','#463660'], ground: ['#827987','#494556'], kind: 'void' }
  ];

  const data = { characters, roster, stages, eraLabels };
  root.DV = Object.assign(root.DV || {}, data);
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : window);
