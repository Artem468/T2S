from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatViewSet, MessageDetailView, MessageExportView

router = DefaultRouter()
router.register(r'', ChatViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('messages/<int:message_id>/', MessageDetailView.as_view(), name='message-detail'),
    path('export/<int:message_id>/', MessageExportView.as_view(), name='message-export'),
]