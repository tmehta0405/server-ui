from django.urls import path
from . import views

urlpatterns = [
    path('', views.ssh, name='ssh'),
    path('dashboard/', views.dashboard, name='dashboard'),
]
