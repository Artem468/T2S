from django.urls import path

from users.views import EmailMailingCreateView, EmailMailingUnsubscribeView

app_name = "users"

urlpatterns = [
    path("mailings/", EmailMailingCreateView.as_view(), name="mailing-create"),
    path(
        "mailings/unsubscribe/<uuid:token>/",
        EmailMailingUnsubscribeView.as_view(),
        name="mailing-unsubscribe",
    ),
]
