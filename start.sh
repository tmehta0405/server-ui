#!/bin/bash
python manage.py migrate
python manage.py collectstatic --noinput --clear
daphne -b 0.0.0.0 console.asgi:application