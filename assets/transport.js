(function (root) {
  'use strict';
  // A Google-hosted HTML bridge uses google.script.run and postMessage.
  // No unreadable no-cors response is ever treated as a successful write.
  function Transport(endpoint) {
    this.endpoint=endpoint; this.frame=null; this.peer=null; this.peerOrigin=null;
    this.channel=crypto.randomUUID(); this.pending=new Map(); this.ready=null;
    this.onMessage=this.onMessage.bind(this);
  }
  Transport.prototype.onMessage=function(event) {
    var message=event.data;
    if(!message || message.channel!==this.channel || message.namespace!=='behavioral-lab-v1')return;
    var origin;
    try { origin=new URL(event.origin); } catch (_) { return; }
    if(origin.protocol!=='https:' || !(origin.hostname==='script.google.com' || /^[a-z0-9-]+\.googleusercontent\.com$/.test(origin.hostname)))return;
    if(this.peer && (event.source!==this.peer || event.origin!==this.peerOrigin))return;
    if(message.type==='ready' && !this.peer) {
      this.peer=event.source;this.peerOrigin=event.origin;
      if(this.resolveReady)this.resolveReady();
    } else if(message.type==='result' && this.peer) {
      var task=this.pending.get(message.requestId);if(!task)return;
      clearTimeout(task.timer);this.pending.delete(message.requestId);
      if(message.result && message.result.ok===true)task.resolve(message.result);
      else { var error=new Error(message.result && message.result.error || 'ارتباط با محل ثبت پاسخ برقرار نشد.');error.retryable=!!(message.result&&message.result.retryable);task.reject(error); }
    }
  };
  Transport.prototype.connect=function() {
    var self=this;if(this.ready)return this.ready;
    this.ready=new Promise(function(resolve,reject){
      var timer=setTimeout(function(){self.dispose();var error=new Error('ارتباط با سرویس ثبت برقرار نشد. اینترنت و نشانی Apps Script را بررسی کنید. پاسخ‌ها روی این دستگاه باقی مانده‌اند.');error.retryable=true;reject(error);},35000);
      self.resolveReady=function(){clearTimeout(timer);resolve();};
      try {
        var url=new URL(self.endpoint);
        if(url.origin!=='https://script.google.com' || !/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname))throw new Error('نشانی تنظیم‌شده باید نشانی Web App گوگل و با پسوند /exec باشد.');
        url.searchParams.set('origin',location.origin);url.searchParams.set('channel',self.channel);
        self.frame=document.createElement('iframe');self.frame.hidden=true;self.frame.title='ارتباط امن با سرویس ثبت';self.frame.referrerPolicy='no-referrer';
        window.addEventListener('message',self.onMessage);self.frame.src=url.href;document.body.appendChild(self.frame);
      } catch(error) {clearTimeout(timer);self.dispose();reject(error);}
    });
    return this.ready;
  };
  Transport.prototype.call=async function(action,payload) {
    await this.connect();var self=this;var requestId=crypto.randomUUID();
    return new Promise(function(resolve,reject){
      var timer=setTimeout(function(){self.pending.delete(requestId);var error=new Error('تأیید ثبت هنوز دریافت نشده است. دوباره تلاش کنید؛ شناسهٔ یکسان از ثبت تکراری جلوگیری می‌کند.');error.retryable=true;reject(error);},45000);
      self.pending.set(requestId,{resolve:resolve,reject:reject,timer:timer});
      self.peer.postMessage({namespace:'behavioral-lab-v1',channel:self.channel,type:'request',requestId:requestId,action:action,payload:payload},self.peerOrigin);
    });
  };
  Transport.prototype.dispose=function(){window.removeEventListener('message',this.onMessage);if(this.frame)this.frame.remove();this.frame=null;this.peer=null;this.ready=null;};
  root.LabTransport=Transport;
})(window);
