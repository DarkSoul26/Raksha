//jshint esversion:6

// REQUIRING DIFFERENT NODE MODULES
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const ejs = require("ejs");
const mongoose = require('mongoose');
const GoogleStrategy= require('passport-google-oauth20').Strategy;
const findOrCreate= require('mongoose-findorcreate');
const multer = require('multer');
const app = express();

app.use(express.static("public"));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({

  extended: true

}));

//app.use session..
app.use(session({
secret: "Our little secret.",
resave:false,
saveUninitialized: false
}));

//use passport package dealing with session
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.ATLAS,{useNewUrlParser: true, useUnifiedTopology: true});

mongoose.set("useCreateIndex", true);

// CREATION OF SCHEMA FOR USERS
const userSchema= new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  money: Number

});

// CREATION OF SCHEMA FOR VICTIMS 
const victimSchema= new mongoose.Schema({
  saviersName: String,
  location: {
    type: String,
    required: true,
  },
  category: String,
  desc: {
    type: String,
    required: true,
  },
  img: {
    type: String,
    default: 'placeholder.jpg',
  },
});


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User',userSchema);

const Victim = new mongoose.model('Victim',victimSchema);


// USING PASSPORT MODULE
passport.use(User.createStrategy());

passport.serializeUser(function(user, done){
  done(null,user.id);
});

passport.deserializeUser(function(id, done){
  User.findById(id, function(err,user){
    done(err,user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/donate",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb){
  console.log(profile);
  
  User.findOrCreate({googleId: profile.id}, function(err,user){
return cb(err,user);
  });
}
));

// FOR IMAGES TO BE STORED ON THE BACKEND
//Define storage space for the image
const storage=multer.diskStorage({

  //destination for the files
  destination:function(req,file,callback){
    callback(null, "./public/uploads/images");
  },

  //add back the extension
  filename:function(req,file,callback){
    callback(null, Date.now()+ file.originalname);
  },
});

//Upload parameters for multer
const upload=multer({
  storage:storage,
  limits:{
    fieldSize:1024*1024*3
  }
});

//data from victims database
app.get('/helpWorld', (req, res) => {
    Victim.find({}, function(err, victims) {
        res.render('helpWorld', {
            viclist: victims
        })
    })
})

// DONATE ROUTE
app.get("/donate", function(req,res){
  User.find({"money":  {$ne: null}}, function(err, foundUser){
    if(err){
      console.log(err);
    }
    else{
      if(foundUser){
        res.render("donate");
      }
    }
  });
});

// HOME ROUTE
app.get("/", function(req, res){
  res.render("home");
});

// ABOUT ROUTE
app.get("/about", function(req, res){
  res.render("about");
});
app.get("/locate",function(req,res){
  if(req.isAuthenticated()){
  res.render("locate");
}
else{
  res.redirect("/login");
}
})
// GOOGLE AUTHENTICATION
app.get("/auth/google",
passport.authenticate("google", {scope: ["profile"]})
);

// DONATION USING DONATE ROUTE
app.get("/auth/google/donate",
passport.authenticate('google', { failureRedirect: '/login'}),
  function(req,res){
    //successful authentication
    res.redirect('/homeAuth');
  }
);


//login route
app.get("/login", function(req, res){

  res.render("login");

});

//register route
app.get("/register", function(req, res){

  res.render("register");

});

//logout 
app.get("/logout", function(req,res){
  //deauthenticate user

  req.logout();
  res.redirect("/");

});

//contact the developers
app.get("/contact",function(req,res){
  res.render("contact");
});

//submit the donate form
app.get("/submit",function(req,res){
if(req.isAuthenticated()){
  res.render("submit");
}
else{
  res.redirect("/login");
}
});


app.post("/submit", function(req,res){

  const submittedMoney = req.body.money;

  //serach a particular user
  User.findById(req.user.id, function(err, foundUser){
    if(err){
      console.log(err);
    }
    else{
      if(foundUser){

        foundUser.money = submittedMoney;
        foundUser.save(function(){
          res.redirect("/donate");
        })
      }
    }
  });

});


app.post("/register",function(req,res){

User.register({username: req.body.username}, req.body.password, function(err,user){
  if(err){
    console.log(err);
    res.redirect("/register");
  }

  else{
    passport.authenticate("local")(req,res,function(){
      res.redirect("/homeAuth");
    });
  }
});

});

app.post("/login",function(req,res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  //login method comes from passport
  req.login(user, function(err){
  if(err) {
    res.redirect("/login");
    console.log(err);
  }
  else{
    passport.authenticate("local")(req, res, function(){
  //hold on the cookie . tells server tht user is autherized\
  res.redirect("/homeAuth");
    });
  }
  })
});


app.post("/locate",upload.single('image'),function(req,res){
  
  const victim = new Victim({
    saviersName: req.body.sName,
    location: req.body.postTitle,
    desc: req.body.postBody,
    category: req.body.ageCategory,
    img: req.file.filename,
  });

  victim.save(function(err){
      if(err){
      res.redirect("/next");
      console.log(err);
      }
      else{
        res.redirect('/helpWorld');
    }
  });
  
  
})

app.get("/homeAuth",function(req,res){
    res.render("homeAuth");
});



//listening on port by heroku or on port 3000 locally
let port = process.env.PORT;
if (port == null || port == "") {
  port = 5000;
}

app.listen(port,function(){
    console.log("server started running successfully");
});