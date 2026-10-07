/* Only forms belonging to the same incarnation are connected. Fusion/absorption
   and story evolution are not ordinary power-up buttons. */
(function(root){
 'use strict';const DV=root.DV=root.DV||{};
 const families=[
  ['goku-early','goku-kaioken'],['goku-ssj2','goku-ssj3'],
  ['goku-god','goku-blue','goku-ultra'],['goku-gt-kid','goku-ssj4'],['goku-daima-mini','goku-daima-ssj4'],
  ['vegeta-ssj','vegeta-super'],['vegeta-god','vegeta-blue'],['vegeta-daima-mini','vegeta-daima-ssj3'],
  ['gohan-teen-ssj','gohan-teen-ssj2'],['gohan-adult-ssj','gohan-ultimate'],
  ['future-trunks-sword','future-trunks-ssj','future-trunks-super'],
  ['gotenks-base','gotenks-ssj','gotenks-ssj3'],['vegito-base','vegito-ssj'],
  ['gogeta-base','gogeta-blue'],['frieza-final','frieza-full'],['goku-black-base','goku-black-rose']
 ];
 const forward={ 'frieza-first':['frieza-final'], 'broly-wrath':['broly-full'] };
 function transformationOptions(spec,roster=DV.roster||[]){
  const family=families.find(g=>g.includes(spec.id)),index=family?.indexOf(spec.id);
  const ids=family?family.filter(id=>id!==spec.id):(forward[spec.id]||[]);
  return ids.map(id=>{const target=roster.find(s=>s.id===id);const down=family&&family.indexOf(id)<index;return {spec:target,cost:down?5:20,returning:!!down};}).filter(o=>o.spec&&o.spec.characterId===spec.characterId&&o.spec.era===spec.era);
 }
 Object.assign(DV,{transformationFamilies:families,transformationOptions});
 if(typeof module!=='undefined')module.exports={transformationFamilies:families,transformationOptions};
})(globalThis);
