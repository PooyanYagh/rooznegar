alter table public.journal_entries add column if not exists sleep_hours numeric;
alter table public.journal_entries add column if not exists jalali_date text;
alter table public.journal_entries add column if not exists milestones text[] not null default '{}';
alter table public.journal_events add column if not exists thoughts text;
alter table public.journal_events add column if not exists emotions text[] not null default '{}';
alter table public.journal_events add column if not exists reflection text;
