const express = require('express');
const router = express.Router();
const store = require('../util/db')
const validate = require('../util/validate')
const passport = require('passport')
const crypto = require('crypto');
const get_login = require('../util/get_login')
const busboy = require('busboy');
const assert = require('node:assert/strict')

const presets = [ "default", "rainbow", "sunset" ];

/* GET home page. */
router.get('/', function(req, res, next) {
  login = get_login(req)
  if(login) {
    res.redirect(303, '/edit/u/' + login.username)
  } else {
    const nusers = store.getUserCount();
    res.render('index', { login, nusers });
  }
});

// #region auth
router.get('/edit/new', function(req, res, next) {
  // TODO: restrict usernames to non-stupid charactersets
  res.render('new-user-form', {login: get_login(req)});
});

router.post('/login/password', passport.authenticate('local', {
  successRedirect: '/',
}));

router.get('/login', function(req, res, next) {
  res.render('login', {
    login: get_login(req)
  });
});

router.post('/logout', function(req, res, next) {
  // TODO: restrict usernames to non-stupid charactersets
  console.log("Redirect to slash before logout:", req.user )
  req.logout(function(err) {
    console.error("login error:",err)
  });
  console.log("Redirect to slash:", req.user )
  res.redirect(303, '/')
});
// #endregion

// #region editing
// #region forms
/* edit user form */
router.get('/edit/u/:username', function(req, res, next) {
  if (!get_login(req)) {
    return next()
  }
  if (get_login(req).username != req.params.username) {
    return next()
  }
  console.log("username:",get_login(req).username)
  const user = store.getUser(req.params.username)
  const links = store.getUserLinks(req.params.username)
  res.render('edit-user-form', {
    username: req.params.username,
    title: store.getTitle(req.params.username),
    bio: store.getBio(req.params.username),
    links: links,
    login: get_login(req)
  });
});

/* edit appearance form */
router.get('/edit/u/:username/appearance', function(req, res, next) {
  const user = get_login(req);
  if (!user || user.username !== req.params.username) {
    return next()
  }
  const links = store.getUserLinks(user.username);
  res.render('edit-appearance-form', { presets, user, links });
});
// #endregion
// #region update-endpoints
router.post('/u/:username/links/:link_number', function(req, res, next) {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize : 1024 * 1024 * 25 }
  });

  req.files = {};

  bb.on('file', (name, file, info) => {
    if (!['siteicon'].includes(name)) {
      console.error(`link creation received extraneous file: ${name}`);
      return; // ignore file
    }
    let parts = [];
    file.on('data', (data) => {
      parts.push(Buffer.from(data));
    }).on('close', () => {
      const blob = Buffer.concat(parts);
      if (blob.length === 0) {
        // librewolf 146 uploads an empty file on no input
        return;
      }
      req.files[name] = {
        blob,
        blob_meta: info
      };
    });
  });

  bb.on('field', (name, val, info) => {
    req.body[name] = val
  });

  bb.on('close', () => {
    try {
      if("ok" != validate.validateUserUrl(req.body.link)) {
        return next(new Error("Could not validate"))
      }
      user = store.editUserLink(
        req.params.username,
        req.params.link_number,
        req.body.linkdesc,
        req.body.link,
        req.files['siteicon']?.blob,
        req.files['siteicon']?.blob_meta
      );
    } catch (err) {
      return next(err);
    }
    // 303 (See Other): send a GET to the new location
    res.redirect(303, '/edit/u/' + req.params.username)
    res.end();
  });

  req.pipe(bb);
});

router.post('/u/:username/links/:link_number/delete', function(req, res, next) {
  store.deleteUserLink(req.params.username, req.params.link_number)
  res.redirect(303, '/edit/u/' + req.params.username)
  res.end();
});

router.post('/u/:username/links', function(req, res, next) {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize : 1024 * 1024 }
  });

  req.files = {};

  bb.on('file', (name, file, info) => {
    if (!['siteicon'].includes(name)) {
      console.error(`link creation received extraneous file: ${name}`);
      return; // ignore file
    }
    let parts = [];
    file.on('data', (data) => {
      parts.push(Buffer.from(data));
    }).on('close', () => {
      const blob = Buffer.concat(parts);
      if (blob.length === 0) {
        // librewolf 146 uploads an empty file on no input
        return;
      }
      req.files[name] = {
        blob,
        blob_meta: info
      };
    });
  });

  bb.on('field', (name, val, info) => {
    req.body[name] = val
  });

  bb.on('close', () => {
    try {
      if("ok" != validate.validateUserUrl(req.body.link)) {
        return next(new Error("Could not validate"))
      }
      user = store.newUserLink(
        req.params.username,
        req.body.linkdesc,
        req.body.link,
        req.files['siteicon']?.blob,
        req.files['siteicon']?.blob_meta
      );
    } catch (err) {
      return next(err);
    }
    // 303 (See Other): send a GET to the new location
    res.redirect(303, '/edit/u/' + req.params.username)
    res.end();
  });

  req.pipe(bb);
});

/**
 * Create new user and log into it immediately
 * TODO: check that user does not exist already
 */

router.post('/u/', function(req, res, next) {
  const { username, password } = req.body;
  // TODO: review validation
  let user_validity = validate.validateNewUser(username)
  if ("ok" !== user_validity) {
    console.error("Invalid user '", username, "':", user_validity);
    return res.send(user_validity)
  }
  let password_validity = validate.validateNewPassword(password)
  if ("ok" !== password_validity) {
    console.error("Invalid password:", password_validity);
    return res.send(password_validity)
  }
  const salt = crypto.randomBytes(20).toString('hex');
  const password_hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
  try {
    store.newUser(username, password_hash, salt);
  } catch (error) {
    if (error.message != "User exists!") {
      throw error
    }
    console.error(error.message);
    return res.send("Could not create new user")
  }

  // Passport exposes a 'login' function for when a user signs up,
  // so we can log them in immediately
  req.login(store.getUser(username), function(err) {
    if (err) { return next(err); }
    return res.redirect(303, '/edit/u/' + req.user.username);
  });
});

router.post('/u/:username/appearance', function(req, res, next) {
  assert(req.params.username)
  const { preset } = req.body;
  assert(presets.includes(preset))

  store.setAppearancePreset(req.params.username, preset)
  
  res.redirect(303, '/edit/u/' + req.params.username + '/appearance')
  res.end();
});

/// fatform
router.post('/u/:username/profile', function(req, res, next) {
  assert(req.params.username)
  const bb_config = { headers: req.headers , limits: {fileSize : 1024 * 1024 }}
  const bb = busboy(bb_config);

  // TODO: create a new blob per file
  let blob = Buffer.from('', "binary")
  let blob_meta = null

  bb.on('file', (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    blob_meta = info;
    file.on('data', (data) => {
      blob = Buffer.concat([blob, Buffer.from(data)])
      console.log(`File [${name}] got ${data.length} bytes, blob is ${blob.length}`);
    }).on('close', () => {
      console.log(`File [${blob.length}] done`);
      console.log(blob.subarray(0,10))
    });
  });
  bb.on('field', (name, val, info) => {
    console.log(`Field [${name}]: value: %j`, val);
    req.body[name] = val
  });
  bb.on('close', () => {
    console.log('Done parsing form!');


    if(!blob.toString().length) {
      blob = null
    }

    // input validation: bio
    bio = req.body.bio
    bio = bio.replace(/(\r\n)+/g, '\n');

    try {
      user = store.newProfileForm(
        req.params.username,
        bio,
        req.body.title,
        blob
      )
    } catch {
      res.send("Could not update profile")
    }
    // 303 (See Other): send a GET to the new location
    res.redirect(303, '/edit/u/' + req.params.username)
    res.end();
  });
  req.pipe(bb);
});
// #endregion
// #endregion

// #region user
/* GET users listing. */
router.get('/u/', function(req, res, next) {
  // TODO: paginate this
  res.render('user-list', {
    usernames: store.getUserNames(),
    login: get_login(req)
  });
});

/* Display user page */
router.get('/u/:username', function(req, res, next) {
  const user = store.getUser(req.params.username);
  if(!user) {
    return next()
  }
  let title = store.getTitle(req.params.username)
  let bio = store.getBio(req.params.username)
  let userLinks = store.getUserLinks(req.params.username)
  let preset = user.preset
  userLinks.forEach((link) => {
    link.title = link.title ? link.title : link.url
  })
  console.log("title is", title)
  res.render('user', {
    username: req.params.username,
    preset,
    links: userLinks,
    login: get_login(req),
    hideNavbar: true,
    title: title,
    bio: bio
  });
});

// TODO: make URL consistent with link pfp
router.get('/media/:username/pfp', function(req, res, next) {
  if(!store.getUser(req.params.username)) {
    return next()
  }
  // TODO: better data access in store
  try {
    row = store.getUserPfp(req.params.username)
    res.set("Content-Type", "image/png");
    return res.status(200).end(row.pfp, 'binary');
  } catch {
    return res.redirect('/icons/user.png');
  }
});

// TODO: make URL consistent with user pfp
router.get('/u/:username/:linkid/pfp', function(req, res, next) {
  const userLinks = store.getUserLinks(req.params.username);
  let link = userLinks.find(link => link.id == req.params.linkid);

  if (!link) {
    return next();
  }
  console.log("link icon:", link.icon)
  if (!link.icon) {
    return res.redirect('/icons/link.svg');
  }
  // TODO: use link.icon_meta to set correct type
  res.set("Content-Type", "image/png");
  return res.status(200).end(link.icon, 'binary');
});
// #endregion

module.exports = router;
