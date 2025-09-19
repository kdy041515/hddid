/*! Android 7.1-safe index.js (WebView/Chrome 52)
 * - No async/await / fetch
 * - Uses jQuery 1.12 Deferred/XHR
 * - Robust XML text parsing (regex) to dodge DOMParser quirks
 * - Media loaders with autoplay + cache-busting + timeouts
 * - E(L) priority: NOTICE_LIST_E preempts NOTICE_LIST_L
 * - KST clock + schedule filtering (stime~etime)
 * - Plenty of console logs for field debugging
 */
;(function(window, document, $){
  'use strict';

  // =========================
  // 환경 설정
  // =========================
  var KST_OFFSET_MINUTES = 9 * 60; // Asia/Seoul UTC+9
  var BASE = (function(){
    try{
      var o = location.origin.replace(/\/+$/,''); 
      return o + '/';
    }catch(_){ return ''; }
  })();
  var $timeEl = document.getElementById('time');

  // =========================
  // 유틸
  // =========================
  function resolved(v){ var d=$.Deferred(); d.resolve(v); return d.promise(); }
  function rejected(e){ var d=$.Deferred(); d.reject(e); return d.promise(); }
  function delay(ms){ var d=$.Deferred(); setTimeout(function(){ d.resolve(); }, Math.max(ms||0,0)); return d.promise(); }
  function pad2(n){ n=String(n); while(n.length<2) n='0'+n; return n; }
  function getKSTDateObject(){ var now=new Date(); var utc=now.getTime()+now.getTimezoneOffset()*60000; return new Date(utc+KST_OFFSET_MINUTES*60000); }
  function getNowHMM(){ var d=getKSTDateObject(); return pad2(d.getHours())+':'+pad2(d.getMinutes()); }
  function fmtKoreanTime(){
    var d=getKSTDateObject(), month=d.getMonth()+1, day=d.getDate(), weeks=['일','월','화','수','목','금','토'], week=weeks[d.getDay()];
    var hour=d.getHours(), minute=pad2(d.getMinutes()), period=hour<12?'오전':'오후', hour12=hour%12; if(hour12===0) hour12=12;
    return month+'월 '+day+'일('+week+') '+period+' '+hour12+':'+minute;
  }
  function startClock(){ function tick(){ if($timeEl) $timeEl.textContent=fmtKoreanTime(); } tick(); setInterval(tick,1000); }
  function absolutize(src){ if(!src) return src; if(/^https?:\/\//i.test(src)) return src; return BASE + String(src).replace(/^\/+/, ''); }
  function cacheBust(u){ return u + (/\?/.test(u)?'&':'?') + 't=' + Date.now(); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  // Debug helpers
  function log(){ try{ console.log.apply(console, arguments); }catch(_){ } }
  function warn(){ try{ console.warn.apply(console, arguments); }catch(_){ } }
  function error(){ try{ console.error.apply(console, arguments); }catch(_){ } }

  // =========================
  // 인벤토리 수집
  // =========================
  function collectMediaBuffers(rootSelector, mediaSelector){
    var wrappers=[], elements=[], items=document.querySelectorAll(rootSelector+' .item');
    for(var i=0;i<items.length;i++){
      var it=items[i], m=it.querySelector(mediaSelector);
      if(m){ wrappers.push(it); elements.push(m); }
    }
    return {wrappers:wrappers, elements:elements};
  }
  var videoBuffers = collectMediaBuffers('.video_area', 'video');
  var imageBuffers = collectMediaBuffers('.image_area', 'img');

  // =========================
  // MEDIA 로더 (Android 7.1 호환)
  // =========================
  function safePlay(video){
    try { var p = video.play(); if(p && p.then){ p['catch'](function(e){ warn('[play()] blocked', e); }); } }
    catch(e){ warn('[play()] failed', e); }
  }

  // Autoplay 정책 회피: unmuted→실패시 muted 재시도
  function setVideoSource(video, src){
    if(!video) return resolved(false);
    try{ video.pause(); }catch(_){}
    video.setAttribute('playsinline','');
    video.removeAttribute('muted'); // 우선 unmuted
    video.muted = false;

    if(!src){
      video.removeAttribute('src'); try{ video.load(); }catch(_){}
      return resolved(false);
    }

    var url = cacheBust(absolutize(src));
    video.src = url;
    try{ video.load(); }catch(_){}

    var dfd = $.Deferred(), settled=false, timer=null;
    function finish(ok){
      if(settled) return; settled=true;
      if(timer){ clearTimeout(timer); timer=null; }
      dfd.resolve(!!ok);
    }
    function onLoaded(){
      try{
        video.muted=false; video.removeAttribute('muted');
        safePlay(video);
        finish(true);
      }catch(e){
        try{
          video.muted=true; video.setAttribute('muted','');
          safePlay(video);
          finish(true);
        }catch(e2){ finish(false); }
      }
    }
    function onError(){ finish(false); }

    video.addEventListener('loadeddata', onLoaded, false);
    video.addEventListener('canplay', onLoaded, false);
    video.addEventListener('error', onError, false);

    timer = setTimeout(function(){
      if(video.readyState >= 2){ onLoaded(); } else { finish(false); }
    }, 7000);

    if(video.readyState >= 2){ onLoaded(); }
    return dfd.promise();
  }

  function setImageSource(img, src){
    if(!img) return resolved(false);
    if(!src){ img.removeAttribute('src'); return resolved(false); }

    var url = absolutize(src);
    var finalUrl = cacheBust(url);

    if(img.getAttribute('src')===url && img.complete && img.naturalWidth>0){
      return resolved(true);
    }

    var dfd=$.Deferred(), done=false, timer=null, ok=false;
    function finish(){
      if(done) return; done=true;
      if(timer){ clearTimeout(timer); timer=null; }
      dfd.resolve(ok || (img.complete && img.naturalWidth>0));
    }
    function onLoad(){ ok=true; finish(); }
    function onErr(){ ok=false; finish(); }

    img.addEventListener('load', onLoad, false);
    img.addEventListener('error', onErr, false);
    timer=setTimeout(finish, 7000);

    img.src = finalUrl;
    if(img.complete && img.naturalWidth>0) finish();
    return dfd.promise();
  }

  // =========================
  // xml.js 연동 (Android 5 WebView 호환)
  // =========================
  function waitForXmlData(timeoutMs){
    if(window.xml_data && typeof window.xml_data === 'object'){
      return resolved(window.xml_data);
    }

    var dfd = $.Deferred();
    var done = false;
    var pollTimer = null;
    var timeoutTimer = null;
    var limit = typeof timeoutMs === 'number' ? timeoutMs : 20000;

    function finish(data, ok){
      if(done){ return; }
      done = true;
      if(pollTimer){ clearInterval(pollTimer); pollTimer = null; }
      if(timeoutTimer){ clearTimeout(timeoutTimer); timeoutTimer = null; }
      if(typeof $ === 'function' && $.fn && $.fn.off){
        $(document).off('xmlDataReady.index');
      }
      if(ok === false){ dfd.reject(data); }
      else{ dfd.resolve(data); }
    }

    function handleIncoming(data){
      if(!data && window.xml_data && typeof window.xml_data === 'object'){
        data = window.xml_data;
      }
      if(data && typeof data === 'object'){
        finish(data, true);
      }
    }

    if(typeof $ === 'function' && $.fn && $.fn.on){
      $(document).on('xmlDataReady.index', function(evt, data){
        $(document).off('xmlDataReady.index');
        handleIncoming(data);
      });
    }

    pollTimer = setInterval(function(){
      if(window.xml_data && typeof window.xml_data === 'object'){
        handleIncoming(window.xml_data);
      }
    }, 200);

    timeoutTimer = setTimeout(function(){
      finish('XML_DATA_TIMEOUT', false);
    }, limit);

    return dfd.promise();
  }

  function toArray(obj){
    if(!obj){ return []; }
    if(obj instanceof Array){ return obj; }
    if(typeof Array.isArray === 'function' && Array.isArray(obj)){ return obj; }
    return [obj];
  }

  function sanitizeUrl(url){
    if(!url){ return ''; }
    return String(url).replace(/^\s+|\s+$/g, '');
  }

  function normalizeTime(value){
    if(!value){ return ''; }
    var str = String(value);
    if(str.indexOf(':') !== -1){ return str; }
    var digits = str.replace(/[^0-9]/g, '');
    if(digits.length === 4){ return digits.substr(0,2) + ':' + digits.substr(2,2); }
    if(digits.length === 3){ return '0' + digits.substr(0,1) + ':' + digits.substr(1,2); }
    if(digits.length === 2){ return digits + ':00'; }
    if(digits.length === 1){ return '0' + digits + ':00'; }
    return str;
  }

  function pickPtime(first, second, fallback){
    var n1 = parseFloat(first);
    if(isFinite(n1) && n1 > 0){ return n1; }
    var n2 = parseFloat(second);
    if(isFinite(n2) && n2 > 0){ return n2; }
    if(isFinite(fallback) && fallback > 0){ return fallback; }
    return 10;
  }

  function convertNoticeList(list){
    var out = [];
    var arr = toArray(list);
    for(var i=0;i<arr.length;i++){
      var item = arr[i];
      if(!item){ continue; }
      var frames = toArray(item.FRAME_LIST);
      var stime = normalizeTime(item.STIME);
      var etime = normalizeTime(item.ETIME);
      for(var j=0;j<frames.length;j++){
        var frame = frames[j];
        if(!frame){ continue; }
        var url = sanitizeUrl(frame.FILE_URL);
        if(!url){ continue; }
        out.push({
          noticeId: item.NOTICE_ID || '',
          noticeName: item.NOTICE_NAME || '',
          stime: stime,
          etime: etime,
          ptime: pickPtime(frame.PTIME, item.PTIME, 10),
          fileURL: url,
          type: frame.TYPE || ''
        });
      }
    }
    return out;
  }

  function transformXmlData(raw){
    var data = { header:{}, L:[], R:[], E:[] };
    if(!raw || typeof raw !== 'object'){ return data; }
    data.header = raw.header || {};
    data.L = convertNoticeList(raw.arr_notice_list_l);
    data.R = convertNoticeList(raw.arr_notice_list_r);
    data.E = convertNoticeList(raw.arr_notice_list_e);
    return data;
  }

  function applyHeaderInfo(header){
    if(!header){ return; }
    try{
      var name = header.KIOSK_NOTICE || header.BRN_NAME || '';
      if(name){
        var waitName = document.querySelector('.video_area .wait .name');
        if(waitName){ waitName.textContent = name; }
      }
    }catch(_){}
  }

  // =========================
  // 시간/스케줄 판단
  // =========================
  function isActiveNow(stime, etime){
    // 빈 값이면 항상 활성
    if(!stime || !etime) return true;
    var now = getNowHMM();
    // 단순 비교(HH:MM). 자정 넘김은 지원 안함(요구시 보완)
    return (now >= stime && now <= etime);
  }

  // =========================
  // 좌/우 플레이어
  // =========================
  function LeftVideoLoop(items, buffers){
    this.items = Array.isArray(items)?items.slice():[];
    this.idx=0; this.timer=null; this.eventMode=false;
    this.videoEls=(buffers&&buffers.elements)||[]; this.videoWraps=(buffers&&buffers.wrappers)||[];
    this.activeBuf = 0;
  }
  LeftVideoLoop.prototype.nextIndex = function(start){
    var i=start; var tries=0;
    while(tries < this.items.length){
      if(i >= this.items.length) i=0;
      var it=this.items[i];
      if(it && it.fileURL && isActiveNow(it.stime, it.etime)) return i;
      i++; tries++;
    }
    return -1;
  };
  LeftVideoLoop.prototype.show = function(i){
    var self=this, item=this.items[i]; if(!item) return resolved(false);
    var bufIndex = this.activeBuf % (this.videoEls.length||1);
    var video = this.videoEls[bufIndex];
    var wrap = this.videoWraps[bufIndex];
    for(var k=0;k<this.videoWraps.length;k++){
      if(this.videoWraps[k]===wrap){ this.videoWraps[k].className = (this.videoWraps[k].className||'').replace(/\bis-active\b/g,'') + ' is-active'; }
      else{ this.videoWraps[k].className = (this.videoWraps[k].className||'').replace(/\bis-active\b/g,''); }
    }
    log('[L] play', item.fileURL, 'ptime=', item.ptime, 'slot=', bufIndex);
    return setVideoSource(video, item.fileURL).then(function(ok){
      if(!ok){ warn('[L] video load failed → skip'); return resolved(false); }
      return delay(clamp((item.ptime||10)*1000, 2000, 600000));
    });
  };
  LeftVideoLoop.prototype.loop = function(){
    var self=this;
    function step(){
      if(self.eventMode){ setTimeout(step, 500); return; }
      var ni = self.nextIndex(self.idx);
      if(ni===-1){ setTimeout(step, 1000); return; }
      self.idx = (ni+1) % self.items.length;
      self.show(ni).then(function(){ setTimeout(step, 200); });
    }
    step();
  };
  LeftVideoLoop.prototype.stopForEvent = function(){
    this.eventMode = true;
    try{
      for(var i=0;i<this.videoEls.length;i++){
        var v=this.videoEls[i];
        v.pause(); v.removeAttribute('src'); v.load();
      }
    }catch(_){}
  };
  LeftVideoLoop.prototype.resume = function(){ this.eventMode=false; };

  function RightImageLoop(items, buffers){
    this.items = Array.isArray(items)?items.slice():[];
    this.idx=0; this.timer=null;
    this.imgEls=(buffers&&buffers.elements)||[]; this.imgWraps=(buffers&&buffers.wrappers)||[];
    this.activeBuf = 0;
  }
  RightImageLoop.prototype.nextIndex = function(start){
    var i=start; var tries=0;
    while(tries < this.items.length){
      if(i >= this.items.length) i=0;
      var it=this.items[i];
      if(it && it.fileURL && isActiveNow(it.stime, it.etime)) return i;
      i++; tries++;
    }
    return -1;
  };
  RightImageLoop.prototype.show = function(i){
    var self=this, item=this.items[i]; if(!item) return resolved(false);
    var bufIndex = this.activeBuf % (this.imgEls.length||1);
    var img = this.imgEls[bufIndex];
    var wrap = this.imgWraps[bufIndex];
    for(var k=0;k<this.imgWraps.length;k++){
      if(this.imgWraps[k]===wrap){ this.imgWraps[k].className = (this.imgWraps[k].className||'').replace(/\bis-active\b/g,'') + ' is-active'; }
      else{ this.imgWraps[k].className = (this.imgWraps[k].className||'').replace(/\bis-active\b/g,''); }
    }
    log('[R] show', item.fileURL, 'ptime=', item.ptime, 'slot=', bufIndex);
    return setImageSource(img, item.fileURL).then(function(){
      return delay(clamp((item.ptime||10)*1000, 1000, 600000));
    });
  };
  RightImageLoop.prototype.loop = function(){
    var self=this;
    function step(){
      var ni = self.nextIndex(self.idx);
      if(ni===-1){ setTimeout(step, 1000); return; }
      self.idx = (ni+1) % self.items.length;
      self.show(ni).then(function(){ setTimeout(step, 120); });
    }
    step();
  };

  // 이벤트 영역: L을 중단시키고 즉시 재생(동영상/이미지 어떤 URL이어도 붙이는 방식)
  function EventOverride(items, leftLoop, videoElem){
    this.items = Array.isArray(items)?items.slice():[];
    this.idx=0; this.left=leftLoop; this.video=videoElem;
    this.busy=false;
  }
  EventOverride.prototype.nextIndex = function(start){
    var i=start; var tries=0;
    while(tries < this.items.length){
      if(i >= this.items.length) i=0;
      var it=this.items[i];
      if(it && it.fileURL && isActiveNow(it.stime, it.etime)) return i;
      i++; tries++;
    }
    return -1;
  };
  EventOverride.prototype.playOnce = function(i){
    var self=this, it=this.items[i]; if(!it) return resolved(false);
    log('[E] PREEMPT', it.fileURL);
    this.left.stopForEvent();

    // 이벤트는 동영상만 처리(요구시 이미지 처리 추가 가능)
    return setVideoSource(this.video, it.fileURL).then(function(ok){
      if(!ok){ warn('[E] load failed'); return resolved(false); }
      return delay(clamp((it.ptime||10)*1000, 2000, 600000));
    }).then(function(){
      try{
        self.video.pause(); self.video.removeAttribute('src'); self.video.load();
      }catch(_){}
      self.left.resume();
      return true;
    });
  };
  EventOverride.prototype.loop = function(){
    var self=this;
    function tick(){
      if(self.busy){ setTimeout(tick, 200); return; }
      var ni = self.nextIndex(self.idx);
      if(ni===-1){ setTimeout(tick, 1000); return; }
      self.idx = (ni+1) % self.items.length;
      self.busy = true;
      self.playOnce(ni).always(function(){ self.busy=false; setTimeout(tick, 200); });
    }
    tick();
  };

  // =========================
  // BOOT
  // =========================
  function boot(){
    startClock();

    waitForXmlData().then(function(raw){
      var data = transformXmlData(raw);
      applyHeaderInfo(data.header);
      log('[XML] ready', data);

      // 좌: 동영상, 우: 이미지, 이벤트: 좌 우선 중단
      var left = new LeftVideoLoop(data.L, videoBuffers);
      var right = new RightImageLoop(data.R, imageBuffers);
      left.loop();
      right.loop();

      // 이벤트용 오버레이 비디오 (좌 영역의 첫 번째 비디오 재사용 가능)
      var evVideo = (videoBuffers && videoBuffers.elements && videoBuffers.elements[0]) || null;
      if(evVideo && data.E && data.E.length){
        var ev = new EventOverride(data.E, left, evVideo);
        ev.loop();
      }
    })
    .fail(function(err){
      error('[BOOT] XML data unavailable → fallback empty rotation', err);
      // fallback: 빈 루프라도 킵 (디버깅 가시화)
      (function blinkError(){
        var el = document.getElementById('error_text');
        if(el){ el.style.display = el.style.display==='none' ? '' : 'none'; }
        setTimeout(blinkError, 800);
      })();
    });
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(boot, 0);
  }else{
    document.addEventListener('DOMContentLoaded', boot, false);
  }

})(window, document, window.jQuery || window.$);
