-- Additive weather comparison storage. Does not change climbing records or billing.
begin;
create table if not exists public.weather_ai_requests(
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_date date not null,
 state text not null check(state in ('processing','ready','failed')),
 input_hash text not null check(length(input_hash)=64),
 input jsonb not null,
 consent_version text not null,
 result jsonb,
 error_code text,
 requested_at timestamptz not null default now(),
 finished_at timestamptz,
 primary key(user_id,plan_date)
);
alter table public.weather_ai_requests enable row level security;
revoke all on public.weather_ai_requests from public,anon,authenticated;
grant select on public.weather_ai_requests to authenticated;
grant all on public.weather_ai_requests to service_role;
drop policy if exists "Read own weather comparisons" on public.weather_ai_requests;
create policy "Read own weather comparisons" on public.weather_ai_requests for select to authenticated using ((select auth.uid())=user_id);
create index if not exists weather_ai_budget on public.weather_ai_requests(plan_date);
create or replace function public.weather_ai_claim(p_user uuid,p_day date,p_hash text,p_input jsonb,p_consent text,p_monthly integer,p_interval integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.weather_ai_requests%rowtype; n integer; first_day date;
begin
 if p_day<>(now() at time zone 'Asia/Tokyo')::date or p_monthly not between 1 and 30 or p_interval not between 1 and 60 or p_consent<>'weather-gemini-free-2026-10-31-v1' then raise exception 'Invalid reservation'; end if;
 perform pg_advisory_xact_lock(782011,1);
 select * into r from public.weather_ai_requests where user_id=p_user and plan_date=p_day;
 if found then return jsonb_build_object('action','existing','row',to_jsonb(r)); end if;
 if exists(select 1 from public.ai_coach_requests where requested_at>now()-make_interval(mins=>p_interval))
 or exists(select 1 from public.weather_ai_requests where requested_at>now()-make_interval(mins=>p_interval))
 then return jsonb_build_object('action','limited','code','RATE_LIMIT'); end if;
 first_day:=date_trunc('month',p_day)::date;
 select (select count(*) from public.ai_coach_requests where plan_date>=first_day and plan_date<first_day+interval '1 month')+
 (select count(*) from public.weather_ai_requests where plan_date>=first_day and plan_date<first_day+interval '1 month') into n;
 if n>=p_monthly then return jsonb_build_object('action','limited','code','MONTHLY_LIMIT'); end if;
 insert into public.weather_ai_requests(user_id,plan_date,state,input_hash,input,consent_version)
 values(p_user,p_day,'processing',p_hash,p_input,p_consent) returning * into r;
 return jsonb_build_object('action','created','row',to_jsonb(r));
end $$;
revoke all on function public.weather_ai_claim(uuid,date,text,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.weather_ai_claim(uuid,date,text,jsonb,text,integer,integer) to service_role;

-- Shared monthly budget and interval for coach + weather, under the same lock.
create or replace function public.ai_coach_claim_v2(p_user_id uuid,p_request_id uuid,p_day date,p_force boolean,p_hash text,p_settings jsonb,p_registry integer,p_daily integer,p_monthly integer,p_global integer,p_interval_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ai_coach_requests%rowtype; n integer; first_day date;
begin
 if p_day<>(now() at time zone 'Asia/Tokyo')::date or p_daily not between 1 and 5 or p_monthly not between 1 and 100 or p_global not between 1 and 1000 or p_interval_minutes not between 1 and 60 then raise exception 'Invalid reservation'; end if;
 perform pg_advisory_xact_lock(782011,1);
 if not exists(select 1 from public.ai_coach_settings s where s.user_id=p_user_id and s.settings=p_settings and s.settings->>'enabled'='true') then return jsonb_build_object('action','disabled'); end if;
 select * into r from public.ai_coach_requests where id=p_request_id;
 if found then
  if r.user_id<>p_user_id then raise exception 'Operation conflict'; end if;
  return jsonb_build_object('action','existing','request',to_jsonb(r));
 end if;
 update public.ai_coach_requests set state='failed',error_code='INTERRUPTED',finished_at=now() where user_id=p_user_id and state='processing' and requested_at<now()-interval '2 minutes';
 select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day and state='processing' order by requested_at desc limit 1;
 if found then return jsonb_build_object('action','pending','request',to_jsonb(r)); end if;
 if not p_force then
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day and state='ready' and settings_snapshot->>'consentVersion'=p_settings->>'consentVersion' order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','cached','request',to_jsonb(r)); end if;
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','existing','request',to_jsonb(r)); end if;
 end if;
 if exists(select 1 from public.ai_coach_requests where requested_at>now()-make_interval(mins=>p_interval_minutes)) or exists(select 1 from public.weather_ai_requests where requested_at>now()-make_interval(mins=>p_interval_minutes)) then return jsonb_build_object('action','limited','code','RATE_LIMIT'); end if;
 first_day:=date_trunc('month',p_day)::date;
 select count(*) into n from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day;
 if n>=p_daily then return jsonb_build_object('action','limited','code','DAILY_LIMIT'); end if;
 select count(*) into n from public.ai_coach_requests where user_id=p_user_id and plan_date>=first_day and plan_date<first_day+interval '1 month';
 if n>=p_monthly then return jsonb_build_object('action','limited','code','MONTHLY_LIMIT'); end if;
 select (select count(*) from public.ai_coach_requests where plan_date>=first_day and plan_date<first_day+interval '1 month')+(select count(*) from public.weather_ai_requests where plan_date>=first_day and plan_date<first_day+interval '1 month') into n;
 if n>=p_global then return jsonb_build_object('action','limited','code','SERVER_LIMIT'); end if;
 insert into public.ai_coach_requests(id,user_id,plan_date,state,input_hash,settings_snapshot,registry_version)
 values(p_request_id,p_user_id,p_day,'processing',p_hash,p_settings,p_registry) returning * into r;
 return jsonb_build_object('action','created','request',to_jsonb(r));
end $$;
revoke all on function public.ai_coach_claim_v2(uuid,uuid,date,boolean,text,jsonb,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.ai_coach_claim_v2(uuid,uuid,date,boolean,text,jsonb,integer,integer,integer,integer,integer) to service_role;

-- Metadata only; no personal records are returned to the client.
create or replace function public.ai_combined_usage(p_day date)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('count',
  (select count(*) from public.ai_coach_requests where plan_date>=date_trunc('month',p_day)::date and plan_date<date_trunc('month',p_day)::date+interval '1 month')+
  (select count(*) from public.weather_ai_requests where plan_date>=date_trunc('month',p_day)::date and plan_date<date_trunc('month',p_day)::date+interval '1 month'),
  'latestAt',(select max(requested_at) from (select requested_at from public.ai_coach_requests union all select requested_at from public.weather_ai_requests) combined));
$$;
revoke all on function public.ai_combined_usage(date) from public,anon,authenticated;
grant execute on function public.ai_combined_usage(date) to service_role;
commit;
