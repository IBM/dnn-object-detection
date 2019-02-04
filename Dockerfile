FROM kkbankol/opencv_yolo_pod
RUN rm -rf /opt/cameras_app/*
COPY . /opt/cameras_app/
#git clone
COPY bin/example_dnn_object_detection /nodejsAction/cv/example_dnn_object_detection
RUN cd /opt/cameras_app && rm -rf node_modules && npm install
RUN cp /nodejsAction/cv/object_detection_classes_yolov3.txt /tmp/object_detection_classes_yolov3.txt
RUN bash -c 'curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash'
# RUN cat /root/.bash_profile
COPY .bash_profile_nvm /root/.bash_profile
COPY .bashrc /root/.bashrc

#RUN echo '# Place next three lines in ~/.bash_profile \
#export NVM_DIR="$HOME/.nvm" \
#[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm \
#[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> /root/.bash_profile
RUN bash -c "source /root/.bash_profile && \
    nvm install v8.9.0 && \
    nvm use 8.9.0 && \
    nvm alias default 8.9.0"
RUN bash -c  "source /root/.bash_profile && cd /opt/cameras_app && rm -rf node_modules && nvm use 8.9.0 && npm install"
CMD bash -c "source /root/.bash_profile && nvm use 8.9.0 && npm start --prefix /opt/cameras_app"
