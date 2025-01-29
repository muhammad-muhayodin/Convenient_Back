FROM ubuntu:latest

WORKDIR /app
RUN apt-get update && apt-get install -y curl tree
RUN apt-get install -y nodejs
RUN apt-get install -y npm
RUN apt-get install -y screen

COPY ./backEnd /app/backEnd

RUN cd /app/backEnd && npm install
EXPOSE 30001
CMD [ "node", "./backEnd/app.js" ]