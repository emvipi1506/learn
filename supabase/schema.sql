-- ============================================================================
-- Grimoire — Lược đồ cơ sở dữ liệu Supabase (PostgreSQL + RLS, chạy lại an toàn)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> dán toàn bộ file này và nhấn Run
-- ============================================================================

-- 1. Bảng hồ sơ học viên (1 dòng cho mỗi tài khoản)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Học Giả Mới',
  current_band numeric(2,1) not null default 3.0,
  target_band numeric(2,1) not null default 6.5,
  daily_minutes integer not null default 120,
  xp integer not null default 0,
  level integer not null default 1,
  streak_days integer not null default 1,
  last_study_date date default current_date,
  current_act integer not null default 1,
  placement_completed boolean not null default false,
  skill_bands jsonb not null default '{"listening": 3.0, "reading": 3.0, "writing": 2.5, "speaking": 2.5}'::jsonb,
  saved_vocab_ids jsonb not null default '[]'::jsonb,
  starter_seeded boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Tương thích ngược cho tài khoản đã tạo từ phiên bản lược đồ trước
alter table public.profiles
  add column if not exists saved_vocab_ids jsonb not null default '[]'::jsonb;
alter table public.profiles
  add column if not exists starter_seeded boolean not null default true;

-- 2. Bảng tiến độ bài học theo 4 kỹ năng
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'speaking')),
  score integer not null default 0,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- 3. Bảng thẻ từ vựng SRS (thuật toán SM-2)
create table if not exists public.vocab_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  unique (user_id, word_id)
);

-- 4. Bảng thẻ từ vựng / ngữ pháp người dùng tự thêm (song ngữ EN / KO)
create table if not exists public.custom_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  lang text not null default 'en' check (lang in ('en', 'ko')),
  lesson_num integer,
  word text not null,
  ipa text not null default '',
  romanization text,
  pos text not null default 'từ vựng',
  meaning_vi text not null,
  example_en text not null default '',
  example_vi text not null default '',
  paraphrases jsonb not null default '[]'::jsonb,
  grammar_note_vi text,
  act integer not null default 1,
  topic text not null default 'Bài trên lớp',
  created_at timestamptz not null default now(),
  unique (user_id, word_id)
);

-- 5. Bảng lịch sử bài nộp Writing & Speaking (kèm đánh giá AI nếu có)
create table if not exists public.practice_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('writing', 'speaking')),
  prompt_id text not null,
  prompt_title text not null,
  content text not null,
  band_estimate numeric(2,1),
  ai_feedback jsonb,
  created_at timestamptz not null default now()
);

-- 6. Bảng nhật ký học tập hàng ngày (Daily Quests)
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null default current_date,
  minutes_studied integer not null default 0,
  vocab_reviewed integer not null default 0,
  lessons_completed integer not null default 0,
  completed_quests jsonb not null default '[]'::jsonb,
  unique (user_id, study_date)
);

-- ============================================================================
-- Bật Row Level Security (RLS) — Mỗi người dùng chỉ đọc/ghi dữ liệu của chính mình
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.vocab_cards enable row level security;
alter table public.custom_vocab enable row level security;
alter table public.practice_submissions enable row level security;
alter table public.daily_logs enable row level security;

-- Chính sách cho profiles
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Chính sách cho lesson_progress
drop policy if exists "Users manage own lesson_progress" on public.lesson_progress;
create policy "Users manage own lesson_progress" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chính sách cho vocab_cards
drop policy if exists "Users manage own vocab_cards" on public.vocab_cards;
create policy "Users manage own vocab_cards" on public.vocab_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chính sách cho custom_vocab
drop policy if exists "Users manage own custom_vocab" on public.custom_vocab;
create policy "Users manage own custom_vocab" on public.custom_vocab
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chính sách cho practice_submissions
drop policy if exists "Users manage own practice_submissions" on public.practice_submissions;
create policy "Users manage own practice_submissions" on public.practice_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chính sách cho daily_logs
drop policy if exists "Users manage own daily_logs" on public.daily_logs;
create policy "Users manage own daily_logs" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger tự tạo hồ sơ khi người dùng đăng ký tài khoản mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
