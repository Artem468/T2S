from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import Chat, Role, Message
from core.serializers import ChatSerializer, MessagePreviewSerializer


@extend_schema(tags=['Чаты'])
@extend_schema_view(
    list=extend_schema(summary="Получить список всех чатов"),
    create=extend_schema(summary="Создать новый чат"),
    retrieve=extend_schema(summary="Получить данные конкретного чата"),
    update=extend_schema(summary="Полное обновление чата"),
    partial_update=extend_schema(summary="Частичное изменение чата"),
    destroy=extend_schema(summary="Удалить чат")
)
class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="История сообщений пользователя",
        description="Возвращает только сообщения с ролью USER для конкретного чата.",
        responses={200: MessagePreviewSerializer(many=True)},
        tags=['Сообщения']
    )
    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        chat = self.get_object()
        messages = Message.objects.filter(
            chat=chat,
            role=Role.USER
        ).order_by('-created_at')

        serializer = MessagePreviewSerializer(messages, many=True)
        return Response(serializer.data)