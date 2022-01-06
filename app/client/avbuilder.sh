#!/bin/sh

echo "Starting build"

docker build . -t avtool_client

echo "scaling the pods"
kubectl scale deployment appsmith-editor --replicas=0
kubectl scale deployment appsmith-editor --replicas=1

echo "fin"

