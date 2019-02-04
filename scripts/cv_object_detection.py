import numpy as np
import cv2
import time
import uuid
import sys
from datetime import datetime
import requests
import ImageChops
from threading import Timer
import argparse
import math
# make sure to get opencv 3.4 and up
# pip3.7 install opencv-contrib-python

# Motion detection flow

# The cutoff for threshold. A lower number means smaller changes between
# the average and current scene are more readily detected.
THRESHOLD_SENSITIVITY = 50
# Number of pixels in each direction to blur the difference between
# average and current scene. This helps make small differences larger
# and more detectable.
BLUR_SIZE = 20
# The number of square pixels a blob must be before we consider it a
# candidate for tracking.
BLOB_SIZE = 75 # 400
# The number of pixels wide a blob must be before we consider it a
# candidate for tracking.
BLOB_WIDTH = 5
# The weighting to apply to "this" frame when averaging. A higher number
# here means that the average scene will pick up changes more readily,
# thus making the difference between average and current scenes smaller.
DEFAULT_AVERAGE_WEIGHT = 0.08
# The maximum distance a blob centroid is allowed to move in order to
# consider it a match to a previous scene's blob.
BLOB_LOCKON_DISTANCE_PX = 80
# The number of seconds a blob is allowed to sit around without having
# any new blobs matching it.
BLOB_TRACK_TIMEOUT = 10 #0.7
# The left and right X positions of the "poles". These are used to
# track the speed of a vehicle across the scene.
LEFT_POLE_PX = 320
RIGHT_POLE_PX = 500
# Constants for drawing on the frame.
LINE_THICKNESS = 1
CIRCLE_SIZE = 5
RESIZE_RATIO = 0.4

methods = ['cv2.TM_CCOEFF', 'cv2.TM_CCOEFF_NORMED', 'cv2.TM_CCORR',
            'cv2.TM_CCORR_NORMED', 'cv2.TM_SQDIFF', 'cv2.TM_SQDIFF_NORMED']

### https://gist.githubusercontent.com/bigsnarfdude/cf51fde11fb30ef23628b1547ecdd939/raw/040e6abe88e91779012f8e7a6a5785f43d30afe8/diff.py
from itertools import tee, izip
def pairwise(iterable):
    "s -> (s0,s1), (s1,s2), (s2, s3), ..."
    a, b = tee(iterable)
    next(b, None)
    return izip(a, b)
###
# webcam
# vid = cv2.VideoCapture(0)
# rtsp
# cv.VideoCapture("rtsp://192.168.1.2:8080/out.h264")
frame_count = 0
prev_frame = None
prev_ret = None
avg = None
tracked_blobs = []
last_frame_captured = None
cam_channel = '9'

# - Load video source (live RTSP or recorded)
# filename = '/Users/kkbankol@us.ibm.com/projects/smart-city-cameras/sample_videos/HD-D113 CCTV Camera Sample Day Video Footage- Erdington Thie.mp4'

# parser = argparse.ArgumentParser(description='Process motion detection vars')
# parser.add_argument('source', metavar='source', type=string, nargs='+',
#                    help='video source, rtsp endpoint or path to file')
# parser.add_argument('endpoint', dest='endpoint', action='store_const',
#                    const=sum, default=max,
#                    help='sum the integers (default: find the max)')
# args = parser.parse_args()

# TODO fix argparser above instead
if len(sys.argv) > 1 :
  stream = sys.argv[1] # './sample_videos/vid10.mp4'
  obj_detection_ip = sys.argv[2]
  obj_detection_port = sys.argv[3] #"3000"

print("reading from " + stream)
# prerecorded video
vid = cv2.VideoCapture(stream) #rtsp_stream)
# cv2.waitKey()
cv2.startWindowThread()
cv2.namedWindow("preview")
num_blobs = 0

def update_list_tracked_blobs():
    blob_ids = [ blob['id'] for blob in tracked_blobs ]
    print("list blob_ids")
    print(blob_ids)

def save_screenshot(frame):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = "cam_" + cam_channel + '_' + timestamp + '.jpg'
    print("writing screenshot: " + filename)
    cv2.imwrite("motion_images/" + filename, frame)


cv2.namedWindow("imgc");
cv2.moveWindow("imgc", 20,20);

# set limit on window size, only show last x captured frames
cv2.namedWindow("captured images");
cv2.moveWindow("captured images", 80,650);

cv2.namedWindow("threshold images");

while(vid.isOpened()):
    if cv2.waitKey(1) & 0xFF == ord('q'):
        vid.release()
        break
    # cv2.TrackerCSRT_create()
    ret, frame = vid.read()
    # if frame is valid and contains a picture
    if not ret:
        vid.release()
        break
    else:
        frame_time = time.time()
        frame_count += 1
        if (frame_count % 100 == 0):
            print("frame: " + str(frame_count))
        # Convert frame to grayscale
        if prev_ret == None:
            prev_frame = frame
            prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY) #COLOR_BGR2GRAY)
            prev_ret = ret
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hsvFrame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        (_, _, grayFrame) = cv2.split(hsvFrame)
        # reduce noise via gauss blur + smooth
        grayFrame = cv2.GaussianBlur(grayFrame, (21, 21), 0)
        # cv2.imshow("preview", grayFrame)
        if avg is None:
            print("Setting average variable")
            # Set up the average if this is the first time through.
            # if avg doesn't exist, copy
            avg = grayFrame.copy().astype("float")
            captured_images = np.array((frame))
            continue
        cv2.accumulateWeighted(grayFrame, avg, DEFAULT_AVERAGE_WEIGHT)
        # cv2.imshow("average", cv2.convertScaleAbs(avg))
        differenceFrame = cv2.absdiff(grayFrame, cv2.convertScaleAbs(avg))
        # cv2.imshow("difference", differenceFrame)
        # Apply a threshold to the difference: any pixel value above the sensitivity
        # value will be set to 255 and any pixel value below will be set to 0.
        retval, thresholdImage = cv2.threshold(differenceFrame, THRESHOLD_SENSITIVITY, 255, cv2.THRESH_BINARY)
        thresholdImage = cv2.dilate(thresholdImage, None, iterations=2)
        try:
            threshold_images
        except NameError:
            threshold_images = np.array((thresholdImage))
        # cv2.imshow("threshold", thresholdImage)
        # eigenface[0] = grayFrame
        # eigenface[1] = cv2.convertScaleAbs(avg)
        # eigenface[2] = differenceFrame
        # eigenface[3] = thresholdImage
        # hconcat(eigenface,3,dst);
        views1 = np.hstack((gray, cv2.convertScaleAbs(avg)))
        views2 = np.hstack((differenceFrame, thresholdImage))
        all_views = np.vstack(( views1, views2 ))
        # all_views = np.vstack(( all_views, (differenceFrame, thresholdImage) ))
        cv2.imshow('imgc', all_views)
        # Find contours aka blobs in the threshold image.
        im2, contours, hierarchy  = cv2.findContours(thresholdImage, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # Technically can stop here if detected object significant enough, follow up with
        # - Raise "object detected" flag
        # - publish cam number + rtsp url to MQTT
        # - server begin recording via RTSP connection, or take multiple screenshots (screenshots should suffice in most cases, but probably want to record video too in case of incident)
        # - run object detection algorithm on captured vid/frames.
        # - aggregate recognized tags. include screenshot of whole labeled frame (and maybe individual objects?)
        #
        # Filter out the blobs that are too small to be considered cars.
        blobs = filter(lambda c: cv2.contourArea(c) > BLOB_SIZE, contours)
        if blobs:
            # print(blobs[0])
            # print("motion detected")
            # instead of comparing how different the frame is, compare based off num blobs
            print("num blobs")
            print(len(blobs))
            if len(blobs) > num_blobs:
                print('new blob detected')
                num_blobs = len(blobs)
            elif len(blobs) < num_blobs:
                print('object left frame')
                num_blobs = len(blobs)
            else:
                print('same amount of objects in file')
            # TODO, take list of tracked blobs and take action when a new one is created
            # print("tracked_blobs")
            # print(tracked_blobs)
            # print(len(tracked_blobs)) tracked_blobs['id']

            # take screenshot every time number of blobs increases from the last frame
            # compare frame to last frame captured, skip iteration if too similar
            # print(cv2.matchTemplate(last_frame_captured, frame, eval(methods[1])))
            # print(h)
            if last_frame_captured is None:
              last_frame_captured = frame
            match_threshold = 0.94 # 17873124.0 #0.95 # [[0.99075127]]
            calculated_threshold = cv2.matchTemplate(last_frame_captured, frame, eval(methods[1]))[0]
            print(calculated_threshold[0])
            print(match_threshold)
            if (calculated_threshold[0] > match_threshold) :
              print("too similar to last captured frame, skipping")
              # time.sleep(0.1)
              # continue
            time.sleep(0.1)
            for c in blobs:
                # Find the bounding rectangle and center for each blob
                (x, y, w, h) = cv2.boundingRect(c)
                center = (int(x + w/2), int(y + h/2))

                ## Optionally draw the rectangle around the blob on the frame that we'll show in a UI later
                # cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), LINE_THICKNESS)

                # Look for existing blobs that match this one
                closest_blob = None
                if tracked_blobs:
                    print("tracking " + str(len(tracked_blobs)) + " blobs")
                    # Sort the blobs we have seen in previous frames by pixel distance from this one
                    closest_blobs = sorted(tracked_blobs, key=lambda b: cv2.norm(b['trail'][0], center))
                    # print( tracked_blobs)
                    update_list_tracked_blobs()
                    # so if we have new blobs that didn't exist in the last frame, or are being newly tracked, store screenshot?
                    # if there's a new blob in the tracked list that wasn't already there?

                    # Starting from the closest blob, make sure the blob in question is in the expected direction
                    for close_blob in closest_blobs:
                        distance = cv2.norm(center, close_blob['trail'][0])

                        # Check if the distance is close enough to "lock on"
                        if distance < BLOB_LOCKON_DISTANCE_PX:
                            # If it's close enough, make sure the blob was moving in the expected direction
                            expected_dir = close_blob['dir']
                            if expected_dir == 'left' and close_blob['trail'][0][0] < center[0]:
                                continue
                            elif expected_dir == 'right' and close_blob['trail'][0][0] > center[0]:
                                continue
                            else:
                                closest_blob = close_blob
                                break

                    if closest_blob:
                        # If we found a blob to attach this blob to, we should
                        # do some math to help us with speed detection
                        prev_center = closest_blob['trail'][0]
                        if center[0] < prev_center[0]:
                            # It's moving left
                            closest_blob['dir'] = 'left'
                            closest_blob['bumper_x'] = x
                        else:
                            # It's moving right
                            closest_blob['dir'] = 'right'
                            closest_blob['bumper_x'] = x + w

                        # ...and we should add this centroid to the trail of
                        # points that make up this blob's history.
                        closest_blob['trail'].insert(0, center)
                        closest_blob['last_seen'] = frame_time

                if not closest_blob:
                    # If we didn't find a blob, let's make a new one and add it to the list
                    b = dict(
                        id=str(uuid.uuid4())[:8],
                        first_seen=frame_time,
                        last_seen=frame_time,
                        dir=None,
                        bumper_x=None,
                        trail=[center],
                    )
                    print(center)
                    # distance = math.sqrt( ((p1[0]-p2[0])**2)+((p1[1]-p2[1])**2) )
                    # sys.exit(0)
                    tracked_blobs.append(b)
                    update_list_tracked_blobs()
                    # TODO TODO TODO
                    # update to respond to new blob only if more than x pixels away from others
                    print("new object detected, taking screenshot, uploading")
                    # TODO, maybe skip ahead 5 frames later to take screenshot? since object will be just on border
                    # Or take one screenshot here, another x frames later?
                    # save_screenshot(frame, cam_channel)
                    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                    filename = "cam_" + cam_channel + '_' + timestamp + '.jpg'
                    print("writing to: " + filename)
                    cv2.imwrite("motion_images/" + filename, frame)
                    last_frame_captured = frame
                    # post to kube api
                    image_path = "motion_images/" + filename
                    url="http://" + obj_detection_ip + ":" + obj_detection_port + "/image/upload"
                    files = {'file': open(image_path, 'rb').read()}
                    data = {'filename': filename, 'time': timestamp, 'channel': cam_channel, 'location': '47'}
                    # print(data)
                    print("posting " + filename + " to node")
                    r = requests.post(url, files=files, data=data)
                    # print(r.text)
                    time.sleep(2) # TODO, instead of pausing perhaps we can record video until motion stops?
                    # Timer(5, save_screenshot(frame), ()).start()
                    views1 = np.hstack((gray, cv2.convertScaleAbs(avg)))
                    views2 = np.hstack((differenceFrame, thresholdImage))
                    threshold_images = np.hstack((thresholdImage, threshold_images))
                    all_views = np.vstack(( views1, views2 ))
                    captured_images = np.hstack((frame, captured_images))
                    # all_views = np.vstack(( all_views, (differenceFrame, thresholdImage) ))
                    cv2.imshow('imgc', all_views)
                    cv2.imshow('captured images', captured_images)
                    cv2.imshow('threshold images', threshold_images)


                    # take screenshot and post
                    # TODO: should add more logic here...take additional screenshot when tracked blob has existed for more than x seconds?
        if tracked_blobs:
            # Prune out the blobs that haven't been seen in some amount of time
            for i in xrange(len(tracked_blobs) - 1, -1, -1):
                if frame_time - tracked_blobs[i]['last_seen'] > BLOB_TRACK_TIMEOUT:
                    # print "Removing expired track {}".format(tracked_blobs[i]['id'])
                    del tracked_blobs[i]
                    update_list_tracked_blobs()

        # Draw the fences
        # cv2.line(frame, (LEFT_POLE_PX, 0), (LEFT_POLE_PX, 700), (100, 100, 100), 2)
        # cv2.line(frame, (RIGHT_POLE_PX, 0), (RIGHT_POLE_PX, 700), (100, 100, 100), 2)
        # Draw information about the blobs on the screen
        for blob in tracked_blobs:
            for (a, b) in pairwise(blob['trail']):
                cv2.circle(frame, a, 3, (255, 0, 0), LINE_THICKNESS)

                if blob['dir'] == 'left':
                    cv2.line(frame, a, b, (255, 255, 0), LINE_THICKNESS)
                else:
                    cv2.line(frame, a, b, (0, 255, 255), LINE_THICKNESS)

                bumper_x = blob['bumper_x']
                if bumper_x:
                    cv2.line(frame, (bumper_x, 100), (bumper_x, 500), (255, 0, 255), 3)

                # cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), LINE_THICKNESS)
                # cv2.circle(frame, center, 10, (0, 255, 0), LINE_THICKNESS)

        # Show the image from the camera (along with all the lines and annotations)
        # in a window on the user's screen.
        # Only use the Value channel of the frame.
        # https://gist.githubusercontent.com/bigsnarfdude/cf51fde11fb30ef23628b1547ecdd939/raw/040e6abe88e91779012f8e7a6a5785f43d30afe8/diff.py
        # print("Take value of frame")
        # (_, _, grayFrame) = cv2.split(gray)
        # print("Blur")
        # grayFrame = cv2.GaussianBlur(gray, (21, 21), 0)
        # time.sleep(0.10)
        # cv2.imshow('frame', gray)
        # Build the average scene image by accumulating this frame
        # with the existing average.
        # cv2.imshow("preview", frame)
        cv2.accumulateWeighted(grayFrame, avg, DEFAULT_AVERAGE_WEIGHT)
        # cv2.imshow("average", cv2.convertScaleAbs(avg))
        differenceFrame = cv2.absdiff(grayFrame, cv2.convertScaleAbs(avg))
        # cv2.imshow("difference", differenceFrame)
        # Apply a threshold to the difference: any pixel value above the sensitivity
        # value will be set to 255 and any pixel value below will be set to 0.
        retval, thresholdImage = cv2.threshold(differenceFrame, THRESHOLD_SENSITIVITY, 255, cv2.THRESH_BINARY)
        thresholdImage = cv2.dilate(thresholdImage, None, iterations=2)
        # cv2.imshow("threshold", thresholdImage)
        # Find contours aka blobs in the threshold image.
        im2, contours, hierarchy  = cv2.findContours(thresholdImage, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # Filter out the blobs that are too small to be considered cars.
        blobs = filter(lambda c: cv2.contourArea(c) > BLOB_SIZE, contours)
        # time.sleep(0.01)
        # Display frame
        # cv2.imshow('frame', gray)
        prev_frame = frame
        prev_gray = gray
        # frame1 = gray
        # # if frame1 is None:
        # motion_frame = gray # last frame where motion was detected
        # # Compare to last frame
        # contours = cv.FindContours(grey_image, storage, cv.CV_RETR_CCOMP, cv.CV_CHAIN_APPROX_SIMPLE)
    # else:
    #     # might need to remove this ^, shouldn't exit in case of camera failure
    #     print("Finished processing " + str(frame_count) + " frames")
    #     vid.release()
        # cv2.destroyAllWindows()
vid.release()
cv2.destroyAllWindows()

# def process_frame:
    # - Convert frame to greyscale
    # - Dilate hole, find contour (shape)

# def subtractFrames(frame1, frame2)
    # cv.AbsDiff()
    #
    # remove noise, return threshold
    # https://github.com/RobinDavid/Motion-detection-OpenCV/blob/master/MotionDetector.py#L87:#L90


# - Capture frame, set as baseline
    # process_frame, set as frame1

# - Grab next frame
    # process_frame, set as frame2
    # subtractFrames

# if threshold > minThreshold
    # begin recording
