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

async function setVideoSource(video, src){
  if(!video) return;
  video.pause();
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  if(!src){
    video.removeAttribute('src');
    try{ video.load(); }catch(e){}
    return;
  }

  const waitUntilReady = () => new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if(settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('canplay', finish);
      video.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, 5000);
    video.addEventListener('loadeddata', finish);
    video.addEventListener('canplay', finish);
    video.addEventListener('error', finish);
    if(video.readyState >= 2){ finish(); }
  });

  video.src = src;
  try{ video.load(); }catch(e){}

  if(video.readyState >= 2){
    return;
  }
  await waitUntilReady();
}

async function setImageSource(img, src){
  if(!img) return;
  if(!src){
    img.removeAttribute('src');
    return;
  }
  if(img.getAttribute('src') === src && img.complete && img.naturalWidth > 0){
    return;
  }
  const waitUntilReady = () => new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if(settled) return;
      settled = true;
      clearTimeout(timer);
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, 5000);
    img.addEventListener('load', finish);
    img.addEventListener('error', finish);
    if(img.complete && img.naturalWidth > 0){ finish(); }
    else if(typeof img.decode === 'function'){
      img.decode().then(finish).catch(finish);
    }
  });

  img.src = src;

  if(img.complete && img.naturalWidth > 0){
    return;
  }
  await waitUntilReady();
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
function inDateRange({sday, eday}){
  const today = yyyymmddTodayKST();
  return (!sday || today >= sday) && (!eday || today <= eday);
}
function inTimeRange({stime, etime}, nowHHMMSS){
  const s = toHHMMSS(stime), e = toHHMMSS(etime);
  if (s <= e) return (nowHHMMSS >= s && nowHHMMSS < e);
  // overnight window (e.g., 23:00~02:00)
  return (nowHHMMSS >= s || nowHHMMSS < e);
}

/** ---------- 시간 표시 (예: 3월 26일(화) 오후 2:44) ---------- */
const WEEK_KO = ['일','월','화','수','목','금','토'];
function fmtKoreanTime(){
  const d = new Date();
  const ko = new Intl.DateTimeFormat('ko-KR', { timeZone: KST_TZ, hour12:true, month:'numeric', day:'numeric', weekday:'short', hour:'numeric', minute:'2-digit' }).format(d);
  // e.g., "3월 26일 (화) 오후 2:44" / 괄호 공백 조정
  return ko.replace(' (', '(');
}
function startClock(){
  const tick = ()=> { if($timeEl){ $timeEl.textContent = fmtKoreanTime(); } };
  tick();
  setInterval(tick, 1000);
}

/** ---------- XML 파싱 ---------- */
async function loadKioskXml(){
  const res = await fetch(KIOSK_XML_URL, { cache:'no-cache' });
  const txt = await res.text();
  const xml = new window.DOMParser().parseFromString(txt, 'text/xml');

  const pick = (parentTag) => {
    return [...xml.querySelectorAll(`${parentTag} > NOTICE_INFO`)].map(info=>{
      const sch = info.querySelector('SCH_TYPE');
      const frameList = info.querySelector('FRAME_LIST');
      const frame = frameList?.querySelector('FRAME_INFO');
      return {
        conName: info.querySelector('CON_NAME')?.textContent?.trim() || '',
        sday: sch?.getAttribute('sday') || '',
        eday: sch?.getAttribute('eday') || '',
        stime: sch?.getAttribute('stime') || '',
        etime: sch?.getAttribute('etime') || '',
        ptime: parseFloat(frameList?.getAttribute('ptime') || '10') || 10,
        fileURL: frame?.getAttribute('fileURL') || '',
        // type은 신뢰하지 않고 확장자로 추론
      };
    });
  };

  const L = pick('NOTICE_LIST_L'); // 동영상 전용
  const R = pick('NOTICE_LIST_R'); // 이미지 전용
  const E = pick('NOTICE_LIST_E'); // 이벤트(좌측 강제 재생)

  return { L, R, E };
}

/** ---------- 플레이어 컨트롤러 ---------- */
class LeftVideoLoop {
  constructor(items, buffers){
    this.items = items;
    this.idx = 0;
    this.timer = null;
    this.isEventPlaying = false; // 이벤트 중단/복귀 제어
    this.videoWrappers = buffers?.wrappers || [];
    this.videoEls = buffers?.elements || [];
    const activeIndex = this.videoWrappers.findIndex(w => w.classList.contains('is-active'));
    this.activeBufferIndex = activeIndex >= 0 ? activeIndex : 0;
    this.hasActiveContent = activeIndex >= 0;
    this.loadToken = 0;
  }
  current(){ return this.items[this.idx % this.items.length]; }
  nextIdx(){ this.idx = (this.idx + 1) % this.items.length; }
  clearTimer(){ if(this.timer){ clearTimeout(this.timer); this.timer = null; } }
  stop(){
    this.clearTimer();
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
  async swapToItem(item){
    if(!item || this.videoEls.length === 0) return;
    const token = ++this.loadToken;
    const targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    const video = this.videoEls[targetIdx];
    const src = (item.fileURL || '').trim();
    await setVideoSource(video, src);
    if(token !== this.loadToken) return; // 중간에 다른 요청이 들어오면 무시
    this.setActiveBuffer(targetIdx);
    if(video){
      try{ video.currentTime = 0; }catch(e){}
      video.muted = true;
      video.play().catch(()=>{});
    }
  }
  async playItem(item){
    if(!item) return;
    this.isEventPlaying = false;
    this.clearTimer();
    await this.swapToItem(item);
    if(!item) return;
    const duration = Number.isFinite(item.ptime) ? Math.max(item.ptime, 0.1) : 10;
    this.timer = setTimeout(()=>{ this.next(); }, duration * 1000);
  }
  next(){
    this.nextIdx();
    this.playItem(this.current());
  }
  start(){
    this.items = this.items.filter(inDateRange);
    if(this.items.length === 0){ console.warn('Left list empty'); return; }
    this.idx = 0;
    this.playItem(this.current());
  }
  async playEventOnce(item){
    if(!item) return;
    this.isEventPlaying = true;
    this.clearTimer();
    await this.swapToItem(item);
    if(!item) return;
    const duration = Number.isFinite(item.ptime) ? Math.max(item.ptime, 0.1) : 10;
    this.timer = setTimeout(()=>{
      this.isEventPlaying = false;
      this.playItem(this.current());
    }, duration * 1000);
  }
  ensurePlaying(){
    const video = this.videoEls[this.activeBufferIndex];
    if(video && video.paused){
      video.play().catch(()=>{});
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
  }
  current(){ return this.items[this.idx % this.items.length]; }
  nextIdx(){ this.idx = (this.idx + 1) % this.items.length; }
  clearTimer(){ if(this.timer){ clearTimeout(this.timer); this.timer = null; } }
  getStandbyIndex(){
    if(this.imageEls.length <= 1){
      return this.activeBufferIndex;
    }
    return (this.activeBufferIndex + 1) % this.imageEls.length;
  }
  setActiveBuffer(idx){
    if(this.imageWrappers.length){
      this.imageWrappers.forEach((wrap, i) => {
        wrap.classList.toggle('is-active', i === idx);
      });
    }
    this.activeBufferIndex = idx;
    this.hasActiveContent = true;
  }
  async showItem(item){
    if(!item || this.imageEls.length === 0) return;
    this.clearTimer();
    const token = ++this.loadToken;
    const targetIdx = this.hasActiveContent ? this.getStandbyIndex() : this.activeBufferIndex;
    const img = this.imageEls[targetIdx];
    const src = (item.fileURL || '').trim();
    await setImageSource(img, src);
    if(token !== this.loadToken) return;
    this.setActiveBuffer(targetIdx);
    const duration = Number.isFinite(item.ptime) ? Math.max(item.ptime, 0.1) : 10;
    this.timer = setTimeout(()=>{ this.next(); }, duration * 1000);
  }
  next(){
    this.nextIdx();
    this.showItem(this.current());
  }
  start(){
    this.items = this.items.filter(inDateRange);
    if(this.items.length === 0){ console.warn('Right list empty'); return; }
    this.idx = 0;
    this.showItem(this.current());
  }
}

/** ---------- 이벤트 감시자 (좌측 강제 재생) ---------- */
class EventWatcher {
  constructor(items, leftController){
    this.items = items.filter(inDateRange);
    this.left = leftController;
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
        // 현재 시간이 이벤트 창 안인가?
        if(inTimeRange(it, nowHMS)){
          const k = this.keyFor(it);
          if(!this.firedMap.get(k)){
            this.firedMap.set(k, true);
            // stime에 진입하면 즉시 강제 재생
            if(!this.left.isEventPlaying){
              this.left.playEventOnce(it);
            }
          }
        }else{
          // 창을 벗어나면 다시 발사 가능하도록 해제(오늘 중 재진입 허용)
          this.firedMap.delete(this.keyFor(it));
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

/** ---------- 부트스트랩 ---------- */
(async function initDID(){
  startClock();

  // XML 로드
  const { L, R, E } = await loadKioskXml();

  // 좌: 동영상 전용으로 필터링 (확장자 기준)
  const leftVideos = L.filter(it => /\.mp4(\?.*)?$/i.test(it.fileURL));
  // 우: 이미지 전용으로 필터링
  const rightImages = R.filter(it => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(it.fileURL));

  // 컨트롤러 생성/시작
  const left = new LeftVideoLoop(leftVideos, videoBuffers);
  const right = new RightImageLoop(rightImages, imageBuffers);
  left.start();
  right.start();

  // 이벤트 감시 시작(좌측 강제)
  const watcher = new EventWatcher(E, left);
  watcher.start();

  // 창 포커스 손실 시(옵션): 영상 멈춤 방지 재개
  window.addEventListener('visibilitychange', ()=>{
    if(!document.hidden){
      left.ensurePlaying();
    }
  });
})();
