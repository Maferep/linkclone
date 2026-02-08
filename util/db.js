const Database = require('better-sqlite3');
const busboy = require('busboy');
const crypto = require('crypto');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict')
const db = new Database('main.db', { verbose: null });
function fun() {
  try {
    let stmt = db.prepare(`CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      hashed_password TEXT NOT NULL,
      salt TEXT NOT NULL,
      preset TEXT
    );`)
    stmt.run()
  } catch {
    return
  }

  let stmt = db.prepare(`CREATE TABLE pfps (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    pfp BLOB NOT NULL,
    pfp_meta TEXT NOT NULL
  );`)
  stmt.run()

  //user page title
  stmt = db.prepare(`CREATE TABLE titles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );`)
  stmt.run()

  //user page bio
  stmt = db.prepare(`CREATE TABLE bios (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE,
    bio TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );`)
  stmt.run()
  
  stmt = db.prepare(`CREATE TABLE links (
    id INTEGER PRIMARY KEY,
    title TEXT,
    url TEXT NOT NULL,
    user_id INTEGER,
    icon BLOB,
    icon_meta TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );`)
  stmt.run()
  stmt = db.prepare(`INSERT INTO users(username, hashed_password, salt) VALUES (?, ?, ?)`)
  hashed = crypto.pbkdf2Sync('paddwodd', "some very s3cr3t s^lt", 310000, 32, 'sha256')
  stmt.run('linkadmin', hashed, "some very s3cr3t s^lt")
}
fun()

const sqlGetUser = db.prepare('SELECT * FROM users WHERE username=?;');
const sqlGetUserId = db.prepare('SELECT id FROM users WHERE username=?;');
const sqlGetUserNames = db.prepare(`SELECT (username) FROM users WHERE username<>'linkadmin';`);
const sqlCountUsers = db.prepare(`SELECT COUNT(*) FROM users WHERE username<>'linkadmin';`);
const sqlNewUser = db.prepare('INSERT INTO users(username, hashed_password, salt) VALUES (?, ?, ?);');

const sqlGetUserLinks = db.prepare('SELECT * FROM links WHERE user_id=?;');
const sqlNewUserLink = db.prepare('INSERT INTO links(title, url, user_id, icon, icon_meta) VALUES (:title,:url,:userid,:icon,:iconmeta) '
  + 'ON CONFLICT DO UPDATE SET title=:title,url=:url,user_id=:userid,icon=:icon,icon_meta=:iconmeta');
const sqlEditUserLink = db.prepare('UPDATE links SET title=:title, url=:url, user_id=:userid, icon=:icon, icon_meta=:iconmeta WHERE id=:id'); // TODO: uses url as id, is wrong and bad
const sqlEditUserLinkNoIcon = db.prepare('UPDATE links SET title=:title, url=:url, user_id=:userid WHERE id=:id'); // NOTE: old icon if exists, is not changed

const sqlDeleteUserLink = db.prepare('DELETE FROM links WHERE id=:id'); // TODO: uses url as id, is wrong and bad

const sqlNewPfp = db.prepare('INSERT INTO pfps(user_id, pfp, pfp_meta) VALUES (:userid, :pfp, :pfp_meta) ON CONFLICT DO UPDATE SET ' +
  'user_id=:userid,' +
  'pfp=excluded.pfp,' +
  'pfp_meta=excluded.pfp_meta;');
const sqlGetUserPfp = db.prepare('SELECT pfp, pfp_meta FROM pfps WHERE pfps.user_id=?;');

const sqlNewTitle = db.prepare('INSERT INTO titles(user_id, title) VALUES (:userid, :title) ON CONFLICT DO UPDATE SET user_id=:userid, title=:title;');
const sqlGetTitle = db.prepare('SELECT * FROM titles WHERE titles.user_id=?;');

const sqlNewBio =  db.prepare('INSERT INTO bios(user_id, bio) VALUES (:userid, :bio) ON CONFLICT DO UPDATE SET user_id=:userid, bio=:bio;');
const sqlGetBio = db.prepare('SELECT * FROM bios WHERE bios.user_id=?;');

const sqlSetAppearancePreset = db.prepare('UPDATE users SET preset=:preset WHERE id=:userid')

let store = {
  /** @type {Object.<string, User>} */
  // XXX: beware this interface! returns arbitrarily many entries
  getUserNames() {
    let users = sqlGetUserNames.all().map(struct => struct.username)
    return users
  },
  getUserCount() {
    return sqlCountUsers.get()['COUNT(*)']
  },
  /** @param {str} username
   * @returns { undefined | {
   *   id: number,
   *   username: str,
   *   hashed_password: str,
   *   salt: str,
   *   preset: undefined | str
   * }}
   */
  getUser(username) {
    const user = sqlGetUser.get(username);
    return user;
  },
  // NOTE: beware this interface! returns arbitrarily many entries
  /** @param {str} username
   * @returns {[{
   *   id: number,
   *   title: str,
   *   url: str,
   *   user_id: number,
   *   icon: undefined | Buffer<ArrayBuffer>,
   *   icon_meta: str,
   * }]}
   */
  getUserLinks(username) {
    const id = sqlGetUserId.get(username)?.id;
    const links = sqlGetUserLinks.all(id);
    return links;
  },
  /** @param {str} username
   * @param {str} hashed_password
   * @param {str} salt
   * @throws {Error}
   */
  newUser(username, hashed_password, salt) {
    // TODO: doesn't INSERT fail if the row exists already?
    if(this.getUser(username)) {
      throw new Error("User exists!")
    }
    sqlNewUser.run(username, hashed_password, salt);
  },
  /** @param {str} username
   * @param {Buffer<ArrayBuffer>} blob
   * @param {busboy.FileInfo} blob_meta
   */
  newUserPfp(username, blob, blob_meta) {
    if(!blob) {
      console.log("Null pfp received, skipping...")
      return
    }
    assert(username)
    const id = sqlGetUserId.get(username)?.id;
    assert(id)
    const string =  JSON.stringify(blob_meta)?.toString();
    const result = sqlNewPfp.run({
      userid: id, pfp: blob, pfp_meta: string
    });
  },
  /** @param {str} username
   * @returns { undefined | {
   *   id: number,
   *   user_id: number,
   *   pfp: Buffer<ArrayBuffer>,
   *   pfp_meta: busboy.FileInfo
   * }}
   */
  getUserPfp(username) {
    const id = sqlGetUserId.get(username)?.id;
    const pfp = sqlGetUserPfp.get(id);
    // XXX: pfp_meta is returned as string here; JSON.parse() it
    return pfp;
  },
  /** @param { str } username
   * @param { str } linkdesc
   * @param { str } link
   * @param { undefined | Buffer<ArrayBuffer> } icon
   * @param { undefined | busboy.FileInfo } icon_meta
   */
  newUserLink(username, linkdesc, link, icon, icon_meta) {
    if (!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    // TODO transaction
    let links = this.getUserLinks(username);
    // TODO parameterize max links
    console.log("Number of links:", links.length)
    if (links.length >= 50) {
      throw new Error("You may have at most 50 links.")
    }
    const id = sqlGetUserId.get(username)?.id;
    params = {
      title: linkdesc,
      url: link, 
      userid: id, 
      icon,
      iconmeta: icon_meta ? JSON.stringify(icon_meta) : null
    }
    const info = sqlNewUserLink.run(params);
  },
  /** 
   * @param { str } username
   * @param { str } link_number
   * @param { str } linkdesc
   * @param { str } link
   * @param { undefined | Buffer<ArrayBuffer> } icon
   * @param { undefined | busboy.FileInfo } icon_meta
   */
  editUserLink(username, link_number, linkdesc, link, icon, icon_meta) {
    if (!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    const userid = sqlGetUserId.get(username)?.id;

    if (icon) {
      params = {
        id: link_number,
        title: linkdesc,
        url: link, 
        userid: userid, 
        icon,
        iconmeta: icon_meta ? JSON.stringify(icon_meta) : null
      }
      sqlEditUserLink.run(params);
    } else {
      params = {
        id: link_number,
        title: linkdesc,
        url: link, 
        userid: userid
      }
      sqlEditUserLinkNoIcon.run(params)
    }
  },
  /** 
   * @param { str } username
   * @param { str } link_number
   */
  deleteUserLink(username, link_number) {
    if (!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    const userid = sqlGetUserId.get(username)?.id;
    params = {
      id: link_number,
      userid: userid, 
    }
    const info = sqlDeleteUserLink.run(params);
  },
  /** @param { str } username
   * @param { str } title
   */
  newTitle(username, title) {
    if(!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    if (!title || !title.length) {
      title = ''
    }
    const id = sqlGetUserId.get(username)?.id;
    sqlNewTitle.run({
      userid: id,
      title
    })
  },
  /** @param { str } username
   * @returns { str | undefined }
   */
  getTitle(username) {
    const id = sqlGetUserId.get(username)?.id;

    const title = sqlGetTitle.get(id)?.title;
    return title;
  },
  /** @param { str } username
   * @param { str } bio
   */
  newBio(username, bio) {
    if(!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    if (!bio || !bio.length) {
      bio = '' // this overwrites existing bio and allows clearing bio
    }
    const id = sqlGetUserId.get(username)?.id;
    sqlNewBio.run({
      "userid": id,
      "bio": bio
    })
  },
  /** @param { str } username
   * @returns { str | undefined }
   */
  getBio(username) {
    const id = sqlGetUserId.get(username)?.id;
    const _bio = sqlGetBio.get(id)?.bio;
    return _bio;
  },
  newProfileForm(username, bio, title, blob) {
    // TODO: shitty multi query
    this.newBio(username, bio)
    this.newTitle(username, title)
    this.newUserPfp(username, blob, "placeholder")
  },
  setAppearancePreset(username, preset) {
    if(!this.getUser(username)) {
      throw new Error("no such user", { username });
    }
    const id = sqlGetUserId.get(username)?.id;
    sqlSetAppearancePreset.run({
      "userid": id,
      "preset": preset
    })
  }
}

module.exports = store