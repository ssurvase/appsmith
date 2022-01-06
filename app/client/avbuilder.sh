#!/bin/sh

echo "Starting build"

TAG=$(date +%Y.%m.%d.%H.%M)

echo "Using tag :: $TAG"

sed -i.bak s#__image_tag__#$TAG# Dockerfile

echo "docker build . -t avtool_client:$TAG"
docker build . -t avtool_client:$TAG

echo "Applying image to k8s deployment appsmith-editor"
echo "kubectl set image -n default --record=true deployment/appsmith-editor appsmith-editor=avtool_client:$TAG"
kubectl set image -n default --record=true deployment/appsmith-editor appsmith-editor=avtool_client:$TAG

# echo "scaling the pods"
# kubectl scale deployment appsmith-editor --replicas=0
# kubectl scale deployment appsmith-editor --replicas=1

echo "fin"

