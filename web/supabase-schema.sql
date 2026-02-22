-- ============================================
-- てきとー日記 DB Schema
-- Supabase SQL Editor で実行してください
-- ============================================

-- 日記テーブル
create table if not exists diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  display_date text not null,
  original_text text not null,
  formatted_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- コアプロファイル
create table if not exists core_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personality text[] default '{}',
  people text[] default '{}',
  places text[] default '{}',
  work text[] default '{}',
  lifestyle text[] default '{}',
  preferences text[] default '{}',
  updated_at timestamptz default now()
);

-- エピソード記憶
create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  date text not null,
  created_at timestamptz default now()
);

-- ユーザープロファイル（管理用）
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text default '',
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- RLS有効化
alter table diaries enable row level security;
alter table core_profiles enable row level security;
alter table episodes enable row level security;
alter table user_profiles enable row level security;

-- RLSポリシー: ユーザーは自分のデータのみアクセス可能
create policy "Users can view own diaries" on diaries for select using (auth.uid() = user_id);
create policy "Users can insert own diaries" on diaries for insert with check (auth.uid() = user_id);
create policy "Users can update own diaries" on diaries for update using (auth.uid() = user_id);
create policy "Users can delete own diaries" on diaries for delete using (auth.uid() = user_id);

create policy "Users can view own profile" on core_profiles for select using (auth.uid() = user_id);
create policy "Users can upsert own profile" on core_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on core_profiles for update using (auth.uid() = user_id);

create policy "Users can view own episodes" on episodes for select using (auth.uid() = user_id);
create policy "Users can insert own episodes" on episodes for insert with check (auth.uid() = user_id);
create policy "Users can delete own episodes" on episodes for delete using (auth.uid() = user_id);

create policy "Users can view own user_profile" on user_profiles for select using (auth.uid() = id);
create policy "Users can update own user_profile" on user_profiles for update using (auth.uid() = id);

-- 管理者は全ユーザーのuser_profilesを閲覧可能
create policy "Admins can view all user_profiles" on user_profiles for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can update all user_profiles" on user_profiles for update
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can delete all user_profiles" on user_profiles for delete
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- 新規ユーザー登録時に自動でuser_profilesを作成するトリガー
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    case when new.email = 'gamingmokugyo@gmail.com' then 'admin' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- PWA プッシュ通知購読テーブル
-- 既存のDBに追加する場合は以下だけ実行してください
-- ============================================

create table if not exists notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  notify_hour int not null default 21,
  notify_minute int not null default 0,
  created_at timestamptz default now(),
  unique(user_id)
);

alter table notification_subscriptions enable row level security;

-- ユーザーは自分の購読情報のみ操作可能
create policy "Users can manage own notification subscription"
  on notification_subscriptions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
