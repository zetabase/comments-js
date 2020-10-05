
/*
007.zb> put sys subusers/zetapages/maxnum 10000
ZB>  Success.
007.zb> put sys subusers/zetapages/token/1 zptoken
ZB>  Success.
007.zb> create zp_comments json "user read zetapages,user append zetapages uid @uid ts @time,user delete zetapages uid @uid,user read zetapages_public" uid lex ts natural
ZB>  Adding permission constraint: field uid must contain user's ID...
ZB>  Timestamp field: ts
ZB>  Adding permission constraint: field uid must contain user's ID...
ZB>  Success.
007.zb>
007.zb> create zp_profiles json "user read zetapages,user append zetapages @key @uid,user delete zetapages @key @uid,user read zetapages_public"
ZB>  Adding permission constraint: field @key must contain user's ID...
ZB>  Adding permission constraint: field @key must contain user's ID...
ZB>  Success.
007.zb>
*/

/*

007.zb> put sys subusers/zetapages_public/token/1 zetapages_public
ZB>  Success.
007.zb> put sys subusers/zetapages_public/maxnum 1
ZB>  Success.


./zb manage -G zetapages_public -p zetapages_public -S zetapages_public -t newsubuser -F 8a12658b-8c5c-4394-bd60-7e0cfedc9007 --user.name zetapages_public --user.mobile "+12035613094" --user.email "zetapages_public@yourdomain.com"

*/


/*
Re-doing comments and profiles tables for 3PA -

create zp_comments_3pa json "user read zetapages,user append zetapages uid @uid ts @time,user delete zetapages uid @uid,user read google-3pa,user append google-3pa uid @uid ts @time,user delete google-3pa uid @uid,user read zetapages_public" uid lex ts natural
create zp_profiles_3pa json "user read zetapages,user append zetapages @key @uid,user delete zetapages @key @uid,user read google-3pa,user append google-3pa @key @uid,user delete google-3pa @key @uid,user read zetapages_public"

*/



const PUBLIC_SUBUSER_GROUP_ID = "commentsjs_public"
const PUBLIC_SUBUSER_HANDLE = "commentsjs_public"
const PUBLIC_SUBUSER_PASSWORD = "commentsjs_public"

const SUBUSER_GROUP_ID = "commentsjs"
const COMMENTS_TABLE_ID = "commentsjs_comments"
const PROFILES_TABLE_ID = "commentsjs_profiles"

const SIGNUP_MODE = "signup"
const EDIT_PROFILE_MODE = "edit-prof"
const VERIFY_MODE = "verify"
const SIGNIN_MODE = "signin"
const SU_EMAIL_MODE = "email"
const SU_MOBILE_MODE = "mobile"
const COMMENT_MODE = "comment"

const LOGIN_STORAGE_KEY = "commentsjs-login-info"

const TOKEN_REFRESH_INTERVAL_MS = 1200000

var _zpProfiles = {};


function trimUrl(s) {
    if(s.indexOf("?_a") >= 0) {
        return s.substring(0, s.indexOf("?_a"))
    } else if(s.indexOf("&_a") >= 0) {
        return s.substring(0, s.indexOf("&_a"))
    } else if(s.indexOf("#") >= 0) {
        return s.substring(0, s.indexOf("#"))
    }
    return s;
}
function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    // console.log('Query variable %s not found', variable);
    return undefined;
}

function  refreshPage() {
    document.location = document.location.toString()
}

function _zpDetect3paRedirect() {
    let suid = getQueryVariable("_e")
    let tok = getQueryVariable("_t")
    let src = getQueryVariable("_a")
    if((!!src) && (!!suid) && (!!tok)) {
        if(src == "google") {
            // only supported source
            return {suid: suid, token: tok, source: src}
        }
    }
    return undefined
}

function stripId(s){
    return s.startsWith("#") ? s.substring(1) : s;
}

function mdToHtml(md) {
    let conv = new showdown.Converter();
    return conv.makeHtml(md);
}

var _zpClient = undefined;
var _zpDidPublicLogin = false;
var _zpUserId = undefined;
var _zpUserHandle = undefined;
var _zpMode = undefined;
var _zpLoggedIn = false;
var _zpHelpMessage = undefined;


function _zpDefaultPageKey() {
    let s = document.location.toString()
    let eIdx = s.indexOf("#");
    let eIdx2 = s.indexOf("?");
    if(eIdx2 < eIdx && eIdx2 >= 0) {
        eIdx = eIdx2;
    }
    if(eIdx < 0) {
        if(eIdx2 < 0){

            eIdx = s.length;
        } else {
            eIdx = eIdx2;
        }
    }
    let sIdx = s.lastIndexOf("/");
    if(sIdx < 0) {
        sIdx = 0;
    } else {
        sIdx += 1;
    }
    return s.substring(sIdx, eIdx)
}

function _zpSetMode(divId0, newMode, options) {
    // console.log("changing mode to ", newMode)
    let oldMode = _zpMode;
    let doLogin3pa = __is3pa(options)
    _zpMode = newMode;
    let divId = stripId(divId0);
    let submitSel = '#' + divId + " a.zp-submit-link";
    let loginSel = '#' + divId + " a.zp-login-link";
    let signupSel = '#' + divId + " a.zp-signup-link";
    let editProfileLinkSel = '#' + divId + " a.zp-edit-profile-link";
    let inputSel = '#' + divId + " input[type=text]";
    let passSel = '#' + divId + " input[type=password]";
    let descSel = '#' + divId + " span.zp-description";
    let passLblSel = '#' + divId + " span.zp-pass-label";
    let inputLblSel = '#' + divId + " span.zp-input-label";
    let taDescSel = '#' + divId + " span.zp-textarea-description";
    let editProfileSel = '#' + divId + " div.zp-comments-edit-profile";
    let inputsSel = '#' + divId + " div.zp-inputs";
    let brandSel = '#' + divId + " span.zp-br";
    $(brandSel).html("<div style=\"width: 240px; text-align: right; margin-left: 40px;\">powered by <a href=\"https://zetabase.io/comments-js\">Comments.js</a> <img src=\"https://zetabase.io/static/assets/img/logo_black.png\" style=\"height: 28px; margin-top: -4px\" /></div>")

    if(_zpMode == EDIT_PROFILE_MODE) {
        // $(editProfileSel).addClass("edit-profile-active")
        $(inputsSel).addClass("edit-profile-active")
    } else {
        // $(editProfileSel).removeClass("edit-profile-active")
        $(inputsSel).removeClass("edit-profile-active")
    }

    if(!!_zpHelpMessage) {
        $('.zp-help-message').show()
        $('.zp-help-message').html(_zpHelpMessage)
    } else {
        $('.zp-help-message').hide()
    }

    if(_zpMode == SIGNUP_MODE) {
        $(descSel).text("Sign up now to join the conversation!")

        $(submitSel).show()
        $(inputLblSel).text("Handle")
        $(passLblSel).text("Password")
        $(inputLblSel).show()
        $(passLblSel).show()
        $(loginSel).show()
        $(loginSel).text("login")
        $(signupSel).hide()
        $(passSel).show()
        $(editProfileLinkSel).hide()
        $(editProfileSel).hide()
    } else if(_zpMode == SIGNIN_MODE) {

        if(doLogin3pa) {
            $(descSel).text("Sign in now to join the conversation!")
            $(inputSel).hide()
            $(passSel).hide()
            $(inputLblSel).hide()
            $(passLblSel).hide()
            $(signupSel).show()
            $(signupSel).text("Continue to sign in with Google")
            $(submitSel).hide()
        } else {
            $(descSel).text("Sign in now to join the conversation!")
            $(inputSel).show()
            $(inputSel).val("")
            $(passSel).show()
            $(inputLblSel).text("Handle")
            $(passLblSel).text("Password")
            $(inputLblSel).show()
            $(passLblSel).show()
            $(signupSel).show()
            $(submitSel).show()
        }

        $(loginSel).text("login")
        $(loginSel).hide()
        $(editProfileLinkSel).hide()
        $(editProfileSel).hide()
    } else if(_zpMode == VERIFY_MODE) {
        $(descSel).text("Enter your text message confirmation code here:")

        $(submitSel).show()
        $(loginSel).show()
        $(signupSel).hide()
        $(passSel).hide()
        $(inputLblSel).text("Verification code")
        $(inputLblSel).show()
        $(passLblSel).hide()
        $(editProfileLinkSel).hide()
        $(editProfileSel).hide()
    } else if(_zpMode == COMMENT_MODE) {
        $(submitSel).show()
        $(descSel).text("Discussion")

        $(editProfileSel + " textarea").val("")
        $(editProfileSel + " textarea").focus();
        if(!!oldMode) {
            scrollTo(descSel)
        }
        $(loginSel).show()
        $(loginSel).text("logout")
        $(signupSel).hide()
        $(inputSel).hide()
        $(passSel).hide()
        // $(inputLblSel).text("Comment")
        $(inputLblSel).hide()
        $(passLblSel).hide()
        $(taDescSel).text("Comment")
        $(taDescSel).show()
        $(editProfileLinkSel).show()
        $(editProfileSel).show()
    } else if(_zpMode == EDIT_PROFILE_MODE) {
        // TODO
        $(descSel).text("Edit profile")
        
        let prof = _zpProfiles[_zpUserId]
        if(prof) {
            $(editProfileSel + " textarea").val(prof.description);
            $(inputSel).val(prof.nickname);
        }

        $(submitSel).show()
        $(inputSel).show()
        $(inputSel).focus();
        scrollTo(descSel)
        $(loginSel).hide()
        $(signupSel).hide()
        $(passSel).hide()
        $(inputLblSel).text("Display name")
        $(inputLblSel).show()
        $(taDescSel).text("Profile description")
        $(taDescSel).show()
        $(passLblSel).hide()
        $(editProfileLinkSel).show()
        $(editProfileSel).show()
    } else if(_zpMode == SU_MOBILE_MODE) {
        $(descSel).text("Enter mobile number")

        $(loginSel).hide()
        $(submitSel).show()
        $(signupSel).hide()
        $(passSel).hide()
        $(inputLblSel).text("Mobile number (+ format)")
        $(inputLblSel).show()
        $(passLblSel).hide()
        $(editProfileLinkSel).hide()
        $(editProfileSel).hide()
    } else if(_zpMode == SU_EMAIL_MODE) {
        $(descSel).text("Enter email address")

        $(loginSel).hide()
        $(submitSel).show()
        $(signupSel).hide()
        $(passSel).hide()
        $(inputLblSel).text("Email address")
        $(inputLblSel).show()
        $(passLblSel).hide()
        $(editProfileLinkSel).hide()
        $(editProfileSel).hide()
    }
}

function _zpGetProfile(userId, cb) {
    Zb.get(_zpClient, PROFILES_TABLE_ID, [userId], function(res,err) {
        // console.log("Get profile result:", res)
        if(res && res[userId]){
            cb(JSON.parse(res[userId]), undefined)
        } else {
            console.log("Error getting profile for " + userId + ": ", err)
            cb(undefined, "error")
            // console.log("Error getting profile for " + userId + ": ", res)
        }
    })
}

function _zpSetProfile(userId, profData, cb) {
    Zb.set(_zpClient, PROFILES_TABLE_ID, userId, JSON.stringify(profData), function(res, err) {
        if(err){
            console.log("Set profile err:", err)
        }
        cb(res)
    })
}

function _zpUpdateComments(pageId, divId0, layout){
    let divId = stripId(divId0);
    let commentsSel = '#' + divId + " div.zp-comments";
    // console.log("zb", Zb)
    Zb.listKeys(_zpClient, COMMENTS_TABLE_ID, `comment/${pageId}/%`, function(res,err){
        if(err){
            console.log('err', err)
        } else {
        //    console.log('res com', res)
           Zb.get(_zpClient, COMMENTS_TABLE_ID, res, function(res,err){
                if(err){
                    console.log('err', err)
                } else {
                    // console.log('res get', res)
                    _zpRenderComments(commentsSel, res, pageId, divId0, layout)
                }
           })
        }
    })
}

function _zpRenderComments(commentsSel, data, pageId, divId0, style) {
    if(style == "tile") {
        return _zpRenderCommentsTile(commentsSel, data, pageId, divId0)
    } else {
        return _zpRenderCommentsStandard(commentsSel, data, pageId, divId0)
    }
}

function _zpRenderCommentsTile(commentsSel, data, pageId, divId0) {
    let ht = "<div class=\"zp-comments-tiles\">";
    let msgs = [];
    for(var k in data){
        try {
            msgs.push(JSON.parse(data[k]));
        }catch(e){
            console.log(`Error parsing: ${k}:\n`, data[k])
        }
    }
    msgs = msgs.sort(function(x,y){
        try{
            return parseInt(y.ts.toString()) - parseInt(x.ts.toString());
        } catch(e){
            return 0;
        }
    })
    for(let i = 0;i < msgs.length; i++){
        let d = msgs[i];
        let ts = new Date(d.ts / 1000000);
        let name = "anonymous coward";
        if (!_zpProfiles[d.uid]) {
            // Need to get user profile
            _zpProfiles[d.uid] = {}; // don't start 2 loads
            _zpGetProfile(d.uid, function(res, err) {
                if(err) {
                    console.log("got user profile err: ", err)
                } else {
                    _zpProfiles[d.uid] = res;
                    _zpUpdateComments(pageId, divId0, "tile")
                    // name - _zpProfiles[d.uid] // prob won't do anything
                }
            })
        } else {
            if(_zpProfiles[d.uid].nickname) {
                name = _zpProfiles[d.uid].nickname;
            }
        }
        let textHtml = mdToHtml(d.text);
        let tileClass = (textHtml.length > 300) ? "zp-comment-tile zp-comment-tile--width2" : "zp-comment-tile";
        let handleClass = (d.uid == _zpUserId) ? "zp-comment-my-handle" : "zp-comment-handle";
        ht += "<div class=\"" + tileClass + "\"><div class=\"zp-comment-header\"><span class=\""+ handleClass +"\">"+ name + "</span> <span class=\"zp-comment-ts\">" + ts.toLocaleString() + "</span></div> <div class=\"zp-comment-text\">" + textHtml + "</div></div>"
    }
    ht += "</div>";

    if(msgs.length == 0) {
        ht = "<span class=\"zp-no-comments\">No comments yet. Break the ice!</span>"
    }
    console.log(ht)

    $(commentsSel).html(ht)
    $('.zp-comments-tiles').masonry({
        // options
        itemSelector: '.zp-comment-tile',
        columnWidth: 300
      });
}

function _zpRenderCommentsStandard(commentsSel, data, pageId, divId0) {
    let ht = "<ul>";
    let msgs = [];
    for(var k in data){
        msgs.push(JSON.parse(data[k]));
    }
    msgs = msgs.sort(function(x,y){
        try{
            return parseInt(y.ts.toString()) - parseInt(x.ts.toString());
        } catch(e){
            return 0;
        }
    })
    // console.log(msgs)
    for(let i = 0;i < msgs.length; i++){
        let d = msgs[i];
        let ts = new Date(d.ts / 1000000);
        let name = "anonymous coward";
        if (!_zpProfiles[d.uid]) {
            // Need to get user profile
            _zpProfiles[d.uid] = {}; // don't start 2 loads
            _zpGetProfile(d.uid, function(res, err) {
                if(err) {
                    console.log("got user profile err [2]: ", err)
                } else {
                // console.log("got user profile: ", res)
                    _zpProfiles[d.uid] = res;
                    _zpUpdateComments(pageId, divId0, "standard")
                    // name - _zpProfiles[d.uid] // prob won't do anything
                }
            })
        } else {
            if(_zpProfiles[d.uid].nickname) {
                name = _zpProfiles[d.uid].nickname;
            }
        }
        let textHtml = mdToHtml(d.text); 
        let handleClass = (d.uid == _zpUserId) ? "zp-comment-my-handle" : "zp-comment-handle";
        ht += "<li><div><span class=\""+ handleClass+"\">"+ name + "</span> <span class=\"zp-comment-ts\">" + ts.toLocaleString() + "</span></div> <div class=\"zp-comment-text\">" + textHtml + "</div></li>"
    }
    ht += "</ul>";

    if(msgs.length == 0) {
        ht = "<span class=\"zp-no-comments\">No comments yet. Break the ice!</span>"
    }

    $(commentsSel).html(ht)
}

function _zpPersistCreds(uid, handle, token) {
    if(!sessionStorage) {
        return;
    }
    let rig = {handle: handle, token: token, uid: uid};
    console.log("Persisting credentials:", rig)
    sessionStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(rig));
}

function __is3pa(options) {
    if(options.auth) {
        let an = options.auth.toString().toLowerCase()
        if(an == "3pa" || an == "google") {
            return true;
        }
    }
    return false;
}

function _zpReferralUrl(options){
    let thisSite = options.referralUrl;
    if(!thisSite) {
       thisSite = trimUrl(document.location.toString())
    }
    return thisSite
}

function scrollTo(idSel){
    // document.querySelector(idSel).scrollIntoView({
    //     behavior: 'smooth' 
    // });
    $("body,html").animate(
        {
          scrollTop: $(idSel).offset().top - 100
        },
        800 //speed
      );
}

function commentsify(uid, signupToken, divId0, options) {
    let pageId = undefined;
    let layout = "standard";
    let doLogin3pa = false;
    if(options) {
        if(options.pageId) {
            pageId = options.pageId;
        }
        if(options.layout) {
            layout = options.layout;
        }
        doLogin3pa = __is3pa(options)
    }

    if((!pageId) || (pageId == null)) {
        pageId = _zpDefaultPageKey()
        console.log("Using page key: ", pageId)
    }

    // console.log("Page key: ", pageId)
    _zpSetMode(divId0, SIGNIN_MODE, options);

    let divId = stripId(divId0);
    let submitSel = '#' + divId + " a.zp-submit-link";
    let inputSel = '#' + divId + " input[type=text]";
    let loginSel = '#' + divId + " a.zp-login-link";
    let signupSel = '#' + divId + " a.zp-signup-link";
    let passSel = '#' + divId + " input[type=password]";
    let descSel = '#' + divId + " span.zp-description";
    let taDescSel = '#' + divId + " span.zp-textarea-description";
    let passLblSel = '#' + divId + " span.zp-pass-label";
    let inputLblSel = '#' + divId + " span.zp-input-label";
    let editProfileLinkSel = '#' + divId + " a.zp-edit-profile-link";
    let editProfileSel = '#' + divId + " div.zp-comments-edit-profile";
    var email = ""
    var mobile = ""
    var handle = ""
    var newPass = ""
    
    var autoLogin = false
    
    // $('.grid').masonry({
    //     // options
    //     itemSelector: '.grid-item',
    //     columnWidth: 200
    //   });
    
    let refUrl = _zpReferralUrl(options);
    console.log("Using referral URL: " + refUrl)

    let auth3pa = _zpDetect3paRedirect();

    let checkProfile = (suid) => {
        _zpGetProfile(suid, function(res, err) {
            if(err) {
                console.log("got user profile err: ", err)
                _zpHelpMessage = "<b>Make a display name</b> by clicking \"Edit Profile\" below!"
                $(".zp-help-message").show()
                $(".zp-help-message").html(_zpHelpMessage)
            } else {
                _zpProfiles[suid] = res;
            }
        })
    }

    if(!!auth3pa) {
        let subUid = auth3pa.suid;
        let tok = auth3pa.token;
        autoLogin = true
        Zb.connectSubJwt(uid, subUid, tok, function(cli, err) {
            if(err) {
                $(descSel).text("Login failed. Please check handle and password. (1) - " + err.toString())
            } else {
                // console.log('cli', cli)
                _zpClient = cli;
                _zpUserId = cli.userId;
                _zpPersistCreds(_zpClient.userId, _zpUserHandle, _zpClient.jwtRefreshToken)
                _zpLoggedIn = true;
                _zpSetMode(divId0, COMMENT_MODE, options);
                $(editProfileSel + " textarea").focus();
                _zpUpdateComments(pageId, divId0, layout)
                checkProfile(_zpUserId)
            }
        }).catch((e) => {
            $(descSel).text("Auto-login failed. Please check handle and password.")
        })
    } else if(sessionStorage) {
        try {
            // TODO - change to connect with jwt
            let item0 = sessionStorage.getItem(LOGIN_STORAGE_KEY);
            if(item0 != null) {
                console.log("Cached creds:", item0)
                let item = JSON.parse(item0);
                let subUid = item.uid;
                let tok = item.token;
                autoLogin = true
                try {
                    console.log(`Auto logging in as ${handle} - ${uid} (${tok})`)
                    Zb.connectSubJwt(uid, subUid, tok, function(cli, err) {
                        console.log("csj - access", cli.jwtToken)
                        if(err) {
                            console.log(`err 0 - `, err)
                            $(descSel).text("Login failed. Please check handle and password. (3) - " + err.toString())
                            if(sessionStorage) {
                                sessionStorage.removeItem(LOGIN_STORAGE_KEY)
                            }
                            refreshPage()
                        } else if((!cli.jwtToken) || (!cli.userId)) {
                            if(sessionStorage) {
                                sessionStorage.removeItem(LOGIN_STORAGE_KEY)
                            }
                            console.log(`No access token obtained...`)
                            refreshPage()
                        } else {
                            console.log(`res 2 - `, cli.userId)
                            // console.log('cli', cli)
                            _zpClient = cli;
                            _zpUserId = cli.userId;
                            _zpLoggedIn = true;
                            _zpUserHandle = handle;
                            console.log("Persisting creds from JWT auto-login - ", _zpUserHandle, handle)
                            _zpPersistCreds(_zpClient.userId, _zpUserHandle, _zpClient.jwtRefreshToken)
                            _zpSetMode(divId0, COMMENT_MODE, options);
                            $(editProfileSel + " textarea").focus();
                            _zpUpdateComments(pageId, divId0, layout)
                            checkProfile(_zpUserId)
                        }
                    }).catch((e) => {
                        if(sessionStorage) {
                            sessionStorage.removeItem(LOGIN_STORAGE_KEY)
                        }
                        refreshPage()
                        $(descSel).text("Auto-login failed. Please check handle and password.")
                    }) 
                } catch(e) { 
                    if(sessionStorage) {
                        sessionStorage.removeItem(LOGIN_STORAGE_KEY)
                    }
                    refreshPage()
                    $(descSel).text("Login failed. Please check handle and password (2):" + e.toString())
                }
            } else {
                console.log("No cached credentials.")
            }
        } catch(e){
            console.log("Auto-login error:", e)
        }
    }

    if((!autoLogin)) {
        console.log("doing public login: ", PUBLIC_SUBUSER_HANDLE, PUBLIC_SUBUSER_PASSWORD)
        _zpDidPublicLogin = true;
        Zb.connectSub(uid, PUBLIC_SUBUSER_HANDLE, PUBLIC_SUBUSER_PASSWORD, function(cli,err){
            if(err){
                $(descSel).text("Public login failed. Please refer to setup instructions to fix this.")
            } else {
                _zpClient = cli;
                _zpUpdateComments(pageId, divId0, layout)
            }
        })
    }

    setInterval(function(){
        console.log(`ZB refreshing token...`)
        try {
            if((!!_zpClient) && (!!_zpClient.jwtRefreshToken)) {
                Zb.refreshJwtToken(_zpClient, function(r){
                    console.log("Refresh result: ", r)
                    if(!_zpDidPublicLogin) {
                        _zpPersistCreds(_zpClient.userId, _zpUserHandle, _zpClient.jwtRefreshToken)
                    }
                })
            }
        } catch(e){
            console.log(`Error refreshing: ${e}`)
        }
    }, TOKEN_REFRESH_INTERVAL_MS)

    $(submitSel).click(function(){
        let txt = $(inputSel).val()
        let pass = $(passSel).val()
        $(inputSel).val("")
        $(passSel).val("")
        // console.log("txt", txt)
        // console.log("pass", pass)
        if(_zpMode == SIGNIN_MODE) {
            try{
            Zb.connectSub(uid, txt, pass, function(cli, err) {
                if(err) {
                    $(descSel).text("Login failed. Please check handle and password.")
                } else {
                    // console.log('cli', cli)
                    _zpClient = cli;
                    _zpUserId = cli.userId;
                    _zpLoggedIn = true;
                    _zpPersistCreds(_zpClient.userId, _zpUserHandle, _zpClient.jwtRefreshToken)
                    _zpSetMode(divId0, COMMENT_MODE, options);
                    $(editProfileSel + " textarea").focus();
                    scrollTo(descSel)
                    _zpUpdateComments(pageId, divId0, layout)
                    checkProfile(_zpUserId)
                }
            }).catch((e) => {
                $(descSel).text("Login failed. Please check handle and password.")
            }) 
            } catch(e) { 
                $(descSel).text("Login failed. Please check handle and password.")
            }
        } else if(_zpMode == SIGNUP_MODE) {
            handle = txt;
            newPass = pass;
            // console.log(handle)
            _zpSetMode(divId0, SU_EMAIL_MODE, options)
        } else if(_zpMode == SU_EMAIL_MODE) {
            email = txt;
            // console.log(email)
            _zpSetMode(divId0, SU_MOBILE_MODE, options)
        } else if(_zpMode == SU_MOBILE_MODE) {
            mobile = txt;
            // console.log(mobile)
            // console.log(uid, handle, email, mobile, newPass, signupToken, SUBUSER_GROUP_ID)
            _zpUserHandle = handle;
            Zb.newSubUser(uid, handle, email, mobile, newPass, signupToken, SUBUSER_GROUP_ID, function(res, err){
                if(err){
                    $(descSel).text("Signup failed: " + err.message)
                    // console.log('err', err)
                    _zpSetMode(divId0, SIGNUP_MODE, options)
                } else {
                    // console.log(res)
                    _zpUserId = res;
                    _zpSetMode(divId0, VERIFY_MODE, options)
                }
            })
        } else if(_zpMode == VERIFY_MODE) {
            Zb.confirmNewSubUser(uid, _zpUserId, txt, function(res,err){
                if(err){
                    $(descSel).text("Signup verification failure: " + err.message)
                    // console.log('err', err)
                } else {
                    // console.log('res verify', res)
                    Zb.connectSub(uid, handle, newPass, function(cli, err) {
                        if(err) {
                            $(descSel).text("Login failed. Please check handle and password.")
                        } else {
                            // console.log('cli', cli)
                            _zpClient = cli;
                            _zpUserId = cli.userId;
                            _zpPersistCreds(_zpClient.userId, _zpUserHandle, _zpClient.jwtRefreshToken)
                            _zpLoggedIn = true;
                            _zpSetProfile(_zpUserId, {nickname: _zpUserHandle, description: ""}, function(res){
                                if(!res){
                                    console.log("error setting profile")
                                }
                                _zpSetMode(divId0, COMMENT_MODE, options)
                                _zpUpdateComments(pageId, divId0, layout)
                            })
                            // _zpSetMode(divId0, COMMENT_MODE);
                            // _zpUpdateComments(pageId, divId0)
                        }
                    })
                }
            })
        } else if(_zpMode == EDIT_PROFILE_MODE) {
            let desc = $(editProfileSel + " textarea").val();
            // console.log("Desc: ", desc)
            let prof = {nickname: txt, description: desc}
            _zpProfiles[_zpUserId] = prof;
            _zpSetProfile(_zpUserId, prof, function(res){
                if(!res){
                    console.log("error setting profile")
                }
                _zpSetMode(divId0, COMMENT_MODE, options)
                $(editProfileLinkSel).text("edit profile")
                _zpUpdateComments(pageId, divId0, layout)
            })
        } else if(_zpMode == COMMENT_MODE) {
            // Zb.listKeys(_zpClient, COMMENTS_TABLE_ID, `comment/${pageId}/%`, function(res,err){
            //     if(err){
            //         console.log('err', err)
            //     } else {
            //         console.log('res com', res)
            //     }
            // })
            // if(txt.length == 0){
            //     return;
            // }
            let msgTxt = $(editProfileSel + " textarea").val();
            let data = {"uid": _zpUserId, "text": msgTxt};
            let key = `comment/${pageId}/${_zpUserId}/${(new Date()).getTime()}`;
            console.log(`Putting key ${key} - data `, data)
            $(editProfileSel + " textarea").val("");
            // Do the insert!
            Zb.put(_zpClient, COMMENTS_TABLE_ID, key, JSON.stringify(data), function(res, err) {
                if(err) {
                    $(descSel).text("Failed to post comment:" + err.message)
                } else {
                    // console.log('res put', res)
                    _zpSetMode(divId0, COMMENT_MODE, options);
                    setTimeout(function(){
                        _zpUpdateComments(pageId, divId0, layout)
                    }, 2000)
                }

            })
        }
    })


    $(editProfileLinkSel).click(function(){
        if(_zpMode == EDIT_PROFILE_MODE) {
            _zpSetMode(divId0, COMMENT_MODE, options)
            $(editProfileLinkSel).text("edit profile")
        } else {
            _zpHelpMessage = undefined;
            _zpSetMode(divId0, EDIT_PROFILE_MODE, options)
            $(editProfileLinkSel).text("cancel edit")
        }
    })
    $(signupSel).click(function(){
        let thisSite = _zpReferralUrl(options);
        console.log(`Using redirect ${thisSite}`)
        if(!doLogin3pa) {
            _zpSetMode(divId0, SIGNUP_MODE, options)
        } else {
            document.location = "https://zetabase.io/3pa/login?ref=" + encodeURIComponent(thisSite) + "&puid=" + encodeURIComponent(uid)
        }
        // let txt = $(inputSel).val()
        // let pass = $(passSel).val()
        // $(inputSel).val("")
        // console.log(txt)
        // console.log(pass)
    })
    $(loginSel).click(function(){
        if(_zpLoggedIn) {
            _zpUserId = undefined;
            _zpUserHandle = undefined;
            _zpClient = undefined;
            _zpLoggedIn = false;
            if(sessionStorage) {
                sessionStorage.removeItem(LOGIN_STORAGE_KEY)
            }
            if(doLogin3pa) {
                document.location = "https://zetabase.io/3pa/login?action=logout&ref=" + encodeURIComponent(_zpReferralUrl(options))
            } else {
                document.location = _zpReferralUrl(options)

            }
        }
        _zpSetMode(divId0, SIGNIN_MODE, options)
        // let txt = $(inputSel).val()
        // let pass = $(passSel).val()
        // $(inputSel).val("")
        // console.log(txt)
        // console.log(pass)
    })
}