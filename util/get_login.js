let store = require('./db')
function get_login(req) {
  if (store.getUser(req.user?.username))
    return req.user;

  // reset session to prevent browsers using stale sessions
  req.logout(err => {
    if (err) {
      console.error("error while logging out", err, req.user);
    }
  });
  return undefined
}

module.exports = get_login