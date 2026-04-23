# T2S – Преобразование человеческого языка в SQL запросы

Веб-приложение, которое берет вопрос на естественном языке, преобразует его в SQL запрос с помощью нейронной сети, выполняет запрос к базе данных и отображает результаты в интерфейсе

## Структура проекта

```
T2S/
├── t2s_backend/          # Django приложение
│   ├── core/             # Основное приложение с моделями и логикой
│   ├── users/            # Приложение управления пользователями
│   ├── manage.py         # Django команды
│   └── requirements.txt   # Python зависимости
├── t2s_frontend/         # Next.js приложение
│   ├── app/              # Основные страницы
│   └── components/       # React компоненты
├── nginx/                # Конфигурация Nginx
├── docker-compose.yml    # Конфигурация контейнеризации
└── .env                  # Переменные окружения
```

## Компоненты системы

### Backend (Django)

Основной API сервер, предоставляющий REST endpoint и WebSocket соединения

**Основные компоненты:**
- `core` – основная бизнес-логика и модели данных
- `users` – управление пользователями
- WebSocket потребители для real-time обновлений
- Асинхронные задачи через Celery

**Технологии:**
- Django 5.2.8 – веб-фреймворк
- Django REST Framework – REST API
- Channels – WebSocket поддержка
- Celery – асинхронные задачи

### Frontend (Next.js)

Интерфейс для взаимодействия с системой.

**Технологии:**
- Next.js 16.2.4 – React фреймворк
- Tailwind CSS – Библиотека для CSS

### Инфраструктура

**База данных:**
- PostgreSQL 15 – основная реляционная БД
- SQLite – локальная БД для инспекции данных

**Кеш и очереди:**
- Redis 7 – кеш и брокер сообщений для Celery

**Асинхронная обработка:**
- Celery Worker – обработка длительных задач
- Celery Beat – планировщик периодических задач

**Веб-сервер:**
- Nginx – reverse proxy и статические файлы
- Uvicorn – ASGI сервер для Django

## Как запустить

### Требования

- Docker
- Docker Compose

### Пошагово

1. **Клонируйте проект**:
```bash
git clone <repository_url>
cd T2S
```

2. **Создайте файл .env** в корне проекта по примеру:

```bash
# linux
cp .env.example .env
```

```bash
# windows
copy .env.example .env
```

3. **Запустите контейнеры**:
```bash
docker compose up --build -d
```

4. **Откройте приложение**:
- Сайт: http://127.0.0.1/
- API Swagger документация: http://127.0.0.1/swagger/
- Admin панель: http://127.0.0.1/admin/

## Асинхронные задачи

Длительные операции выполняются через Celery. Задачи определены в `core/tasks.py` и `users/tasks.py`

Celery Beat исполняет периодические задачи по расписанию


Просмотреть логи контейнеров:
```bash
docker compose logs -f t2s-django
docker compose logs -f celery
docker compose logs -f t2s-frontend
```

## Остановка приложения

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить тома (базу данных)
docker-compose down -v
```