-- Run after 202610280001_ai_coach.sql. Does not alter climbing records or old proposals.
begin;
update public.ai_coach_settings set settings=jsonb_set(settings,'{enabled}','false'::jsonb),updated_at=now()
where settings->>'consentVersion' is distinct from 'gemini-free-2026-10-28-v1';
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
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day and state='ready' and settings_snapshot->>'consentVersion'=p_settings->>'consentVersion' order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','cached','request',to_jsonb(r)); end if;
  select * into r from public.ai_coach_requests where user_id=p_user_id and plan_date=p_day order by requested_at desc limit 1;
  if found then return jsonb_build_object('action','existing','request',to_jsonb(r)); end if;
 end if;
 if exists(select 1 from public.ai_coach_requests where requested_at>now()-interval '60 seconds') then return jsonb_build_object('action','limited','code','RATE_LIMIT'); end if;
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


commit;
