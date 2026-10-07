/* Thumb controls own input lifetimes; the game still owns simulation and commands. */
(function (global) {
  'use strict';
  const DV = global.DV = global.DV || {};
  const STORAGE_KEY = 'dragon-clash-vs-touch-layout-v1';
  const CONTROL_IDS = ['joystick', 'charge', 'light', 'ki', 'combo', 'super', 'escape', 'assist', 'special'];
  const LABELS = {joystick: '摇杆', charge: '蓄气', light: '普攻', ki: '技能一', combo: '技能二', super: '必杀', escape: '脱身', assist: '援助', special: '专属'};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

  function mobileControlGroups(moves = {}) {
    const primary = ['light', 'ki', 'combo', 'super', 'escape', 'assist'].map(action => ({action, label: LABELS[action]}));
    const specials = [['absorb', '吸收'], ['psycho', '念动力'], ['giant', '巨大化']]
      .filter(([key]) => moves && moves[key]).map(([key, label]) => ({action: 'unique:' + key, label}));
    return {primary, extra: specials.length ? [{...specials[0], choices: specials}] : [], specials};
  }

  function touchControlsMarkup(moves = {}) {
    const groups = mobileControlGroups(moves), special = groups.specials[0];
    const button = item => `<button type="button" class="dv-thumb-action" data-layout-id="${item.action}" data-action="${item.action}" aria-label="${item.label}${item.action === 'light' ? '，长按重击' : ''}">${item.label}</button>`;
    return `<div class="dv-touch dv-touch-controller" data-touch-controller aria-label="触屏战斗控制">
      <div class="dv-thumb-joystick" data-control="joystick" data-layout-id="joystick" role="group" aria-label="摇杆：左右移动，上推跳跃，下拉防御，双推冲刺"><span class="dv-thumb-cross" aria-hidden="true"></span><span class="dv-thumb-nub" data-joystick-nub aria-hidden="true"></span><span class="dv-thumb-joystick-label" aria-hidden="true">移动</span></div>
      <button type="button" class="dv-thumb-charge" data-control="charge" data-layout-id="charge" aria-label="按住蓄气">蓄气</button>
      ${groups.primary.map(button).join('')}
      <button type="button" class="dv-thumb-action dv-thumb-special" data-layout-id="special" data-action="${special?.action || 'unique:absorb'}" aria-label="${special?.label || '专属'}"${special ? '' : ' hidden'}>${special?.label || '专属'}</button>
      <select class="dv-thumb-special-select" data-special-select aria-label="选择角色专属技能"${groups.specials.length > 1 ? '' : ' hidden'}>${groups.specials.map(item => `<option value="${item.action}">${item.label}</option>`).join('')}</select>
      <div class="dv-thumb-editor" data-touch-editor role="group" aria-label="调整触屏布局" hidden>
        <div class="dv-thumb-editor-copy"><strong>触屏布局</strong><span>拖动摇杆或按钮调整位置</span></div>
        <label><span data-touch-selected>普攻</span><input type="range" data-touch-scale min="0.6" max="1.6" step="0.05" value="1" aria-label="当前按钮大小"></label>
        <div class="dv-thumb-editor-actions"><button type="button" data-editor-command="reset">重置</button><button type="button" data-editor-command="cancel">取消</button><button type="button" data-editor-command="save">保存</button></div>
      </div>
    </div>`;
  }

  function normalizeLayouts(raw) {
    const layouts = {portrait: {}, landscape: {}};
    if (!raw || typeof raw !== 'object') return layouts;
    for (const orientation of ['portrait', 'landscape']) {
      const source = raw[orientation];
      if (!source || typeof source !== 'object') continue;
      for (const id of CONTROL_IDS) {
        const value = source[id];
        if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
        layouts[orientation][id] = {x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1), scale: clamp(finite(value.scale, 1), .6, 1.6)};
      }
    }
    return layouts;
  }

  function clampControl(layout, baseSize, bounds, safe = {}) {
    const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
    const scale = clamp(finite(layout.scale, 1), .6, 1.6), size = Math.max(44, Math.round(baseSize * scale));
    const half = size / 2;
    const axis = (value, length, start, end) => {
      const lower = half + Math.max(0, finite(start, 0)) + 8, upper = length - half - Math.max(0, finite(end, 0)) - 8;
      return lower > upper ? length / 2 : clamp(clamp(finite(value, .5), 0, 1) * length, lower, upper);
    };
    return {x: axis(layout.x, width, safe.left, safe.right), y: axis(layout.y, height, safe.top, safe.bottom), size, scale};
  }

  function baseSizes(width) {
    return width >= 1000 ? {joystick: 132, action: 64} : width >= 700 ? {joystick: 116, action: 56} : width >= 400 ? {joystick: 112, action: 52} : {joystick: 104, action: 48};
  }

  function defaultLayout(bounds, orientation) {
    const w = Math.max(1, bounds.width), h = Math.max(1, bounds.height), sizes = baseSizes(w);
    const stride = sizes.action + (w < 400 ? 10 : 13), right = sizes.action / 2 + 14, bottom = sizes.action / 2 + 16;
    const left = Math.min(132, Math.max(sizes.joystick / 2 + 12, w * .13));
    const joystickY = h - Math.max(sizes.joystick / 2 + 16, bottom + stride * .65);
    const position = (x, y) => ({x: x / w, y: y / h, scale: 1});
    const layout = {
      joystick: position(left, joystickY), charge: position(left, joystickY - sizes.joystick / 2 - 34),
      light: position(w - right, h - bottom), ki: position(w - right, h - bottom - stride),
      combo: position(w - right - stride, h - bottom - stride * .5),
      super: position(w - right - stride * 2, h - bottom),
      escape: position(w - right - stride, h - bottom - stride * 1.5),
      assist: position(w - right - stride * 2, h - bottom - stride),
      special: position(w - right, h - bottom - stride * 2)
    };
    // In wide views keep optional character mechanics toward the right thumb.
    if (orientation === 'landscape' && w >= 650) layout.special = position(w - right - stride * 3, h - bottom - stride * .35);
    return layout;
  }

  class TouchControls {
    static markup(moves) { return touchControlsMarkup(moves); }

    constructor(element, options = {}) {
      if (!element) throw new TypeError('TouchControls requires its .dv-touch element');
      this.element = element; this.options = options;
      this.window = element.ownerDocument?.defaultView || global;
      this.command = typeof options.command === 'function' ? options.command : () => {};
      this.input = typeof options.input === 'function' ? options.input : () => {};
      this.now = options.now || (() => this.window.performance?.now?.() ?? Date.now());
      this.schedule = options.setTimeout || ((fn, delay) => this.window.setTimeout(fn, delay));
      this.unschedule = options.clearTimeout || (id => this.window.clearTimeout(id));
      this.pointers = new Map(); this.sources = new Map(); this.listeners = [];
      this.editing = false; this.destroyed = false; this.selected = 'light'; this.lastPush = null; this.joystickSide = 0; this.jumpArmed = true;
      this.layouts = normalizeLayouts(null);
      try { this.storage = options.storage; const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) || 'null'); if (saved?.version === 1) this.layouts = normalizeLayouts(saved.layouts); } catch (_) { /* Private browsing and old data use defaults. */ }
      this.bind(); this.refresh();
      if (this.window.ResizeObserver) { this.observer = new this.window.ResizeObserver(() => this.resize()); this.observer.observe(element); }
    }

    listen(element, name, handler, options) { element?.addEventListener(name, handler, options); this.listeners.push([element, name, handler, options]); }

    bind() {
      const root = this.element;
      if (typeof this.window.PointerEvent === 'function') {
        this.listen(root, 'pointerdown', event => this.down(event));
        this.listen(root, 'pointermove', event => this.move(event));
        this.listen(root, 'pointerup', event => this.up(event, false));
        for (const name of ['pointercancel', 'lostpointercapture']) this.listen(root, name, event => this.up(event, true));
      } else {
        const touch = (event, fn) => {
          for (const item of event.changedTouches || []) fn.call(this, {pointerId: 'touch:' + item.identifier, target: item.target || event.target, clientX: item.clientX, clientY: item.clientY, button: 0, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation()});
        };
        this.listen(root, 'touchstart', event => touch(event, this.down), {passive: false});
        this.listen(root, 'touchmove', event => touch(event, this.move), {passive: false});
        this.listen(root, 'touchend', event => touch(event, event => this.up(event, false)), {passive: false});
        this.listen(root, 'touchcancel', event => touch(event, event => this.up(event, true)), {passive: false});
      }
      this.listen(root, 'contextmenu', event => event.preventDefault());
      this.listen(root, 'click', event => {
        const button = event.target.closest?.('[data-editor-command]');
        if (!button || !this.editing) return;
        event.preventDefault(); event.stopPropagation();
        if (button.dataset.editorCommand === 'reset') { this.releaseAll(); this.layouts[this.orientation] = {}; this.applyLayout(); }
        else this.closeEditor(button.dataset.editorCommand === 'save');
      });
      this.listen(root, 'input', event => {
        if (!this.editing || !event.target.matches?.('[data-touch-scale]')) return;
        const layout = this.currentLayout(this.selected);
        this.layouts[this.orientation][this.selected] = {...layout, scale: clamp(Number(event.target.value) || 1, .6, 1.6)};
        this.applyLayout();
      });
      this.listen(root, 'change', event => {
        if (!event.target.matches?.('[data-special-select]')) return;
        this.specialAction = event.target.value; this.refreshSpecials(); this.applyLayout();
      });
      this.listen(this.window, 'blur', () => this.releaseAll());
      this.listen(this.window, 'pagehide', () => this.releaseAll());
      this.listen(this.window, 'orientationchange', () => { this.releaseAll(); this.resize(); });
      this.listen(this.window, 'resize', () => this.resize());
      this.listen(root.ownerDocument, 'visibilitychange', () => { if (root.ownerDocument.hidden) this.releaseAll(); });
    }

    consume(event) { event.preventDefault?.(); event.stopPropagation?.(); }

    down(event) {
      if (this.destroyed || event.button > 0 || this.pointers.has(event.pointerId)) return;
      if (event.target.closest?.('[data-special-select]') || event.target.closest?.('[data-touch-editor]')) { event.stopPropagation?.(); return; }
      const control = event.target.closest?.('[data-layout-id]');
      if (!control || !this.element.contains(control) || control.hidden) return;
      this.consume(event);
      const id = control.dataset.layoutId;
      if (!this.editing && id === 'joystick' && this.joystickPointer != null) return;
      const state = {id, control, start: this.now(), heavy: false, timer: null};
      this.pointers.set(event.pointerId, state);
      try { control.setPointerCapture?.(event.pointerId); } catch (_) { /* Touch fallback has no pointer capture. */ }
      control.classList.add('is-held');
      if (this.editing) {
        this.selected = id; this.applyLayout();
        const layout = this.currentLayout(id), point = this.positioned[id];
        state.drag = {x: event.clientX, y: event.clientY, originalX: point.x, originalY: point.y, layout};
        return;
      }
      if (id === 'joystick') { this.joystickPointer = event.pointerId; state.rect = control.getBoundingClientRect(); this.updateJoystick(event, state); }
      else if (id === 'charge') this.setInput('charge', true, event.pointerId);
      else if (id === 'light') state.timer = this.schedule(() => { if (this.pointers.get(event.pointerId) === state && !this.editing) { state.heavy = true; this.command('heavy'); } }, 300);
      else this.command(control.dataset.action);
    }

    move(event) {
      const state = this.pointers.get(event.pointerId);
      if (!state) return;
      this.consume(event);
      if (state.drag && this.editing) {
        const bounds = this.bounds(), point = clampControl({x: (state.drag.originalX + event.clientX - state.drag.x) / bounds.width, y: (state.drag.originalY + event.clientY - state.drag.y) / bounds.height, scale: state.drag.layout.scale}, this.sizeFor(state.id), bounds, this.safeInsets());
        this.layouts[this.orientation][state.id] = {x: point.x / bounds.width, y: point.y / bounds.height, scale: point.scale}; this.applyLayout();
      } else if (!this.editing && state.id === 'joystick') this.updateJoystick(event, state);
    }

    up(event, cancelled) {
      const state = this.pointers.get(event.pointerId);
      if (!state) return;
      this.consume(event); this.pointers.delete(event.pointerId);
      if (state.timer != null) this.unschedule(state.timer);
      if (!this.editing && !state.drag && !cancelled && state.id === 'light' && !state.heavy) this.command(this.now() - state.start >= 300 ? 'heavy' : 'light');
      for (const [key, sources] of this.sources) if (sources.has(event.pointerId)) this.setInput(key, false, event.pointerId);
      if (state.id === 'joystick') {
        this.joystickPointer = null; this.joystickSide = 0; this.jumpArmed = true;
        if (cancelled) this.lastPush = null;
        this.resetNub();
      }
      if (![...this.pointers.values()].some(item => item.control === state.control)) state.control.classList.remove('is-held');
      try { state.control.releasePointerCapture?.(event.pointerId); } catch (_) { /* Already cancelled. */ }
    }

    setInput(key, down, source) {
      let sources = this.sources.get(key);
      if (!sources) { sources = new Set(); this.sources.set(key, sources); }
      const before = sources.size > 0;
      if (down) sources.add(source); else sources.delete(source);
      const after = sources.size > 0;
      if (before !== after) this.input(key, after);
    }

    updateJoystick(event, state) {
      const rect = state.rect, radius = Math.max(1, rect.width / 2);
      let x = (event.clientX - rect.left - radius) / radius, y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
      const side = x < -.32 ? -1 : x > .32 ? 1 : 0;
      this.setInput('left', side === -1, event.pointerId); this.setInput('right', side === 1, event.pointerId); this.setInput('guard', y > .4, event.pointerId);
      if (Math.hypot(x, y) < .28) this.jumpArmed = true;
      if (y < -.45 && this.jumpArmed) { this.jumpArmed = false; this.command('jump'); }
      if (side && side !== this.joystickSide) {
        const now = this.now();
        if (this.lastPush?.side === side && now - this.lastPush.at <= 280) { this.command('dash'); this.lastPush = null; }
        else this.lastPush = {side, at: now};
      }
      this.joystickSide = side;
      const nub = this.element.querySelector('[data-joystick-nub]');
      if (nub) nub.style.transform = `translate(-50%, -50%) translate(${x * radius * .5}px, ${y * radius * .5}px)`;
    }

    resetNub() { const nub = this.element.querySelector('[data-joystick-nub]'); if (nub) nub.style.transform = 'translate(-50%, -50%)'; }

    releaseAll() {
      for (const [id, state] of [...this.pointers]) this.up({pointerId: id}, true);
      for (const [key, sources] of this.sources) if (sources.size) { sources.clear(); this.input(key, false); }
      this.lastPush = null; this.joystickSide = 0; this.joystickPointer = null; this.jumpArmed = true; this.resetNub();
    }

    bounds() { const bounds = this.element.getBoundingClientRect(); return {width: Math.max(1, bounds.width), height: Math.max(1, bounds.height)}; }

    safeInsets() {
      const style = this.window.getComputedStyle?.(this.element);
      return Object.fromEntries(['left', 'right', 'top', 'bottom'].map(side => [side, parseFloat(style?.getPropertyValue('--dv-safe-' + side)) || 0]));
    }

    sizeFor(id) {
      const sizes = baseSizes(this.bounds().width);
      return id === 'joystick' ? sizes.joystick : id === 'charge' ? 44 : id === 'light' ? Math.round(sizes.action * 1.25) : sizes.action;
    }

    currentLayout(id) { return this.layouts[this.orientation][id] || defaultLayout(this.bounds(), this.orientation)[id]; }

    applyLayout() {
      if (this.destroyed) return;
      const bounds = this.bounds(), safe = this.safeInsets(); this.positioned = {};
      for (const control of this.element.querySelectorAll('[data-layout-id]')) {
        const id = control.dataset.layoutId;
        if (!CONTROL_IDS.includes(id)) continue;
        const point = clampControl(this.currentLayout(id), this.sizeFor(id), bounds, safe); this.positioned[id] = point;
        Object.assign(control.style, {left: point.x + 'px', top: point.y + 'px', width: point.size + 'px', height: point.size + 'px'});
        control.classList.toggle('is-selected', this.editing && id === this.selected);
      }
      const select = this.element.querySelector('[data-special-select]'), special = this.positioned.special;
      if (select && special) { select.style.left = clamp(special.x - 42, 8 + safe.left, Math.max(8 + safe.left, bounds.width - 92 - safe.right)) + 'px'; select.style.top = Math.max(8 + safe.top, special.y - special.size / 2 - 46) + 'px'; }
      this.updateEditor();
    }

    refreshSpecials() {
      let moves = {}; try { moves = this.options.moves?.() || {}; } catch (_) { /* Selection may be between fighters. */ }
      const {specials} = mobileControlGroups(moves);
      const active = specials.find(item => item.action === this.specialAction) || specials[0]; this.specialAction = active?.action;
      const button = this.element.querySelector('[data-layout-id="special"]');
      if (button) { button.hidden = !active; if (active) { button.dataset.action = active.action; button.textContent = active.label; button.setAttribute('aria-label', active.label); } }
      const select = this.element.querySelector('[data-special-select]');
      if (select) {
        select.hidden = this.editing || specials.length <= 1;
        const signature = specials.map(item => item.action).join('|');
        if (this.specialSignature !== signature) select.innerHTML = specials.map(item => `<option value="${escapeHTML(item.action)}">${escapeHTML(item.label)}</option>`).join('');
        select.value = active?.action || ''; this.specialSignature = signature;
      }
    }

    refresh() {
      const orientation = this.window.innerWidth >= this.window.innerHeight ? 'landscape' : 'portrait';
      if (this.orientation && this.orientation !== orientation) this.releaseAll();
      this.orientation = orientation; this.element.dataset.orientation = orientation; this.refreshSpecials(); this.applyLayout();
    }

    resize() { this.releaseAll(); this.refresh(); }

    updateEditor() {
      const editor = this.element.querySelector('[data-touch-editor]'); if (editor) editor.hidden = !this.editing;
      if (!this.editing) return;
      const label = this.element.querySelector('[data-touch-selected]'), scale = this.element.querySelector('[data-touch-scale]');
      if (label) label.textContent = LABELS[this.selected] || '按钮';
      if (scale) scale.value = this.currentLayout(this.selected).scale;
    }

    openEditor() {
      if (this.editing || this.destroyed) return;
      this.releaseAll(); this.beforeEdit = normalizeLayouts(this.layouts); this.editing = true;
      this.element.classList.add('is-editing'); this.refresh(); this.options.onEdit?.(true);
    }

    closeEditor(save = false) {
      if (!this.editing) return;
      this.releaseAll();
      if (save) { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify({version: 1, layouts: normalizeLayouts(this.layouts)})); } catch (_) { /* Layout remains active for this session. */ } }
      else this.layouts = normalizeLayouts(this.beforeEdit);
      this.editing = false; this.beforeEdit = null; this.element.classList.remove('is-editing'); this.refresh(); this.options.onEdit?.(false);
    }

    destroy() {
      if (this.destroyed) return;
      this.releaseAll(); if (this.editing) this.closeEditor(false);
      for (const [element, name, handler, options] of this.listeners) element?.removeEventListener(name, handler, options);
      this.listeners = []; this.observer?.disconnect(); this.destroyed = true;
    }
  }

  const api = {TouchControls, mobileControlGroups, touchControlsMarkup, normalizeLayouts, clampControl, defaultLayout, STORAGE_KEY};
  Object.assign(DV, {TouchControls, mobileControlGroups, touchControlsMarkup});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
