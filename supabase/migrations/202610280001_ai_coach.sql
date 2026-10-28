-- Additive only. Never modifies or deletes existing climbing records.
begin;
create table if not exists public.ai_coach_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 settings jsonb not null default '{"enabled":false}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.ai_coach_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_date date not null,
 state text not null check(state in ('processing','ready','failed')),
 input_hash text not null check(length(input_hash)=64),
 settings_snapshot jsonb not null,
 registry_version integer not null,
 draft jsonb,
 model text,
 input_tokens bigint,
 output_tokens bigint,
 error_code text,
 requested_at timestamptz not null default now(),
 finished_at timestamptz
);
create index if not exists ai_coach_user_day on public.ai_coach_requests(user_id,plan_date,requested_at desc);
create index if not exists ai_coach_budget on public.ai_coach_requests(plan_date);
create table if not exists public.ai_coach_adoptions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 proposal_id uuid not null references public.ai_coach_requests(id) on delete cascade,
 workout_plan jsonb not null,
 modified boolean not null,
 adopted_at timestamptz not null default now()
);
alter table public.ai_coach_settings enable row level security;
alter table public.ai_coach_requests enable row level security;
alter table public.ai_coach_adoptions enable row level security;
revoke all on public.ai_coach_settings,public.ai_coach_requests,public.ai_coach_adoptions from anon,authenticated;
grant select on public.ai_coach_settings,public.ai_coach_requests,public.ai_coach_adoptions to authenticated;
grant all on public.ai_coach_settings,public.ai_coach_requests,public.ai_coach_adoptions to service_role;
drop policy if exists "Read own coach settings" on public.ai_coach_settings;
create policy "Read own coach settings" on public.ai_coach_settings for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Read own coach requests" on public.ai_coach_requests;
create policy "Read own coach requests" on public.ai_coach_requests for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Read own coach adoptions" on public.ai_coach_adoptions;
create policy "Read own coach adoptions" on public.ai_coach_adoptions for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.ai_coach_claim(p_user_id uuid,p_request_id uuid,p_day date,p_force boolean,p_hash text,p_settings jsonb,p_registry integer,p_daily integer,p_monthly integer,p_global integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ai_coach_requests%rowtype; n integer; first_day date;
begin
 if p_day<>(now() at time zone 'Asia/Tokyo')::date or p_daily not between 1 and 5 or p_monthly not between 1 and 100 or p_global not between 1 and 1000 then raise exception 'Invalid reservation'; end if;
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
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day and state='ready' order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','cached','request',to_jsonb(r)); end if;
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','existing','request',to_jsonb(r)); end if;
 end if;
 first_day:=date_trunc('month',p_day)::date;
 select count(*) into n from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day;
 if n>=p_daily then return jsonb_build_object('action','limited','code','DAILY_LIMIT'); end if;
 select count(*) into n from public.ai_coach_requests where user_id=p_user_id and plan_date>=first_day and plan_date<first_day+interval '1 month';
 if n>=p_monthly then return jsonb_build_object('action','limited','code','MONTHLY_LIMIT'); end if;
 select count(*) into n from public.ai_coach_requests where plan_date>=first_day and plan_date<first_day+interval '1 month';
 if n>=p_global then return jsonb_build_object('action','limited','code','SERVER_LIMIT'); end if;
 insert into public.ai_coach_requests(id,user_id,plan_date,state,input_hash,settings_snapshot,registry_version)
 values(p_request_id,p_user_id,p_day,'processing',p_hash,p_settings,p_registry) returning * into r;
 return jsonb_build_object('action','created','request',to_jsonb(r));
end $$;
revoke all on function public.ai_coach_claim(uuid,uuid,date,boolean,text,jsonb,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.ai_coach_claim(uuid,uuid,date,boolean,text,jsonb,integer,integer,integer,integer) to service_role;

create or replace function public.ai_coach_finish(p_user_id uuid,p_request_id uuid,p_state text,p_draft jsonb,p_model text,p_input bigint,p_output bigint,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ai_coach_requests%rowtype;
begin
 if p_state not in ('ready','failed') then raise exception 'Invalid result'; end if;
 select * into r from public.ai_coach_requests where id=p_request_id and user_id=p_user_id for update;
 if not found then raise exception 'Request missing'; end if;
 if r.state<>'processing' then return to_jsonb(r); end if;
 if p_state='ready' and not exists(select 1 from public.ai_coach_settings s where s.user_id=p_user_id and s.settings=r.settings_snapshot and s.settings->>'enabled'='true') then
  update public.ai_coach_requests set state='failed',draft=null,error_code='CONSENT_CHANGED',model=left(p_model,100),input_tokens=p_input,output_tokens=p_output,finished_at=now() where id=r.id returning * into r;
 else
  update public.ai_coach_requests set state=p_state,draft=case when p_state='ready' then p_draft else null end,model=left(p_model,100),input_tokens=case when p_input is null then null else greatest(p_input,0) end,output_tokens=case when p_output is null then null else greatest(p_output,0) end,error_code=left(p_error,60),finished_at=now() where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.ai_coach_finish(uuid,uuid,text,jsonb,text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.ai_coach_finish(uuid,uuid,text,jsonb,text,bigint,bigint,text) to service_role;
commit;
