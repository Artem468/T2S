import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 't2s_backend.settings')
app = Celery('t2s_backend')

app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    task_track_started=True,
    task_compression='gzip',
    result_compression='gzip',
    task_soft_time_limit=30,
    worker_max_memory_per_child=150000,
    broker_transport_options={'visibility_timeout': 43200}
)

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
