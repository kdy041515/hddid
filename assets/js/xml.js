/******************************************
   name :  xml.js
   auth :  ELTOV
   date :  2022.08.25
   desc :  xml 파싱 (iframe 기반, AJAX 미사용)
*******************************************/

;(function(window, document, $){
    'use strict';

    var STATE_INIT = 0;
    var STATE_LOADING = 1;
    var STATE_READY = 2;
    var STATE_ERROR = 3;

    var state = STATE_INIT;
    var xmlText = '';
    var errorValue = null;
    var waitQueue = [];

    function pushDeferred(dfd){
        waitQueue.push(dfd);
    }

    function flushQueue(){
        if(!waitQueue.length) return;
        var list = waitQueue.slice();
        waitQueue.length = 0;
        var i;
        if(state === STATE_READY){
            for(i=0;i<list.length;i++){
                try{ list[i].resolve(xmlText); }
                catch(_){ }
            }
        }else if(state === STATE_ERROR){
            for(i=0;i<list.length;i++){
                try{ list[i].reject(errorValue); }
                catch(_){ }
            }
        }
    }

    function ensureLoad(){
        if(state === STATE_LOADING || state === STATE_READY || state === STATE_ERROR){
            return;
        }
        state = STATE_LOADING;

        var iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.setAttribute('tabindex', '-1');
        iframe.src = './xml/kiosk_contents.xml';

        function cleanup(){
            try{
                if(iframe.parentNode){ iframe.parentNode.removeChild(iframe); }
            }catch(_){ }
        }

        iframe.onload = function(){
            var doc;
            try{
                doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                if(!doc){ throw new Error('NO_DOCUMENT'); }
                var serialized = '';
                if(window.XMLSerializer){
                    try{
                        serialized = new XMLSerializer().serializeToString(doc);
                    }catch(e){ serialized = ''; }
                }
                if(!serialized && doc.xml){
                    serialized = String(doc.xml);
                }
                if(!serialized && doc.documentElement && doc.documentElement.outerHTML){
                    serialized = String(doc.documentElement.outerHTML);
                }
                if(!serialized){
                    throw new Error('SERIALIZE_FAIL');
                }
                if(serialized.indexOf('<?xml') !== 0){
                    serialized = '<?xml version="1.0" encoding="utf-8"?>' + serialized;
                }
                xmlText = serialized;
                window.KIOSK_XML_TEXT = xmlText;
                state = STATE_READY;
                cleanup();
                flushQueue();
            }catch(e){
                errorValue = e || new Error('IFRAME_PARSE_ERROR');
                state = STATE_ERROR;
                cleanup();
                flushQueue();
            }
        };

        iframe.onerror = function(){
            errorValue = new Error('IFRAME_LOAD_ERROR');
            state = STATE_ERROR;
            cleanup();
            flushQueue();
        };

        var target = document.body || document.documentElement;
        try{
            target.appendChild(iframe);
        }catch(_){
            // body가 없을 경우 DOMContentLoaded 이후 재시도
            setTimeout(function(){
                try{
                    (document.body || document.documentElement).appendChild(iframe);
                }catch(e){
                    errorValue = e;
                    state = STATE_ERROR;
                    flushQueue();
                }
            }, 0);
        }
    }

    function createDeferred(){
        if($ && $.Deferred){
            return $.Deferred();
        }
        // 단순 폴백 (resolve/reject 호출만 지원)
        var resolved = false;
        var rejected = false;
        var value;
        return {
            resolve: function(v){ resolved=true; value=v; },
            reject: function(e){ rejected=true; value=e; },
            promise: function(){ return this; },
            done: function(fn){ if(resolved){ fn(value); } return this; },
            fail: function(fn){ if(rejected){ fn(value); } return this; }
        };
    }

    window.KioskXmlScript = {
        load: function(){
            var dfd = createDeferred();
            if(state === STATE_READY){
                dfd.resolve(xmlText);
                return dfd.promise ? dfd.promise() : dfd;
            }
            if(state === STATE_ERROR){
                dfd.reject(errorValue);
                return dfd.promise ? dfd.promise() : dfd;
            }
            pushDeferred(dfd);
            ensureLoad();
            return dfd.promise ? dfd.promise() : dfd;
        },
        getText: function(){
            return xmlText;
        }
    };

    // 즉시 로드 시도
    ensureLoad();

})(window, document, window.jQuery);
