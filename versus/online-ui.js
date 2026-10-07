(function(root){
 'use strict';const DV=root.DV,App=DV.App;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const byId=id=>DV.roster.find(f=>f.id===id)||DV.roster[0];
 const indexOf=id=>Math.max(0,DV.roster.findIndex(f=>f.id===id));
 const options=id=>DV.roster.map(f=>`<option value="${esc(f.id)}"${f.id===id?' selected':''}>${esc(f.name)} · ${esc(f.form)}</option>`).join('');
 Object.assign(App.prototype,{
  showOnline(){
   this.restoreTutorialSelection();this.clearHeld();this.touchControls?.destroy();this.touchControls=null;this.sound.stop?.();this.match=null;this.resultPending=0;this.modalKind=null;this.mode='online';this.screen='online';
   this.network?.leave();
   this.network=new DV.NetworkClient({url:DV.resolveServerURL(root.DV_NETWORK_CONFIG||{},root.location),onMessage:message=>this.handleOnlineMessage(message),onStatus:(status,message)=>this.updateOnlineStatus(status,message)});
   this.renderOnlineEntry();if(this.network.url)this.network.connect().catch(error=>this.onlineError(error.message));
  },
  onlineHeader(subtitle){return `<header class="dv-online-header"><div><small>DRAGON CLASH / ONLINE</small><h1>好友对战<span>${esc(subtitle)}</span></h1></div><button data-online="leave">返回选人 ↗</button></header>`;},
  renderOnlineEntry(){
   this.screen='online';this.match=null;this.touchControls?.destroy();this.touchControls=null;
   const enabled=this.network.status==='connected',configured=!!this.network.url;
   this.root.innerHTML=`<div class="dv-online">${this.onlineHeader('创建一局，邀请朋友')}<div class="dv-online-status" role="status" data-online-status>${configured?'正在连接服务器…':'联机服务尚未上线，请先体验本地对战。'}</div><div class="dv-online-picks"><label>我的战士<select data-online-fighter aria-label="我的战士">${options(this.fighter(0).id)}</select></label><label>我的援助<select data-online-assist aria-label="我的援助">${options((DV.roster[this.assistIndices[0]]||this.fighter(0)).id)}</select></label></div><div class="dv-online-entry-grid"><section><small>01 / HOST</small><h2>创建房间</h2><p>生成六位房间号，发给你的朋友。</p><button class="dv-online-primary" data-online="create"${enabled?'':' disabled'}>创建房间 →</button></section><form data-online-join><small>02 / JOIN</small><h2>加入好友</h2><label for="dv-room-code">六位房间号</label><input id="dv-room-code" name="room" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" minlength="6" placeholder="输入房间号" autocomplete="off" required aria-label="六位房间号"><button class="dv-online-primary" type="submit"${enabled?'':' disabled'}>加入房间 →</button></form></div><p class="dv-online-note">双人 1v1 · 每人选择自己的战士 · 手机和平板建议横屏</p>${configured?'<button class="dv-online-retry" data-online="retry">重新连接</button>':''}<p class="dv-online-error" role="alert" data-online-error></p></div>`;
   this.bindOnlineUI();this.updateOnlineStatus(this.network.status);
  },
  renderOnlineRoom(){
   const room=this.network.room;if(!room)return this.renderOnlineEntry();
   this.clearHeld();this.touchControls?.destroy();this.touchControls=null;this.match=null;this.screen='online';this.modalKind=null;this.resultPending=0;
   const side=this.network.side,own=room.seats[side],host=room.host===side;
   const cards=[0,1].map(seatSide=>{
    const seat=room.seats[seatSide],mine=seatSide===side;
    if(!seat)return `<section class="dv-room-seat is-empty"><small>PLAYER 0${seatSide+1}</small><div class="dv-room-empty">＋</div><h2>等待朋友加入</h2><p>把上方房间号发给朋友</p></section>`;
    const fighter=byId(seat.fighterId);
    return `<section class="dv-room-seat${mine?' is-mine':''}"><small>PLAYER 0${seatSide+1} ${mine?' / 你':''}${room.host===seatSide?' / 房主':''}</small><div class="dv-room-avatar" style="--fighter-color:${esc(fighter.color)}"><canvas width="220" height="210" data-room-preview="${seatSide}" aria-label="${esc(fighter.name)}预览"></canvas></div><h2>${esc(fighter.name)}<span>${esc(fighter.form)}</span></h2><p class="dv-room-ready${seat.ready?' is-ready':''}">${!seat.connected?'连接中断，等待重连':seat.ready?'已准备 ✓':'选择中'}</p>${mine?`<label>主战<select data-online-fighter aria-label="我的战士"${seat.ready?' disabled':''}>${options(seat.fighterId)}</select></label><label>援助<select data-online-assist aria-label="我的援助"${seat.ready?' disabled':''}>${options(seat.assistId)}</select></label>`:`<p>援助 · ${esc(byId(seat.assistId).name)}</p>`}</section>`;
   }).join('');
   const bothReady=room.seats.every(seat=>seat?.connected&&seat.ready);
   this.root.innerHTML=`<div class="dv-online">${this.onlineHeader('等待双方准备')}<div class="dv-room-code"><span>房间号 · 发给朋友</span><strong>${esc(room.code)}</strong><button data-online="copy">复制房间号</button></div><div class="dv-online-status" role="status" data-online-status></div><div class="dv-room-seats">${cards}</div><div class="dv-room-footer"><label>战场<select data-online-stage aria-label="房间战场"${host&&!own?.ready?'':' disabled'}>${DV.stages.map((stage,i)=>`<option value="${i}"${i===room.stageIndex?' selected':''}>${esc(stage.name)}</option>`).join('')}</select></label><div><button data-online="ready" aria-pressed="${!!own?.ready}"${own?.connected?'':' disabled'}>${own?.ready?'取消准备':'准备好了'}</button>${host?`<button class="dv-online-primary" data-online="start"${bothReady?'':' disabled'}>开始对战 →</button>`:'<span class="dv-online-note">双方准备后，由房主开始</span>'}</div></div><p class="dv-online-error" role="alert" data-online-error></p></div>`;
   this.bindOnlineUI();this.updateOnlineStatus(this.network.status);
   for(const seat of room.seats){if(!seat)continue;const canvas=this.el(`[data-room-preview="${seat.side}"]`);if(canvas&&DV.drawFighter)try{DV.drawFighter(canvas.getContext('2d'),{spec:byId(seat.fighterId),facing:seat.side?-1:1,state:'idle',frame:0,grounded:true},110,200,1.1);}catch{}}
   if(own)DV.preloadFighterArt?.(room.seats.filter(Boolean).flatMap(seat=>[byId(seat.fighterId),byId(seat.assistId)])).then(()=>{if(this.screen==='online'&&this.network.room===room)this.paintOnlinePreviews();}).catch(()=>{});
  },
  paintOnlinePreviews(){for(const seat of this.network.room?.seats||[]){if(!seat)continue;const canvas=this.el(`[data-room-preview="${seat.side}"]`);if(canvas)try{const c=canvas.getContext('2d');c.clearRect(0,0,220,210);DV.drawFighter(c,{spec:byId(seat.fighterId),facing:seat.side?-1:1,state:'idle',frame:0,grounded:true},110,200,1.1);}catch{}}},
  bindOnlineUI(){
   this.root.querySelectorAll('[data-online]').forEach(button=>button.onclick=async()=>{
    this.sound.unlock();const action=button.dataset.online;
    if(action==='leave'){this.showSelect();return;}
    if(action==='retry'){this.network.connect().catch(error=>this.onlineError(error.message));return;}
    if(action==='create'){this.network.create(this.el('[data-online-fighter]').value,this.el('[data-online-assist]').value);return;}
    if(action==='ready'){
     const room=this.network.room,own=room.seats[this.network.side];
     if(!own.ready){button.disabled=true;button.textContent='载入角色中…';try{const art=await DV.preloadFighterArt?.(room.seats.filter(Boolean).flatMap(seat=>[byId(seat.fighterId),byId(seat.assistId)]));if(art?.ready===false)throw Error('art unavailable');}catch{if(this.network.room===room)this.renderOnlineRoom();this.onlineError('角色资源加载失败，请检查网络后重试。');return;}}
     const current=this.network.room,currentOwn=current?.seats[this.network.side];
     if(current?.code===room.code&&currentOwn?.fighterId===own.fighterId&&currentOwn?.assistId===own.assistId&&currentOwn?.ready===own.ready)this.network.send({type:'ready',value:!own.ready});return;
    }
    if(action==='start'){this.network.send({type:'start'});return;}
    if(action==='copy'){
     const code=this.network.room.code;root.navigator?.clipboard?.writeText(code).then(()=>{button.textContent='已复制 ✓';}).catch(()=>{button.textContent='房间号 '+code;});
    }
   });
   const form=this.el('[data-online-join]');if(form)form.onsubmit=event=>{event.preventDefault();const code=this.el('#dv-room-code').value.trim();if(!/^\d{6}$/.test(code)){this.onlineError('请输入六位数字房间号。');return;}this.network.join(code,this.el('[data-online-fighter]').value,this.el('[data-online-assist]').value);};
   for(const selector of ['[data-online-fighter]','[data-online-assist]','[data-online-stage]']){
    const element=this.el(selector);if(element&&this.network.room)element.onchange=()=>this.network.send({type:'select',fighterId:this.el('[data-online-fighter]').value,assistId:this.el('[data-online-assist]').value,...(this.network.room.host===this.network.side?{stageIndex:Number(this.el('[data-online-stage]').value)}:{})});
   }
  },
  updateOnlineStatus(status,message=''){
   const labels={idle:'等待连接',connecting:'连接服务器中… 免费服务首次唤醒可能需约一分钟。',connected:'已连接 · 双人房间',reconnecting:'正在恢复连接…',disconnected:'连接中断，正在尝试重连…',closed:'连接已关闭'};
   const statusElement=this.el('[data-online-status]');if(statusElement)statusElement.textContent=message||labels[status]||status;
   if(this.screen==='online'&&!this.network.room)this.root.querySelectorAll('[data-online="create"],[data-online-join] button').forEach(button=>button.disabled=status!=='connected');
   if(this.screen==='battle'&&status!=='connected'){this.clearHeld();this.notice(message||labels[status]||'连接中断',5000,'error');}
   this.root.dataset.connection=status;
  },
  onlineError(message){const element=this.el('[data-online-error]');if(element)element.textContent=message;else this.notice(message,3500,'error');},
  handleOnlineMessage(message){
   if(this.mode!=='online')return;
   if(message.type==='error'){if(!this.network.room&&this.screen!=='online')this.clearHeld();if(!this.network.room)this.renderOnlineEntry();this.onlineError(message.message||'联机操作失败，请重试。');return;}
   if(message.type==='room'){
    if(message.room.phase==='lobby'||!this.match)this.renderOnlineRoom();
    else if(message.room.seats.some(seat=>seat&&!seat.connected))this.notice('对方掉线，等待重新连接…',5000,'error');
    return;
   }
   if(message.type==='started'){this.startOnlineBattle(message);return;}
   if(message.type==='state'&&this.match&&this.screen==='battle'){
    this._onlinePrevious=this.match.fighters.map(f=>({x:f.x,y:f.y,state:f.state,frame:f.frame,visualFrame:f.visualFrame}));
    DV.NetProtocol.applySnapshot(this.match,message.snapshot);this._onlineReceivedAt=performance.now();
    for(const event of message.events||[])if(Array.isArray(event))this.combatEvent(event[0],event[1]||{});
    const own=this.match.fighters[this.localSide()],signature=own.spec.id+':'+['absorb','psycho','giant'].map(key=>!!DV.resolveMoves(own)[key]).join(':');
    if(signature!==this._onlineControlSignature){this._onlineControlSignature=signature;this.touchControls?.refresh();}
    if(this.match.phase==='over'&&!this.resultPending&&this.modalKind!=='result')this.resultPending=performance.now()+2000;
   }
  },
  startOnlineBattle(message){
   const room=message.room||this.network.room;this.network.room=room;
   this.indices=message.snapshot.fighters.map(f=>indexOf(f.fighterId));this.assistIndices=message.snapshot.fighters.map(f=>indexOf(f.assistId));this.assistSpecMode=true;this.stageIndex=room.stageIndex;this.tutorial=null;this._onlinePrevious=null;this._onlineControlSignature='';
   this.start();DV.NetProtocol.applySnapshot(this.match,message.snapshot);this._onlineReceivedAt=performance.now();
   const bar=this.el('.dv-battlebar>span');if(bar)bar.innerHTML=`<b>房间 ${esc(room.code)}</b>　你是 P${this.network.side+1} · 双方使用各自的摇杆和技能键`;
   this.root.dataset.onlineSide=String(this.network.side);this.touchControls?.refresh();
  },
  onlineRenderMatch(){
   if(this.mode!=='online'||!this.match||!this._onlinePrevious)return null;
   const alpha=Math.max(0,Math.min(1,(performance.now()-this._onlineReceivedAt)/50));
   return Object.assign(Object.create(Object.getPrototypeOf(this.match)),this.match,{fighters:this.match.fighters.map((fighter,i)=>{
    const previous=this._onlinePrevious[i];if(!previous||Math.abs(previous.x-fighter.x)>180||Math.abs(previous.y-fighter.y)>180)return fighter;
    return {...fighter,x:previous.x+(fighter.x-previous.x)*alpha,y:previous.y+(fighter.y-previous.y)*alpha};
   })});
  },
  onlinePause(){
   if(!this.match||this.screen!=='battle')return;if(this.modalKind){this.modalAction('back');return;}
   this.clearHeld();this.showModal('pause','对战菜单','<p>联机对局仍在继续。调整按键时，请留意对手。</p>',[{id:'back',label:'继续对战',primary:true},{id:'layout',label:'自定义按键'},{id:'moves',label:'我的出招表'},{id:'online-leave',label:'离开房间'}]);
  },
  onlineResult(){
   if(!this.match||this.match.phase!=='over')return;this.clearHeld();const winner=this.match.winner;
   this.showModal('result',winner===null?'平局':winner===this.localSide()?'你赢了！':'本局落败',`<p>房间 ${esc(this.network.room?.code)} · ${winner===null?'再来一局决出胜负。':esc(this.match.fighters[winner].spec.name)+' 获胜'}</p><p>回到房间后，双方重新准备即可再战。</p>`,[{id:'online-room',label:'返回房间',primary:true},{id:'online-leave',label:'离开房间'}]);
  },
  returnOnlineRoom(){
   this.el('.dv-modal-shade')?.remove();this.modalKind=null;
   if(this.network.room?.host===this.network.side)this.network.send({type:'lobby'});
   else{this.notice('等待房主返回房间，然后重新准备。',2500);this.onlineResult();}
  }
 });
 DV.openOnline=function(onExit){DV.open(onExit);DV.app.showOnline();};
})(globalThis);
