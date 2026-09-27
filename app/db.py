import os, sqlite3, datetime
from .security import hash_password

DB_PATH = os.environ.get("RTK_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "rtk_crm.db"))
UPLOAD_DIR = os.environ.get("RTK_UPLOADS", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "uploads"))
OUTBOX_DIR = os.environ.get("RTK_OUTBOX", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "outbox"))

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

SCHEMA = [
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','manager','admin')), email TEXT UNIQUE, is_verified INTEGER DEFAULT 0, confirm_token TEXT, phone TEXT DEFAULT '', birth_date TEXT DEFAULT '', city TEXT DEFAULT '', organization TEXT DEFAULT '', position TEXT DEFAULT '', education TEXT DEFAULT '', skills TEXT DEFAULT '', telegram TEXT DEFAULT '', about TEXT DEFAULT '', portfolio TEXT DEFAULT '', avatar TEXT DEFAULT '', last_login_at TEXT DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS universities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, vendor TEXT, software TEXT, contract_number TEXT, license_signed TEXT, license_years TEXT, transfer_status TEXT, manager_name TEXT, uni_responsible TEXT, comment TEXT)",
    "CREATE TABLE IF NOT EXISTS directions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, direction_id INTEGER REFERENCES directions(id), description TEXT DEFAULT '', requirements TEXT DEFAULT '', start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', photo TEXT DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS workflows (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, is_default INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS workflow_statuses (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS interactions (id INTEGER PRIMARY KEY AUTOINCREMENT, university_id INTEGER NOT NULL REFERENCES universities(id), product_id INTEGER REFERENCES products(id), workflow_id INTEGER NOT NULL REFERENCES workflows(id), current_status_id INTEGER REFERENCES workflow_statuses(id), responsible_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS interaction_history (id INTEGER PRIMARY KEY AUTOINCREMENT, interaction_id INTEGER NOT NULL REFERENCES interactions(id) ON DELETE CASCADE, from_status_id INTEGER, from_status_name TEXT, to_status_id INTEGER, to_status_id_name TEXT, to_status_name TEXT, comment TEXT, user_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, direction_id INTEGER REFERENCES directions(id), description TEXT DEFAULT '', requirements TEXT DEFAULT '', start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', photo TEXT DEFAULT '', created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), ip TEXT DEFAULT '', user_agent TEXT DEFAULT '', device TEXT DEFAULT '', os TEXT DEFAULT '', browser TEXT DEFAULT '', is_mobile INTEGER DEFAULT 0, battery INTEGER, duration INTEGER DEFAULT 0, cookies_info TEXT DEFAULT '', cookies_accepted INTEGER DEFAULT 0, last_seen_at TEXT, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), course_id INTEGER REFERENCES courses(id), product_id INTEGER REFERENCES products(id), message TEXT DEFAULT '', status TEXT DEFAULT 'Новая', comment TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, UNIQUE(course_id, user_id))",
    "CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, history_id INTEGER NOT NULL REFERENCES interaction_history(id) ON DELETE CASCADE, filename TEXT NOT NULL, stored_name TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL)",
]

DEFAULT_WORKFLOW = [
    "Поиск контактов ответственного в вузе",
    "Коммуникация и уточнение актуальности программ",
    "Организация встречи с представителями вуза",
    "Обмен пакетом документов для подписания",
    "Корректировка документов перед подписанием",
    "Подписание документов",
    "Передача обучающих материалов, лицензии и документации",
    "Сопровождение внедрения ИТ-продуктов",
    "Обучение преподавателей",
    "Актуализация учебной программы с учетом ИТ-продукта",
    "Ведение занятий",
    "Актуализация документации и обучающих материалов",
    "Повышение квалификации преподавателей",
    "Контроль исполнения",
]

def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    conn = get_conn()
    for stmt in SCHEMA:
        conn.execute(stmt)
    # --- миграция: добавляем колонки email/is_verified/confirm_token в существующие БД ---
    cols = [r[1] for r in conn.execute("PRAGMA table_info(users)")]
    if "email" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "is_verified" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
    # FIX: пользователи, созданные до введения подтверждения e-mail (confirm_token IS NULL),
    # считаются подтверждёнными — иначе вход после обновления БД был невозможен (403)
    conn.execute("UPDATE users SET is_verified=1 WHERE confirm_token IS NULL AND is_verified=0")
    if "confirm_token" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN confirm_token TEXT")
    pcols = [r[1] for r in conn.execute("PRAGMA table_info(products)")]
    for col in ("requirements", "start_date", "end_date", "photo"):
        if col not in pcols:
            conn.execute("ALTER TABLE products ADD COLUMN " + col + " TEXT DEFAULT ''")
    ucols = [r[1] for r in conn.execute("PRAGMA table_info(users)")]
    if "last_login_at" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT ''")
    if "cookie_consent" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN cookie_consent INTEGER DEFAULT 0")
    scols = [r[1] for r in conn.execute("PRAGMA table_info(sessions)")]
    if "cookies_info" not in scols:
        conn.execute("ALTER TABLE sessions ADD COLUMN cookies_info TEXT DEFAULT ''")
    if "cookies_accepted" not in scols:
        conn.execute("ALTER TABLE sessions ADD COLUMN cookies_accepted INTEGER DEFAULT 0")
    acols = [r[1] for r in conn.execute("PRAGMA table_info(applications)")]
    if "product_id" not in acols:
        conn.execute("ALTER TABLE applications ADD COLUMN product_id INTEGER REFERENCES products(id)")
    for col in ("phone", "birth_date", "city", "organization", "position", "education", "skills", "telegram", "about", "portfolio", "avatar"):
        if col not in ucols:
            conn.execute("ALTER TABLE users ADD COLUMN " + col + " TEXT DEFAULT ''")
    has = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    if has:
        conn.commit()
        conn.close()
        return
    # --- seed users ---
    users = [
        ("admin", "Admin123!", "Администратор системы", "admin", "admin@rt.ru"),
        ("manager", "Manager123!", "Марина Ветрова", "manager", "manager@rt.ru"),
        ("kam1", "Kam123!", "Иван Петров", "user", "kam1@rt.ru"),
        ("kam2", "Kam123!", "Ольга Смирнова", "user", "kam2@rt.ru"),
    ]
    for u, p, f, r, e in users:
        conn.execute("INSERT INTO users(username,password_hash,full_name,role,email,is_verified) VALUES(?,?,?,?,?,1)",
                     (u, hash_password(p), f, r, e))
    # --- seed directions ---
    directions = ["DevOps", "QA (тестирование)", "Data Science", "Кибербезопасность"]
    dir_ids = {}
    for d in directions:
        cur = conn.execute("INSERT INTO directions(name) VALUES(?)", (d,))
        dir_ids[d] = cur.lastrowid
    # --- seed products ---
    products = [
        ("CI/CD Pipeline Kit", "DevOps", "Практикум по построению пайплайнов сборки и доставки"),
        ("Kubernetes Learning Lab", "DevOps", "Среда для отработки деплоя в Kubernetes"),
        ("Test Management Suite", "QA (тестирование)", "Управление тест-кейсами и прогонами"),
        ("Автотесты 2.0", "QA (тестирование)", "Фреймворк и методика автоматизации тестирования"),
        ("Data Analysis Workbench", "Data Science", "Аналитические датасеты и тетради Jupyter"),
        ("ML Starter Pack", "Data Science", "Базовый курс машинного обучения"),
        ("SOC Simulator", "Кибербезопасность", "Симулятор мониторинга и реагирования на инциденты"),
    ]
    prod_ids = []
    for name, d, desc in products:
        cur = conn.execute("INSERT INTO products(name,direction_id,description) VALUES(?,?,?)",
                           (name, dir_ids[d], desc))
        prod_ids.append(cur.lastrowid)
    # --- 3 фейковых ИТ-проекта с дедлайнами: > недели / до недели / последний день ---
    today = datetime.date.today()
    demo_projects = [
        ("Облачная платформа: практикум", "DevOps",
         "Развёртывание микросервисов в облаке Ростелекома: IaC, балансировка, автоскейлинг. Финал — защита пилотного стенда.",
         "Студенты 3–4 курсов ИТ, основы Linux и сетей.",
         (today + datetime.timedelta(days=2)).isoformat(), (today + datetime.timedelta(days=14)).isoformat()),
        ("Нейросети в продакшене", "Data Science",
         "Вывод ML-моделей в продакшен: оптимизация, API, мониторинг дрейфа. Включает работу с GPU-контуром.",
         "Студенты с базовым знанием Python и ML.",
         (today - datetime.timedelta(days=3)).isoformat(), (today + datetime.timedelta(days=4)).isoformat()),
        ("Хакатон «Защита данных»", "Кибербезопасность",
         "Соревнование команд по поиску уязвимостей и защите инфраструктуры. Призы от партнёров программы.",
         "Команды 3–5 человек: студенты и школьники старших классов.",
         (today - datetime.timedelta(days=2)).isoformat(), today.isoformat()),
    ]
    for name, d, desc, req, sd, ed in demo_projects:
        conn.execute("INSERT INTO products(name,direction_id,description,requirements,start_date,end_date) VALUES(?,?,?,?,?,?)",
                     (name, dir_ids[d], desc, req, sd, ed))
    # --- seed universities ---
    unis = [
        ("МГУ им. М. В. Ломоносова", "Ростелеком", "GitLab CE", "Д-01/2026", "2026-01-15", "3", "Передано", "Иван Петров", "Проф. Сидоров А. Н.", "Пилотный вуз"),
        ("МФТИ", "Ростелеком", "Kubernetes Learning Lab", "Д-02/2026", "2026-02-01", "2", "В передаче", "Иван Петров", "Доцент Козлов В. И.", ""),
        ("СПбГУ", "Ростелеком", "Test Management Suite", "Д-03/2026", "", "", "Не начато", "Ольга Смирнова", "Канд. техн. наук Орлова М. П.", ""),
        ("УрФУ", "Ростелеком", "Data Analysis Workbench", "Д-04/2026", "2026-03-10", "1", "Передано", "Ольга Смирнова", "Доцент Гусев Д. Р.", ""),
        ("НИУ ВШЭ", "Ростелеком", "ML Starter Pack", "", "", "", "Не начато", "Иван Петров", "Старший преподаватель Лебедева Ю. С.", "Обсуждаем пилот"),
        ("КФУ", "Ростелеком", "SOC Simulator", "", "", "", "Не начато", "Ольга Смирнова", "Проф. Хабибуллин Р. А.", ""),
    ]
    uni_ids = []
    for u in unis:
        cur = conn.execute("INSERT INTO universities(name,vendor,software,contract_number,license_signed,license_years,transfer_status,manager_name,uni_responsible,comment) VALUES(?,?,?,?,?,?,?,?,?,?)", u)
        uni_ids.append(cur.lastrowid)
    # --- default workflow ---
    cur = conn.execute("INSERT INTO workflows(name,is_default) VALUES('Базовый workflow (14 этапов)',1)")
    wf_id = cur.lastrowid
    st_ids = []
    for pos, name in enumerate(DEFAULT_WORKFLOW):
        cur = conn.execute("INSERT INTO workflow_statuses(workflow_id,name,position) VALUES(?,?,?)",
                           (wf_id, name, pos))
        st_ids.append(cur.lastrowid)
    # --- seed interactions with history ---
    seed_inter = [
        (uni_ids[0], prod_ids[0], 3, 3), (uni_ids[0], prod_ids[1], 5, 3),
        (uni_ids[1], prod_ids[1], 8, 3), (uni_ids[2], prod_ids[2], 1, 4),
        (uni_ids[3], prod_ids[4], 10, 4), (uni_ids[4], prod_ids[5], 0, 3),
        (uni_ids[5], prod_ids[6], 2, 4), (uni_ids[1], prod_ids[2], 6, 3),
    ]
    for i, (uni, prod, st_idx, resp) in enumerate(seed_inter):
        ts = now()
        cur = conn.execute(
            "INSERT INTO interactions(university_id,product_id,workflow_id,current_status_id,responsible_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            (uni, prod, wf_id, st_ids[st_idx], resp, ts, ts))
        iid = cur.lastrowid
        for step in range(1, st_idx + 1):
            prev = st_ids[step - 1]
            curh = conn.execute(
                "INSERT INTO interaction_history(interaction_id,from_status_id,from_status_name,to_status_id,to_status_name,comment,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
                (iid, st_ids[step - 2] if step > 1 else None,
                 DEFAULT_WORKFLOW[step - 2] if step > 1 else None,
                 prev, DEFAULT_WORKFLOW[step - 1],
                 "" if step > 1 else "Создано взаимодействие",
                 resp, ts))
    # --- seed курсов: 3 примера с дедлайнами (зелёный/жёлтый/красный) и фото ---
    if conn.execute("SELECT COUNT(*) c FROM courses").fetchone()["c"] == 0:
        ts = now()
        admin_id = conn.execute("SELECT id FROM users WHERE username='admin'").fetchone()["id"]
        dir_dev = conn.execute("SELECT id FROM directions WHERE name='DevOps'").fetchone()
        dir_ds = conn.execute("SELECT id FROM directions WHERE name='Data Science'").fetchone()
        dir_sec = conn.execute("SELECT id FROM directions WHERE name='Кибербезопасность'").fetchone()
        today = datetime.date.today()
        def iso(d):
            return d.isoformat()
        photos = {}
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import numpy as np
            from matplotlib.colors import LinearSegmentedColormap
            specs = [("course_devops.png", "#3B0073", "#7700FF", "DevOps"),
                     ("course_ds.png", "#2E0050", "#9B3DFF", "Data Science"),
                     ("course_sec.png", "#4A0090", "#C080FF", "CYBER")]
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            for fname, c1, c2, label in specs:
                path = os.path.join(UPLOAD_DIR, fname)
                if not os.path.exists(path):
                    fig, ax = plt.subplots(figsize=(6, 3), dpi=100)
                    grad = np.linspace(0, 1, 256).reshape(1, -1)
                    ax.imshow(grad, aspect="auto", cmap=LinearSegmentedColormap.from_list("rt", [c1, c2]), extent=[0, 1, 0, 1])
                    ax.text(0.05, 0.5, label, color="white", fontsize=22, fontweight="bold", va="center")
                    ax.axis("off")
                    fig.savefig(path, bbox_inches="tight", pad_inches=0)
                    plt.close(fig)
                photos[label] = fname
        except Exception:
            photos = {}
        seed_courses = [
            ("DevOps-практикум: от кода до продакшена", dir_dev["id"] if dir_dev else None,
             "Формат: 12 недель, онлайн + воркшопы.\nПрограмма:\n1. Контейнеризация: Docker, docker-compose\n2. CI/CD: GitLab CI, пайплайны сборки и тестов\n3. Kubernetes: поды, деплойменты, сервисы, конфиги\n4. Наблюдаемость: логирование, метрики, алертинг\n5. Финальный проект: развёртывание учебного микросервиса\nРезультат: пет-проект в портфолио и сертификат ИТ Школы.",
             "Кто может участвовать:\n— студенты 3-4 курсов ИТ-направлений;\n— базовые знания Linux и Git (входной тест);\n— группы до 25 человек; приоритет вузам-партнёрам программы «Код будущего».",
             iso(today + datetime.timedelta(days=1)), iso(today + datetime.timedelta(days=14)),
             photos.get("DevOps", "")),
            ("Анализ данных на Python", dir_ds["id"] if dir_ds else None,
             "Формат: 10 недель, вечерний онлайн-формат.\nПрограмма:\n1. Python для аналитики: pandas, numpy\n2. Визуализация: matplotlib, seaborn\n3. Статистика и A/B-тесты на практике\n4. SQL для аналитика\n5. Дипломный проект на реальном датасете ИТ Школы\n6 лабораторных работ с проверкой код-ревьюерами.",
             "Кто может участвовать:\n— студенты и школьники старших классов;\n— уверенное знание основ Python (функции, списки, словари);\n— опыт в Data Science не требуется;\n— нужен ноутбук с доступом в интернет.",
             iso(today - datetime.timedelta(days=2)), iso(today + datetime.timedelta(days=4)),
             photos.get("Data Science", "")),
            ("Хакатон «Киберполигон»", dir_sec["id"] if dir_sec else None,
             "Однодневная командная соревновательная программа.\nЭтапы:\n1. Квалификация: CTF-разбор уязвимостей\n2. Основной раунд: защита инфраструктуры от атак «красной команды»\n3. Финал: питчи команд перед экспертами Ростелекома\nПризовой фонд и приглашения на стажировку финалистам.",
             "Кто может участвовать:\n— команды 3-5 человек: студенты и школьники 10-11 классов;\n— базовое понимание сетей и ОС;\n— регистрация команд до 18:00 дня проведения;\n— у каждого участника подтверждённый профиль в CRM.",
             iso(today - datetime.timedelta(days=1)), iso(today),
             photos.get("CYBER", "")),
        ]
        for t, d, desc, req, sd, ed, photo in seed_courses:
            conn.execute("INSERT INTO courses(title,direction_id,description,requirements,start_date,end_date,photo,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                         (t, d, desc, req, sd, ed, photo, admin_id, ts))
    conn.commit()
    conn.close()
