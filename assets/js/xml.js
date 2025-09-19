/******************************************
   name :  xml.js
   auth :  ELTOV
   date :  2022.08.25
   desc :  xml 파싱
*******************************************/


//////////////////////////////////////////////////////////////
// 내부 상태 관리
var __xml_load_state = 0; // 0:init,1:loading,2:ready,3:error
var __xml_load_error = null;
var __xml_success_callbacks = [];
var __xml_error_callbacks = [];
var __xml_serialized_text = '';

function __pushSuccessCallback(fn){
    if (typeof fn === 'function') {
        __xml_success_callbacks.push(fn);
    }
}

function __pushErrorCallback(fn){
    if (typeof fn === 'function') {
        __xml_error_callbacks.push(fn);
    }
}

function __flushSuccessCallbacks(data){
    var list = __xml_success_callbacks.slice();
    __xml_success_callbacks.length = 0;
    for (var i = 0; i < list.length; i++) {
        try { list[i](data); } catch (e) { }
    }
}

function __flushErrorCallbacks(err){
    var list = __xml_error_callbacks.slice();
    __xml_error_callbacks.length = 0;
    for (var i = 0; i < list.length; i++) {
        try { list[i](err); } catch (e) { }
    }
}

//////////////////////////////////////////////////////////////
// 리턴할 페이지 불러오기 (iframe 기반, AJAX 미사용)
function setLoadContents(p_url,p_fnc){
    if (__xml_load_state === 2) {
        if (typeof p_fnc === 'function') {
            try { p_fnc(window.xml_data); } catch (e) { }
        }
        return;
    }

    if (__xml_load_state === 3) {
        if (typeof p_fnc === 'function') {
            try { p_fnc(window.xml_data); } catch (e) { }
        }
        return;
    }

    __pushSuccessCallback(p_fnc);

    if (__xml_load_state === 1) {
        return;
    }

    __xml_load_state = 1;

    var iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.src = p_url;

    function cleanup(){
        try {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch (e) { }
    }

    iframe.onload = function(){
        var doc = null;
        try {
            doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!doc) {
                throw new Error('NO_DOCUMENT');
            }
            onReadXmlContents(doc, null);
            __xml_load_error = null;
            __xml_load_state = 2;
            __flushSuccessCallbacks(window.xml_data);
        } catch (err) {
            __xml_load_state = 3;
            __xml_load_error = err;
            setTxtError("INIT", "Error!!<br>Please retry");
            __flushErrorCallbacks(err);
        }
        cleanup();
    };

    iframe.onerror = function(){
        __xml_load_state = 3;
        __xml_load_error = new Error('IFRAME_LOAD_ERROR');
        setTxtError("INIT", "Error!!<br>Please retry");
        __flushErrorCallbacks(__xml_load_error);
        cleanup();
    };

    try {
        (document.body || document.documentElement).appendChild(iframe);
    } catch (e) {
        setTimeout(function(){
            try {
                (document.body || document.documentElement).appendChild(iframe);
            } catch (err) {
                __xml_load_state = 3;
                __xml_load_error = err;
                setTxtError("INIT", "Error!!<br>Please retry");
                __flushErrorCallbacks(err);
            }
        }, 0);
    }
}

function __serializeXmlDocument(doc){
    var serialized = '';
    if (!doc) {
        return serialized;
    }
    if (window.XMLSerializer) {
        try {
            serialized = new XMLSerializer().serializeToString(doc);
        } catch (e) {
            serialized = '';
        }
    }
    if (!serialized && doc.xml) {
        serialized = String(doc.xml);
    }
    if (!serialized && doc.documentElement && doc.documentElement.outerHTML) {
        serialized = String(doc.documentElement.outerHTML);
    }
    if (serialized && serialized.indexOf('<?xml') !== 0) {
        serialized = '<?xml version="1.0" encoding="utf-8"?>' + serialized;
    }
    return serialized;
}

function onReadXmlContents(p_xml, p_fnc) {
    var xml_doc = null;
    if (!p_xml) {
        setTxtError("INIT", "Error!!<br>Please retry");
        throw new Error('INVALID_XML_SOURCE');
    }
    if (p_xml.nodeType === 9) {
        xml_doc = p_xml;
    } else if (p_xml.responseXML) {
        if (p_xml.readyState != 4) {
            return;
        }
        if (p_xml.status != 200) {
            setTxtError("INIT", "Error!!<br>Please retry");
            throw new Error('XML_HTTP_STATUS');
        }
        xml_doc = p_xml.responseXML;
    } else if (p_xml.documentElement) {
        xml_doc = p_xml;
    }

    if (!xml_doc) {
        setTxtError("INIT", "Error!!<br>Please retry");
        throw new Error('XML_DOCUMENT_EMPTY');
    }

    try {
        var root_node = xml_doc.getElementsByTagName("KIOSK")[0];
        if (!root_node) {
            setTxtError("INIT", "Error!!<br>Please retry");
            throw new Error('XML_ROOT_NOT_FOUND');
        }
        var xml_data = new Object();
        xml_data.header = new Object();

        var i = 0;
        var str_type = "";
        var child1 = root_node.firstChild;
        var child2;
        var child3;
        var child4;

        while (child1 != null && child1.nodeType != 4) {

            if (child1.nodeType == 1) {
                if (child1.nodeName == "HEADER") {
                    child2 = child1.firstChild;
                    while (child2 != null && child2.nodeType != 4) {
                        if (child2.nodeName == "RET_CODE") xml_data.header.RET_CODE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_ID") xml_data.header.KIOSK_ID = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_TYPE") xml_data.header.KIOSK_TYPE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_NOTICE") xml_data.header.KIOSK_NOTICE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_CODE") xml_data.header.KIOSK_CODE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_NAME") xml_data.header.KIOSK_NAME = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_WIDTH") xml_data.header.KIOSK_WIDTH = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "KIOSK_HEIGHT") xml_data.header.KIOSK_HEIGHT = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "MOVE_TYPE") xml_data.header.MOVE_TYPE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "MSG_TYPE") xml_data.header.MSG_TYPE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "SYNC_TYPE") xml_data.header.SYNC_TYPE = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        if (child2.nodeName == "BRN_NAME") xml_data.header.BRN_NAME = getCvtXmlTag(child2.childNodes[0].nodeValue);
                        child2 = child2.nextSibling;
                    }

                    xml_data.header.RET_CODE = getCvtXmlTag(xml_data.header.RET_CODE);
                    xml_data.header.KIOSK_ID = getCvtXmlTag(xml_data.header.KIOSK_ID);
                    xml_data.header.DID_TYPE = getCvtXmlTag(xml_data.header.DID_TYPE);
                    xml_data.header.KIOSK_CODE = getCvtXmlTag(xml_data.header.KIOSK_CODE);
                    xml_data.header.KIOSK_NAME = getCvtXmlTag(xml_data.header.KIOSK_NAME);
                    xml_data.header.KIOSK_TYPE = getCvtXmlTag(xml_data.header.KIOSK_TYPE);
                    xml_data.header.BRN_NAME = getCvtXmlTag(xml_data.header.BRN_NAME);

                    did_type = xml_data.header.DID_TYPE;

                    if (xml_data.header.KIOSK_TYPE == "") xml_data.header.KIOSK_TYPE = "TYPE01";
                } else if (child1.nodeName == "NOTICE_LIST_L") {

                    if (xml_data.arr_notice_list_l == null) {
                        console.log("CREAT NOR")
                        xml_data.arr_notice_list_l = new Array();
                    }

                    child2 = child1.firstChild;
                    str_type = getCvtXmlTag(child1.getAttribute("type"));

                    while (child2 != null && child2.nodeType != 4) {
                        if (child2.nodeName == "NOTICE_INFO") {
                            child3 = child2.firstChild;

                            var CObj = new Object();
                            var frame_list = new Array();

                            CObj.NOTICE_ID = getCvtXmlTag(child2.getAttribute("id"));

                            while (child3 != null && child3.nodeType != 4) {
                                if (child3.nodeName == "SCH_TYPE") {
                                    CObj.SDAY = getCvtXmlTag(child3.getAttribute("sday"));
                                    CObj.EDAY = getCvtXmlTag(child3.getAttribute("eday"));
                                    CObj.STIME = "0000";
                                    CObj.ETIME = "2359"
                                }
                                if (child3.nodeName == "CON_TYPE") {
                                    //CObj.CON_TYPE = getCvtXmlTag(child3.childNodes[0].nodeValue)
                                }
                                if (child3.nodeName == "FRAME_LIST") {
                                    child4 = child3.firstChild;
                                    CObj.PTIME = getCvtXmlTag(child3.getAttribute("ptime"));
                                    //CObj.AREA_TYPE = getCvtXmlTag(child3.getAttribute("area_type"));
                                    while (child4 != null && child4.nodeType != 4) {
                                        var CFile = new Object();
                                        if (child4.nodeName == "FRAME_INFO") {
                                            CFile.FILE_ID = getCvtXmlTag(child4.getAttribute("id"));
                                            CFile.TYPE = getCvtXmlTag(child4.getAttribute("type"));
                                            CFile.X = getCvtXmlNum(child4.getAttribute("x", 0));
                                            CFile.Y = getCvtXmlNum(child4.getAttribute("y", 0));
                                            CFile.WIDTH = getCvtXmlNum(child4.getAttribute("width", 1290));
                                            CFile.HEIGHT = getCvtXmlNum(child4.getAttribute("height", 690));
                                            CFile.FILE_URL = getCvtXmlTag(child4.getAttribute("fileURL"));
                                            //if(CFile.FILE_URL.substring(0,1) == "/") CFile.FILE_URL = CFile.FILE_URL.substring(1);
                                            frame_list.push(CFile);
                                        }
                                        child4 = child4.nextSibling;
                                    }
                                }

                                CObj.NOTICE_NAME = getCvtXmlTag(CObj.NOTICE_NAME);

                                child3 = child3.nextSibling;
                            }

                            CObj.NOTICE_ID = getCvtXmlTag(CObj.NOTICE_ID);
                            CObj.SDAY = getCvtXmlTag(CObj.SDAY);
                            CObj.EDAY = getCvtXmlTag(CObj.EDAY);
                            CObj.STIME = getCvtXmlTag(CObj.STIME);
                            CObj.ETIME = getCvtXmlTag(CObj.ETIME);
                            CObj.STIME_NUM = getCvtXmlNum(CObj.STIME, 0);
                            CObj.ETIME_NUM = getCvtXmlNum(CObj.ETIME, 0);
                            CObj.PTIME = getCvtXmlNum(CObj.PTIME, 10);
                            //CObj.AREA_TYPE = getCvtXmlTag(CObj.AREA_TYPE);
                            //if(CObj.AREA_TYPE == "") CObj.AREA_TYPE = "FULL";
                        }
                        child2 = child2.nextSibling;
                    }
                } else if (child1.nodeName == "NOTICE_LIST_R") {

                    if (xml_data.arr_notice_list_r == null) {
                        xml_data.arr_notice_list_r = new Array();
                    }

                    child2 = child1.firstChild;
                    str_type = getCvtXmlTag(child1.getAttribute("type"));

                    while (child2 != null && child2.nodeType != 4) {
                        if (child2.nodeName == "NOTICE_INFO") {
                            console.log(1)
                            child3 = child2.firstChild;

                            var CObj = new Object();
                            var frame_list = new Array();

                            CObj.NOTICE_ID = getCvtXmlTag(child2.getAttribute("id"));
                            CObj.DISP_TYPE = "SPC";

                            while (child3 != null && child3.nodeType != 4) {
                                if (child3.nodeName == "NOTICE_NAME") if (child3.childNodes[0]) CObj[child3.nodeName] = child3.childNodes[0].nodeValue;
                                if (child3.nodeName == "SCH_TYPE") {
                                    CObj.SDAY = getCvtXmlTag(child3.getAttribute("sday"));
                                    CObj.EDAY = getCvtXmlTag(child3.getAttribute("eday"));
                                    CObj.STIME = getCvtXmlTag(child3.getAttribute("stime"));
                                    CObj.ETIME = getCvtXmlTag(child3.getAttribute("etime"));
                                }
                                if (child3.nodeName == "CON_TYPE") {
                                    CObj.CON_TYPE = getCvtXmlTag(child3.childNodes[0].nodeValue)
                                }
                                if (child3.nodeName == "FRAME_LIST") {
                                    child4 = child3.firstChild;
                                    CObj.PTIME = getCvtXmlTag(child3.getAttribute("ptime"));
                                    while (child4 != null && child4.nodeType != 4) {
                                        var CFile = new Object();
                                        if (child4.nodeName == "FRAME_INFO") {
                                            CFile.FILE_ID = getCvtXmlTag(child4.getAttribute("id"));
                                            CFile.TYPE = getCvtXmlTag(child4.getAttribute("type"));
                                            CFile.X = getCvtXmlNum(child4.getAttribute("x", 0));
                                            CFile.Y = getCvtXmlNum(child4.getAttribute("y", 0));
                                            CFile.WIDTH = getCvtXmlNum(child4.getAttribute("width", 1290));
                                            CFile.HEIGHT = getCvtXmlNum(child4.getAttribute("height", 690));
                                            CFile.FILE_URL = getCvtXmlTag(child4.getAttribute("fileURL"));
                                            //if(CFile.FILE_URL.substring(0,1) == "/") CFile.FILE_URL = CFile.FILE_URL.substring(1);
                                            frame_list.push(CFile);
                                        }
                                        child4 = child4.nextSibling;
                                    }
                                }

                                CObj.NOTICE_NAME = getCvtXmlTag(CObj.NOTICE_NAME);

                                child3 = child3.nextSibling;
                            }

                            CObj.NOTICE_ID = getCvtXmlTag(CObj.NOTICE_ID);
                            CObj.SDAY = getCvtXmlTag(CObj.SDAY);
                            CObj.EDAY = getCvtXmlTag(CObj.EDAY);
                            CObj.STIME = getCvtXmlTag(CObj.STIME);
                            CObj.ETIME = getCvtXmlTag(CObj.ETIME);
                            CObj.STIME_NUM = getCvtXmlNum(CObj.STIME, 0);
                            CObj.ETIME_NUM = getCvtXmlNum(CObj.ETIME, 0);
                            CObj.PTIME = getCvtXmlNum(CObj.PTIME, 10);
                            //CObj.AREA_TYPE = getCvtXmlTag(CObj.AREA_TYPE);
                            //if(CObj.AREA_TYPE == "") CObj.AREA_TYPE = "FULL";
                        }
                        child2 = child2.nextSibling;
                    }
                }  // END IF
            }

            child1 = child1.nextSibling;
        }
        window.xml_data = xml_data;
        __xml_serialized_text = __serializeXmlDocument(xml_doc);
        window.KIOSK_XML_TEXT = __xml_serialized_text;

        if (typeof p_fnc === 'function') {
            p_fnc(xml_data);
        }
        console.log(xml_data);
        return xml_data;
    } catch (err) {
        console.log("ERR PARSE XML");
        console.log(err);
        throw err;
    }
}



function setTxtError(p_type,p_msg){
    console.log("setTxtError = " + p_type + " , " + p_msg);
}


;(function(window, document, $){
    'use strict';

    function createDeferred(){
        if ($ && $.Deferred) {
            return $.Deferred();
        }
        var resolved = false;
        var rejected = false;
        var value = null;
        return {
            resolve: function(v){ resolved = true; value = v; },
            reject: function(e){ rejected = true; value = e; },
            promise: function(){ return this; },
            done: function(fn){ if (resolved) { try { fn(value); } catch (e) { } } return this; },
            fail: function(fn){ if (rejected) { try { fn(value); } catch (e) { } } return this; }
        };
    }

    window.KioskXmlScript = {
        load: function(){
            var dfd = createDeferred();

            if (__xml_load_state === 2) {
                dfd.resolve(__xml_serialized_text);
                return dfd.promise ? dfd.promise() : dfd;
            }

            if (__xml_load_state === 3) {
                dfd.reject(__xml_load_error || new Error('XML_LOAD_FAIL'));
                return dfd.promise ? dfd.promise() : dfd;
            }

            __pushSuccessCallback(function(){
                dfd.resolve(__xml_serialized_text);
            });
            __pushErrorCallback(function(err){
                dfd.reject(err || new Error('XML_LOAD_FAIL'));
            });

            setLoadContents('./xml/kiosk_contents.xml');

            return dfd.promise ? dfd.promise() : dfd;
        },
        getText: function(){
            return __xml_serialized_text;
        }
    };

    // 초기 로드 시도
    setLoadContents('./xml/kiosk_contents.xml');

})(window, document, window.jQuery);
