from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatViewSet, DatabaseConnectionView, MessageDetailView, MessageExportView

router = DefaultRouter()
router.register(r'', ChatViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('db/connect/', DatabaseConnectionView.as_view(), name='database-connect'),
    path('messages/<int:message_id>/', MessageDetailView.as_view(), name='message-detail'),
    path('export/<int:message_id>/', MessageExportView.as_view(), name='message-export'),
]
