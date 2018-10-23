var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// var multer = require('multer');
// var upload = multer({dest: './routes/uploads/'});


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');
app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');
app.set('view engine', 'html');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, './public')));
app.use(express.static(path.join(__dirname, '../images')));
// app.use(express.bodyParser());

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


// app.get('/post/:id', async (req, res, next) => {
// app.get('/sql', async (req, res, next) => {
//   try {
//     const db = await dbPromise;
//     const [post, categories] = await Promise.all([
//       db.get('SELECT * FROM Post WHERE id = ?', req.params.id),
//       db.all('SELECT * FROM Category')
//     ]);
//     // res.render('post', { post, categories });
//   } catch (err) {
//     next(err);
//   }
// });


// app.post('/test_image', upload.single('image'), function(request, respond) {
//   // console.dir(req.files)
//   // res.send(200)
//   // console.log(req.body)
//   if(request.file) console.log(request.file);
//   // console.log(req)
//   // console.log(Object.keys(req))
//   // res.send(console.dir(req.files));  // DEBUG: display available fields
// })


module.exports = app;
