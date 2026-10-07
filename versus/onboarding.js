(function(root){
 'use strict';const DV=root.DV=root.DV||{};
 const tutorialSteps=[
  {title:'靠近对手',key:'A / D',touch:'左右推动摇杆',task:'向任意方向移动一段距离',tip:'先熟悉距离。移动可以靠近对手，也可以避开攻击。'},
  {title:'打中一拳',key:'J',touch:'短按普攻',task:'用轻攻击实际命中一次',tip:'已经放在近身距离。看准对手，用轻击打中；连续轻击可以衔接。'},
  {title:'挡下一拳',key:'按住 S',touch:'摇杆下拉并保持',task:'防住对手预告后的轻击',tip:'蓝色提示出现时保持防御。成功挡住攻击，体力不会被普通轻击扣除。'},
  {title:'释放必杀',key:'I',touch:'必杀',task:'用龟派气功实际命中',tip:'气力已补满。在地面面向对手释放；必杀需要准备时间。'}
 ];
 const actionLabels={light:'轻击',attack:'轻击',heavy:'重击',jump:'跳跃',dash:'冲刺',ki:'气弹',super:'必杀',assist:'援助',grab:'投技',counter:'反击'};
 function trainingCue(f){
  if(!f)return null;
  if(f.pursuitTicks>0)return {kind:'pursuit',text:'浮空命中 · K 跳跃 / L 冲刺追击',remaining:f.pursuitTicks/12};
  if(f.confirmTicks>0&&f.confirmState===f.state)return {kind:'confirm',text:'命中确认 · H 重击 / U 气弹 / I 必杀',remaining:f.confirmTicks/12};
  if(f.buffer&&f.bufferTicks>0)return {kind:'buffer',text:'已预输入 · '+(actionLabels[f.buffer]||'下一招')+'，动作结束后衔接',remaining:1};
  return null;
 }
 class Tutorial{
  constructor(){this.step=0;this.complete=false;this.needsSetup=true;this.progress=0;this.superArmed=false;}
  retry(){this.needsSetup=true;this.progress=0;this.superArmed=false;}
  advance(){this.step++;this.complete=this.step>=tutorialSteps.length;this.needsSetup=true;this.progress=0;this.superArmed=false;}
  prepare(match){
   if(this.complete||match.paused)return false;
   let reset=false;
   if(this.needsSetup){
    match.restart(false);const [p,enemy]=match.fighters;
    p.x=this.step===3?380:520;enemy.x=this.step===0?820:this.step===3?770:615;
    p.facing=1;enemy.facing=-1;this.origin=p.x;this.nextStrike=match.tick+60;
    this.needsSetup=false;reset=true;
   }
   if(this.step===2&&match.phase==='fight'){
    const [p,enemy]=match.fighters,dx=p.x-enemy.x;
    match.setInput(1,'left',dx<-108);match.setInput(1,'right',dx>108);
    if(match.tick>=this.nextStrike&&enemy.state==='idle'){
     match.command(1,'light');this.nextStrike=match.tick+100;
    }
   }
   return reset;
  }
  observe(match){
   if(this.complete||this.needsSetup||match.paused)return;
   if(this.step===0){this.progress=Math.min(1,Math.abs(match.fighters[0].x-this.origin)/60);if(this.progress>=1)this.advance();}
  }
  event(type,data={}){
   if(this.complete||this.needsSetup)return;
   if(this.step===1&&type==='hit'&&data.side===0&&data.action==='light'&&data.hitType==='melee'&&!data.assist)this.advance();
   else if(this.step===2&&type==='guard'&&data.side===0&&data.attackerSide===1)this.advance();
   else if(this.step===3){
    if(type==='super'&&data.side===0)this.superArmed=true;
    if(type==='hit'&&data.side===0&&data.hitType==='beam'&&!data.assist&&this.superArmed)this.advance();
   }
  }
  snapshot(match){return {step:this.step,complete:this.complete,progress:this.progress,
   info:tutorialSteps[this.step]||{title:'基础教学完成',task:'你已经完成移动、命中、防御和必杀。',tip:'接下来可以进入训练模式，尝试重击浮空和援助。'},
   telegraph:this.step===2&&!this.needsSetup&&(this.nextStrike-(match?.tick||0))<=35};}
 }
 Object.assign(DV,{Tutorial,tutorialSteps,trainingCue});
 if(typeof module!=='undefined')module.exports={Tutorial,tutorialSteps,trainingCue};
})(globalThis);
