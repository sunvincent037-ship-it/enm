(function(root){
 'use strict';const DV=root.DV=root.DV||{};
 // Explicit matches checked against speech from this MOD-CH ISO. A missing
 // match uses the current character's neutral power shout, never another skill.
 const map={};function bind(id,bank,line,names){map[id]||={};for(const name of names)map[id][name]=bank+'/line-'+line;}
 bind('goku-kid','ch-011',587,['少年龟派气功','龟派气功']);
 bind('goku-early','ch-000',587,['龟派气功']);
 bind('goku-early','ch-000',583,['界王拳']);
 bind('goku-kaioken','ch-000',587,['界王拳龟派气功','龟派气功']);
 bind('goku-gt-kid','ch-007',587,['逆转龟派气功','龟派气功']);
 bind('goku-ssj4','ch-010',587,['十倍龟派气功']);
 bind('vegeta-scouter','ch-029',587,['伽力克炮','加利克炮','加力克炮']);
 bind('vegeta-ssj','ch-032',592,['大爆炸攻击']);
 bind('vegeta-super','ch-033',592,['终极闪光','最终闪光']);
 bind('vegeta-ssj4','ch-038',592,['终极闪耀攻击']);
 bind('gohan-kid','ch-013',587,['愤怒魔闪光','魔闪光']);
 bind('gohan-adult-ssj','ch-018',587,['超级魔闪光','魔闪光']);
 bind('piccolo-z','ch-023',587,['魔贯光杀炮']);
 bind('piccolo-fused','ch-023',587,['魔贯光杀炮']);
 bind('yamcha-z','ch-026',591,['操气弹']);
 bind('yamcha-z','ch-026',589,['狼牙风风拳']);
 bind('tien-z','ch-027',591,['新气功炮']);
 bind('tien-z','ch-027',589,['气功炮']);
 bind('chiaotzu-z','ch-028',587,['洞洞波']);
 bind('roshi-max','ch-067',587,['最大龟派气功','龟派气功']);
 bind('goten-ssj','ch-047',587,['龟派气功']);
 bind('future-trunks-sword','ch-039',592,['燃烧攻击']);
 bind('gotenks-ssj','ch-049',591,['超级幽灵神风拳']);
 bind('vegito-base','ch-051',587,['大爆炸攻击']);
 bind('gogeta-ssj4','ch-054',592,['百倍大爆炸龟派气功','大爆炸龟派气功']);
 bind('cell-perfect','ch-107',587,['完美龟派气功','龟派气功']);
 bind('cell-super-perfect','ch-107',587,['太阳系龟派气功','龟派气功']);
 bind('buu-gohan','ch-116',587,['超级龟派气功','龟派气功']);
 bind('baby-super2','ch-142',592,['复仇死亡弹']);
 bind('super17-gt','ch-144',592,['电击地狱弹']);
 bind('pan-gt','ch-063',587,['少女龟派气功','龟派气功']);
 bind('uub-majuub','ch-065',588,['巧克力光线']);
 bind('goku-god','ch-059',587,['神之龟派气功','龟派气功']);
 bind('vegeta-god','ch-068',587,['神之伽力克炮','伽力克炮','加利克炮']);
 bind('vegeta-blue','ch-035',592,['终极闪光·蓝','最终闪光']);
 bind('vegito-blue','ch-158',592,['最终龟派气功']);
 bind('caulifla-ssj2','ch-135',587,['粉碎加农炮']);
 bind('goku-black-base','ch-099',591,['黑色龟派气功']);
 bind('goku-black-rose','ch-034',587,['黑色龟派气功']);
 bind('hit-super','ch-078',589,['闪时·杀击','闪时']);
 bind('zamasu-fused','ch-076',587,['绝对雷霆']);
 bind('beerus-super','ch-071',585,['破坏']);
 DV.bt3TechniqueVoices=map;if(typeof module!=='undefined')module.exports=map;
})(typeof window!=='undefined'?window:globalThis);
