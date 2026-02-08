validateUserUrl = (url) => {
    let _url
    try {
        _url = new URL(url)
    } catch {
        return "not a url"
    }
    if(["https:", "http:", "magnet:", "gemini:"].includes(_url.protocol)) {
        return "ok"
    } else {
        return "bad protocol"
    }
};

validateNewUser = (user) => {
    if (user.length > 20 || user.length < 3) {
        return "bad username length"
    }
    if(!user.match(/^[0-9a-z]+$/)) { // https://stackoverflow.com/questions/4434076/best-way-to-alphanumeric-check-in-javascript
        return "bad characters"
    }
    return "ok"
};

validateNewPassword = (password) => {
    if (password.length > 50 || password.length < 3) {
        return "bad password length"
    }
    return "ok"
};

module.exports =  { validateUserUrl, validateNewUser, validateNewPassword }