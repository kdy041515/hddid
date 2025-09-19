/******************************************
   name :  comm.js
   auth :  ELTOV
   date :  2022.08.20
   desc :  기본유틸과 구성정보들
*******************************************/

// 널체크 
function getChkNull(p_src,p_default){
    if(p_src == null || p_src == undefined){
        return p_default;
    }else{
        return p_src + "";
    }
}

function getCvtXmlTag(p_src){
    var p1 = /&amp;/gi;
    var p2 = /&lt;/gi;
    var p3 = /&gt;/gi;
    var p4 = /&quot;/gi;
    var p5 = /&apos;/gi;

    if(p_src == null || p_src == undefined){
        return "";
    }

    p_src = p_src + "";
    p_src = p_src.replace(p1,"&");
    p_src = p_src.replace(p2,"<");
    p_src = p_src.replace(p3,">");
    p_src = p_src.replace(p4,"\"");
    p_src = p_src.replace(p5,"\'");
    p_src = p_src.trim();
    return p_src;
}

function getCvtSearchName(p_src){

    if(p_src == null || p_src == undefined){
        return "";
    }
    var p1 = /[^a-z^0-9]/gi;
    p_src = p_src.toLowerCase();
    p_src = p_src.replace(p1,"");
    return p_src;
}

function getCvtXmlNum(p_src,p_default){
    if(p_default == undefined) p_default = 0;
    if(p_src == null ) return p_default;
    if(isNaN(p_src) == true) return p_default;
    return Number(p_src);
}

function getCvtRemoveWhite(p_src){
    var p1 = / /gi;
    var p2 = /\t/gi;
    var p3 = /\n/gi;

    if(p_src == null || p_src == undefined){
        return "";
    }

    p_src = p_src + "";
    p_src = p_src.replace(p1,"");
    p_src = p_src.replace(p2,"");
    p_src = p_src.replace(p3,"");
    p_src = p_src.trim();
    return p_src;
}


function getMapPosition(p_obj){

    var ret_obj = { left:0, top:0 };
    var left = p_obj.style.left;
    var top = p_obj.style.top;

    left = left.replace(/px/gi,"");
    top = top.replace(/px/gi,"");

    ret_obj.left = parseFloat(left);
    ret_obj.top = parseFloat(top);

    return ret_obj;
}


function getUrlParams(p_url) {
    var params = {};
    p_url.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str, key, value) { params[key] = value; });
    return params;
}


function getPosTransform(p_obj){
    var i = 0;
    var ret_obj = { left:0, top:0, scale:1, rotate:0 };
    var str_tmp = "";
    var arr_tmp = [];
    var arr_match = [];

    var str_trans = p_obj.style.transform;
    //var str_trans = "translate(110px, 210px) scale(1, 1) rotate(110deg)";
    var regex = /(\w+)\((.+?)\)/g;
    var p1 = /px/gi;
    var p2 = /deg/gi;

    while( arr_match = regex.exec(str_trans)){
        if(arr_match.length == 3){
            if(arr_match[1] == "translate"){
                arr_tmp = arr_match[2].split(',');
                if(arr_tmp.length == 2){
                    str_tmp = arr_tmp[0].replace(p1,"");
                    ret_obj.left = parseFloat(str_tmp);
                    str_tmp = arr_tmp[1].replace(p1,"");
                    ret_obj.top = parseFloat(str_tmp);
                }
            }
            /*
            }else if(arr_match[1] == "scale"){
                arr_tmp = arr_match[2].split(',');
                if(arr_tmp.length == 2){
                    ret_obj.scale = parseFloat(arr_tmp[0]);
                }
            }else if(arr_match[1] == "rotate"){
                str_tmp = arr_match[2].replace(p2,"");
                ret_obj.rotate = parseFloat(str_tmp);
            }
            */
        }
        i++;
        if(i >= 10) break;
    }
    
    return ret_obj;
}


function getPosTransform_old(p_obj){
    var ret_obj = { left:0, top:0 };
    var str_trans = p_obj.style.transform;
    if(str_trans.indexOf("translate") >= 0){
        str_trans = str_trans.replace(/translate/gi,"");
        str_trans = str_trans.replace(/\(/gi,"");
        str_trans = str_trans.replace(/\)/gi,"");
        str_trans = str_trans.replace(/ /gi,"");
        str_trans = str_trans.replace(/px/gi,"");

        var arr_str = str_trans.split(',');
        if(arr_str.length == 2){
            ret_obj.left = parseFloat(arr_str[0]);
            ret_obj.top = parseFloat(arr_str[1]);
        }
    }else if(str_trans.indexOf("matrix") >= 0){
        str_trans = str_trans.replace(/matrix/gi,"");
        str_trans = str_trans.replace(/\(/gi,"");
        str_trans = str_trans.replace(/\)/gi,"");
        str_trans = str_trans.replace(/ /gi,"");
        str_trans = str_trans.replace(/px/gi,"");

        var arr_str = str_trans.split(',');
        if(arr_str.length == 6){
            ret_obj.left = parseFloat(arr_str[4]);
            ret_obj.top = parseFloat(arr_str[5]);
        }
    }
    return ret_obj;
}


////////////////////////////////////////////////////
// 연동

// 윈도우만 쓸 경우 window.chrome.webview
// function setInitFsCommand(){
//     if(window.chrome.webview){
//         window.chrome.webview.addEventListener('message',arg => {
//             var str_tmp = "";
//             var arr_tmp;
//             if("SENSOR" in arg.data){
//                 str_tmp = arg.data.SENSOR + "";
//                 if(str_tmp == "ON"){
//                     onClickScreenSaver();
//                 }
//             }
//         });
//     }
// }


function setInitFsCommand() {
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.addEventListener('message', arg => {
            var str_tmp = "";
            var arr_tmp;
            if ("SENSOR" in arg.data) {
                str_tmp = arg.data.SENSOR + "";
                if (str_tmp == "ON") {
                    onClickScreenSaver();
                }
            }
        });
    } else if (window.Android) {
        // 안드로이드 WebView를 위한 이벤트 리스너
        window.addEventListener('message', function(event) {
            var data = JSON.parse(event.data);
            if ("SENSOR" in data) {
                var str_tmp = data.SENSOR + "";
                if (str_tmp == "ON") {
                    onClickScreenSaver();
                }
            }
        });
    }
}



// function setCallWebToApp(p_cmd,p_val){
//     var str_cmd = "";

//     //console.log("setCallWebToApp = " + p_cmd + " , " + p_val);
    
//     if(window.chrome.webview){
//         str_cmd = p_cmd + " ${" + p_val + "}";
//         window.chrome.webview.postMessage(str_cmd);
//     }
// }

function setCallWebToApp(p_cmd, p_val) {
    var str_cmd = "";
    console.log("setCallWebToApp = " + p_cmd + " , " + p_val);

    if (window.chrome && window.chrome.webview) {
        // 윈도우 환경
        str_cmd = p_cmd + " ${" + p_val + "}";
        window.chrome.webview.postMessage(str_cmd);
    } else if (window.Android) {
        // 안드로이드 환경
        window.Android.postMessage(JSON.stringify({ cmd: p_cmd, val: p_val }));
    }
}   


function setCallWebToAppSock(p_cmd,p_val){
    var str_cmd = "";

    //console.log("setCallWebToAppSock = " + p_cmd + " , " + p_val);

    str_cmd = p_cmd + "^" + p_val;

    var str_url = "ws://127.0.0.1:8008/echo";

    var web_sock = new WebSocket(str_url);    

    web_sock.onopen = function(evt){
        web_sock.send(str_cmd);
        web_sock.close();
    }
}


// GET 방식처리
function setSendSocketGET(p_fnc,p_url,p_opt){
    var xhr;
    var fnc;
    if (window.XMLHttpRequest){
        xhr = new XMLHttpRequest();
    }else{
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }

    if(p_opt.timeout > 0){
        xhr.timeout = p_opt.timeout;
    }

    fnc = p_fnc;

    xhr.onreadystatechange = function(){
        if (xhr.readyState != 4){
            return;
        }
        // 성공을 했다.
        if(xhr.status == 200){
            //console.log("setSendSocketGET = " + xhr.status);
            // 받은 정보를 콜백하자.
            str_ret = xhr.responseText;
            str_ret = $.trim(str_ret);
            str_ret = str_ret.replace(/\n/g,"");
            fnc("SUCC",str_ret);
        }else{  // 실패를 했다.
            fnc("FAIL","");
        }
    }

    xhr.open("GET",p_url,true);
    xhr.send();
}

// POST 방식처리
function setSendSocketPOST(p_fnc,p_url,p_opt,p_form,p_body){
    var str_ret = "";
    var xhr;
    var fnc;
    if (window.XMLHttpRequest){
        xhr = new XMLHttpRequest();
    }else{
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }

    if(p_opt.timeout > 0){
        xhr.timeout = p_opt.timeout;
    }

    fnc = p_fnc;

    xhr.onreadystatechange = function(){
        if (xhr.readyState != 4){
            return;
        }
        // 성공을 했다.
        if(xhr.status == 200){
            // 받은 정보를 콜백하자.
            str_ret = xhr.responseText;
            str_ret = $.trim(str_ret);
            str_ret = str_ret.replace(/\n/g,"");
            fnc("SUCC",str_ret);
        }else{  // 실패를 했다.
            fnc("FAIL","");
        }
    }

    xhr.open("POST",p_url,true);
    if(p_opt.type == "JSON"){ 
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(p_body);
    }else{
        xhr.send(p_form);
    }
}

// 결과를 받는다.
function onReadSockContents(){
    var str_ret = "";
    //console.log("gl_http = " + gl_http.status);
    if (gl_http.readyState != 4){
        return;
    }
    // 성공을 했다.
    if(gl_http.status == 200){
        //console.log("onReadSockContents = " + gl_http.status);
        // 받은 정보를 콜백하자.
        str_ret = gl_http.responseText;
        str_ret = $.trim(str_ret);
        str_ret = str_ret.replace(/\n/g,"");
        gl_fnc("SUCC",str_ret);
        //  gl_http.responseText;
    }else{  // 실패를 했다.
        gl_fnc("FAIL","");
    }
}
