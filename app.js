// Node Modules
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const { pool } = require("./dbCon");
const bcrypt = require("bcrypt");
const path = require('path');

const app = express();
const port = 3000;

// Static File
// User Static File (Build in middleware)
app.use(express.static("public"));


const multer = require('multer')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/products')
  },
  filename: function (req, file, cb) {
    console.log(file)
    cb(null, `item_image-${Date.now()}` + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  if(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg'){
    cb(null, true)
  }else{
    cb(null, false)
  }
}
const upload = multer({ storage: storage, fileFilter:fileFilter })


const initializePassport = require("./passportCon");

initializePassport(passport);

// user express-ejs=layouts
const expressLayouts = require("express-ejs-layouts");
app.use(expressLayouts);
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());


app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(flash());

// Index (Home) Page
app.get("/", checkAuthenticated, (req, res) => {
  res.render("loginPage", {
    title: "Login Page",
    layout: "layouts/login-layout",
  });
});

// User Session
app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
    layout: "layouts/main-layout",
    username: req.user.username,
    userRole: req.user.role,
  });
});

// Page Item List
app.get("/users/item-list", checkNotAuthenticated, (req, res) => {
  const sql = `SELECT * FROM items ORDER BY id`;
  pool.query(sql, [], (err, results) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("item-list", {
      title: "Item List",
      layout: "layouts/main-layout",
      msg: req.flash("msg"),
      model: results.rows,
    });
  });
});

// Add Item Page
app.get("/users/item-list/add", checkNotAuthenticated, (req, res) => {
  res.render("add-item", {
    title: "Add Product",
    layout: "layouts/main-layout",
  });
});

// Page Item Detail
app.get("/users/item-list/:item_name", checkNotAuthenticated, (req, res) => {
  const sql = `SELECT * FROM items where item_name = '${req.params.item_name}'`;
  pool.query(sql, (err, results) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("item-detail", {
      title: "Item Detail",
      layout: "layouts/main-layout",
      model: results.rows[0],
      msg: req.flash("msg"),
    });
  });
});

// User list page
app.get("/users/user-list", checkNotAuthenticated, (req, res) => {
  const sql = `SELECT * FROM users ORDER BY username`;
  pool.query(sql, [], (err, results) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("user-list", {
      title: "User List",
      layout: "layouts/main-layout",
      msg: req.flash("msg"),
      model: results.rows,
    });
  });
});


// Page User Detail
app.get("/users/user-list/:username", checkNotAuthenticated, (req, res) => {
  const sql = `SELECT * FROM users where username = '${req.params.username}'`;
  pool.query(sql, (err, results) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("user-detail", {
      title: "User Detail",
      layout: "layouts/main-layout",
      model: results.rows[0],
    });
  });
});


// Add User
app.get("/users/addUser", checkNotAuthenticated, (req, res) => {
  res.render("addUser", {
    title: "Add User",
    layout: "layouts/main-layout",
  });
});

app.get("/users/logout", checkNotAuthenticated, (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.flash("success", "User logged out");
    res.redirect("/");
  });
});

app.post(
  "/users/login",
  passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/",
    failureFlash: true,
    successFlash: true,
  })
);

app.post("/users/addUser", checkNotAuthenticated, async (req, res) => {
  const { username, password, role, password2 } = req.body;

  console.log({
    username,
    password,
    role,
  });

  const errors = [];

  if (password.length < 6) {
    errors.push({ message: "Password must be at least 6 characters" });
  }
  if (password !== password2) {
    errors.push({ message: "Password does not match" });
  }
  if (role === undefined) {
    errors.push({ message: "Please select a role" });
  }

  if (errors.length > 0) {
    res.render("addUser", {
      errors,
      layout: "layouts/main-layout",
      title: "Add User",
      params: req.body,
      model: results.rows,
    });
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: "Username already exits" });
          res.render("AddUser", {
            errors,
            layout: "layouts/main-layout",
            title: "Add User",
            params: req.body,
          });
        } else {
          const name = username.toLowerCase();
          pool.query(
            `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, password`,
            [name, hashedPassword, role],
            (err, result) => {
              if (err) {
              }
              console.log(result.rows);
              req.flash("success", "Successfully created a new user");
              res.redirect("/users/dashboard");
            }
          );
        }
      }
    );
  }
});

app.post("/users/item-list/add", checkNotAuthenticated, upload.array('img', 1), async (req, res) => {
  const { item_name, category, price, quantity,} = req.body;
  const img  = req.files[0].filename
  console.log({
    item_name,
    category,
    price,
    quantity,
    img
  });

  const errors = [];

  

  
  if (img === undefined) {
    errors.push({ message: "Please insert an image" });
  }
  if (category === undefined) {
    errors.push({ message: "Please select a category" });
  }

  if (quantity < 0 || quantity === "") {
    errors.push({ message: "Invalid amount of quantity" });
  }

  if (price < 0 || quantity === "") {
    errors.push({ message: "Invalid amount of price" });
  }

  if (errors.length > 0) {
    res.render("add-item", {
      errors,
      layout: "layouts/main-layout",
      title: "Add Item",
      params: req.body,
    });
  } else {
    pool.query(
      `SELECT * FROM items WHERE item_name = $1`,
      [item_name.toLowerCase()],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: "Product name already exists" });
          res.render("add-item", {
            errors, 
            layout: "layouts/main-layout",
            title: "Add Item",
            params: req.body,
          });
        } else {
          const product = item_name.toLowerCase();
          pool.query(
            "INSERT INTO items (item_name, category, price, quantity, item_image) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [product, category, price, quantity, img],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success", "Successfully create a product");
              res.redirect("/users/item-list");
            }
          );
        }
      }
    );
  }
});


// Delete Product 
app.get("/users/item-list/delete/:item_name", checkNotAuthenticated, (req, res) => {
  const name = req.params.item_name;
  const check = `SELECT item_name FROM items WHERE item_name = '${name}'`;
  const sql = `DELETE FROM items WHERE item_name = '${name}'`;
  console.log(check)

  pool.query(sql, (err, result) => {
    function capitalizeTheFirstLetterOfEachWord(words) {
      var separateWord = words.toLowerCase().split(' '); 
        for (var i = 0; i < separateWord.length; i++) { 
          separateWord[i] = separateWord[i].charAt(0).toUpperCase() + separateWord[i].substring(1);
        } 
       return separateWord.join(' ');
    }   

    if (err) {
      res.send(err.message);
    }
    if (!name) {
      res.status(404).send("<h1>404</h1>");
    }
    if (name !== sql) {

      req.flash("msg", `Product ${capitalizeTheFirstLetterOfEachWord(req.params.item_name)} has been deleted`);
      res.redirect("/users/item-list");
      
    } else if (req.params.name === sql) {
      res.render("item-list", {
        title: "Item List",
        layout: "layouts/main-layout",
        model: result.rows[0],
      });
    }
  });
});




app.use("/", (req, res) => {
  res.status(404);
  res.send("404 Not Found");
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/users/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
