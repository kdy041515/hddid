/******************************************
   name :  xml.js
   auth :  ELTOV
   date :  2022.08.25
   desc :  xml 파싱
*******************************************/


//////////////////////////////////////////////////////////////
// 리턴할 페이지 불러오기
function setLoadContents(p_url,p_fnc){
    var xml_http;
    if (window.XMLHttpRequest){
        xml_http = new XMLHttpRequest();
    }else{
        xml_http = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xml_http.open("GET",p_url,true);
    xml_http.onreadystatechange = function(){
        onReadXmlContents(xml_http,p_fnc);
    };
    xml_http.send();
}

function onReadXmlContents(p_xml, p_fnc) {
    var ret_code = "FAIL";
    if (p_xml.readyState != 4) {
        return;
    }
    if (p_xml.status != 200) {
        setTxtError("INIT", "Error!!<br>Please retry");
        return;
    }

    try {
        var xml_doc = p_xml.responseXML;

        var root_node = xml_doc.getElementsByTagName("KIOSK")[0];
        if (!root_node) {
            setTxtError("INIT", "Error!!<br>Please retry");
            return;
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
                            CObj.FRAME_LIST = frame_list;
                            if (frame_list.length > 0) {
                                xml_data.arr_notice_list_l.push(CObj);
                            }
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
                            CObj.FRAME_LIST = frame_list;
                            if (frame_list.length > 0) {
                                xml_data.arr_notice_list_r.push(CObj);
                            }
                        }
                        child2 = child2.nextSibling;
                    }
                } else if (child1.nodeName == "NOTICE_LIST_E") {

                    if (xml_data.arr_notice_list_e == null) {
                        xml_data.arr_notice_list_e = new Array();
                    }

                    child2 = child1.firstChild;
                    str_type = getCvtXmlTag(child1.getAttribute("type"));

                    while (child2 != null && child2.nodeType != 4) {
                        if (child2.nodeName == "NOTICE_INFO") {
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
                            CObj.FRAME_LIST = frame_list;
                            if (frame_list.length > 0) {
                                xml_data.arr_notice_list_e.push(CObj);
                            }
                        }
                        child2 = child2.nextSibling;
                    }
                }  // END IF
            }

            child1 = child1.nextSibling;
        }
    } catch (err) {
        console.log("ERR PARSE XML");
        console.log(err);
        return;
    }

    try {
        window.xml_data = xml_data;
        if (window.jQuery) {
            window.jQuery(document).trigger('xmlDataReady', [xml_data]);
        }
    } catch (pubErr) {
        console.log("xml_data publish error", pubErr);
    }

    console.log(xml_data)
}



function setTxtError(p_type,p_msg){
    console.log("setTxtError = " + p_type + " , " + p_msg);
}
