const KIOSK_XML_URL = './xml/kiosk_contents.xml';
const KST_TZ = 'Asia/Seoul';
const $timeEl = document.getElementById('time');
const videoBuffers = collectMediaBuffers('.video_area', 'video');
const imageBuffers = collectMediaBuffers('.image_area', 'img');
function collectMediaBuffers(rootSelector, mediaSelector){
  const wrappers = [];
  const elements = [];
  document.querySelectorAll(`${rootSelector} .item`).forEach(item => {
    const media = item.querySelector(mediaSelector);
    if(media){
      wrappers.push(item);
      elements.push(media);
    }
  });
  return { wrappers, elements };
}

function resolvedPromise(value){
  return $.Deferred().resolve(value).promise();
}

function delay(ms){
  return $.Deferred(function(dfd){
    setTimeout(()=>dfd.resolve(), Math.max(ms || 0, 0));
  }).promise();
}

function safePlay(video) {
  try {
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.catch(err => {
        console.warn("play() blocked:", err);
      });
    }
  } catch(e) {
    console.error("play error", e);
  }
}

function setVideoSource(video, src){
  if(!video) return resolvedPromise(false);
  video.pause();
  video.muted = true;
  video.setAttribute('muted','');
  video.setAttribute('playsinline','');

  if(!src){
    video.removeAttribute('src');
    try{ video.load(); }catch(e){}
    return resolvedPromise(false);
  }

  video.src = src + '?t=' + Date.now(); // 캐시 무효화
  try{ video.load(); }catch(e){}

  return new Promise(resolve=>{
    video.onloadeddata = ()=>{
      try{ 
        video.removeAttribute('muted'); 
        video.volume = 1; 
        video.play().catch(()=>{}); 
      }catch(e){}
      resolve(true);
    };
    video.onerror = ()=>resolve(false);
  });
}


function setImageSource(img, src){
  if(!img) return resolvedPromise();
  if(!src){
    img.removeAttribute('src');
    return resolvedPromise(false);
  }
  if(img.getAttribute('src') === src && img.complete && img.naturalWidth > 0){
    return resolvedPromise(true);
  }
  const waitUntilReady = () => {
    const dfd = $.Deferred();
    let settled = false;
    let ok = false;
    const finish = () => {
      if(settled) return;
      settled = true;
      clearTimeout(timer);
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      dfd.resolve(ok || (img.complete && img.naturalWidth > 0));
    };
    const timer = setTimeout(finish, 5000);
    img.addEventListener('load', ()=>{ ok = true; finish(); });
    img.addEventListener('error', ()=>{ ok = false; finish(); });
    if(img.complete && img.naturalWidth > 0){
      finish();
    } else if(typeof img.decode === 'function'){
      try {
        const decodePromise = img.decode();
        if(decodePromise && typeof decodePromise.then === 'function'){
          decodePromise.then(finish, finish);
        }
      } catch(e){
        finish();
      }
    }
    return dfd.promise();
  };

  img.src = src;

  if(img.complete && img.naturalWidth > 0) return resolvedPromise(true);
  return waitUntilReady();
}

function pad2(n){ return String(n).padStart(2,'0'); }
function nowKST(){ return new Date(new Intl.DateTimeFormat('en-US', { timeZone: KST_TZ, hour12:false }).format(new Date())); } // date only
function getKSTDate(){
  const d = new Date();
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TZ, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).formatToParts(d).reduce((a,p)=> (a[p.type]=p.value, a), {});
  return { y:f.year, m:f.month, d:f.day, hh:f.hour, mm:f.minute, ss:f.second };
}
function toHHMMSS(str){ 
  // allow "0000" or "2359" (HHMM) and "100000" (HHMMSS)
  const s = (str||'').trim();
  if (s.length === 4) return s + '00';
  if (s.length === 6) return s;
  return '000000';
}
function compareHHMMSS(a,b){ // return a-b
  return a.localeCompare(b);
}
function yyyymmddTodayKST(){
  const {y,m,d} = getKSTDate();
  return `${y}${m}${d}`;
}

const WEEK_KO = ['일','월','화','수','목','금','토'];
function fmtKoreanTime(){
  const d = new Date();
  const ko = new Intl.DateTimeFormat('ko-KR', { timeZone: KST_TZ, hour12:true, month:'numeric', day:'numeric', weekday:'short', hour:'numeric', minute:'2-digit' }).format(d);
  return ko.replace(' (', '(');
}
function startClock(){
  const tick = ()=> { if($timeEl){ $timeEl.textContent = fmtKoreanTime(); } };
  tick();
  setInterval(tick, 1000);
}

/** XML 파싱 */
function loadKioskXml(){
  const dfd = $.Deferred();
  $.ajax({
    url: KIOSK_XML_URL,
    dataType: 'text',
    cache: false
  }).done(txt => {
    try {
      const xml = new window.DOMParser().parseFromString(txt, 'text/xml');
      const headerPick = (target) => {
        return xml.querySelectorAll(`HEADER > ${target}`)?.[0]?.textContent?.trim() || '';
      };

      const pick = (parentTag) => {
        return [...xml.querySelectorAll(`${parentTag} > NOTICE_INFO`)].map(info=>{
          const sch = info.querySelector('SCH_TYPE');
          const frameList = info.querySelector('FRAME_LIST');
          const frame = frameList?.querySelector('FRAME_INFO');
          return {
            conName: info.querySelector('CON_NAME')?.textContent?.trim() || '',
            stime: sch?.getAttribute('stime') || '',
            etime: sch?.getAttribute('etime') || '',
            ptime: parseFloat(frameList?.getAttribute('ptime') || '10') || 10,
            fileURL: frame?.getAttribute('fileURL') || '',
          };
        });
      };

      const NAME = headerPick('BRN_NAME'); // 동영상 전용
      const L = pick('NOTICE_LIST_L'); // 동영상 전용
      const R = pick('NOTICE_LIST_R'); // 이미지 전용
      const E = pick('NOTICE_LIST_E'); // 이벤트(좌측 강제 재생)
      dfd.resolve({ L, R, E, NAME });
    } catch (err) {
      dfd.reject(err);
    }
  }).fail((xhr, status, err) => {
    dfd.reject(err || status);
  });
  return dfd.promise();
}

/** ---------- 플레이어 컨트롤러 ---------- */
class LeftVideoLoop {
  constructor(items, buffers){
    this.items = items;
    this.idx = 0;
    this.swapTimer = null;
    this.prerollTimer = null;
    this.isEventPlaying = false; // 이벤트 중단/복귀 제어
    this.videoWrappers = buffers?.wrappers || [];
    this.videoEls = buffers?.elements || [];
    const activeIndex = this.videoWrappers.findIndex(w => w.classList.contains('is-active'));
    this.activeBufferIndex = activeIndex >= 0 ? activeIndex : 0;
    this.hasActiveContent = activeIndex >= 0;
    this.preloaded = null;
    this.preloadPromise = null;
    this.playToken = 0;
    this.preloadToken = 0;
    this.preRollLeadSeconds = 0.3;
    this.pendingResumeIndex = 0;
  }
  current(){ return this.items[this.idx % this.items.length]; }
  nextIdx(){ this.idx = (this.idx + 1) % this.items.length; }
  clearTimers(){
    if(this.swapTimer){ clearTimeout(this.swapTimer); this.swapTimer = null; }
    if(this.prerollTimer){ clearTimeout(this.prerollTimer); this.prerollTimer = null; }
  }
  stop(){
    this.clearTimers();
    this.videoEls.forEach(video => { try{ video.pause(); }catch(e){} });
  }
  getStandbyIndex(){
    if(this.videoEls.length <= 1){
      return this.activeBufferIndex;
    }
    return (this.activeBufferIndex + 1) % this.videoEls.length;
  }
  setActiveBuffer(idx){
    const prev = this.activeBufferIndex;
    if(this.videoWrappers.length){
      this.videoWrappers.forEach((wrap, i) => {
        wrap.classList.toggle('is-active', i === idx);
      });
    }
    if(prev !== idx && this.videoEls[prev]){
      try{ this.videoEls[prev].pause(); }catch(e){}
    }
    this.activeBufferIndex = idx;
    this.hasActiveContent = true;
  }
  durationFor(item){
    return Number.isFinite(item?.ptime) ? Math.max(item.ptime, 0.1) : 10;
  }
  loadIntoBuffer(bufferIdx, item, token){
    if(bufferIdx == null || !item) return resolvedPromise();
    const video = this.videoEls[bufferIdx];
    if(!video) return resolvedPromise();
    const src = (item.fileURL || '').trim();
    return setVideoSource(video, src).then(ok => {
      if(token !== this.playToken) return false;
      if(!ok) return false;
      return true;
    });
  }
  preloadItemAtIndex(index, token){
    if(this.videoEls.length <= 1){ return resolvedPromise(); }
    const item = this.items[index % this.items.length];
    if(!item) return resolvedPromise();
    const standbyIdx = this.getStandbyIndex();
    if(standbyIdx === this.activeBufferIndex) return resolvedPromise();
    const video = this.videoEls[standbyIdx];
    if(!video) return resolvedPromise();
    const loadToken = ++this.preloadToken;
    const src = (item.fileURL || '').trim();
    const dfd = $.Deferred();
    delay(1500).then(() => setVideoSource(video, src)).then(ok => {
      if(token !== this.playToken || loadToken !== this.preloadToken){ dfd.resolve(); return; }
      if(!ok){ dfd.resolve(); return; }
      try{ video.pause(); }catch(e){}
      try{ video.currentTime = 0; }catch(e){}
      this.preloaded = { index: index % this.items.length, item, bufferIndex: standbyIdx, hasStarted: false };
      dfd.resolve();
    }, err => {
      console.error(err);
      dfd.resolve();
    });
    return dfd.promise();
  }
  triggerPreRoll(token, expectedIndex){
    const proceed = () => {
      if(token !== this.playToken || this.isEventPlaying) return;
      const preloaded = this.preloaded;
      if(!preloaded || preloaded.index !== (expectedIndex % this.items.length)) return;
      const video = this.videoEls[preloaded.bufferIndex];
      if(!video || preloaded.hasStarted) return;
      preloaded.hasStarted = true;
      try{ video.currentTime = 0; }catch(e){}
      try{
        video.removeAttribute('muted');
        video.volume = 1;
        const playResult = video.play();
        if(playResult && typeof playResult.then === 'function'){
          playResult.then(()=>{}, ()=>{});
        }
      }catch(e){}
    };

    if(token !== this.playToken || this.isEventPlaying) return resolvedPromise();

    const dfd = $.Deferred();
    const wrappedProceed = () => { proceed(); dfd.resolve(); };
    if(this.preloadPromise){
      this.preloadPromise.always(wrappedProceed);
    }else{
      wrappedProceed();
    }
    return dfd.promise();
  }
  completeSwap(token, nextIndex){
    if(token !== this.playToken || this.isEventPlaying) return resolvedPromise();
    const dfd = $.Deferred();
    const proceed = () => {
      if(token !== this.playToken || this.isEventPlaying){ dfd.resolve(); return; }
      const preloaded = this.preloaded;
      const targetIndex = nextIndex % this.items.length;
      let playPromise;
      if(preloaded && preloaded.index === targetIndex){
        playPromise = this.startPlaybackAtIndex(targetIndex, { usePreloaded: true, preloadedData: preloaded });
      }else{
        playPromise = this.startPlaybackAtIndex(targetIndex);
      }
      if(playPromise && typeof playPromise.always === 'function'){
        playPromise.always(()=>dfd.resolve());
      }else if(playPromise && typeof playPromise.then === 'function'){
        playPromise.then(()=>dfd.resolve());
      }else{
        dfd.resolve();
      }
    };

    if(this.preloadPromise && typeof this.preloadPromise.always === 'function'){
      this.preloadPromise.always(proceed);
    }else if(this.preloadPromise && typeof this.preloadPromise.then === 'function'){
      this.preloadPromise.then(proceed, proceed);
    }else{
      proceed();
    }

    return dfd.promise();
  }
  startPlaybackAtIndex(index, options = {}){
    const dfd = $.Deferred();
    if(this.items.length === 0 || this.videoEls.length === 0){ dfd.resolve(); return dfd.promise(); }

    const playlistLength = this.items.length;
    const normalizedIndex = ((index % playlistLength) + playlistLength) % playlistLength;
    const defaultItem = this.items[normalizedIndex];
    const { usePreloaded = false, preloadedData = null, isEvent = false } = options;
    const item = (usePreloaded && preloadedData && preloadedData.item) ? preloadedData.item : defaultItem;
    if(!item){ dfd.resolve(); return dfd.promise(); }

    const token = ++this.playToken;
    this.isEventPlaying = isEvent;
    this.clearTimers();

    const consumedPreloaded = usePreloaded && preloadedData && typeof preloadedData.bufferIndex === 'number' ? preloadedData : null;
    const self = this;
    let bufferIndex = null;
    let video = null;

    const handlePlayFailure = () => {
      const nextIndex = (normalizedIndex + 1) % playlistLength;
      self.startPlaybackAtIndex(nextIndex);
      dfd.resolve();
    };

    const afterPlayStarted = () => {
      if(!video){ dfd.resolve(); return; }
      const playTokenSnap = self.playToken;
      const onErr = () => {
        video.removeEventListener('error', onErr);
        if (playTokenSnap === self.playToken){
          const nextIndex = (normalizedIndex + 1) % playlistLength;
          self.startPlaybackAtIndex(nextIndex);
        }
      };
      video.addEventListener('error', onErr, { once:true });

      self.idx = normalizedIndex;
      if(!isEvent){
        self.pendingResumeIndex = normalizedIndex;
      }

      if(isEvent){
        const duration = self.durationFor(item);
        const eventToken = self.playToken;
        self.swapTimer = setTimeout(()=>{
          if(eventToken !== self.playToken) return;
          self.isEventPlaying = false;
          const resumeIndex = self.pendingResumeIndex % Math.max(self.items.length, 1);
          self.startPlaybackAtIndex(resumeIndex);
        }, Math.max(duration * 1000, 0));
        dfd.resolve();
        return;
      }

      const duration = self.durationFor(item);
      const nextIndex = (normalizedIndex + 1) % playlistLength;

      if(self.videoEls.length > 1){
        const preloadToken = self.playToken;
        self.preloadPromise = self.preloadItemAtIndex(nextIndex, preloadToken);
        const lead = Math.min(duration, self.preRollLeadSeconds);
        const preRollDelay = Math.max((duration - lead) * 1000, 0);
        self.prerollTimer = setTimeout(()=>{
          self.triggerPreRoll(preloadToken, nextIndex);
        }, preRollDelay);
      }else{
        self.preloadPromise = null;
      }

      const swapToken = self.playToken;
      self.swapTimer = setTimeout(()=>{
        self.completeSwap(swapToken, nextIndex);
      }, Math.max(duration * 1000, 0));
      dfd.resolve();
    };

    const proceedWithVideo = () => {
      if(!video){ dfd.resolve(); return; }
      bufferIndex = bufferIndex == null ? self.activeBufferIndex : bufferIndex;
      self.setActiveBuffer(bufferIndex);
      if(!(consumedPreloaded && consumedPreloaded.hasStarted)){
        try{ video.currentTime = 0; }catch(e){}
      }
      try{
        video.removeAttribute('muted');
        video.volume = 1;
      }catch(e){}
      let playResult;
      try{
        playResult = video.play();
      }catch(e){
        handlePlayFailure();
        return;
      }
      if(playResult && typeof playResult.then === 'function'){
        playResult.then(afterPlayStarted, () => { handlePlayFailure(); });
      }else{
        afterPlayStarted();
      }
    };

    if(consumedPreloaded){
      bufferIndex = consumedPreloaded.bufferIndex;
      video = self.videoEls[bufferIndex];
      self.preloaded = null;
      self.preloadPromise = null;
      proceedWithVideo();
      return dfd.promise();
    }

    self.preloaded = null;
    self.preloadPromise = null;
    bufferIndex = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    if(bufferIndex == null || bufferIndex === undefined){
      dfd.resolve();
      return dfd.promise();
    }

    self.loadIntoBuffer(bufferIndex, item, token).then(ok => {
      if(token !== self.playToken){ dfd.resolve(); return; }
      if(ok === false){
        const nextIndex = (normalizedIndex + 1) % playlistLength;
        self.startPlaybackAtIndex(nextIndex);
        dfd.resolve();
        return;
      }
      video = self.videoEls[bufferIndex];
      if(video){
        try{ video.currentTime = 0; }catch(e){}
      }
      proceedWithVideo();
    });

    return dfd.promise();
  }
  playItem(item, options = {}){
    if(!item) return resolvedPromise();
    const index = options.index != null ? options.index : this.items.indexOf(item);
    if(index < 0){ return resolvedPromise(); }
    return this.startPlaybackAtIndex(index, options);
  }
  next(){
    if(this.items.length === 0) return;
    const nextIndex = (this.idx + 1) % this.items.length;
    this.startPlaybackAtIndex(nextIndex);
  }
  start(){
    if(this.items.length === 0){ console.warn('Left list empty'); return; }
    this.idx = 0;
    this.startPlaybackAtIndex(0);
  }
  playEventOnce(item){
    if(!item) return resolvedPromise();
    this.isEventPlaying = true;
    this.pendingResumeIndex = this.idx;
    this.clearTimers();
    this.preloaded = null;
    this.preloadPromise = null;
    const token = ++this.playToken;
    const targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    if(targetIdx == null || targetIdx === undefined){ return resolvedPromise(); }
    return this.loadIntoBuffer(targetIdx, item, token).then(ok => {
      if(token !== this.playToken) return;
      if(ok === false){
      // 이벤트 소스가 에러면 이벤트를 건너뛰고 원래 재생 복귀
      this.isEventPlaying = false;
      const resumeIndex = this.pendingResumeIndex % Math.max(this.items.length, 1);
      this.startPlaybackAtIndex(resumeIndex);
      return;
    }

      this.setActiveBuffer(targetIdx);
      const video = this.videoEls[targetIdx];
      if(video){
        try{ video.currentTime = 0; }catch(e){}
        try{
          video.removeAttribute('muted');
          video.volume = 1;
          const playResult = video.play();
          if(playResult && typeof playResult.then === 'function'){
            playResult.then(()=>{}, ()=>{});
          }
        }catch(e){}
      }
      const duration = this.durationFor(item);
      const resumeToken = this.playToken;
      this.swapTimer = setTimeout(()=>{
        if(resumeToken !== this.playToken) return;
        this.isEventPlaying = false;
        const resumeIndex = this.pendingResumeIndex % Math.max(this.items.length, 1);
        this.startPlaybackAtIndex(resumeIndex);
      }, Math.max(duration * 1000, 0));
    });
  }
  ensurePlaying(){
    const video = this.videoEls[this.activeBufferIndex];
    if(video && video.paused){
      try{
        video.volume = 1;
        const playResult = video.play();
        if(playResult && typeof playResult.then === 'function'){
          playResult.then(()=>{}, ()=>{});
        }
      }catch(e){}
    }
  }
}

class RightImageLoop {
  constructor(items, buffers){
    this.items = items;
    this.idx = 0;
    this.timer = null;
    this.imageWrappers = buffers?.wrappers || [];
    this.imageEls = buffers?.elements || [];
    const activeIndex = this.imageWrappers.findIndex(w => w.classList.contains('is-active'));
    this.activeBufferIndex = activeIndex >= 0 ? activeIndex : 0;
    this.hasActiveContent = activeIndex >= 0;
    this.loadToken = 0;
    this.preloaded = null;
    this.preloadToken = 0;
    this.preRollLeadSeconds = 0.3;
   }
  getStandbyIndex(){
    if(this.imageEls.length <= 1) return this.activeBufferIndex;
    return (this.activeBufferIndex + 1) % this.imageEls.length;
  }
  current(){ return this.items[this.idx % this.items.length]; }
  nextIdx(){ this.idx = (this.idx + 1) % this.items.length; }
  clearTimer(){ if(this.timer){ clearTimeout(this.timer); this.timer = null; } }
  
  setActiveBuffer(idx){
    if(this.imageWrappers.length){
      this.imageWrappers.forEach((wrap, i) => {
        wrap.classList.toggle('is-active', i === idx);
      });
    }
    this.activeBufferIndex = idx;
    this.hasActiveContent = true;
  }

  preloadItemAtIndex(index, token){
    if(this.imageEls.length <= 1) return resolvedPromise();
    const item = this.items[index % this.items.length];
    if(!item) return resolvedPromise();
    const standbyIdx = this.getStandbyIndex();
    if(standbyIdx === this.activeBufferIndex) return resolvedPromise();
    const img = this.imageEls[standbyIdx];
    const src = (item.fileURL || '').trim();
    return setImageSource(img, src).then(ok => {
      if(token !== this.preloadToken) return;
      if(!ok) return;
      this.preloaded = { index: index % this.items.length, bufferIndex: standbyIdx };
    });
  }

  showItem(item){
    if(!item || this.imageEls.length === 0) return resolvedPromise();
    this.clearTimer();
    const dfd = $.Deferred();
    const token = ++this.loadToken;

    const scheduleNext = () => {
      const duration = Number.isFinite(item.ptime) ? Math.max(item.ptime, 0.1) : 10;

      if(this.imageEls.length > 1){
        const nextIndex = (this.idx + 1) % this.items.length;
        const lead = Math.min(duration, this.preRollLeadSeconds);
        const delay = Math.max((duration - lead) * 1000, 0);
        const preloadToken = ++this.preloadToken;
        setTimeout(()=>{
          this.preloadItemAtIndex(nextIndex, preloadToken);
        }, delay);
      }

      this.timer = setTimeout(()=>{ this.next(); }, duration * 1000);
      dfd.resolve();
    };

    if(this.preloaded && this.preloaded.index === (this.idx % this.items.length)){
      if(token !== this.loadToken){ dfd.resolve(); return dfd.promise(); }
      this.setActiveBuffer(this.preloaded.bufferIndex);
      this.preloaded = null;
      scheduleNext();
      return dfd.promise();
    }

    const targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    const img = this.imageEls[targetIdx];
    const src = (item.fileURL || '').trim();
    setImageSource(img, src).then(ok => {
      if(token !== this.loadToken){ dfd.resolve(); return; }
      if(!ok){
        this.nextIdx();
        this.showItem(this.current());
        dfd.resolve();
        return;
      }
      this.setActiveBuffer(targetIdx);
      scheduleNext();
    });

    return dfd.promise();
  }
  next(){
    this.nextIdx();
    this.showItem(this.current());
  }
  start(){
    if(this.items.length === 0){ console.warn('Right list empty'); return; }
    this.idx = 0;
    this.showItem(this.current());
  }
}


/** ---------- 이벤트 감시자 (좌측 강제 재생) ---------- */
class EventWatcher {
  constructor(items, leftController){
    this.left = leftController;
    this.items = Array.isArray(items) ? items : [];
    this.tickHandle = null;
    // 같은 윈도우에서 중복 트리거 방지용
    this.firedMap = new Map(); // key: fileURL@date => true while window active
  }

  keyFor(it){ return `${it.fileURL}@${yyyymmddTodayKST()}`; }
  resetDaily(){
    this.firedMap.clear();
  }
  start(){
    const tick = ()=>{
      const { hh, mm, ss } = getKSTDate();
      const nowHMS = `${hh}${mm}${ss}`;
      for(const it of this.items){
        const k = this.keyFor(it);
        if(!this.firedMap.get(k)){
          this.firedMap.set(k, true);
          // stime에 진입하면 즉시 강제 재생
          if(!this.left.isEventPlaying){
            this.left.playEventOnce(it);
          }
        }
      }
    };
    tick();
    this.tickHandle = setInterval(tick, 500);
    // 자정에 맵 초기화
    const midnightReset = ()=>{
      const {hh,mm,ss} = getKSTDate();
      if(hh==='00' && mm==='00' && ss<'03'){ this.resetDaily(); }
    };
    setInterval(midnightReset, 1000);
  }
}

(function initDID(){
  startClock();

  loadKioskXml().then(data => {
    const { NAME = '', L = [], R = [], E = [] } = data || {};
    const nameEl = document.querySelector('.video_area .wait .name');
    if(nameEl){
      nameEl.textContent = NAME || '';
      nameEl.style.display = NAME ? '' : 'none';
    }

    const leftVideos = L.filter(it => /\.mp4(\?.*)?$/i.test(it.fileURL));
    const rightImages = R.filter(it => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(it.fileURL));

    const left = new LeftVideoLoop(leftVideos, videoBuffers);
    const right = new RightImageLoop(rightImages, imageBuffers);
    left.start();
    right.start();

    const watcher = new EventWatcher(E, left);
    watcher.start();

    window.addEventListener('visibilitychange', ()=>{
      if(!document.hidden){
        left.ensurePlaying();
      }
    });
  }).fail(err => {
    console.error('Failed to initialize DID', err);
  });
})();