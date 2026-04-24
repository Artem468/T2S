from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChatViewSet,
    DatabaseConnectionView,
    MessageDetailView,
    MessageExportView,
    DatabaseActivateView,
    QuestionGeneratorView,
)

router = DefaultRouter()
router.register(r'', ChatViewSet)

urlpatterns = [
    path('db/connect/', DatabaseConnectionView.as_view(), name='database-connect'),
    path('db/<int:pk>/activate/', DatabaseActivateView.as_view(), name='database-connect'),
    path('messages/<int:message_id>/', MessageDetailView.as_view(), name='message-detail'),
    path('export/<int:message_id>/', MessageExportView.as_view(), name='message-export'),
    path('questions/', QuestionGeneratorView.as_view(), name='question-generator'),
    path('', include(router.urls)),
]
