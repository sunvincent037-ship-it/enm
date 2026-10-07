(function(root){
 'use strict';
 const DV=root.DV=root.DV||{};
 function resolveServerURL(config={},page=root.location||{}){
  const explicit=typeof config==='string'?config:config.url;
  let candidate=String(explicit||'').trim();
  if(!candidate){
   if(!(config.sameOrigin||['localhost','127.0.0.1','[::1]'].includes(page.hostname)||/\.onrender\.com$/.test(page.hostname||'')))return '';
   candidate=(page.protocol==='https:'?'wss:':'ws:')+'//'+page.host+'/rooms';
  }
  try{
   const url=new URL(candidate);
   if(url.protocol==='https:')url.protocol='wss:';else if(url.protocol==='http:')url.protocol='ws:';
   if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||(page.protocol==='https:'&&url.protocol!=='wss:'))return '';
   if(url.pathname==='/')url.pathname='/rooms';
   url.hash='';return url.href;
  }catch{return '';}
 }
 class NetworkClient{
  constructor(options={}){
   this.url=options.url||resolveServerURL(DV_NETWORK_CONFIG_SAFE(),root.location);
   this.Socket=options.Socket||root.WebSocket;this.onMessage=options.onMessage||(()=>{});this.onStatus=options.onStatus||(()=>{});
   this.storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:safeSessionStorage();
   this.socket=null;this.room=null;this.side=0;this.token='';this.intentional=false;this.attempts=0;this.latency=null;this.status='idle';
   this.storageKey='dragon-versus-online-room-v1';this.restore();
  }
  restore(){try{const saved=JSON.parse(this.storage?.getItem(this.storageKey)||'null');if(saved?.url===this.url&&/^\d{6}$/.test(saved.code)&&typeof saved.token==='string'){this.token=saved.token;this.room={code:saved.code};}}catch{}}
  remember(){try{if(this.token&&this.room)this.storage?.setItem(this.storageKey,JSON.stringify({url:this.url,code:this.room.code,token:this.token}));else this.storage?.removeItem(this.storageKey);}catch{}}
  setStatus(status,message){this.status=status;this.onStatus(status,message||'');}
  connect(){
   if(this.socket?.readyState===1)return Promise.resolve(this);
   if(this.opening)return this.opening;
   if(!this.url||!this.Socket)return Promise.reject(new Error('尚未配置联机服务器，请设置 Render 服务地址。'));
   this.intentional=false;this.setStatus(this.attempts?'reconnecting':'connecting');
   this.opening=new Promise((resolve,reject)=>{
    const socket=this.socket=new this.Socket(this.url);let settled=false;
    const fail=message=>{if(settled)return;settled=true;clearTimeout(this.connectTimer);this.opening=null;reject(new Error(message));};
    this.connectTimer=setTimeout(()=>{fail('服务器启动较慢或无法连接，请稍后重试。');socket.close();},70000);
    socket.onopen=()=>{
     if(socket!==this.socket)return;
     settled=true;clearTimeout(this.connectTimer);this.opening=null;this.attempts=0;this.setStatus('connected');
     clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping',sent:Date.now()}),10000);
     this.pingTimer.unref?.();
     if(this.token&&this.room?.code)this.send({type:'resume',version:DV.NetProtocol.VERSION,code:this.room.code,token:this.token});
     resolve(this);
    };
    socket.onmessage=event=>{if(socket===this.socket)this.receive(event.data);};
    socket.onerror=()=>{if(!settled)fail('无法连接联机服务器，请检查网络；免费服务首次启动可能需约一分钟。');};
    socket.onclose=()=>{
     if(socket!==this.socket)return;
     fail('联机连接已断开。');clearInterval(this.pingTimer);
     if(this.intentional){this.setStatus('closed');return;}
     this.setStatus('disconnected','连接中断，正在尝试恢复房间。');
     if(this.token&&this.room&&this.attempts<7){
      const delay=Math.min(500*2**this.attempts++,4000);
      this.reconnectTimer=setTimeout(()=>this.connect().catch(()=>{}),delay);
     }
    };
   });return this.opening;
  }
  receive(raw){
   let message;try{message=typeof raw==='string'?JSON.parse(raw):null;}catch{return;}
   if(!message||typeof message.type!=='string')return;
   if(message.type==='pong'){if(Number.isFinite(message.sent))this.latency=Math.max(0,Date.now()-message.sent);return;}
   if(message.type==='room'){
    this.room=message.room;if(message.side===0||message.side===1)this.side=message.side;
    if(typeof message.token==='string')this.token=message.token;this.remember();
   }
   if(message.type==='error'&&['ROOM_NOT_FOUND','INVALID_TOKEN','RESUME_EXPIRED','RESUME_DENIED','ROOM_CLOSED'].includes(message.code)){this.room=null;this.token='';this.remember();}
   this.onMessage(message);
  }
  send(message){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify(message));return true;}
  create(fighterId,assistId){return this.send({type:'create',version:DV.NetProtocol.VERSION,fighterId,assistId});}
  join(code,fighterId,assistId){return this.send({type:'join',version:DV.NetProtocol.VERSION,code:String(code).trim(),fighterId,assistId});}
  command(action,arg){return this.send({type:'command',action,...(arg===undefined?{}:{arg})});}
  input(key,value){if(!value&&this.room?.phase!=='battle')return false;return this.send({type:'input',key,value:!!value});}
  releaseAll(){for(const key of ['left','right','guard','charge'])this.input(key,false);}
  leave(){
   this.intentional=true;clearTimeout(this.reconnectTimer);clearTimeout(this.connectTimer);clearInterval(this.pingTimer);
   this.releaseAll();this.send({type:'leave'});this.room=null;this.token='';this.remember();this.socket?.close();this.setStatus('closed');
  }
 }
 function safeSessionStorage(){try{return root.sessionStorage;}catch{return null;}}
 function DV_NETWORK_CONFIG_SAFE(){return root.DV_NETWORK_CONFIG||{};}
 Object.assign(DV,{NetworkClient,resolveServerURL});
 if(typeof module!=='undefined')module.exports={NetworkClient,resolveServerURL};
})(globalThis);
