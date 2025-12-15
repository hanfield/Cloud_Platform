"""
WebSocket URL routing
"""
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/vm-status/', consumers.VMStatusConsumer.as_asgi()),
]
