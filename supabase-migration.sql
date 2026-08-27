alter table public.journal_entries add column if not exists sleep_hours numeric;
alter table public.journal_entries add column if not exists jalali_date text;
alter table public.journal_entries add column if not exists milestones text[] not null default '{}';
alter table public.journal_events add column if not exists thoughts text;
alter table public.journal_events add column if not exists emotions text[] not null default '{}';
alter table public.journal_events add column if not exists reflection text;

-- ثبت ساختارمند روز و اتصال اقدام‌ها به همان روز
alter table public.journal_entries add column if not exists workout text;
alter table public.journal_entries add column if not exists nutrition text;
alter table public.journal_entries add column if not exists deep_work_minutes integer;

alter table public.goals add column if not exists baseline_progress integer not null default 0 check (baseline_progress between 0 and 100);
alter table public.goal_actions add column if not exists entry_id uuid references public.journal_entries(id) on delete cascade;
create unique index if not exists goal_actions_one_per_entry
  on public.goal_actions(goal_id, entry_id) where entry_id is not null;
