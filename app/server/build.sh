#!/bin/bash

# Remove previous dist directory
rm -rf dist/

# Build the code. $@ accepts all the parameters from the input command line and uses it in the maven build command
# mvn clean package "$@"
mvn clean package "$@" -Dmaven.test.skip

if [ $? -eq 0 ]
then
  echo "mvn Successful"
else
  echo "mvn Failed"
  exit 1
fi

# Create the dist directory
mkdir -p dist/plugins

# Copy the server jar
cp -v ./appsmith-server/target/server-*.jar dist/

# Copy all the plugins
rsync -av --exclude "original-*.jar" ./appsmith-plugins/*/target/*.jar dist/plugins/

TAG=$(date +%Y.%m.%d.%H.%M)

docker build -t av-server:${TAG} .
