var express = require('express');
var sqlite = require('sqlite');
var Promise = require('bluebird');
var async = require("async");
var await = require('await')
var fs = require('fs');
var child_process = require("child_process") //.exec;
var Cloudant = require('@cloudant/cloudant');

require('dotenv').load();

var multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // console.log("saving " + file.originalname)
    console.log("saving " + req.body.filename)
    cb(null, req.body.filename)
  }
  // onParseEnd:function(req, next){
  //   console.log("completed")
  // }
// }));
})
const upload = multer({
  storage: storage
  // ,
  // onFileUploadStart: function (file) {
  //  console.log('Upload starting for filename: ' + file.originalname);
  // }
})


// var upload = multer({dest: './uploads/'});

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Express' });
  //res.render('index.html');
  res.send(200)
});


const dbPromise = sqlite.open('../camera_data.db', { Promise });
dbPromise.then( (res) => {
  db = res
})

router.get('/sql', function(req, res, next) {
  // res.render('index', { title: 'Express' });
  try {
    // const [post, categories] = await Promise.all([
      // db.get('SELECT * FROM events WHERE id = ?', req.params.id),
    // const events = await(Promise.all([
    //   db.get('SELECT * FROM events')
    // ]))
    // Promise.all([
    //   db.get('SELECT * FROM events')
    // ])
    // db.get('SELECT * FROM events').then()
    db.all("select * from events").then( (events) => {
      console.log(events)
      res.send(events)
    })
    // res.render('post', { post, categories });
  } catch (err) {
    console.log(err)
    res.send(500)
    // next(err);
  }
});

router.get('/status', function(req, res, next) {
  res.send(200)
});

var initCloudant = function() {
  var username = process.env.cloudant_username || "nodejs";
  var password = process.env.cloudant_password;
  var cloudant = Cloudant({account:username, password:password});
  cloudant.db.create('imagedb', function(err, body) {
    console.log(err)
    console.log(body)
  })
  imagedb = cloudant.db.use('imagedb')

}

initCloudant()

// var uploadToCloudant = function(docID, options) {
//   imagedb.insert({
//     _id: 'event1234', // eventID = timestamp + '-' + location + '-' + channel
//     // originalImage: "image",
//     // processedImage: 'image1',
//     timestamp: "123456789",
//     cam_channel: "02",
//     location: "48",
//     classes: []
//   }, function(err, data) {
//     console.log('Error:', err);
//     console.log('Data:', data);
//     // callback(err, data);
//   })
// }

var createCloudantWithAttachments = function(docID, imagePath, eventProps) {
    console.log("creating cloudant doc")
    var i = imagePath.split('/')
    var imageName = i[i.length - 1]
    console.log("loading: " +  imagePath)
    //fs.readFile(imagePath, function(err, data) {
    fs.readFile("detected_images/output.jpg", function(err, data) {
            if (!err) {
                // imagedb.attachment.insert(docID, imageName, data, 'image/' + imageName.split('.')[1],
                console.log("inserting document")
                console.log(docID)
                console.log(imagePath)
                console.log(eventProps)
                console.log(data)
                console.log('image/' + imageName.split('.')[1])
                // console.log()
                imagedb.multipart.insert({props: eventProps},
                        [{
                            name: imageName,
                            data: data,
                            content_type: 'image/' + imageName.split('.')[1]
                        }], docID, function(err, body) {
                        if (!err) {
                          console.log(body);
                        } else {
                          console.log("error uploading attachment");
                          console.log(err)
                        }
                    })
          } else {
            console.log("error loading file")
          }
        })
}

// var uploadCloudantAttachment = function(docID, imagePath) {
//   var i = imagePath.split('/')
//   var imageName = i[i.length - 1]
//   fs.readFile(image, function(err, data) {
//     if (!err) {
//       imagedb.attachment.insert(docID, imageName, data, 'image/' + imageName.split('.')[1],
//         { rev: '12-150985a725ec88be471921a54ce91452' }, function(err, body) {
//           if (!err)
//             console.log(body);
//       });
//       // imagedb.attachment.insert('rabbit', 'rabbit.png', data, 'image/png',
//       //   { rev: '12-150985a725ec88be471921a54ce91452' }, function(err, body) {
//       //     if (!err)
//       //       console.log(body);
//       // });
//     }
//   });
// }

// router.post('/test_image', function(req, res, next) {
router.post('/test_image',
    upload.single('file'), function(req, res, next) {
    /*
    upload.fields ([
      {name: 'file', maxCount: 1},
      {name: 'foo', maxCount: 1}
    ]), function(req, res) {
    */
    // upload.any('file', 2), function(req, res) {
    // console.dir(req.files)
    // res.send(200)
    // console.log(req.body)
    // console.log(req.file)
    // console.log(req.files)
    // console.log(req)
    // TODO, this is hacky, but file upload hangs otherwise
    // console.log(req)
    if(req.file) {
      console.log(req.file)
      console.log(req.body)
      try {
        // var cmd = "/nodejsAction/cv/example_dnn_object_detection  -c=/nodejsAction/cv/yolov3.cfg -m=/nodejsAction/cv/yolov3.weights --scale=0.00392 --rgb -i=" + req.file.path + " --width=384 --height=384 --classes '/nodejsAction/cv/object_detection_classes_yolov3.txt'"
        var object_detection_path = "/Users/kkbankol@us.ibm.com/projects/opencv/samples/dnn/object_detection"
        var config_path = "/Users/kkbankol@us.ibm.com/projects/darknet/cfg/yolov3.cfg"
        var weights_path = "/Users/kkbankol@us.ibm.com/projects/darknet/yolov3.weights"
        var imagePath = "/Users/kkbankol@us.ibm.com/projects/smart-city-cameras/cameras_app/uploads/" + req.body.filename
        var classes_path = "/Users/kkbankol@us.ibm.com/projects/opencv/samples/data/dnn/object_detection_classes_yolov3.txt"
        var misc_opts = "--width=384 --height=384 --scale=0.00392 --rgb"
        var cmd = [object_detection_path, " -c=" + config_path, " -m=" + weights_path, " -i=" + imagePath, misc_opts, " --classes '" + classes_path + "'"]
        // var cmd = "/Users/kkbankol@us.ibm.com/projects/opencv/samples/dnn/object_detection -c=/Users/kkbankol@us.ibm.com/projects/darknet/cfg/yolov3.cfg -m=/Users/kkbankol@us.ibm.com/projects/darknet/yolov3.weights --scale=0.00392 --rgb -i=/Users/kkbankol@us.ibm.com/projects/smart-city-cameras/cameras_app/uploads/file --width=384 --height=384 --classes '/Users/kkbankol@us.ibm.com/projects/opencv/samples/data/dnn/object_detection_classes_yolov3.txt'"
        // console.log(req.file.path)
        //child_process.execSync(cmd)
        //var callFunc = exec(cmd, function (error, stdout, stderr) {
            //console.log(stdout)
            //result = stdout;
            //return {payload: result};
            //return stdout
        //});
        // console.log(callFunc)
        console.log(cmd.join(" "))
        var extractClasses = child_process.execSync(cmd.join(" ")).toString()
        createCloudantWithAttachments(
          req.body.time + '-' + req.body.channel + '-' + req.body.location,
          imagePath,
          {
            meta: req.body,
            obj: JSON.parse(extractClasses)
          }
        )
        res.send({payload: extractClasses})
        // next()
      } catch (err) {
        console.log(err)
        res.send(500)
        // next(err);
      }
      // res.send(200)
    }
  // res.send(200)
  // console.log(req)
  // console.log(Object.keys(req))
  // res.send(console.dir(req.files));  // DEBUG: display available fields
})

router.post('/image', function(req, res, next) {
  // res.render('index', { title: 'Express' });


  // if (headers['Content-Type']) == "image" ??? {
  //   write to
  // }
  // if request type includes rtsp url / cam {
  //   connect to rtsp
  //   take screenshot
  //   write to file
  //   run example dnn_object
  // }

  try {
    var cmd = "/nodejsAction/cv/example_dnn_object_detection  -c=/nodejsAction/cv/yolov3.cfg -m=/nodejsAction/cv/yolov3.weights --scale=0.00392 --rgb -i=/nodejsAction/cv/cam_9_2018-10-09-14_48_00.jpg --width=384 --height=384 --classes '/nodejsAction/cv/object_detection_classes_yolov3.txt'"
    //child_process.execSync(cmd)
    //var callFunc = exec(cmd, function (error, stdout, stderr) {
        //console.log(stdout)
        //result = stdout;
        //return {payload: result};
        //return stdout
    //});
    var callFunc = child_process.execSync(cmd).toString()
    res.send({payload: callFunc})
  } catch (err) {
    console.log(err)
    res.send(500)
    // next(err);
  }

});




// router.get('/query', function(req, res, next) {
//
// });


module.exports = router;
