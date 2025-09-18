(function(){
  var KIOSK_XML_URL = './xml/kiosk_contents.xml';
  var KST_OFFSET_MINUTES = 9 * 60; // Asia/Seoul UTC+9
  var $timeEl = document.getElementById('time');
  var videoBuffers = collectMediaBuffers('.video_area', 'video');
  var imageBuffers = collectMediaBuffers('.image_area', 'img');

  function collectMediaBuffers(rootSelector, mediaSelector){
    var wrappers = [];
    var elements = [];
    var items = document.querySelectorAll(rootSelector + ' .item');
    for(var i = 0; i < items.length; i++){
      var item = items[i];
      var media = item.querySelector(mediaSelector);
      if(media){
        wrappers.push(item);
        elements.push(media);
      }
    }
    return { wrappers: wrappers, elements: elements };
  }

  function resolvedPromise(value){
    var dfd = $.Deferred();
    dfd.resolve(value);
    return dfd.promise();
  }

  function delay(ms){
    var dfd = $.Deferred();
    setTimeout(function(){ dfd.resolve(); }, Math.max(ms || 0, 0));
    return dfd.promise();
  }

  function toggleClass(el, className, shouldHave){
    if(!el) return;
    if(el.classList){
      if(shouldHave){ el.classList.add(className); }
      else { el.classList.remove(className); }
      return;
    }
    var current = el.className || '';
    var has = (' ' + current + ' ').indexOf(' ' + className + ' ') >= 0;
    if(shouldHave){
      if(!has){ el.className = current ? (current + ' ' + className) : className; }
    }else if(has){
      var replaced = (' ' + current + ' ').replace(' ' + className + ' ', ' ');
      el.className = replaced.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }
  }

  function safePlay(video) {
    try {
      video.play();
    } catch(e) {
      try{ console.error('play error', e); }catch(ignore){}
    }
  }

  function setVideoSource(video, src){
    if(!video) return resolvedPromise(false);
    try{ video.pause(); }catch(ignore){}
    video.muted = true;
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');

    if(!src){
      video.removeAttribute('src');
      try{ video.load(); }catch(ignore){}
      return resolvedPromise(false);
    }

    video.src = src + '?t=' + Date.now();
    try{ video.load(); }catch(ignore){}

    var dfd = $.Deferred();
    var settled = false;
    var timer = null;

    function cleanup(){
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
      video.removeEventListener('error', onError);
      if(timer){ clearTimeout(timer); timer = null; }
    }

    function finish(ok){
      if(settled) return;
      settled = true;
      cleanup();
      if(ok){
        try{
          video.removeAttribute('muted');
          video.volume = 1;
          video.play();
        }catch(ignore){}
        dfd.resolve(true);
      }else{
        dfd.resolve(false);
      }
    }

    function onLoaded(){ finish(true); }
    function onError(){ finish(false); }

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('canplay', onLoaded);
    video.addEventListener('error', onError);

    timer = setTimeout(function(){
      if(video.readyState >= 2){ finish(true); }
      else { finish(false); }
    }, 5000);

    if(video.readyState >= 2){ finish(true); }

    return dfd.promise();
  }

  function setImageSource(img, src){
    if(!img) return resolvedPromise(false);
    if(!src){
      img.removeAttribute('src');
      return resolvedPromise(false);
    }
    if(img.getAttribute('src') === src && img.complete && img.naturalWidth > 0){
      return resolvedPromise(true);
    }

    var dfd = $.Deferred();
    var settled = false;
    var ok = false;
    var timer = null;

    function cleanup(){
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      if(timer){ clearTimeout(timer); timer = null; }
    }

    function finish(){
      if(settled) return;
      settled = true;
      cleanup();
      if(ok || (img.complete && img.naturalWidth > 0)){ dfd.resolve(true); }
      else { dfd.resolve(false); }
    }

    function onLoad(){ ok = true; finish(); }
    function onError(){ ok = false; finish(); }

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    timer = setTimeout(finish, 5000);

    img.src = src;

    if(img.complete && img.naturalWidth > 0){
      finish();
    }

    return dfd.promise();
  }

  function pad2(n){
    var str = String(n);
    while(str.length < 2){ str = '0' + str; }
    return str;
  }

  function getKSTDateObject(){
    var now = new Date();
    var utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcTime + KST_OFFSET_MINUTES * 60000);
  }

  function getKSTDate(){
    var d = getKSTDateObject();
    return {
      y: String(d.getFullYear()),
      m: pad2(d.getMonth() + 1),
      d: pad2(d.getDate()),
      hh: pad2(d.getHours()),
      mm: pad2(d.getMinutes()),
      ss: pad2(d.getSeconds())
    };
  }

  function toHHMMSS(str){
    var s = (str || '').replace(/^\s+|\s+$/g, '');
    if(s.length === 4) return s + '00';
    if(s.length === 6) return s;
    return '000000';
  }

  function compareHHMMSS(a, b){
    if(a === b) return 0;
    return a < b ? -1 : 1;
  }

  function yyyymmddTodayKST(){
    var parts = getKSTDate();
    return parts.y + parts.m + parts.d;
  }

  var WEEK_KO = ['일','월','화','수','목','금','토'];

  function fmtKoreanTime(){
    var d = getKSTDateObject();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var week = WEEK_KO[d.getDay()];
    var hour = d.getHours();
    var minute = pad2(d.getMinutes());
    var period = hour < 12 ? '오전' : '오후';
    var hour12 = hour % 12;
    if(hour12 === 0) hour12 = 12;
    return month + '월 ' + day + '일(' + week + ') ' + period + ' ' + hour12 + ':' + minute;
  }

  function startClock(){
    function tick(){
      if($timeEl){
        $timeEl.textContent = fmtKoreanTime();
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  function loadKioskXml(){
    var dfd = $.Deferred();
    $.ajax({
      url: KIOSK_XML_URL,
      dataType: 'text',
      cache: false
    }).done(function(txt){
      try {
        var parser = new window.DOMParser();
        var xml = parser.parseFromString(txt, 'text/xml');

        function headerPick(target){
          var nodes = xml.querySelectorAll('HEADER > ' + target);
          if(nodes && nodes.length){
            var node = nodes[0];
            if(node && node.textContent){
              return node.textContent.replace(/^\s+|\s+$/g, '');
            }
          }
          return '';
        }

        function pick(parentTag){
          var result = [];
          var parentNodes = xml.querySelectorAll(parentTag + ' > NOTICE_INFO');
          for(var i = 0; i < parentNodes.length; i++){
            var info = parentNodes[i];
            var sch = info.querySelector('SCH_TYPE');
            var frameList = info.querySelector('FRAME_LIST');
            var frame = null;
            if(frameList){ frame = frameList.querySelector('FRAME_INFO'); }
            var item = {
              conName: '',
              stime: '',
              etime: '',
              ptime: 10,
              fileURL: ''
            };
            var conNameNode = info.querySelector('CON_NAME');
            if(conNameNode && conNameNode.textContent){
              item.conName = conNameNode.textContent.replace(/^\s+|\s+$/g, '');
            }
            if(sch){
              item.stime = sch.getAttribute('stime') || '';
              item.etime = sch.getAttribute('etime') || '';
            }
            if(frameList){
              var ptimeAttr = frameList.getAttribute('ptime');
              var parsed = parseFloat(ptimeAttr || '10');
              item.ptime = isFinite(parsed) ? parsed : 10;
            }
            if(frame){
              item.fileURL = frame.getAttribute('fileURL') || '';
            }
            result.push(item);
          }
          return result;
        }

        var data = {
          NAME: headerPick('BRN_NAME'),
          L: pick('NOTICE_LIST_L'),
          R: pick('NOTICE_LIST_R'),
          E: pick('NOTICE_LIST_E')
        };
        dfd.resolve(data);
      } catch(err){
        dfd.reject(err);
      }
    }).fail(function(xhr, status, err){
      dfd.reject(err || status);
    });
    return dfd.promise();
  }

  function LeftVideoLoop(items, buffers){
    this.items = Array.isArray(items) ? items.slice() : [];
    this.idx = 0;
    this.swapTimer = null;
    this.prerollTimer = null;
    this.isEventPlaying = false;
    this.videoWrappers = buffers && buffers.wrappers ? buffers.wrappers : [];
    this.videoEls = buffers && buffers.elements ? buffers.elements : [];
    var activeIndex = -1;
    for(var i = 0; i < this.videoWrappers.length; i++){
      if(this.videoWrappers[i].classList && this.videoWrappers[i].classList.contains('is-active')){
        activeIndex = i;
        break;
      }
    }
    this.activeBufferIndex = activeIndex >= 0 ? activeIndex : 0;
    this.hasActiveContent = activeIndex >= 0;
    this.preloaded = null;
    this.preloadPromise = null;
    this.playToken = 0;
    this.preloadToken = 0;
    this.preRollLeadSeconds = 0.3;
    this.pendingResumeIndex = 0;
  }

  LeftVideoLoop.prototype.current = function(){
    if(this.items.length === 0) return null;
    return this.items[this.idx % this.items.length];
  };

  LeftVideoLoop.prototype.nextIdx = function(){
    if(this.items.length === 0) return 0;
    this.idx = (this.idx + 1) % this.items.length;
    return this.idx;
  };

  LeftVideoLoop.prototype.clearTimers = function(){
    if(this.swapTimer){ clearTimeout(this.swapTimer); this.swapTimer = null; }
    if(this.prerollTimer){ clearTimeout(this.prerollTimer); this.prerollTimer = null; }
  };

  LeftVideoLoop.prototype.stop = function(){
    this.clearTimers();
    for(var i = 0; i < this.videoEls.length; i++){
      try{ this.videoEls[i].pause(); }catch(ignore){}
    }
  };

  LeftVideoLoop.prototype.getStandbyIndex = function(){
    if(this.videoEls.length <= 1){
      return this.activeBufferIndex;
    }
    return (this.activeBufferIndex + 1) % this.videoEls.length;
  };

  LeftVideoLoop.prototype.setActiveBuffer = function(idx){
    var prev = this.activeBufferIndex;
    for(var i = 0; i < this.videoWrappers.length; i++){
      toggleClass(this.videoWrappers[i], 'is-active', i === idx);
    }
    if(prev !== idx && this.videoEls[prev]){
      try{ this.videoEls[prev].pause(); }catch(ignore){}
    }
    this.activeBufferIndex = idx;
    this.hasActiveContent = true;
  };

  LeftVideoLoop.prototype.durationFor = function(item){
    if(!item) return 10;
    var num = parseFloat(item.ptime);
    if(!isFinite(num)){ num = 10; }
    return Math.max(num, 0.1);
  };

  LeftVideoLoop.prototype.loadIntoBuffer = function(bufferIdx, item, token){
    if(bufferIdx == null || !item) return resolvedPromise();
    var video = this.videoEls[bufferIdx];
    if(!video) return resolvedPromise();
    var src = (item.fileURL || '').replace(/^\s+|\s+$/g, '');
    var self = this;
    var dfd = $.Deferred();
    setVideoSource(video, src).done(function(ok){
      if(token !== self.playToken){ dfd.resolve(false); return; }
      if(!ok){ dfd.resolve(false); return; }
      dfd.resolve(true);
    }).fail(function(){
      dfd.resolve(false);
    });
    return dfd.promise();
  };

  LeftVideoLoop.prototype.preloadItemAtIndex = function(index, token){
    if(this.videoEls.length <= 1) return resolvedPromise();
    if(this.items.length === 0) return resolvedPromise();
    var item = this.items[index % this.items.length];
    if(!item) return resolvedPromise();
    var standbyIdx = this.getStandbyIndex();
    if(standbyIdx === this.activeBufferIndex) return resolvedPromise();
    var video = this.videoEls[standbyIdx];
    if(!video) return resolvedPromise();
    var loadToken = ++this.preloadToken;
    var src = (item.fileURL || '').replace(/^\s+|\s+$/g, '');
    var self = this;
    var dfd = $.Deferred();
    delay(1500).done(function(){
      setVideoSource(video, src).done(function(ok){
        if(token !== self.playToken || loadToken !== self.preloadToken){ dfd.resolve(); return; }
        if(!ok){ dfd.resolve(); return; }
        try{ video.pause(); }catch(ignore){}
        try{ video.currentTime = 0; }catch(ignore){}
        self.preloaded = { index: index % self.items.length, item: item, bufferIndex: standbyIdx, hasStarted: false };
        dfd.resolve();
      }).fail(function(){ dfd.resolve(); });
    }).fail(function(){ dfd.resolve(); });
    return dfd.promise();
  };

  LeftVideoLoop.prototype.triggerPreRoll = function(token, expectedIndex){
    if(token !== this.playToken || this.isEventPlaying) return resolvedPromise();
    var dfd = $.Deferred();
    var self = this;
    function proceed(){
      if(token !== self.playToken || self.isEventPlaying) return;
      var preloaded = self.preloaded;
      if(!preloaded || preloaded.index !== (expectedIndex % self.items.length)) return;
      var video = self.videoEls[preloaded.bufferIndex];
      if(!video || preloaded.hasStarted) return;
      preloaded.hasStarted = true;
      try{ video.currentTime = 0; }catch(ignore){}
      try{
        video.removeAttribute('muted');
        video.volume = 1;
        safePlay(video);
      }catch(ignore){}
    }

    function wrapped(){ proceed(); dfd.resolve(); }

    if(this.preloadPromise && typeof this.preloadPromise.always === 'function'){
      this.preloadPromise.always(wrapped);
    }else{
      wrapped();
    }
    return dfd.promise();
  };

  LeftVideoLoop.prototype.completeSwap = function(token, nextIndex){
    if(token !== this.playToken || this.isEventPlaying) return resolvedPromise();
    var dfd = $.Deferred();
    var self = this;

    function proceed(){
      if(token !== self.playToken || self.isEventPlaying){ dfd.resolve(); return; }
      var preloaded = self.preloaded;
      var targetIndex = nextIndex % self.items.length;
      var playPromise = null;
      if(preloaded && preloaded.index === targetIndex){
        playPromise = self.startPlaybackAtIndex(targetIndex, { usePreloaded: true, preloadedData: preloaded });
      }else{
        playPromise = self.startPlaybackAtIndex(targetIndex);
      }
      if(playPromise && typeof playPromise.always === 'function'){
        playPromise.always(function(){ dfd.resolve(); });
      }else{
        dfd.resolve();
      }
    }

    if(this.preloadPromise && typeof this.preloadPromise.always === 'function'){
      this.preloadPromise.always(proceed);
    }else{
      proceed();
    }
    return dfd.promise();
  };

  LeftVideoLoop.prototype.startPlaybackAtIndex = function(index, options){
    options = options || {};
    var dfd = $.Deferred();
    if(this.items.length === 0 || this.videoEls.length === 0){ dfd.resolve(); return dfd.promise(); }

    var playlistLength = this.items.length;
    var normalizedIndex = ((index % playlistLength) + playlistLength) % playlistLength;
    var defaultItem = this.items[normalizedIndex];
    var usePreloaded = options.usePreloaded === true;
    var preloadedData = options.preloadedData || null;
    var isEvent = options.isEvent === true;
    var item = (usePreloaded && preloadedData && preloadedData.item) ? preloadedData.item : defaultItem;
    if(!item){ dfd.resolve(); return dfd.promise(); }

    var token = ++this.playToken;
    this.isEventPlaying = isEvent;
    this.clearTimers();

    var consumedPreloaded = (usePreloaded && preloadedData && typeof preloadedData.bufferIndex === 'number') ? preloadedData : null;
    var self = this;
    var bufferIndex = null;
    var video = null;

    function handlePlayFailure(){
      var nextIndex = (normalizedIndex + 1) % playlistLength;
      self.startPlaybackAtIndex(nextIndex);
      dfd.resolve();
    }

    function afterPlayStarted(){
      if(!video){ dfd.resolve(); return; }
      var playTokenSnap = self.playToken;
      function onErr(){
        video.removeEventListener('error', onErr);
        if(playTokenSnap === self.playToken){
          var nextIndex = (normalizedIndex + 1) % playlistLength;
          self.startPlaybackAtIndex(nextIndex);
        }
      }
      video.addEventListener('error', onErr);

      self.idx = normalizedIndex;
      if(!isEvent){
        self.pendingResumeIndex = normalizedIndex;
      }

      if(isEvent){
        var durationEvent = self.durationFor(item);
        var eventToken = self.playToken;
        self.swapTimer = setTimeout(function(){
          if(eventToken !== self.playToken) return;
          self.isEventPlaying = false;
          var resumeIndex = self.pendingResumeIndex % Math.max(self.items.length, 1);
          self.startPlaybackAtIndex(resumeIndex);
        }, Math.max(durationEvent * 1000, 0));
        dfd.resolve();
        return;
      }

      var duration = self.durationFor(item);
      var nextIndex = (normalizedIndex + 1) % playlistLength;

      if(self.videoEls.length > 1){
        var preloadToken = self.playToken;
        self.preloadPromise = self.preloadItemAtIndex(nextIndex, preloadToken);
        var lead = Math.min(duration, self.preRollLeadSeconds);
        var preRollDelay = Math.max((duration - lead) * 1000, 0);
        self.prerollTimer = setTimeout(function(){
          self.triggerPreRoll(preloadToken, nextIndex);
        }, preRollDelay);
      }else{
        self.preloadPromise = null;
      }

      var swapToken = self.playToken;
      self.swapTimer = setTimeout(function(){
        self.completeSwap(swapToken, nextIndex);
      }, Math.max(duration * 1000, 0));
      dfd.resolve();
    }

    function proceedWithVideo(){
      if(!video){ dfd.resolve(); return; }
      bufferIndex = bufferIndex == null ? self.activeBufferIndex : bufferIndex;
      self.setActiveBuffer(bufferIndex);
      if(!(consumedPreloaded && consumedPreloaded.hasStarted)){
        try{ video.currentTime = 0; }catch(ignore){}
      }
      try{
        video.removeAttribute('muted');
        video.volume = 1;
      }catch(ignore){}
      try{
        video.play();
      }catch(e){
        handlePlayFailure();
        return;
      }
      afterPlayStarted();
    }

    if(consumedPreloaded){
      bufferIndex = consumedPreloaded.bufferIndex;
      video = this.videoEls[bufferIndex];
      this.preloaded = null;
      this.preloadPromise = null;
      proceedWithVideo();
      return dfd.promise();
    }

    this.preloaded = null;
    this.preloadPromise = null;
    bufferIndex = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    if(bufferIndex == null || bufferIndex === undefined){
      dfd.resolve();
      return dfd.promise();
    }

    this.loadIntoBuffer(bufferIndex, item, token).done(function(ok){
      if(token !== self.playToken){ dfd.resolve(); return; }
      if(ok === false){
        var nextIndex = (normalizedIndex + 1) % playlistLength;
        self.startPlaybackAtIndex(nextIndex);
        dfd.resolve();
        return;
      }
      video = self.videoEls[bufferIndex];
      if(video){
        try{ video.currentTime = 0; }catch(ignore){}
      }
      proceedWithVideo();
    }).fail(function(){
      dfd.resolve();
    });

    return dfd.promise();
  };

  LeftVideoLoop.prototype.playItem = function(item, options){
    options = options || {};
    if(!item) return resolvedPromise();
    var index = options.index != null ? options.index : this.items.indexOf(item);
    if(index < 0){ return resolvedPromise(); }
    return this.startPlaybackAtIndex(index, options);
  };

  LeftVideoLoop.prototype.next = function(){
    if(this.items.length === 0) return;
    var nextIndex = (this.idx + 1) % this.items.length;
    this.startPlaybackAtIndex(nextIndex);
  };

  LeftVideoLoop.prototype.start = function(){
    if(this.items.length === 0){ try{ console.warn('Left list empty'); }catch(ignore){} return; }
    this.idx = 0;
    this.startPlaybackAtIndex(0);
  };

  LeftVideoLoop.prototype.playEventOnce = function(item){
    if(!item) return resolvedPromise();
    this.isEventPlaying = true;
    this.pendingResumeIndex = this.idx;
    this.clearTimers();
    this.preloaded = null;
    this.preloadPromise = null;
    var token = ++this.playToken;
    var targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    if(targetIdx == null || targetIdx === undefined){ return resolvedPromise(); }
    var self = this;
    return this.loadIntoBuffer(targetIdx, item, token).done(function(ok){
      if(token !== self.playToken) return;
      if(ok === false){
        self.isEventPlaying = false;
        var resumeIndex = self.pendingResumeIndex % Math.max(self.items.length, 1);
        self.startPlaybackAtIndex(resumeIndex);
        return;
      }
      self.setActiveBuffer(targetIdx);
      var video = self.videoEls[targetIdx];
      if(video){
        try{ video.currentTime = 0; }catch(ignore){}
        try{
          video.removeAttribute('muted');
          video.volume = 1;
          safePlay(video);
        }catch(ignore){}
      }
      var duration = self.durationFor(item);
      var resumeToken = self.playToken;
      self.swapTimer = setTimeout(function(){
        if(resumeToken !== self.playToken) return;
        self.isEventPlaying = false;
        var resumeIndex = self.pendingResumeIndex % Math.max(self.items.length, 1);
        self.startPlaybackAtIndex(resumeIndex);
      }, Math.max(duration * 1000, 0));
    });
  };

  LeftVideoLoop.prototype.ensurePlaying = function(){
    var video = this.videoEls[this.activeBufferIndex];
    if(video && video.paused){
      try{
        video.volume = 1;
        safePlay(video);
      }catch(ignore){}
    }
  };

  function RightImageLoop(items, buffers){
    this.items = Array.isArray(items) ? items.slice() : [];
    this.idx = 0;
    this.timer = null;
    this.imageWrappers = buffers && buffers.wrappers ? buffers.wrappers : [];
    this.imageEls = buffers && buffers.elements ? buffers.elements : [];
    var activeIndex = -1;
    for(var i = 0; i < this.imageWrappers.length; i++){
      var wrap = this.imageWrappers[i];
      if(wrap.classList && wrap.classList.contains('is-active')){
        activeIndex = i;
        break;
      }
    }
    this.activeBufferIndex = activeIndex >= 0 ? activeIndex : 0;
    this.hasActiveContent = activeIndex >= 0;
    this.loadToken = 0;
    this.preloaded = null;
    this.preloadToken = 0;
    this.preRollLeadSeconds = 0.3;
  }

  RightImageLoop.prototype.getStandbyIndex = function(){
    if(this.imageEls.length <= 1) return this.activeBufferIndex;
    return (this.activeBufferIndex + 1) % this.imageEls.length;
  };

  RightImageLoop.prototype.current = function(){
    if(this.items.length === 0) return null;
    return this.items[this.idx % this.items.length];
  };

  RightImageLoop.prototype.nextIdx = function(){
    if(this.items.length === 0) return 0;
    this.idx = (this.idx + 1) % this.items.length;
    return this.idx;
  };

  RightImageLoop.prototype.clearTimer = function(){
    if(this.timer){ clearTimeout(this.timer); this.timer = null; }
  };

  RightImageLoop.prototype.setActiveBuffer = function(idx){
    for(var i = 0; i < this.imageWrappers.length; i++){
      toggleClass(this.imageWrappers[i], 'is-active', i === idx);
    }
    this.activeBufferIndex = idx;
    this.hasActiveContent = true;
  };

  RightImageLoop.prototype.preloadItemAtIndex = function(index, token){
    if(this.imageEls.length <= 1) return resolvedPromise();
    if(this.items.length === 0) return resolvedPromise();
    var item = this.items[index % this.items.length];
    if(!item) return resolvedPromise();
    var standbyIdx = this.getStandbyIndex();
    if(standbyIdx === this.activeBufferIndex) return resolvedPromise();
    var img = this.imageEls[standbyIdx];
    if(!img) return resolvedPromise();
    var src = (item.fileURL || '').replace(/^\s+|\s+$/g, '');
    var self = this;
    var dfd = $.Deferred();
    setImageSource(img, src).done(function(ok){
      if(token !== self.preloadToken){ dfd.resolve(); return; }
      if(!ok){ dfd.resolve(); return; }
      self.preloaded = { index: index % self.items.length, bufferIndex: standbyIdx };
      dfd.resolve();
    }).fail(function(){ dfd.resolve(); });
    return dfd.promise();
  };

  RightImageLoop.prototype.showItem = function(item){
    if(!item || this.imageEls.length === 0) return resolvedPromise();
    this.clearTimer();
    var dfd = $.Deferred();
    var token = ++this.loadToken;
    var self = this;

    function scheduleNext(){
      var duration = parseFloat(item.ptime);
      if(!isFinite(duration)){ duration = 10; }
      duration = Math.max(duration, 0.1);

      if(self.imageEls.length > 1){
        var nextIndex = (self.idx + 1) % self.items.length;
        var lead = Math.min(duration, self.preRollLeadSeconds);
        var delay = Math.max((duration - lead) * 1000, 0);
        self.preloadToken += 1;
        var preloadToken = self.preloadToken;
        setTimeout(function(){
          self.preloadItemAtIndex(nextIndex, preloadToken);
        }, delay);
      }

      self.timer = setTimeout(function(){ self.next(); }, duration * 1000);
      dfd.resolve();
    }

    if(this.preloaded && this.preloaded.index === (this.idx % this.items.length)){
      if(token !== this.loadToken){ dfd.resolve(); return dfd.promise(); }
      this.setActiveBuffer(this.preloaded.bufferIndex);
      this.preloaded = null;
      scheduleNext();
      return dfd.promise();
    }

    var targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    var img = this.imageEls[targetIdx];
    var src = (item.fileURL || '').replace(/^\s+|\s+$/g, '');
    setImageSource(img, src).done(function(ok){
      if(token !== self.loadToken){ dfd.resolve(); return; }
      if(!ok){
        self.nextIdx();
        self.showItem(self.current());
        dfd.resolve();
        return;
      }
      self.setActiveBuffer(targetIdx);
      scheduleNext();
    }).fail(function(){
      dfd.resolve();
    });

    return dfd.promise();
  };

  RightImageLoop.prototype.next = function(){
    this.nextIdx();
    this.showItem(this.current());
  };

  RightImageLoop.prototype.start = function(){
    if(this.items.length === 0){ try{ console.warn('Right list empty'); }catch(ignore){} return; }
    this.idx = 0;
    this.showItem(this.current());
  };

  function EventWatcher(items, leftController){
    this.left = leftController;
    this.items = Array.isArray(items) ? items.slice() : [];
    this.tickHandle = null;
    this.firedMap = {};
  }

  EventWatcher.prototype.keyFor = function(it){
    return (it.fileURL || '') + '@' + yyyymmddTodayKST();
  };

  EventWatcher.prototype.resetDaily = function(){
    this.firedMap = {};
  };

  EventWatcher.prototype.start = function(){
    var self = this;
    function tick(){
      var parts = getKSTDate();
      var nowHMS = parts.hh + parts.mm + parts.ss;
      for(var i = 0; i < self.items.length; i++){
        var it = self.items[i];
        var key = self.keyFor(it);
        if(!self.firedMap[key]){
          self.firedMap[key] = true;
          if(!self.left.isEventPlaying){
            self.left.playEventOnce(it);
          }
        }
      }
    }
    tick();
    this.tickHandle = setInterval(tick, 500);
    setInterval(function(){
      var parts = getKSTDate();
      if(parts.hh === '00' && parts.mm === '00' && parts.ss < '03'){
        self.resetDaily();
      }
    }, 1000);
  };

  function initDID(){
    startClock();

    loadKioskXml().done(function(data){
      data = data || {};
      var NAME = data.NAME || '';
      var L = Array.isArray(data.L) ? data.L : [];
      var R = Array.isArray(data.R) ? data.R : [];
      var E = Array.isArray(data.E) ? data.E : [];
      var nameEl = document.querySelector('.video_area .wait .name');
      if(nameEl){
        nameEl.textContent = NAME || '';
        nameEl.style.display = NAME ? '' : 'none';
      }

      var leftVideos = [];
      for(var i = 0; i < L.length; i++){
        if(/\.mp4(\?.*)?$/i.test(L[i].fileURL || '')){
          leftVideos.push(L[i]);
        }
      }
      var rightImages = [];
      for(var j = 0; j < R.length; j++){
        if(/\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(R[j].fileURL || '')){
          rightImages.push(R[j]);
        }
      }

      var left = new LeftVideoLoop(leftVideos, videoBuffers);
      var right = new RightImageLoop(rightImages, imageBuffers);
      left.start();
      right.start();

      var watcher = new EventWatcher(E, left);
      watcher.start();

      window.addEventListener('visibilitychange', function(){
        if(!document.hidden){
          left.ensurePlaying();
        }
      });
    }).fail(function(err){
      try{ console.error('Failed to initialize DID', err); }catch(ignore){}
    });
  }

  initDID();
})();
