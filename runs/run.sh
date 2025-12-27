#!/bin/bash
docker build -t django-docker .
docker run --name serv-ui --rm --env-file .env -p 8000:8000 django-docker
