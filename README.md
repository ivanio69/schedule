# Расписание 214Р

Минималистичное расписание для группы 214Р. Пользователи могут переключать день, подгруппу и учебную неделю, а также добавлять общие для всех пользователей репетиции

## MongoDB

Основное расписание и пользовательские репетиции хранятся в MongoDB.

Создайте `.env.local` на основе `.env.example` и укажите:

- `MONGODB_URI` — строка подключения MongoDB Atlas или другого MongoDB-сервера.
- `MONGODB_DB` — имя базы данных, по умолчанию `schedule`.
- `ADMIN_PASSWORD` — пароль для `/admin`.
- `ADMIN_SESSION_SECRET` — секрет для сессии администратора.

После настройки базы исходный `app/table.json` используется только как первоначальный seed, если коллекция расписания ещё пуста. Для явного заполнения базы:

```bash
npm run seed
```

## Разработка

```bash
npm ci
npm run dev
```

Проверки перед коммитом:

```bash
npm run lint
npm run typecheck
npm run build
```

## Структура

- `app/` — Next.js entry points, API routes и глобальные стили.
- `components/` — экран расписания, карточки занятий и репетиций.
- `lib/schedule.ts` — типы и чистые функции работы с расписанием.
- `lib/mongodb.ts` — подключение к MongoDB.
- `lib/database.ts` — операции с расписанием и репетициями.
- `app/table.json` — резервные исходные данные для первоначального seed.

## Seminar topics

The **Семинары** tab (`/seminars`) shows seminar lists grouped by subject and the names of everyone who has selected each topic. Lists start collapsed and expand on click with a smooth transition. Users can claim a free place or cancel their own selection. There is no per-user limit across different topics. Lists refresh every 15 seconds and when the window regains focus or the connection returns.

In **Admin → Семинары**, create a list with a subject, title, one topic per line, and a capacity of one to five people **per topic**. The administrator can replace or clear participants using **Участники**. A stale administrator edit is rejected so it cannot silently overwrite newer bookings.

Lists are stored in the MongoDB `seminars` collection, created on first insert; no migration or additional environment variables are required. Atomic revision checks prevent overbooking and duplicate concurrent claims. Administrator routes use the existing signed admin cookie. Student selection follows the application's existing `schedule_person_id` model (an identity selected by the user, not a verified login).

Run `npm run test:seminars` for integration tests against an isolated, temporary MongoDB instance. The first run downloads a MongoDB binary. The tests never connect to the application's configured database. Validation: `npm run typecheck`, `npm run build` (requires `MONGODB_URI`), and ESLint for changed code.
