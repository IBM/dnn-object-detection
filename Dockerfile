FROM kkbankol/opencv_yolo
ADD . /opt/cameras_app
ADD bin/example_dnn_object_detection /nodejsAction/cv/example_dnn_object_detection
RUN cd /opt/cameras_app && rm -rf node_modules && npm install 
RUN cp /nodejsAction/cv/object_detection_classes_yolov3.txt /tmp/object_detection_classes_yolov3.txt
CMD cd /opt/cameras_app && npm start 
