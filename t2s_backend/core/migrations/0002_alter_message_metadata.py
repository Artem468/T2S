from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="message",
            name="metadata",
            field=models.JSONField(
                blank=True,
                default=None,
                null=True,
                verbose_name="Метаданные",
            ),
        ),
    ]
