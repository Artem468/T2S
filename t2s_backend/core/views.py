import io
import json

from asgiref.sync import async_to_sync
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from sqlalchemy import text
from openpyxl import Workbook
from docx import Document
from reportlab.pdfgen import canvas

from core.models import Chat, Role, Message
from core.serializers import ChatSerializer, MessagePreviewSerializer, MessageDetailResponseSerializer
from core.utils import fetch_data


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
        description="Возвращает только сообщения с ролью USER для конкретного чата",
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


class MessageDetailView(APIView):
    @extend_schema(
        summary="Детальная информация о запросе",
        description="Ищет сообщение по ID и подтягивает данные из внешней",
        responses={200: MessageDetailResponseSerializer},
        tags=['Сообщения']
    )
    def get(self, request, message_id):
        instance = get_object_or_404(Message, id=message_id)

        try:
            external_body = async_to_sync(fetch_data)(instance.message)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = MessagePreviewSerializer(instance)
        response_data = serializer.data
        response_data['payload'] = external_body

        return Response(response_data)


class MessageExportView(APIView):
    @extend_schema(
        summary="Экспорт сообщений пользователя",
        description="Экспортирует данные в нужный формат",
        responses={200: MessagePreviewSerializer},
        tags=['Сообщения']
    )
    def get(self, request, message_id):
        instance = get_object_or_404(Message, id=message_id)

        try:
            external_data = async_to_sync(fetch_data)(instance.message)
        except Exception as e:
            return Response(
                {"error": f"SQLAlchemy Error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        serializer = MessagePreviewSerializer(instance)
        response_data = serializer.data
        response_data['payload'] = external_data

        export_format = request.query_params.get('format')
        if export_format:
            return self.handle_export(export_format, response_data)

        return Response(response_data)

    def handle_export(self, fmt, data):
        """Маршрутизатор экспорта."""
        filename = f"message_{data['id']}"
        if fmt == 'xlsx':
            return self.export_excel(data, filename)
        elif fmt == 'docx':
            return self.export_docx(data, filename)
        elif fmt == 'pdf':
            return self.export_pdf(data, filename)
        return None

    @staticmethod
    def export_excel(data, filename):
        wb = Workbook()
        ws = wb.active
        ws.append(['ID', 'Message SQL', 'Created At', 'External Data'])

        ws.append([data['id'], data['message'], str(data['created_at']), str(data['external_body'])])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return HttpResponse(
            buffer,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename="{filename}.xlsx"'}
        )

    @staticmethod
    def export_docx(data, filename):
        doc = Document()
        doc.add_heading(f"Message ID: {data['id']}", 0)
        doc.add_paragraph(f"SQL Query: {data['message']}")
        doc.add_paragraph(f"Result: {json.dumps(data['external_body'], indent=2, ensure_ascii=False)}")

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return HttpResponse(
            buffer,
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={'Content-Disposition': f'attachment; filename="{filename}.docx"'}
        )

    @staticmethod
    def export_pdf(data, filename):
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(50, 800, f"Message ID: {data['id']}")
        p.drawString(50, 780, f"SQL: {data['message'][:60]}...")

        p.drawString(50, 760, f"External Rows Count: {len(data['external_body'])}")
        p.showPage()
        p.save()
        buffer.seek(0)
        return HttpResponse(
            buffer,
            content_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{filename}.pdf"'}
        )
