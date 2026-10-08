(function (root) {
  'use strict';
  const DV = root.DV = root.DV || {};
  const STORAGE_KEY = 'dragon-clash-keyboard-v1';
  const p1 = [
    ['left','左移','KeyA'],['right','右移','KeyD'],['guard','防御','KeyS'],['charge','蓄气','KeyW'],
    ['light','轻击','KeyJ'],['heavy','重击','KeyH'],['jump','跳跃','KeyK'],['dash','冲刺','KeyL'],
    ['ki','气弹 / 技能一','KeyU'],['super','必杀','KeyI'],['assist','援助','KeyO'],['grab','投技','KeyG'],
    ['counter','反击','KeyC'],['escape','脱身','KeyY'],['transform','变身菜单','KeyT'],
    ['absorb','专属 · 吸收','KeyZ'],['psycho','专属 · 念动力','KeyV'],['giant','专属 · 巨大化','KeyX']
  ];
  const p2 = [
    ['left','左移','ArrowLeft'],['right','右移','ArrowRight'],['guard','防御','ArrowDown'],['charge','蓄气','ArrowUp'],
    ['light','轻击','Digit1',['Numpad1']],['heavy','重击','Digit7',['Numpad7']],
    ['jump','跳跃','Digit2',['Numpad2']],['dash','冲刺','Digit3',['Numpad3']],
    ['ki','气弹 / 技能一','Digit4',['Numpad4']],['super','必杀','Digit5',['Numpad5']],
    ['assist','援助','Digit6',['Numpad6']],['grab','投技','Digit8',['Numpad8']],
    ['counter','反击','Period',['NumpadDecimal']],['escape','脱身','Minus',['Equal','NumpadAdd']],
    ['transform','变身菜单','Digit0',['Numpad0']],['absorb','专属 · 吸收','Digit9',['Numpad9']]
  ];
  const KEYBOARD_ACTIONS = [p1,p2].flatMap((items,side) => items.map(([action,label,code,aliases=[]]) => ({id:`p${side+1}.${action}`,side,label,code,aliases})));
  const originalCodes = new Set(KEYBOARD_ACTIONS.flatMap(item => [item.code,...item.aliases]));
  const reserved = new Set(['KeyF','KeyM','KeyB','KeyR']);
  const supported = code => typeof code === 'string' && !reserved.has(code) && /^(Key[A-Z]|Digit[0-9]|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal)|Arrow(Left|Right|Up|Down)|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote)$/.test(code);
  const defaultKeyboardBindings = () => Object.fromEntries(KEYBOARD_ACTIONS.map(item => [item.id,item.code]));
  const physicalCodes = (item,bindings) => bindings[item.id] === item.code ? [item.code,...item.aliases] : [bindings[item.id]];
  function conflict(bindings) {
    const used = new Map();
    for (const item of KEYBOARD_ACTIONS) for (const code of physicalCodes(item,bindings)) {
      if (used.has(code)) return {code,first:used.get(code),second:item};
      used.set(code,item);
    }
    return null;
  }
  function normalizeKeyboardBindings(raw) {
    const bindings = defaultKeyboardBindings();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bindings;
    for (const item of KEYBOARD_ACTIONS) if (Object.hasOwn(raw,item.id)) {
      if (!supported(raw[item.id])) return defaultKeyboardBindings();
      bindings[item.id] = raw[item.id];
    }
    return conflict(bindings) ? defaultKeyboardBindings() : bindings;
  }
  function withKeyboardBinding(current,id,code) {
    const item = KEYBOARD_ACTIONS.find(action => action.id === id);
    if (!item) throw new Error('未知操作');
    if (!supported(code)) throw new Error('该键为系统保留键或不支持的按键，请换一个键。');
    const next = {...normalizeKeyboardBindings(current),[id]:code}, duplicate = conflict(next);
    if (duplicate) {
      const other = duplicate.first.id === id ? duplicate.second : duplicate.first;
      throw new Error(`${keyboardKeyLabel(code)} 已用于 P${other.side+1}「${other.label}」，请先修改该操作。`);
    }
    return next;
  }
  function loadKeyboardBindings(storage) {
    try {
      const value = JSON.parse((storage ?? root.localStorage)?.getItem(STORAGE_KEY) || 'null');
      return normalizeKeyboardBindings(value?.version === 1 ? value.bindings : null);
    } catch (_) { return defaultKeyboardBindings(); }
  }
  function saveKeyboardBindings(bindings,storage) {
    try {
      const target = storage ?? root.localStorage;
      if (!target) return false;
      target.setItem(STORAGE_KEY,JSON.stringify({version:1,bindings:normalizeKeyboardBindings(bindings)}));
      return true;
    } catch (_) { return false; }
  }
  function remapBattleKey(event,bindings) {
    const current = bindings || loadKeyboardBindings();
    let code = originalCodes.has(event.code) ? 'Unbound' : event.code;
    for (const item of KEYBOARD_ACTIONS) if (physicalCodes(item,current).includes(event.code)) {
      // Keep the authored Shift+= shortcut and its original key-up lifetime.
      code = item.id==='p2.escape' && current[item.id]===item.code && event.code==='Equal' ? 'Equal' : item.code;
      break;
    }
    if (code === event.code) return event;
    return {code,target:event.target,repeat:event.repeat,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,
      preventDefault:() => event.preventDefault?.(),stopImmediatePropagation:() => event.stopImmediatePropagation?.()};
  }
  function keyboardKeyLabel(code) {
    const symbols = {ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`',NumpadAdd:'小键盘 +',NumpadSubtract:'小键盘 −',NumpadMultiply:'小键盘 ×',NumpadDivide:'小键盘 ÷',NumpadDecimal:'小键盘 .'};
    return symbols[code] || code.replace(/^Key|^Digit/,'').replace(/^Numpad/,'小键盘 ');
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (DV.App) Object.assign(DV.App.prototype,{
    primaryKey(side=0,action) {
      if(this.mode==='online')side=0;
      const bindings=this.keyboardBindings || loadKeyboardBindings(), prefix=`p${side+1}.`;
      const label=key=>keyboardKeyLabel(bindings[prefix+key]);
      if(action==='combo'||action==='unique'||side===1&&['psycho','giant'].includes(action))return label('guard')+' + '+label('ki');
      if(action==='burst')return label('guard')+' + '+label('super');
      return bindings[prefix+action] ? label(action) : '—';
    },
    helpHTML() {
      const bindings=this.keyboardBindings || loadKeyboardBindings();
      return `<div class="dv-help">${[0,1].map(side=>`<strong>PLAYER 0${side+1}${side===1?' · 本地双人':''}</strong>${KEYBOARD_ACTIONS.filter(item=>item.side===side).map(item=>`<span><kbd>${esc(keyboardKeyLabel(bindings[item.id]))}</kbd> ${esc(item.label)}</span>`).join('')}`).join('')}</div><p class="dv-help-notes">轻击可提前按键衔接三段连；重击命中后可用空中轻击追击。近身投技克制防御，反击可迎击对手出招。专属操作仅在角色拥有对应能力时生效。</p><p class="dv-help-notes">P1 副技能 <kbd>${esc(this.primaryKey(0,'combo'))}</kbd> · 爆气 <kbd>${esc(this.primaryKey(0,'burst'))}</kbd><br>P2 副技能使用防御 + 气弹，爆气使用防御 + 必杀。对波时有节奏地连按当前轻击键，每次至少间隔 6 帧。</p><p class="dv-help-notes">联机对局使用 P1 的键位。P2 的默认数字键兼容小键盘，默认脱身也支持 Shift + = 与小键盘 +。<br>Esc 暂停 · F 全屏 · M 静音。训练中 B 打开出招表、F3 显示判定框、R 重开。完整角色招式与消耗可在暂停菜单「出招表」查看。</p>`;
    },
    battleHints() {
      const key=action=>esc(this.primaryKey(0,action));
      const base=`<b>${key('left')} ${key('right')}</b> 移动　`+[
        ['guard','防御'],['light','轻击'],['heavy','重击'],['grab','投技'],['counter','反击'],['jump','跳'],
        ['dash','冲刺'],['ki','远攻'],['super','必杀'],['assist','援助'],['charge','蓄气'],['combo','副技能'],['escape','脱身']
      ].map(([action,label])=>`<b>${key(action)}</b> ${label}`).join('　');
      try {
        const moves=DV.resolveMoves?.(this.match?.fighters?.[this.localSide()] || this.fighter(0)) || {};
        return base+['absorb','psycho','giant'].filter(action=>moves[action]).map(action=>`　<b>${key(action)}</b> ${esc(moves[action].label || action)}`).join('');
      }catch(_){return base;}
    },
    showKeyboardSettings() {
      this.clearHeld();this.screen='keyboard-settings';this.modalKind=null;
      this.root.scrollTop=0;
      this.keyboardDraft=normalizeKeyboardBindings(this.keyboardBindings || loadKeyboardBindings());
      this.keyboardSide=0;this.keyboardCapture=null;this.keyboardStatus='点击右侧按键，再按下你想使用的新键。';
      this.renderKeyboardSettings();
    },
    renderKeyboardSettings() {
      const side=this.keyboardSide || 0;
      this.root.innerHTML=`<div class="dv-preferences dv-keyboard-settings"><header class="dv-preferences-header"><div><small>SETTINGS / KEYBOARD</small><h1>电脑键位</h1><p>修改战斗按键，菜单快捷键保持通用。</p></div><button type="button" data-keyboard="cancel">返回设置 ↗</button></header><nav class="dv-keyboard-tabs" aria-label="选择玩家">${[0,1].map(n=>`<button type="button" data-keyboard="side" data-side="${n}" aria-pressed="${side===n}">PLAYER 0${n+1} · P${n+1}</button>`).join('')}</nav><p class="dv-keyboard-status" role="status">${esc(this.keyboardStatus)}</p><div class="dv-keyboard-list">${KEYBOARD_ACTIONS.filter(item=>item.side===side).map(item=>`<div class="dv-keyboard-row"><span>${esc(item.label)}</span><button type="button" data-keyboard="capture" data-binding="${item.id}" aria-label="修改 P${side+1} ${esc(item.label)}" aria-pressed="${this.keyboardCapture===item.id}">${this.keyboardCapture===item.id?'请按新键…':esc(keyboardKeyLabel(this.keyboardDraft[item.id]))}</button></div>`).join('')}</div><p class="dv-keyboard-note">防御 + 气弹 = 副技能；防御 + 必杀 = 爆气。P2 默认数字键兼容小键盘。<br>Esc、Tab、Enter、Space、F（全屏）、M（静音）、B / F3 / R（训练）为保留键。横竖屏触屏按钮请在「触屏布局」中调整。</p><footer class="dv-keyboard-actions"><button type="button" data-keyboard="reset">恢复默认键位</button><button type="button" data-keyboard="cancel">取消</button><button type="button" data-keyboard="save" class="primary">保存键位</button></footer></div>`;
      this.root.querySelectorAll('[data-keyboard]').forEach(button=>{button.onclick=()=>{
        const action=button.dataset.keyboard;
        if(action==='cancel'){this.keyboardCapture=null;this.showPreferences();return;}
        if(action==='save'){
          this.keyboardBindings=normalizeKeyboardBindings(this.keyboardDraft);this.keyboardCapture=null;
          if(saveKeyboardBindings(this.keyboardBindings)){this.showPreferences();return;}
          this.keyboardStatus='当前浏览器无法保存。新键位在本次打开期间生效，请允许本地存储后再试。';
        }else if(action==='reset'){
          this.keyboardDraft=defaultKeyboardBindings();this.keyboardCapture=null;this.keyboardStatus='已恢复默认草稿，点击「保存键位」后应用。';
        }else if(action==='side'){
          this.keyboardSide=Number(button.dataset.side);this.keyboardCapture=null;this.keyboardStatus='点击右侧按键，再按下你想使用的新键。';
        }else if(action==='capture'){
          this.keyboardCapture=button.dataset.binding;this.keyboardStatus='请按下新键。按 Esc 取消本次改键。';
        }
        this.renderKeyboardSettings();
      };});
      if(this.keyboardCapture)this.el(`[data-binding="${this.keyboardCapture}"]`)?.focus({preventScroll:true});
    },
    keyboardSettingsKey(event,down) {
      event.stopImmediatePropagation();
      if(!down || event.repeat)return;
      if(this.keyboardCapture){
        event.preventDefault();
        if(event.code==='Escape'){this.keyboardCapture=null;this.keyboardStatus='已取消本次改键，其他草稿保持不变。';}
        else {
          try {
            if(event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)throw new Error('请单独按一个键，不使用组合键。');
            this.keyboardDraft=withKeyboardBinding(this.keyboardDraft,this.keyboardCapture,event.code);
            this.keyboardCapture=null;this.keyboardStatus='已修改草稿，点击「保存键位」后应用。';
          }catch(error){this.keyboardStatus=error.message;}
        }
        this.renderKeyboardSettings();return;
      }
      if(event.code==='Escape'){event.preventDefault();this.showPreferences();}
    }
  });
  const api={STORAGE_KEY,KEYBOARD_ACTIONS,defaultKeyboardBindings,normalizeKeyboardBindings,withKeyboardBinding,loadKeyboardBindings,saveKeyboardBindings,remapBattleKey,keyboardKeyLabel};
  Object.assign(DV,api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
