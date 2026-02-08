# Linkclone
Linkclone is a minimalist, responsive link-in-bio web application on the lines of linktr.ee and carrd, with basic features like user-uploaded icons, preset-based customization and a login system designed for mobile and desktop use.

This software is in alpha and meant as a proof of concept. For a more mature implementation, check out [linksta.cc](https://linksta.cc/).

# Run application
- 'npm install' to install dependencies
- 'npm run start' to launch on port 3000
- `bin/www` `var port = normalizePort(process.env.PORT || '3000');`

# Technology
Node.js/Express on the backend. EJS template engine, plain JS frontend. SQLite database using better-sqlite3.

# To Do
- icons exactly as linktree
- jpeg **XL**
- crop pfp
- some way to change link order
- compress images in frontend
- delete links
- clean up redundant tables
- add jsdocs/intellisense to store interface (better-sqlite3 plugin?)
- invite code
- report button
- change text size

## UI / UX
- animations

## Security
- rate limiting
