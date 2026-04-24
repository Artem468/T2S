from datetime import timezone as dt_timezone
from html import escape

from django.conf import settings
from django.urls import reverse
from django.utils import timezone

from users.models import MailingRepeat


def ensure_aware_datetime(value):
    if timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def build_crontab_kwargs(scheduled_at, repeat):
    scheduled_at = ensure_aware_datetime(scheduled_at).astimezone(dt_timezone.utc)
    kwargs = {
        "minute": str(scheduled_at.minute),
        "hour": str(scheduled_at.hour),
        "timezone": getattr(settings, "CELERY_TIMEZONE", settings.TIME_ZONE),
    }
    if repeat == MailingRepeat.WEEK:
        kwargs["day_of_week"] = scheduled_at.strftime("%a").lower()[:3]
    elif repeat == MailingRepeat.MONTH:
        kwargs["day_of_month"] = str(scheduled_at.day)
    return kwargs


def build_export_links(base_url, message_lookup_id):
    normalized_base = base_url.rstrip("/")
    export_path = reverse("message-export", kwargs={"message_id": message_lookup_id})
    return {
        "xlsx": f"{normalized_base}{export_path}?fmt=xlsx",
        "docx": f"{normalized_base}{export_path}?fmt=docx",
        "pdf": f"{normalized_base}{export_path}?fmt=pdf",
    }


def build_unsubscribe_url(base_url, token):
    normalized_base = base_url.rstrip("/")
    return f"{normalized_base}{reverse('users:mailing-unsubscribe', kwargs={'token': token})}"


def render_mailing_bodies(description, comment, export_links, unsubscribe_url):
    description = description or "Без описания"
    comment_block = f"\nКомментарий: {comment}" if comment else ""
    text_body = (
        f"{description}{comment_block}\n\n"
        f"Скачать экспорт:\n"
        f"XLSX: {export_links['xlsx']}\n"
        f"DOCX: {export_links['docx']}\n"
        f"PDF: {export_links['pdf']}\n\n"
        f"Отписаться: {unsubscribe_url}\n"
    )
    safe_description = escape(description).replace("\n", "<br>")
    safe_comment = escape(comment).replace("\n", "<br>") if comment else ""

    comment_html = ""
    if comment:
        comment_html = (
            "<h2 style=\"margin: 24px 0 8px; font-size: 44px; line-height: 1.08; "
            "font-weight: 800; color: #0a7a73; text-align: center;\">Комментарий</h2>"
            "<div style=\"height: 8px; width: 100%; max-width: 660px; border-radius: 999px; "
            "background: #0a7a73; margin: 0 auto 28px;\"></div>"
            f"<p style=\"margin: 0 0 32px; font-size: 24px; line-height: 1.6; color: #111111; "
            f"text-align: center; font-weight: 700;\">{safe_comment}</p>"
        )

    html_body = (
        "<!doctype html>"
        "<html lang=\"ru\">"
        "<head>"
        "<meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
        "<title>Рассылка T2S</title>"
        "</head>"
        "<body style=\"margin: 0; padding: 0; background: #f2f2f2;\">"
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
        "style=\"background: #f2f2f2; padding: 24px 12px;\">"
        "<tr><td align=\"center\">"
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
        "style=\"max-width: 900px; background: #f5f5f5; border-radius: 18px; "
        "font-family: 'Trebuchet MS', Arial, sans-serif;\">"
        "<tr><td style=\"padding: 42px 28px 36px;\">"
        "<h1 style=\"margin: 0 0 18px; font-size: 64px; line-height: 1.08; "
        "font-weight: 900; color: #0a7a73; text-align: center;\">Рассылка T2S</h1>"
        "<div style=\"height: 16px; width: 100%; max-width: 660px; border-radius: 999px; "
        "background: #0a7a73; margin: 0 auto 34px;\"></div>"
        f"<p style=\"margin: 0 0 26px; font-size: 26px; line-height: 1.62; color: #111111; "
        f"text-align: center; font-weight: 700;\">{safe_description}</p>"
        f"{comment_html}"
        "<p style=\"margin: 0 0 24px; font-size: 22px; line-height: 1.4; color: #111111; "
        "text-align: center; font-weight: 700;\">Скачать экспорт</p>"
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
        "style=\"margin-bottom: 20px;\"><tr>"
        "<td align=\"center\" style=\"padding: 6px;\">"
        f"<a href=\"{export_links['xlsx']}\" "
        "style=\"display: inline-block; min-width: 160px; border-radius: 18px; "
        "background: #d9e5e5; color: #0f0f0f; text-decoration: none; "
        "font-size: 14px; font-weight: 700; line-height: 20px; padding: 10px 22px;\">"
        "Скачать XLSX</a></td>"
        "<td align=\"center\" style=\"padding: 6px;\">"
        f"<a href=\"{export_links['docx']}\" "
        "style=\"display: inline-block; min-width: 160px; border-radius: 18px; "
        "background: #d9e5e5; color: #0f0f0f; text-decoration: none; "
        "font-size: 14px; font-weight: 700; line-height: 20px; padding: 10px 22px;\">"
        "Скачать DOCX</a></td>"
        "<td align=\"center\" style=\"padding: 6px;\">"
        f"<a href=\"{export_links['pdf']}\" "
        "style=\"display: inline-block; min-width: 160px; border-radius: 18px; "
        "background: #d9e5e5; color: #0f0f0f; text-decoration: none; "
        "font-size: 14px; font-weight: 700; line-height: 20px; padding: 10px 22px;\">"
        "Скачать PDF</a></td>"
        "</tr></table>"
        "<div style=\"text-align: center;\">"
        f"<a href=\"{unsubscribe_url}\" "
        "style=\"display: inline-block; border-radius: 18px; background: #d9e5e5; "
        "color: #0f0f0f; text-decoration: none; font-size: 14px; font-weight: 700; "
        "line-height: 20px; padding: 10px 22px;\">Отказаться от рассылки</a>"
        "</div>"
        "</td></tr></table>"
        "</td></tr></table>"
        "</body></html>"
    )
    return text_body, html_body
