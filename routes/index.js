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
  res.render('index.html');
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
  var username = process.env.CLOUDANT_USERNAME || "nodejs";
  var password = process.env.CLOUDANT_PASSWORD;
  var cloudant = Cloudant({account:username, password:password});
  // cloudant.db.create('imagedb', function(err, body) {
  //   console.log(err)
  //   console.log(body)
  // })
  console.log("Initializing Cloudant DB")
  imagedb = cloudant.db.use(process.env.CLOUDANT_DB, function(err, body) {
    console.log(body)
    if (err) {
      console.log(err)
      console.log("Creating Cloudant Table")
      cloudant.db.create(process.env.CLOUDANT_DB, function(err, body) {

        console.log(body)
        if (err) {
          console.log(err)
        }
        else {
          console.log("Created Cloudant DB table")
        }
      })
    } else {
      console.log("Cloudant DB initialized")
    }
  })

}


initCloudant()

router.get('/initcloudant', function(req, res, next) {
  res.send(200)
  initCloudant()
});




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
                imagedb.multipart.insert(eventProps,
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

var parseClasses = function(original) {
  var classes_edited = {}
  original['classes'].map(function(key, idx){
    var cls = key['class']
    if (classes_edited[cls]) {
      console.log("class key exists, appending")
      classes_edited[cls]["data"].push(key)
      classes_edited[cls]["count"] += 1
      // if (idx == len(original['classes'])) {
      //   return classes_edited
      // }
    } else {
      console.log("creating new class key")
      classes_edited[cls] = {
        data: [key],
        count: 1
    }
      // if (idx == len(original['classes'])) {
      //   return classes_edited
      // }

      // classes_edited[cls]["data"] = [key]
      // classes_edited[cls]["count"] = 1
    }
    // return classes_edited
    console.log("key", key['class'])
    console.log("value", idx)
  })
  return classes_edited
}

// Pull all captured records from Cloudant
router.get('/query/all', function(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  imagedb.list({include_docs:true}, function (err, data) {
    console.log(err, data)
    // result = data
    res.json(data)
  })
})

// query by
router.get('/query/and', function(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  // req should contain
  imagedb.list({include_docs:true}, function (err, data) {
    console.log(err, data)
    // result = data
    res.json(data)
  })
})

var queryCloudant = function () {
  var selector = {
    "selector": {
      "$and": [
          { classes : {car: {"$exists": true}}},
          { time : {"$gt":'20181029182423'}}
      ]
    }
  }
  // imagedb.find({selector: { classes : {car: {"$exists": true}}}}, function(er, result) {
  imagedb.find(selector, function(er, result) {
    if (er) {
      throw er;
    }
    console.log('Found %d matching documents', result.docs.length);
    for (var i = 0; i < result.docs.length; i++) {
      console.log('  Doc id: %s', result.docs[i]._id);
    }
  })
}

router.get('/query/all', function(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  imagedb.list({include_docs:true}, function (err, data) {
    console.log(err, data)
    // result = data
    res.json(data)
  })
})


// router.post('/test_image', function(req, res, next) {
router.post('/image/upload',
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
    if (req.file) {
      console.log(req.file)
      console.log(req.body)
      try {
        // var cmd = "/nodejsAction/cv/"example_dnn_object_detection"  -c=/nodejsAction/cv/yolov3.cfg -m=/nodejsAction/cv/yolov3.weights --scale=0.00392 --rgb -i= --width=384 --height=384 --classes '/nodejsAction/cv/object_detection_classes_yolov3.txt'"
        // var cmd = '/root/opencv-4.0.0-beta/samples/dnn/dnn/example_dnn_object_detection -c=/tmp/yolov3.cfg -m=/tmp/yolov3.weights --scale=0.00392 --rgb -i=/tmp/cam_9_2018-10-09-14_48_00.jpg --width=384 --height=384 --classes ""'
        // var path = "/Users/kkbankol@us.ibm.com/projects/"

        // TODO, add a switch flag for running node locally vs in container
        // var path = "/opt/cameras_app/"
        var path = "/nodejsAction/cv/"
        // var modelArtifacts = "/nodejsAction/cv/"
        // var object_detection_path = "/Users/kkbankol@us.ibm.com/projects/opencv/samples/dnn/object_detection"
        var objectDetectionBin = path + "example_dnn_object_detection"

        // var modelConfigPath = "/Users/kkbankol@us.ibm.com/projects/darknet/cfg/yolov3.cfg"
        var modelConfigPath = path + "yolov3.cfg"
        // var modelWeightsPath = "/Users/kkbankol@us.ibm.com/projects/darknet/yolov3.weights"
        var modelWeightsPath = path + "yolov3.weights"
        // var modelClassesPath = "/Users/kkbankol@us.ibm.com/projects/opencv/samples/data/dnn/object_detection_classes_yolov3.txt"
        var modelClassesPath = path + "object_detection_classes_yolov3.txt"

        // var imagePath = "/Users/kkbankol@us.ibm.com/projects/smart-city-cameras/cameras_app/uploads/" + req.body.filename
        // var imagePath = '/Users/kkbankol@us.ibm.com/projects/smart-city-cameras/dnn-object-detection/scripts/motion_images/' + req.body.filename
        var imagePath = "/opt/cameras_app/uploads/" + req.body.filename
        var miscOpts = "--width=384 --height=384 --scale=0.00392 --rgb"
        var cmd = [objectDetectionBin, " -c=" + modelConfigPath, " -m=" + modelWeightsPath, " -i=" + imagePath, miscOpts, " --classes '" + modelClassesPath + "'"]
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
        // var listClasses = extractClasses.filter(function(elem, pos) {
        //     return extractClasses.indexOf(elem) == pos;
        // })
        var doc_contents = {}
        // console.log("document:", [doc_contents, req.body, extractClasses].reduce(Object.assign)),
        // console.log("document:", Object.assign(doc_contents, req.body, JSON.parse(extractClasses)))
        console.log("document:", Object.assign(doc_contents, req.body, {classes: parseClasses(JSON.parse(extractClasses))} ))

        createCloudantWithAttachments(
          req.body.time + '-' + req.body.channel + '-' + req.body.location,
          imagePath,
          // Object.assign({}, req.body)
          // Object.assign(doc_contents, req.body, JSON.parse(extractClasses)),
          Object.assign(
            doc_contents,
            req.body, {
              classes: parseClasses(JSON.parse(extractClasses))
            }
          ),
          // {
          //   meta: req.body,
          //   obj: JSON.parse(extractClasses)
          // }
        )
        res.send({payload: parseClasses})
        console.log("updated")
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

/*
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
*/




// router.get('/query', function(req, res, next) {
//
// });


module.exports = router;
