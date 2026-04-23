import json
import uuid

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Message
from users.models import EmailMailing, EmailMailingRecipient, MailingRepeat
from users.serializers import EmailMailingCreateResponseSerializer, EmailMailingCreateSerializer
from users.services import build_crontab_kwargs, ensure_aware_datetime


class EmailMailingCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Рассылки"],
        summary="Создать email-рассылку",
        request=EmailMailingCreateSerializer,
        responses={201: EmailMailingCreateResponseSerializer},
    )
    def post(self, request):
        serializer = EmailMailingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        message = Message.objects.filter(message_id=validated_data["message_id"]).order_by("-created_at").first()
        if message is None:
            return Response(
                {"message_id": ["Message по полю message_id не найден."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            mailing = EmailMailing.objects.create(
                message=message,
                message_lookup_id=validated_data["message_id"],
                scheduled_at=validated_data["scheduled_at"],
                comment=validated_data.get("comment", ""),
                repeat=validated_data["repeat"],
            )
            EmailMailingRecipient.objects.bulk_create(
                [
                    EmailMailingRecipient(mailing=mailing, email=email)
                    for email in validated_data["emails"]
                ]
            )
            task_name = self._create_periodic_task(mailing)
            mailing.periodic_task_name = task_name
            mailing.save(update_fields=["periodic_task_name", "updated_at"])

        response_data = {
            "id": mailing.id,
            "scheduled_at": mailing.scheduled_at,
            "repeat": mailing.repeat,
            "recipients_count": len(validated_data["emails"]),
            "periodic_task_name": mailing.periodic_task_name,
        }
        return Response(response_data, status=status.HTTP_201_CREATED)

    def _create_periodic_task(self, mailing):
        from django_celery_beat.models import ClockedSchedule, CrontabSchedule, PeriodicTask

        scheduled_at = ensure_aware_datetime(mailing.scheduled_at)
        task_name = f"email-mailing-{mailing.id}-{uuid.uuid4().hex}"
        task_kwargs = json.dumps({"campaign_id": mailing.id})

        periodic_task_kwargs = {
            "name": task_name,
            "task": "users.tasks.send_scheduled_mailing",
            "kwargs": task_kwargs,
            "enabled": True,
            "start_time": scheduled_at,
        }

        if mailing.repeat == MailingRepeat.NONE:
            clocked, _ = ClockedSchedule.objects.get_or_create(clocked_time=scheduled_at)
            PeriodicTask.objects.create(
                clocked=clocked,
                one_off=True,
                **periodic_task_kwargs,
            )
            return task_name

        crontab, _ = CrontabSchedule.objects.get_or_create(**build_crontab_kwargs(scheduled_at, mailing.repeat))
        PeriodicTask.objects.create(
            crontab=crontab,
            one_off=False,
            **periodic_task_kwargs,
        )
        return task_name


class EmailMailingUnsubscribeView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Рассылки"],
        summary="Отписаться от email-рассылки",
        responses={200: None},
    )
    def get(self, request, token):
        recipient = get_object_or_404(EmailMailingRecipient, unsubscribe_token=token)
        if not recipient.is_unsubscribed:
            recipient.is_unsubscribed = True
            recipient.unsubscribed_at = ensure_aware_datetime(timezone.now())
            recipient.save(update_fields=["is_unsubscribed", "unsubscribed_at"])
            self._disable_mailing_if_empty(recipient.mailing)

        return HttpResponse(
            "<html><body><h2>Вы успешно отписались от рассылки.</h2></body></html>"
        )

    def _disable_mailing_if_empty(self, mailing):
        if mailing.recipients.filter(is_unsubscribed=False).exists():
            return

        mailing.is_active = False
        mailing.save(update_fields=["is_active", "updated_at"])
        if mailing.periodic_task_name:
            from django_celery_beat.models import PeriodicTask

            PeriodicTask.objects.filter(name=mailing.periodic_task_name).update(enabled=False)
