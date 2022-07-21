const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbCon");
const bcrypt = require("bcrypt");

function initialize(passport) {
  const authenticateUser = (username, password, done) => {
    pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          const user = results.rows[0];

          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              throw err;
            }
            if (isMatch) {
              return done(null, user, { message: `Success Login as ${user.username}`});
            } else {
              return done(null, false, { message: "Password is incorrect" });
            }
          });
        } else {
          return done(null, false, { message: "Username is not registered" });
        }
      }
    );
  };

  passport.use(
    new LocalStrategy({
      usernameField: "username",
      passwordField: "password",
    },
    authenticateUser
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser((id, done) => {
    pool.query(`SELECT * FROM users WHERE id = $1`, [id], (err,results) => {
      if (err) {
        throw error;
      }
      return done(null, results.rows[0]);
    });
  });
}

module.exports = initialize;
