var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var saml2 = require('saml2-js')

var app = express();


// *** SAML2 Setup ***

var fs = require('fs');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));

// Create identity provider
var idpMetadata = {
  sso_login_url: "https://samltest.id/idp/profile/SAML2/Redirect/SSO",
  sso_logout_url: "https://samltest.id/idp/profile/SAML2/Redirect/SLO",
  certificates: [fs.readFileSync("idp.pem").toString(), fs.readFileSync("idp.pem").toString()]
};

var spMetadata = {
  entity_id: "nodejs:saml2:test1",
  private_key: fs.readFileSync("private.pem").toString(),
  certificate: fs.readFileSync("public.pem").toString(),
  assert_endpoint: "localhost:3000/assert",
  force_authn: true,
  //auth_context: { comparison: "exact", class_refs: ["urn:oasis:names:tc:SAML:1.0:am:password"] },
  nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
  sign_get_request: false,
  allow_unencrypted_assertion: true
}

var idp = new saml2.IdentityProvider(idpMetadata);
var sp = new saml2.ServiceProvider(spMetadata);

// Endpoint to retrieve metadata
app.get("/metadata.xml", function(req, res) {
  res.type('application/xml');
  res.send(sp.create_metadata());
});
 
// Starting point for login
app.get("/login", function(req, res) {
  sp.create_login_request_url(idp, {}, function(err, login_url, request_id) {
    if (err != null)
      return res.send(500);
    res.redirect(login_url);
  });
});
 
// Assert endpoint for when login completes
app.post("/assert", function(req, res) {
  var options = {request_body: req.body};
  sp.post_assert(idp, options, function(err, saml_response) {
    if (err != null)
      return res.send(500);
 
    // Save name_id and session_index for logout
    // Note:  In practice these should be saved in the user session, not globally.
    name_id = saml_response.user.name_id;
    session_index = saml_response.user.session_index;
 
    res.send("Hello #{saml_response.user.name_id}!");
  });
});
 
// Starting point for logout
app.get("/logout", function(req, res) {
  var options = {
    name_id: name_id,
    session_index: session_index
  };
 
  sp.create_logout_request_url(idp, options, function(err, logout_url) {
    if (err != null)
      return res.send(500);
    res.redirect(logout_url);
  });
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
