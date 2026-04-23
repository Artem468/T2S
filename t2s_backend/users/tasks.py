from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django_celery_beat.models import PeriodicTask

from users.models import EmailMailing, MailingRepeat
from users.services import build_export_links, build_unsubscribe_url, render_mailing_bodies

def _disable_periodic_task(task_name):
    if not task_name:
        return

    PeriodicTask.objects.filter(name=task_name).update(enabled=False)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_scheduled_mailing(self, campaign_id):
    mailing = (
        EmailMailing.objects.select_related("message")
        .prefetch_related("recipients")
        .filter(pk=campaign_id, is_active=True)
        .first()
    )
    if mailing is None:
        return "mailing_not_found"

    active_recipients = list(mailing.recipients.filter(is_unsubscribed=False))
    if not active_recipients:
        mailing.is_active = False
        mailing.save(update_fields=["is_active", "updated_at"])
        _disable_periodic_task(mailing.periodic_task_name)
        return "no_active_recipients"

    base_url = getattr(settings, "PUBLIC_BASE_URL", "http://localhost").rstrip("/")
    export_links = build_export_links(base_url, mailing.message_lookup_id)
    sent_count = 0

    for recipient in active_recipients:
        unsubscribe_url = build_unsubscribe_url(base_url, recipient.unsubscribe_token)
        text_body, html_body = render_mailing_bodies(
            description=mailing.message.description,
            comment=mailing.comment,
            export_links=export_links,
            unsubscribe_url=unsubscribe_url,
        )
        email = EmailMultiAlternatives(
            subject=getattr(settings, "MAILING_EMAIL_SUBJECT", "Рассылка T2S"),
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient.email],
        )
        email.attach_alternative(html_body, "text/html")
        email.send(fail_silently=False)
        sent_count += 1

    if mailing.repeat == MailingRepeat.NONE:
        mailing.is_active = False
        mailing.save(update_fields=["is_active", "updated_at"])
        _disable_periodic_task(mailing.periodic_task_name)

    return f"sent:{sent_count}"
