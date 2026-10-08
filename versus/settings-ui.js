(function(root){
 'use strict';
 const DV=root.DV,App=DV.App;
 const previewMoves=()=>({absorb:true,psycho:true,giant:true});

 Object.assign(App.prototype,{
  showPreferences(){
   this.screen='preferences';
   this.root.scrollTop=0;
   const controls=this.touchControls;this.touchControls=null;controls?.destroy();
   this.clearHeld();this.sound.stop?.();this.match=null;this.modalKind=null;this.resultPending=0;
   this.root.innerHTML=`<main class="dv-preferences">
    <header class="dv-preferences-header"><div><small>DRAGON CLASH / SETTINGS</small><h1>设置</h1><p>调成你顺手的方式，准备下一场对战。</p></div><button type="button" data-preference="home">返回首页 ↗</button></header>
    <div class="dv-preferences-list">
     <section class="dv-preference-row"><div><small>01 / TOUCH</small><h2>触屏按键布局</h2><p>拖动摇杆和按钮，调整位置与大小。横屏、竖屏分别保存。</p></div><button type="button" class="dv-preference-primary" data-preference="layout">调整触屏布局 →</button></section>
     <section class="dv-preference-row"><div><small>02 / KEYBOARD</small><h2>电脑键位</h2><p>分别修改 P1 与 P2 的操作按键。</p></div><button type="button" data-preference="keyboard">修改电脑键位 →</button></section>
     <section class="dv-preference-row"><div><small>03 / AUDIO</small><h2>游戏声音</h2><p>音效、角色语音与战斗音乐。</p></div><button type="button" data-preference="sound" aria-pressed="${this.sound.muted}" aria-label="静音">声音 ${this.sound.muted?'关':'开'}</button></section>
     <section class="dv-preference-row"><div><small>04 / GUIDE</small><h2>操作指南</h2><p>查看基础操作、连段与角色专属技能。</p></div><button type="button" data-preference="help">查看操作指南 →</button></section>
    </div><p class="dv-preferences-note">设置会保存在当前设备与浏览器中。</p>
   </main>`;
   this.root.querySelectorAll('[data-preference]').forEach(button=>button.onclick=()=>{
    this.sound.unlock();
    const action=button.dataset.preference;
    if(action==='home')this.close();
    else if(action==='layout')this.showLayoutPreview();
    else if(action==='keyboard')this.showKeyboardSettings();
    else if(action==='help')this.showHelp();
    else if(action==='sound'){
     this.sound.muted=!this.sound.muted;
     button.textContent=this.sound.muted?'声音 关':'声音 开';
     button.setAttribute('aria-pressed',String(this.sound.muted));this.save();
    }
   });
   this.el('[data-preference="layout"]')?.focus({preventScroll:true});
  },

  showLayoutPreview(){
   this.screen='layout-preview';
   this.root.scrollTop=0;
   const previous=this.touchControls;this.touchControls=null;previous?.destroy();
   this.clearHeld();this.sound.stop?.();this.match=null;this.modalKind=null;
   this.root.innerHTML=`<div class="dv-battle dv-layout-preview">
    <canvas width="1280" height="720" aria-label="触屏布局预览场地"></canvas>
    <div class="dv-layout-caption" aria-hidden="true"><small>TOUCH LAYOUT</small><strong>把按键放到顺手的位置</strong><span>点选按钮，再用上方滑块调整大小</span></div>
    <div class="dv-battlebar"><span>触屏布局预览 · 保存后用于实际对战</span><div><button type="button" data-layout-back>取消并返回设置</button></div></div>
    ${DV.touchControlsMarkup(previewMoves())}
   </div>`;
   let storage=null;try{storage=root.localStorage;}catch{}
   const controller=new DV.TouchControls(this.el('.dv-touch'),{
    storage,moves:previewMoves,command:()=>{},input:()=>{},
    onEdit:editing=>{if(!editing&&this.active&&this.screen==='layout-preview'&&this.touchControls===controller)this.showPreferences();}
   });
   this.touchControls=controller;
   this.el('[data-layout-back]').onclick=()=>controller.closeEditor(false);
   controller.openEditor();
  }
 });

 DV.openSettings=function(onExit){
  if(!DV.app)DV.app=new App();
  DV.app.open(onExit,'preferences');
 };
})(globalThis);
