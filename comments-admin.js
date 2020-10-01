
var _zpAdminHelpMessage = undefined;
var _zpAdminClient = undefined;
var _zpAdminData = undefined;

function updateHelp(){

    if(!!_zpAdminHelpMessage) {
        $('.zp-help-message').show()
        $('.zp-help-message').html(_zpAdminHelpMessage)
    } else {
        $('.zp-help-message').hide()
    }
}

function commentsAdmin(divId0) {
    let divId = stripId(divId0);
    console.log(`Creating admin console in ${divId}...`)
    let brandSel = '#' + divId + " span.zp-br";
    let submitSel = '#' + divId + " a.zp-submit-link";
    let inputSel = '#handle-input';
    let siteSel = '#site-input';
    let passSel = '#' + divId + " input[type=password]";
    $(brandSel).html("powered by <a href=\"https://zetabase.io/comments-js\">Comments.js</a> <img src=\"https://zetabase.io/static/assets/img/logo_black.png\" style=\"height: 28px; margin-top: -4px\" />")

    updateHelp()
    $(".zp-author-info").hide()

    let cfg = loadSessionData()

    if(!!cfg) {
        $(siteSel).val(cfg.pageId)
        $(inputSel).val(cfg.handle)
        console.log(cfg)
    } else {
        console.log('no session')
    }

    $(submitSel).click(function(){
        let handle = $(inputSel).val()
        let pass = $(passSel).val()
        let site = $(siteSel).val()
        persistSessionData(site, handle)
        Zb.connect(null, handle, pass, function(res, err) {
            if(res){
                console.log('res', res)
                _zpAdminClient = res;
                _zpAdminHelpMessage = "Success!"
                updateHelp()
                updatePosts(site)
            } else {
                _zpAdminHelpMessage = "Failed to log you in. Please check your provided handle and password."
                updateHelp()
                console.log('err', err)
            }
        })
        console.log('click', handle, pass, site)
    })
}

function deletePost(id) {
    Zb.deleteKey(_zpAdminClient, COMMENTS_TABLE_ID, id, function(res, err) {
        if(err){
            _zpAdminHelpMessage = "Failed to delete post."
            updateHelp()
        } else {
            _zpAdminHelpMessage = "Deleted post: " + id
            updateHelp()
        }
    })
}

function lookupUser(id) {
    Zb.get(_zpAdminClient, PROFILES_TABLE_ID, [id], function(res0,err) {
        console.log(res0[id])
        try {
            let res = JSON.parse(res0[id])
            $(".zp-author-info").show()
            if(err){
                $(".zp-author-info p").text("Error: " + err.toString())
                // alert(err)
            } else {
                $(".zp-author-info p").html("<em>Nickname:</em> <span>" + res.nickname + "</span>")
            // alert(JSON.stringify(res))
            }
        } catch(e) {
            $(".zp-author-info p").text("Error: " + e.toString())

        }
    }) 
}

function renderAdminView() {
    let ht = "";
    let ctr = 0;
    for(var k in _zpAdminData) {
        ctr += 1;
        let commentId = "comment-" + ctr.toString()
        let d = JSON.parse(_zpAdminData[k])
        let ts = new Date(d.ts / 1000000);
        let txt = d.text;
        let uid = d.uid;
        let item = `<div class="one-comment" id="${commentId}"><div>By <a href=\"#\" onClick=\"lookupUser('${uid}')\">${uid}</a> at ${ts.toLocaleTimeString()}</div><p><a href="#" onClick="deletePost('${k}');$('#${commentId}').hide()">Delete &times;</a>${txt}</p></div>`
        ht += item
    }
    return ht
}

function updatePosts(pageId) {
    Zb.listKeys(_zpAdminClient, COMMENTS_TABLE_ID, `comment/${pageId}/%`, function(res,err){
        if(err){
            console.log('err', err)
            _zpAdminHelpMessage = "Failed to list comments."
            updateHelp()
        } else {
        //    console.log('res com', res)
           Zb.get(_zpAdminClient, COMMENTS_TABLE_ID, res, function(res,err){
                if(err){
                    console.log('err', err)
                    _zpAdminHelpMessage = "Failed to lookup comments."
                    updateHelp()
                } else {
                    console.log('res get', res)
                    // _zpRenderComments(commentsSel, res, pageId, divId0, layout)
                    _zpAdminData = res
                    let ht = renderAdminView()
                    $('.zp-admin').html(ht)
                }
           })
        }
    })
}

function persistSessionData(pageId, handle) {
    let config = {pageId: pageId, handle: handle}
    if(sessionStorage) {
        sessionStorage.setItem("COMMENTSJS_ADMIN", JSON.stringify(config))
    }
}

function loadSessionData() {
    if(sessionStorage) {
        try {
            return JSON.parse(sessionStorage.getItem("COMMENTSJS_ADMIN"))
        } catch(e) {
            return null
        }
    }
    return undefined
}