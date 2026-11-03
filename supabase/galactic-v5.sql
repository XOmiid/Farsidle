alter table galactic_private.matches add column if not exists home_saved boolean not null default false;
alter table galactic_private.matches add column if not exists away_saved boolean not null default false;
create or replace function galactic_private.simulate_v5(p_match uuid,p_start timestamptz,p_second boolean)returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;v3 boolean;play_minutes int[];vars jsonb;home_state jsonb;away_state jsonb;role_pid text;corner_play boolean;keeper_rush boolean;first_added int;second_added int;half_end int;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
 if coalesce((cfg->>'engineVersion')::int,1)>=6 then perform galactic_private.simulate_v6(p_match,p_start,p_second);return;end if;
 v3:=coalesce((cfg->>'engineVersion')::int,1)>=3;

 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 home_state:=m.home_setup;away_state:=m.away_setup;
 hm.formation:=home_state->>'formation';hm.tactic:=home_state->>'tactic';am.formation:=away_state->>'formation';am.tactic:=away_state->>'tactic';
 hl:=home_state->'players';al:=away_state->'players';seed:=r.seed||':v5:'||m.round||':'||m.slot;
 first_added:=2+floor(galactic_private.random_value(seed,9000)*3)::int;second_added:=3+floor(galactic_private.random_value(seed,9001)*4)::int;half_end:=case when p_second then 90+second_added else 45+first_added end;
 if p_second then
  stats:=m.sim_state->'stats';hs:=(m.sim_state->>'hs')::int;aws:=(m.sim_state->>'aws')::int;rh:=m.sim_state->'rh';ra:=m.sim_state->'ra';yellows:=m.sim_state->'yellows';
  hcontrol:=(m.sim_state->>'hcontrol')::numeric;total_control:=(m.sim_state->>'total_control')::numeric;last_play:=45;prev_min:=45;timeline:=m.timeline;off_ms:=floor(extract(epoch from(m.halftime_until-m.started_at))*1000);
 else

 raw:=raw||jsonb_build_array(galactic_private.scene(0,'kickoff','بازی «'||hm.team_name||'» با پیراهن آبی و «'||am.team_name||'» با پیراهن قرمز آغاز شد.',null,hs,aws,stats,rh,ra));
 end if;
 if p_second then raw:=jsonb_build_array(galactic_private.scene(45,'second_half','نیمهٔ دوم آغاز شد؛ تیم‌ها با تصمیم‌های تازه به زمین برگشته‌اند.',null,hs,aws,stats,rh,ra));end if;
 -- Four regular chances and one stoppage-time chance in each half.
 select array_agg(n order by n)into play_minutes from(select 1+floor(galactic_private.random_value(seed,8000+g)*44)::int n from generate_series(1,4)g)q;
 play_minutes:=play_minutes||array[46+floor(galactic_private.random_value(seed,8005)*first_added)::int]||array_fill(0,array[4]);
 select play_minutes||array_agg(n order by n)into play_minutes from(select 46+floor(galactic_private.random_value(seed,8100+g)*44)::int n from generate_series(1,4)g)q;
 play_minutes:=play_minutes||array[91+floor(galactic_private.random_value(seed,8105)*second_added)::int];
 select play_minutes||array_agg(n order by n)into play_minutes from(select 91+floor(galactic_private.random_value(seed,8200+g)*30)::int n from generate_series(1,2)g)q;
 for i in (case when p_second then 10 else 1 end)..(case when p_second then 16 else 5 end)loop
  if i in(5,14)then raw:=raw||jsonb_build_array(galactic_private.scene(case when p_second then 90 else 45 end,'stoppage_time','داور حداقل '||case when p_second then second_added else first_added end||' دقیقه وقت اضافه اعلام می‌کند؛ هنوز فرصت هست.',null,hs,aws,stats,rh,ra)||jsonb_build_object('period',case when p_second then 2 else 1 end,'stoppageBase',case when p_second then 90 else 45 end,'addedMinutes',case when p_second then second_added else first_added end));end if;
  if i=15 then
   if hs<>aws or r.competition='league'then exit;end if;
   raw:=raw||jsonb_build_array(galactic_private.scene(half_end,'full_time',case when hs=aws and r.competition='league'then 'پایان نود دقیقه و وقت‌های تلف‌شده؛ هر تیم یک امتیاز می‌گیرد.'when hs=aws then 'پایان وقت‌های تلف‌شده؛ بازی مساوی است و به وقت اضافه می‌رود.'else 'سوت پایان مسابقه پس از وقت‌های تلف‌شده به صدا درآمد.'end,null,hs,aws,stats,rh,ra));
   extra:=true;last_play:=90;
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'extra_start','وقت اضافه آغاز می‌شود؛ خستگی حالا اهمیت بیشتری دارد.',null,hs,aws,stats,rh,ra));
  end if;
  minute:=play_minutes[i];idx:=i*100;
  h:=galactic_private.profile_v4(hl,cfg,hm.tactic,rh,minute);a:=galactic_private.profile_v4(al,cfg,am.tactic,ra,minute);
  share:=least(.78,greatest(.22,.5+((h->>'midfield')::numeric-(a->>'midfield')::numeric)/180+case hm.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end-case am.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end));
  delta:=minute-last_play;hcontrol:=hcontrol+delta*share;total_control:=total_control+delta;pos_h:=round(100*hcontrol/greatest(total_control,1));
  stats:=jsonb_set(jsonb_set(stats,'{home,possession}',to_jsonb(pos_h)),'{away,possession}',to_jsonb(100-pos_h));
  for j in 0..1 loop
   tactic:=case when j=0 then hm.tactic else am.tactic end;opp_tactic:=case when j=0 then am.tactic else hm.tactic end;
   attempts:=greatest(0,round(delta*9*(case when j=0 then share else 1-share end)*case tactic when 'possession'then 1.15 when 'direct'then .8 when 'low_block'then .8 else 1 end));
   pass_chance:=least(.95,greatest(.5,.62+(case when j=0 then(h->>'passing')::numeric else(a->>'passing')::numeric end)/350-case when opp_tactic='press'then .07 else 0 end-case when tactic='direct'then .1 else 0 end));
   complete:=least(attempts,greatest(0,round(attempts*(pass_chance+(galactic_private.random_value(seed,idx+70+j)-.5)*.05))));
   stats:=galactic_private.stat_add(galactic_private.stat_add(stats,j,'passes',attempts),j,'passesCompleted',complete);
   -- Every counted foul has a narrated whistle; there are no invisible card/foul events.
  end loop;last_play:=minute;
  -- A counterattack can create danger without requiring possession superiority.
  chance:=share;if hm.tactic='counter'and share<.5 then chance:=chance+.06;end if;if am.tactic='counter'and share>.5 then chance:=chance-.06;end if;
  side:=case when galactic_private.random_value(seed,idx+1)<chance then 0 else 1 end;
  if side=0 then attackers:=hl;defenders:=al;ar:=rh;dr:=ra;tactic:=hm.tactic;opp_tactic:=am.tactic;team_name:=hm.team_name;attack_power:=(h->>'attack')::numeric;def_power:=(a->>'defence')::numeric;keeper_skill:=(a->>'goalkeeping')::numeric;else attackers:=al;defenders:=hl;ar:=ra;dr:=rh;tactic:=am.tactic;opp_tactic:=hm.tactic;team_name:=am.team_name;attack_power:=(a->>'attack')::numeric;def_power:=(h->>'defence')::numeric;keeper_skill:=(h->>'goalkeeping')::numeric;end if;
  path:=case tactic when 'wide'then case when galactic_private.random_value(seed,idx+95)<.65 then 'cross'else 'cutback'end when 'central'then 'central'when 'long_shots'then 'long'when 'counter'then 'through'when 'direct'then 'direct'when 'possession'then 'central'else(array['cross','central','through','long'])[1+floor(galactic_private.random_value(seed,idx+2)*4)::int]end;
  if v3 and galactic_private.random_value(seed,idx+80)<.3 then path:=(array['cross','central','through','long','dribble','cutback'])[1+floor(galactic_private.random_value(seed,idx+81)*6)::int];end if;
  creator:=galactic_private.actor_v4(attackers,case when path='cross'then 'cross'else 'creator'end,seed,idx+10,ar);
  corner_play:=false;keeper_rush:=false;
  shooter:=galactic_private.actor_v4(attackers,case when path='long'then 'long'else 'shooter'end,seed,idx+20,ar);
  if shooter->>'id'=creator->>'id'and path not in('long','dribble')then shooter:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>creator->>'id'),'shooter',seed,idx+21,ar);end if;
  defender:=galactic_private.actor_v4(defenders,'defender',seed,idx+30,dr);
  if galactic_private.random_value(seed,idx+96)<(case when tactic='wide'then .34 else .23 end)then
   corner_play:=true;path:='cross';shooter:=galactic_private.actor_v4(attackers,'corner',seed,idx+97,ar);
   if shooter->>'id'=creator->>'id'then creator:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>shooter->>'id'),'creator',seed,idx+98,ar);end if;
  end if;
  wing:=case when creator->>'role'in('RW','RB')then 'راست'else 'چپ'end;target_name:=shooter->>'name';
  txt:=case path when 'cross'then '«'||team_name||'» از سمت '||wing||' پیش می‌آید؛ فضای خطرناکی کنار محوطه باز شده است.'when 'long'then '«'||team_name||'» پشت محوطه توپ را می‌چرخاند؛ شاید فرصت شوت از دور فراهم شود.'when 'through'then '«'||team_name||'» توپ را پس گرفته؛ پشت دفاع حریف فضای خالی دیده می‌شود.'when 'direct'then '«'||team_name||'» بازی را سریع به جلو می‌برد؛ یک پاس بلند به سمت خط حمله.'else '«'||team_name||'» به مرکز دفاع نزدیک می‌شود؛ چند پاس کوتاه و حرکت بین خطوط.'end;
  vars:=jsonb_build_object('team',team_name,'creator',creator->>'name','target',target_name,'defender',defender->>'name','wing',wing);
  if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+82,'build_up',path,vars),txt);end if;
  seq:=jsonb_build_array(galactic_private.scene(minute,'build_up',txt,side,hs,aws,stats,rh,ra));
  if corner_play then
   stats:=galactic_private.stat_add(stats,side,'corners');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_won',(defender->>'name')||' توپ را از خط عرضی بیرون می‌زند؛ کرنر برای «'||team_name||'». '||target_name||' برای حمله به ارسال جلو می‌آید.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery',(creator->>'name')||' کرنر را ارسال می‌کند؛ '||target_name||' برای ضربهٔ سر با مدافع رقابت می‌کند.',side,hs,aws,stats,rh,ra));
  elsif v3 and galactic_private.random_value(seed,idx+83)<.09 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_rush','دروازه‌بان از دروازه خارج می‌شود؛ '||target_name||' به توپ نزدیک شده و باید سریع تصمیم بگیرد...',side,hs,aws,stats,rh,ra));keeper_rush:=true;path:='through';
  elsif galactic_private.random_value(seed,idx+3)<.19 then
   -- The foul, referee decision, kick and outcome are separate reveals.
   fouler:=defender;stats:=galactic_private.stat_add(stats,1-side,'fouls');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'foul',(fouler->>'name')||' برای متوقف کردن حرکت وارد می‌شود؛ بازیکن روی زمین است و داور سوت می‌زند.',side,hs,aws,stats,rh,ra));
   second_yellow:=coalesce((yellows->>(fouler->>'id'))::int,0)>0;
   red:=galactic_private.random_value(seed,idx+4)<.055;yellow:=not red and galactic_private.random_value(seed,idx+5)<(.48+case when opp_tactic='press'then .13 else 0 end+(75-galactic_private.skill(fouler,'discipline',70))/250);
   if yellow then stats:=galactic_private.stat_add(stats,1-side,'yellowCards');yellows:=jsonb_set(yellows,array[fouler->>'id'],to_jsonb(coalesce((yellows->>(fouler->>'id'))::int,0)+1));end if;
   if yellow and second_yellow then red:=true;end if;
   if red then
    stats:=galactic_private.stat_add(stats,1-side,'redCards');if side=0 then ra:=ra||jsonb_build_array(fouler->>'id');dr:=ra;else rh:=rh||jsonb_build_array(fouler->>'id');dr:=rh;end if;
    txt:=(fouler->>'name')||case when yellow then ' کارت زرد دوم را می‌گیرد؛ اخراج! تیمش از این لحظه یک نفر کمتر دارد.'else ' کارت قرمز مستقیم می‌گیرد؛ تیمش از این لحظه یک نفر کمتر دارد.'end;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'red_card',txt,side,hs,aws,stats,rh,ra));
   elsif yellow then seq:=seq||jsonb_build_array(galactic_private.scene(minute,'yellow_card',(fouler->>'name')||' با کارت زرد داور روبه‌رو می‌شود.',side,hs,aws,stats,rh,ra));end if;
   path:=case when galactic_private.random_value(seed,idx+6)<.28 then 'penalty_kick'else 'free_kick'end;
   role_pid:=case when side=0 then home_state else away_state end#>>array['roles',case when path='penalty_kick'then 'penalty'else 'freeKick'end];
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,case when path='penalty_kick'then 'penalties'else 'freeKicks'end)desc,p->>'id'limit 1;
   target_name:=shooter->>'name';
   if path='penalty_kick'then stats:=galactic_private.stat_add(stats,side,'penalties');txt:='داور به نقطهٔ پنالتی اشاره می‌کند؛ '||target_name||' پشت توپ قرار می‌گیرد.';
   else txt:='ضربهٔ آزاد در موقعیتی مناسب؛ '||target_name||' توپ را تنظیم می‌کند و به دروازه نگاه می‌کند.';end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,path,txt,side,hs,aws,stats,rh,ra));
  else

   txt:=case path when 'cross'then (creator->>'name')||' از کناره عبور می‌کند و توپ را به محوطه می‌فرستد؛ '||target_name||' برای ضربهٔ سر آماده می‌شود.'when 'long'then target_name||' پشت محوطه صاحب توپ می‌شود، سرش را بالا می‌آورد و برای شوت آماده می‌شود.'when 'through'then (creator->>'name')||' توپ را به فضای پشت دفاع می‌فرستد؛ '||target_name||' با سرعت به سمت توپ می‌رود.'when 'direct'then target_name||' با مدافع برای توپ بلند درگیر می‌شود و تلاش می‌کند آن را کنترل کند.'else (creator->>'name')||' پاس رو به جلو را می‌فرستد؛ '||target_name||' بین مدافعان برای کنترل توپ حرکت می‌کند.'end;
   if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+84,'action',path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'action',txt,side,hs,aws,stats,rh,ra));
  end if;
   actor_fit:=coalesce((shooter->>'fit')::numeric,1)*coalesce((shooter#>>'{chemistry,factor}')::numeric,1);
   actor_fit:=actor_fit*greatest(.55,1-(cfg#>>array['tactics',tactic,'fatigue'])::numeric*greatest(0,minute-coalesce((shooter->>'joinedMinute')::int,0))/90*(1.3-galactic_private.skill(shooter,'stamina')/180));
   on_prob:=.55+(galactic_private.skill(shooter,'shooting')*actor_fit-70)/350;goal_prob:=.29+(attack_power-def_power)/330+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/240;
   if path='cross'then
    aerial_diff:=galactic_private.aerial(shooter)*actor_fit-galactic_private.aerial(defender)*coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
    on_prob:=.54+aerial_diff/220;goal_prob:=.31+aerial_diff/145+(galactic_private.skill(creator,'crossing')-75)/400+(attack_power-def_power)/500+(75-keeper_skill)/300;
   elsif path='long'then on_prob:=.38+(galactic_private.skill(shooter,'longShots')*actor_fit-70)/300;goal_prob:=.16+(galactic_private.skill(shooter,'longShots')*actor_fit-keeper_skill)/250;
   elsif path='through'then goal_prob:=goal_prob+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/350;
   elsif path='direct'then on_prob:=on_prob+(galactic_private.skill(shooter,'physical')-galactic_private.skill(defender,'physical'))/400;
   elsif path='free_kick'then on_prob:=.4+(galactic_private.skill(shooter,'freeKicks')-70)/300;goal_prob:=.23+(galactic_private.skill(shooter,'freeKicks')-keeper_skill)/280;
   elsif path='penalty_kick'then on_prob:=.91;goal_prob:=.82+(galactic_private.skill(shooter,'penalties')*actor_fit-keeper_skill)/300;end if;
   on_prob:=least(.94,greatest(.15,on_prob));goal_prob:=least(.9,greatest(.05,goal_prob));
   goal_prob:=case when path='penalty_kick'then goal_prob else least(.72,greatest(.24,.41+(on_prob-.55)*.25+(goal_prob-.29)*.35))end;
   if keeper_rush then goal_prob:=least(.72,greatest(.24,goal_prob+(galactic_private.skill(shooter,'composure')*actor_fit-keeper_skill)/500));end if;
   goal:=galactic_private.random_value(seed,idx+50)<goal_prob;on_target:=goal or galactic_private.random_value(seed,idx+51)<.6;
   stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   if goal then kind:='goal';if side=0 then hs:=hs+1;else aws:=aws+1;end if;txt:=case when keeper_rush then target_name||' توپ را از کنار دروازه‌بان عبور می‌دهد... گل! دروازه‌بان به توپ نمی‌رسد!'when path='cross'then target_name||' با ضربهٔ سر می‌زند... گل! توپ درون دروازه است!'when path='penalty_kick'then target_name||' به توپ ضربه می‌زند... گل! پنالتی تبدیل به گل شد.'when path='free_kick'then target_name||' از روی دیوار دفاعی می‌زند... گل! ضربهٔ آزاد به تور می‌رسد.'when path='long'then target_name||' از راه دور شوت می‌زند... گل! یک ضربهٔ تماشایی!'else target_name||' ضربه را می‌زند... گل! توپ به تور دروازه می‌رسد!'end;
   elsif on_target then kind:='save';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... دروازه‌بان توپ را مهار می‌کند!'else ' ضربه می‌زند... دروازه‌بان با واکنش به‌موقع مانع گل می‌شود!'end;
   elsif galactic_private.random_value(seed,idx+52)<.23 then kind:='woodwork';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... اوه! توپ به تیر دروازه می‌خورد و برمی‌گردد!'else ' شوت می‌زند... اوه! توپ به تیر دروازه برخورد می‌کند!'end;
   else kind:='miss';txt:=target_name||case when path='penalty_kick'then ' به توپ ضربه می‌زند... پنالتی بیرون می‌رود! چه فرصتی از دست رفت.'when path='cross'then ' برای ضربهٔ سر بلند می‌شود... توپ از بالای دروازه عبور می‌کند.'else ' ضربه می‌زند... توپ از کنار دروازه می‌گذرد.'end;end if;
   if v3 and not keeper_rush and path not in('penalty_kick','free_kick')then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+94,kind,path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
  seq_hold:=8000;
  for e in select value from jsonb_array_elements(seq)loop raw:=raw||jsonb_build_array(e||jsonb_build_object('holdMs',greatest(seq_hold,least(12000,2000+char_length(e->>'text')*35)),'sequence',i,'dangerous',true,'period',case when extra then 3 when p_second then 2 else 1 end,'stoppageBase',case when i=5 then 45 when i=14 then 90 end));end loop;
 end loop;
 if p_second then
 if extra then raw:=raw||jsonb_build_array(galactic_private.scene(120,'extra_end',case when hs=aws then 'وقت اضافه هم با تساوی تمام شد؛ پنالتی‌ها برنده را تعیین می‌کنند.'else 'پایان وقت اضافه.'end,null,hs,aws,stats,rh,ra));end if;
 if hs=aws and r.competition='cup' then
  for i in 1..30 loop
   for side in 0..1 loop
    attackers:=case when side=0 then hl else al end;ar:=case when side=0 then rh else ra end;
    role_pid:=(case when side=0 then home_state else away_state end)#>>'{roles,penalty}';
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,'penalties')desc,p->>'id'offset((i-1)%(11-jsonb_array_length(ar)))limit 1;
    keeper_skill:=case when side=0 then(a->>'goalkeeping')::numeric else(h->>'goalkeeping')::numeric end;
    goal:=galactic_private.random_value(seed,4000+i*2+side)<least(.92,greatest(.45,.76+(galactic_private.skill(shooter,'penalties')-keeper_skill)/400));
    if i=30 and side=1 then goal:=(hp=ap);end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_setup',(shooter->>'name')||' برای پنالتی پشت توپ قرار می‌گیرد؛ نگاه‌ها به دروازه است.',side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',8000));
    if side=0 then ht:=ht+1;if goal then hp:=hp+1;end if;else ataken:=ataken+1;if goal then ap:=ap+1;end if;end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_kick',(shooter->>'name')||case when goal then ' ضربه می‌زند... گل!'else ' ضربه می‌زند... پنالتی از دست می‌رود!'end,side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',8000));
    if ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht))then exit;end if;
   end loop;
   if(ht=ataken and ht>=5 and hp<>ap)or(ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht)))then exit;end if;
  end loop;winner:=case when hp>ap then hm.id else am.id end;penalties:=jsonb_build_object('home',hp,'away',ap);
 else winner:=case when hs>aws then hm.id when aws>hs then am.id end;end if;
 raw:=raw||jsonb_build_array(galactic_private.scene(case when extra then 120 else half_end end,'final',case when winner is null then 'مسابقه با تساوی تمام شد؛ هر تیم یک امتیاز می‌گیرد.'else '«'||case when winner=hm.id then hm.team_name else am.team_name end||'» برندهٔ مسابقه شد.'end,null,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',case when penalties is not null then hp end,'penaltyAway',case when penalties is not null then ap end));
 else
 raw:=raw||jsonb_build_array(galactic_private.scene(half_end,'halftime','پایان نیمهٔ اول؛ دو دقیقه برای تغییر آرایش، تاکتیک و حداکثر پنج تعویض.',null,hs,aws,stats,rh,ra)||jsonb_build_object('holdMs',120000,'period',1,'stoppageBase',45));
 end if;
 for e in select value from jsonb_array_elements(raw)loop
  if e->>'kind'in('extra_start','second_half')then prev_min:=(e->>'minute')::int;end if;
  if p_second and(e->>'kind'='full_time'or(not extra and e->>'kind'='final'))then e:=e||jsonb_build_object('period',2,'stoppageBase',90);end if;
  off_ms:=off_ms+greatest(0,(e->>'minute')::int-prev_min)*800;hold:=coalesce((e->>'holdMs')::int,8000);
  timeline:=timeline||jsonb_build_array((e-'holdMs')||jsonb_build_object('atMs',off_ms,'untilMs',off_ms+hold));off_ms:=off_ms+hold;prev_min:=(e->>'minute')::int;
 end loop;
 if not p_second then
  update galactic_private.matches set halftime_at=p_start+(off_ms-120000)*interval '1 millisecond',halftime_until=p_start+off_ms*interval '1 millisecond',stage='first',sim_state=jsonb_build_object('stats',stats,'hs',hs,'aws',aws,'rh',rh,'ra',ra,'yellows',yellows,'hcontrol',hcontrol,'total_control',total_control)where id=p_match;
 else update galactic_private.matches set stage='second'where id=p_match;end if;
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',5)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;

revoke execute on all functions in schema galactic_private from public,anon,authenticated;

create or replace function galactic_private.simulate_v4(p_match uuid,p_start timestamptz,p_second boolean)returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;def_fit numeric;progress boolean;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;half boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;v3 boolean;play_minutes int[];vars jsonb;overturned boolean;home_state jsonb;away_state jsonb;role_pid text;corner_play boolean;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
 if coalesce((cfg->>'engineVersion')::int,1)>=5 then perform galactic_private.simulate_v5(p_match,p_start,p_second);return;end if;
 v3:=coalesce((cfg->>'engineVersion')::int,1)>=3;

 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 home_state:=m.home_setup;away_state:=m.away_setup;
 hm.formation:=home_state->>'formation';hm.tactic:=home_state->>'tactic';am.formation:=away_state->>'formation';am.tactic:=away_state->>'tactic';
 hl:=home_state->'players';al:=away_state->'players';seed:=r.seed||':v4:'||m.round||':'||m.slot;
 if p_second then
  stats:=m.sim_state->'stats';hs:=(m.sim_state->>'hs')::int;aws:=(m.sim_state->>'aws')::int;rh:=m.sim_state->'rh';ra:=m.sim_state->'ra';yellows:=m.sim_state->'yellows';
  hcontrol:=(m.sim_state->>'hcontrol')::numeric;total_control:=(m.sim_state->>'total_control')::numeric;last_play:=45;prev_min:=45;half:=true;timeline:=m.timeline;off_ms:=floor(extract(epoch from(m.halftime_until-m.started_at))*1000);
 else

 raw:=raw||jsonb_build_array(galactic_private.scene(0,'kickoff','بازی «'||hm.team_name||'» با پیراهن آبی و «'||am.team_name||'» با پیراهن قرمز آغاز شد.',null,hs,aws,stats,rh,ra));
 end if;
 if p_second then raw:=jsonb_build_array(galactic_private.scene(45,'second_half','نیمهٔ دوم آغاز شد؛ تیم‌ها با تصمیم‌های تازه به زمین برگشته‌اند.',null,hs,aws,stats,rh,ra));end if;
 -- Independent draws, sorted chronologically: clustered chances, quiet spells and late drama.
 select array_agg(n order by n)into play_minutes from(select 1+floor(galactic_private.random_value(seed,8000+g)*45)::int n from generate_series(1,9)g)q;
 select play_minutes||array_agg(n order by n)into play_minutes from(select 46+floor(galactic_private.random_value(seed,8000+g)*45)::int n from generate_series(10,18)g)q;
 select play_minutes||array_agg(n order by n)into play_minutes from(select 91+floor(galactic_private.random_value(seed,8100+g)*30)::int n from generate_series(1,6)g)q;
 for i in (case when p_second then 10 else 1 end)..(case when p_second then 24 else 9 end) loop
  if i=19 then
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'full_time',case when hs=aws and r.competition='league'then 'نود دقیقه با تساوی تمام شد؛ هر تیم یک امتیاز می‌گیرد.'when hs=aws then 'سوت پایان نود دقیقه؛ بازی مساوی است و به وقت اضافه می‌رود.'else 'سوت پایان نود دقیقه به صدا درآمد.'end,null,hs,aws,stats,rh,ra));
   if hs<>aws or r.competition='league' then exit;end if;extra:=true;
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'extra_start','وقت اضافه آغاز می‌شود؛ خستگی حالا اهمیت بیشتری دارد.',null,hs,aws,stats,rh,ra));
  end if;
  minute:=case when v3 then play_minutes[i] when i<=18 then floor(i*90.0/19)::int else 90+(i-18)*4 end;idx:=i*100;
  if not half and minute>=45 then raw:=raw||jsonb_build_array(galactic_private.scene(45,'halftime','پایان نیمهٔ اول؛ دو تیم برای نیمهٔ دوم آماده می‌شوند.',null,hs,aws,stats,rh,ra));half:=true;end if;
  h:=galactic_private.profile_v4(hl,cfg,hm.tactic,rh,minute);a:=galactic_private.profile_v4(al,cfg,am.tactic,ra,minute);
  share:=least(.78,greatest(.22,.5+((h->>'midfield')::numeric-(a->>'midfield')::numeric)/180+case hm.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end-case am.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end));
  delta:=minute-last_play;hcontrol:=hcontrol+delta*share;total_control:=total_control+delta;pos_h:=round(100*hcontrol/greatest(total_control,1));
  stats:=jsonb_set(jsonb_set(stats,'{home,possession}',to_jsonb(pos_h)),'{away,possession}',to_jsonb(100-pos_h));
  for j in 0..1 loop
   tactic:=case when j=0 then hm.tactic else am.tactic end;opp_tactic:=case when j=0 then am.tactic else hm.tactic end;
   attempts:=greatest(0,round(delta*9*(case when j=0 then share else 1-share end)*case tactic when 'possession'then 1.15 when 'direct'then .8 when 'low_block'then .8 else 1 end));
   pass_chance:=least(.95,greatest(.5,.62+(case when j=0 then(h->>'passing')::numeric else(a->>'passing')::numeric end)/350-case when opp_tactic='press'then .07 else 0 end-case when tactic='direct'then .1 else 0 end));
   complete:=least(attempts,greatest(0,round(attempts*(pass_chance+(galactic_private.random_value(seed,idx+70+j)-.5)*.05))));
   stats:=galactic_private.stat_add(galactic_private.stat_add(stats,j,'passes',attempts),j,'passesCompleted',complete);
   -- Every counted foul has a narrated whistle; there are no invisible card/foul events.
  end loop;last_play:=minute;
  -- A counterattack can create danger without requiring possession superiority.
  chance:=share;if hm.tactic='counter'and share<.5 then chance:=chance+.06;end if;if am.tactic='counter'and share>.5 then chance:=chance-.06;end if;
  side:=case when galactic_private.random_value(seed,idx+1)<chance then 0 else 1 end;
  if side=0 then attackers:=hl;defenders:=al;ar:=rh;dr:=ra;tactic:=hm.tactic;opp_tactic:=am.tactic;team_name:=hm.team_name;attack_power:=(h->>'attack')::numeric;def_power:=(a->>'defence')::numeric;keeper_skill:=(a->>'goalkeeping')::numeric;else attackers:=al;defenders:=hl;ar:=ra;dr:=rh;tactic:=am.tactic;opp_tactic:=hm.tactic;team_name:=am.team_name;attack_power:=(a->>'attack')::numeric;def_power:=(h->>'defence')::numeric;keeper_skill:=(h->>'goalkeeping')::numeric;end if;
  path:=case tactic when 'wide'then case when galactic_private.random_value(seed,idx+95)<.65 then 'cross'else 'cutback'end when 'central'then 'central'when 'long_shots'then 'long'when 'counter'then 'through'when 'direct'then 'direct'when 'possession'then 'central'else(array['cross','central','through','long'])[1+floor(galactic_private.random_value(seed,idx+2)*4)::int]end;
  if v3 and galactic_private.random_value(seed,idx+80)<.3 then path:=(array['cross','central','through','long','dribble','cutback'])[1+floor(galactic_private.random_value(seed,idx+81)*6)::int];end if;
  creator:=galactic_private.actor_v4(attackers,case when path='cross'then 'cross'else 'creator'end,seed,idx+10,ar);
  corner_play:=false;
  shooter:=galactic_private.actor_v4(attackers,case when path='long'then 'long'else 'shooter'end,seed,idx+20,ar);
  if shooter->>'id'=creator->>'id'and path not in('long','dribble')then shooter:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>creator->>'id'),'shooter',seed,idx+21,ar);end if;
  defender:=galactic_private.actor_v4(defenders,'defender',seed,idx+30,dr);
  if galactic_private.random_value(seed,idx+96)<(case when tactic='wide'then .34 else .23 end)then
   corner_play:=true;path:='cross';shooter:=galactic_private.actor_v4(attackers,'corner',seed,idx+97,ar);
   if shooter->>'id'=creator->>'id'then creator:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>shooter->>'id'),'creator',seed,idx+98,ar);end if;
  end if;
  wing:=case when creator->>'role'in('RW','RB')then 'راست'else 'چپ'end;target_name:=shooter->>'name';
  txt:=case path when 'cross'then '«'||team_name||'» از سمت '||wing||' پیش می‌آید؛ فضای خطرناکی کنار محوطه باز شده است.'when 'long'then '«'||team_name||'» پشت محوطه توپ را می‌چرخاند؛ شاید فرصت شوت از دور فراهم شود.'when 'through'then '«'||team_name||'» توپ را پس گرفته؛ پشت دفاع حریف فضای خالی دیده می‌شود.'when 'direct'then '«'||team_name||'» بازی را سریع به جلو می‌برد؛ یک پاس بلند به سمت خط حمله.'else '«'||team_name||'» به مرکز دفاع نزدیک می‌شود؛ چند پاس کوتاه و حرکت بین خطوط.'end;
  vars:=jsonb_build_object('team',team_name,'creator',creator->>'name','target',target_name,'defender',defender->>'name','wing',wing);
  if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+82,'build_up',path,vars),txt);end if;
  seq:=jsonb_build_array(galactic_private.scene(minute,'build_up',txt,side,hs,aws,stats,rh,ra));
  if corner_play then
   stats:=galactic_private.stat_add(stats,side,'corners');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_won',(defender->>'name')||' توپ را از خط عرضی بیرون می‌زند؛ کرنر برای «'||team_name||'».',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_setup',target_name||' برای کمک به حمله از جایگاه '||(shooter->>'role')||' جلو آمده؛ '||(creator->>'name')||' پشت توپ می‌ایستد.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery',(creator->>'name')||' کرنر را ارسال می‌کند؛ '||target_name||' برای ضربهٔ سر با مدافع رقابت می‌کند.',side,hs,aws,stats,rh,ra));progress:=true;
  elsif v3 and galactic_private.random_value(seed,idx+83)<.09 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' برای رسیدن به پاس عمقی سرعت می‌گیرد؛ دروازه‌بان هم جلو آمده است.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_sweep','پاس پشت دفاع می‌افتد؛ دروازه‌بان از محوطه بیرون می‌آید و پیش از '||target_name||' توپ را دور می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif galactic_private.random_value(seed,idx+3)<.19 then
   -- The foul, referee decision, kick and outcome are separate reveals.
   fouler:=defender;stats:=galactic_private.stat_add(stats,1-side,'fouls');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'foul',(fouler->>'name')||' برای متوقف کردن حرکت وارد می‌شود؛ بازیکن روی زمین است و داور سوت می‌زند.',side,hs,aws,stats,rh,ra));
   second_yellow:=coalesce((yellows->>(fouler->>'id'))::int,0)>0;
   red:=galactic_private.random_value(seed,idx+4)<.055;yellow:=not red and galactic_private.random_value(seed,idx+5)<(.48+case when opp_tactic='press'then .13 else 0 end+(75-galactic_private.skill(fouler,'discipline',70))/250);
   if yellow then stats:=galactic_private.stat_add(stats,1-side,'yellowCards');yellows:=jsonb_set(yellows,array[fouler->>'id'],to_jsonb(coalesce((yellows->>(fouler->>'id'))::int,0)+1));end if;
   if yellow and second_yellow then red:=true;end if;
   if red then
    stats:=galactic_private.stat_add(stats,1-side,'redCards');if side=0 then ra:=ra||jsonb_build_array(fouler->>'id');dr:=ra;else rh:=rh||jsonb_build_array(fouler->>'id');dr:=rh;end if;
    txt:=(fouler->>'name')||case when yellow then ' کارت زرد دوم را می‌گیرد؛ اخراج! تیمش از این لحظه یک نفر کمتر دارد.'else ' کارت قرمز مستقیم می‌گیرد؛ تیمش از این لحظه یک نفر کمتر دارد.'end;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'red_card',txt,side,hs,aws,stats,rh,ra));
   elsif yellow then seq:=seq||jsonb_build_array(galactic_private.scene(minute,'yellow_card',(fouler->>'name')||' با کارت زرد داور روبه‌رو می‌شود.',side,hs,aws,stats,rh,ra));end if;
   path:=case when galactic_private.random_value(seed,idx+6)<.28 then 'penalty_kick'else 'free_kick'end;
   role_pid:=case when side=0 then home_state else away_state end#>>array['roles',case when path='penalty_kick'then 'penalty'else 'freeKick'end];
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,case when path='penalty_kick'then 'penalties'else 'freeKicks'end)desc,p->>'id'limit 1;
   target_name:=shooter->>'name';
   if path='penalty_kick'then stats:=galactic_private.stat_add(stats,side,'penalties');txt:='داور به نقطهٔ پنالتی اشاره می‌کند؛ '||target_name||' پشت توپ قرار می‌گیرد.';
   else txt:='ضربهٔ آزاد در موقعیتی مناسب؛ '||target_name||' توپ را تنظیم می‌کند و به دروازه نگاه می‌کند.';end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,path,txt,side,hs,aws,stats,rh,ra));progress:=true;
  elsif galactic_private.random_value(seed,idx+7)<.07 and path in('through','direct')then
   stats:=galactic_private.stat_add(stats,side,'offsides');seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' پشت مدافعان حرکت می‌کند؛ پاس رو به جلو ارسال می‌شود.',side,hs,aws,stats,rh,ra));seq:=seq||jsonb_build_array(galactic_private.scene(minute,'offside','پرچم کمک‌داور بالا رفته است؛ حرکت آفساید بود.',side,hs,aws,stats,rh,ra));progress:=false;
  else
   actor_fit:=coalesce((creator->>'fit')::numeric,1)*coalesce((creator#>>'{chemistry,factor}')::numeric,1);def_fit:=coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
   chance:=least(.96,greatest(.32,.78+(galactic_private.skill(creator,case when path='cross'then 'crossing'else 'passing'end)*actor_fit-galactic_private.skill(defender,'defending')*def_fit)/250));
   if path='dribble'then chance:=least(.92,greatest(.25,.65+(galactic_private.skill(shooter,'dribbling')*coalesce((shooter->>'fit')::numeric,1)-galactic_private.skill(defender,'defending')*def_fit)/180));end if;
   if path='cutback'then chance:=chance-.04;end if;
   if path='long'then chance:=.95;end if;if path='through'then chance:=chance+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/400;end if;
   if opp_tactic='low_block'and path='central'then chance:=chance-.12;end if;
   progress:=galactic_private.random_value(seed,idx+8)<chance;
   txt:=case path when 'cross'then (creator->>'name')||' از کناره عبور می‌کند و توپ را به محوطه می‌فرستد؛ '||target_name||' برای ضربهٔ سر آماده می‌شود.'when 'long'then target_name||' پشت محوطه صاحب توپ می‌شود، سرش را بالا می‌آورد و برای شوت آماده می‌شود.'when 'through'then (creator->>'name')||' توپ را به فضای پشت دفاع می‌فرستد؛ '||target_name||' با سرعت به سمت توپ می‌رود.'when 'direct'then target_name||' با مدافع برای توپ بلند درگیر می‌شود و تلاش می‌کند آن را کنترل کند.'else (creator->>'name')||' پاس رو به جلو را می‌فرستد؛ '||target_name||' بین مدافعان برای کنترل توپ حرکت می‌کند.'end;
   if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+84,'action',path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'action',txt,side,hs,aws,stats,rh,ra));
   if not progress then
    kind:='interception';txt:=(defender->>'name')||' زودتر به توپ می‌رسد و حمله را قطع می‌کند.';
    if path='cross'and galactic_private.random_value(seed,idx+9)<.45 then kind:='corner';stats:=galactic_private.stat_add(stats,side,'corners');txt:=(defender->>'name')||' ارسال را دفع می‌کند؛ توپ به کرنر می‌رود.';end if;
    if v3 and kind='interception'then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+85,kind,path,vars),txt);end if;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
    if v3 and kind='corner'and galactic_private.random_value(seed,idx+86)<.65 then
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_setup',(creator->>'name')||' برای زدن کرنر می‌رود؛ مدافعان یارهایشان را زیر نظر دارند.',side,hs,aws,stats,rh,ra));
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery','توپ به داخل محوطه می‌پیچد؛ '||target_name||' برای ضربهٔ سر از میان مدافعان جلو می‌آید.',side,hs,aws,stats,rh,ra));path:='cross';progress:=true;
    end if;
   end if;
  end if;
  if v3 and progress and path='cross'and galactic_private.random_value(seed,idx+87)<.12 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_claim','دروازه‌بان از خط جدا می‌شود و ارسال را بالاتر از سر '||target_name||' می‌گیرد؛ خطر رفع شد.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif v3 and progress and path not in('penalty_kick','free_kick')and galactic_private.random_value(seed,idx+88)<.12 then
   stats:=galactic_private.stat_add(stats,side,'shots');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'blocked_shot',target_name||' ضربه می‌زند؛ '||(defender->>'name')||' خودش را جلوی توپ می‌اندازد و شوت را بلوکه می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
  end if;
  if progress then
   actor_fit:=coalesce((shooter->>'fit')::numeric,1)*coalesce((shooter#>>'{chemistry,factor}')::numeric,1);
   actor_fit:=actor_fit*greatest(.55,1-(cfg#>>array['tactics',tactic,'fatigue'])::numeric*greatest(0,minute-coalesce((shooter->>'joinedMinute')::int,0))/90*(1.3-galactic_private.skill(shooter,'stamina')/180));
   on_prob:=.55+(galactic_private.skill(shooter,'shooting')*actor_fit-70)/350;goal_prob:=.29+(attack_power-def_power)/330+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/240;
   if path='cross'then
    aerial_diff:=galactic_private.aerial(shooter)*actor_fit-galactic_private.aerial(defender)*coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
    on_prob:=.54+aerial_diff/220;goal_prob:=.31+aerial_diff/145+(galactic_private.skill(creator,'crossing')-75)/400+(attack_power-def_power)/500+(75-keeper_skill)/300;
   elsif path='long'then on_prob:=.38+(galactic_private.skill(shooter,'longShots')*actor_fit-70)/300;goal_prob:=.16+(galactic_private.skill(shooter,'longShots')*actor_fit-keeper_skill)/250;
   elsif path='through'then goal_prob:=goal_prob+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/350;
   elsif path='direct'then on_prob:=on_prob+(galactic_private.skill(shooter,'physical')-galactic_private.skill(defender,'physical'))/400;
   elsif path='free_kick'then on_prob:=.4+(galactic_private.skill(shooter,'freeKicks')-70)/300;goal_prob:=.23+(galactic_private.skill(shooter,'freeKicks')-keeper_skill)/280;
   elsif path='penalty_kick'then on_prob:=.91;goal_prob:=.82+(galactic_private.skill(shooter,'penalties')*actor_fit-keeper_skill)/300;end if;
   on_prob:=least(.94,greatest(.15,on_prob));goal_prob:=least(.9,greatest(.05,goal_prob));
   on_target:=galactic_private.random_value(seed,idx+50)<on_prob;goal:=on_target and galactic_private.random_value(seed,idx+51)<goal_prob;
   stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   if v3 and on_target and not goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+89)<.17 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'parry',target_name||' می‌زند... دروازه‌بان توپ را برمی‌گرداند اما آن را نگرفته است!',side,hs,aws,stats,rh,ra));
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'rebound',target_name||' برای توپ برگشتی هجوم می‌برد؛ مدافع هم به سمت توپ می‌دود.',side,hs,aws,stats,rh,ra));
    on_target:=galactic_private.random_value(seed,idx+90)<least(.88,greatest(.3,.60+(galactic_private.skill(shooter,'composure')*actor_fit-70)/250));
    goal:=on_target and galactic_private.random_value(seed,idx+91)<least(.8,greatest(.1,.42+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/250));
    stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   end if;
   overturned:=false;
   if v3 and goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+92)<.14 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'var_review','توپ از دروازه‌بان عبور می‌کند؛ کمک‌داور هنوز تأیید نکرده و صحنه در حال بررسی است...',side,hs,aws,stats,rh,ra));
    overturned:=galactic_private.random_value(seed,idx+93)<.35;
    if overturned then goal:=false;stats:=galactic_private.stat_add(galactic_private.stat_add(galactic_private.stat_add(stats,side,'offsides'),side,'shots',-1),side,'onTarget',-1);end if;
   end if;
   if overturned then kind:='disallowed_goal';txt:='تصمیم نهایی: آفساید! گلِ '||target_name||' پذیرفته نشد؛ امتیاز تغییری نمی‌کند.';
   elsif goal then kind:='goal';if side=0 then hs:=hs+1;else aws:=aws+1;end if;txt:=case path when 'cross'then target_name||' با ضربهٔ سر می‌زند... گل! توپ درون دروازه است!'when 'penalty_kick'then target_name||' به توپ ضربه می‌زند... گل! پنالتی تبدیل به گل شد.'when 'free_kick'then target_name||' از روی دیوار دفاعی می‌زند... گل! ضربهٔ آزاد به تور می‌رسد.'when 'long'then target_name||' از راه دور شوت می‌زند... گل! یک ضربهٔ تماشایی!'else target_name||' ضربه را می‌زند... گل! توپ به تور دروازه می‌رسد!'end;
   elsif on_target then kind:='save';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... دروازه‌بان توپ را مهار می‌کند!'else ' ضربه می‌زند... دروازه‌بان با واکنش به‌موقع مانع گل می‌شود!'end;
   elsif galactic_private.random_value(seed,idx+52)<.23 then kind:='woodwork';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... اوه! توپ به تیر دروازه می‌خورد و برمی‌گردد!'else ' شوت می‌زند... اوه! توپ به تیر دروازه برخورد می‌کند!'end;
   else kind:='miss';txt:=target_name||case when path='penalty_kick'then ' به توپ ضربه می‌زند... پنالتی بیرون می‌رود! چه فرصتی از دست رفت.'when path='cross'then ' برای ضربهٔ سر بلند می‌شود... توپ از بالای دروازه عبور می‌کند.'else ' ضربه می‌زند... توپ از کنار دروازه می‌گذرد.'end;end if;
   if v3 and path not in('penalty_kick','free_kick')then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+94,kind,path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
  end if;
  seq_hold:=16000/jsonb_array_length(seq);
  for e in select value from jsonb_array_elements(seq)loop raw:=raw||jsonb_build_array(e||jsonb_build_object('holdMs',seq_hold,'sequence',i));end loop;
 end loop;
 if p_second then
 if extra then raw:=raw||jsonb_build_array(galactic_private.scene(120,'extra_end',case when hs=aws then 'وقت اضافه هم با تساوی تمام شد؛ پنالتی‌ها برنده را تعیین می‌کنند.'else 'پایان وقت اضافه.'end,null,hs,aws,stats,rh,ra));end if;
 if hs=aws and r.competition='cup' then
  for i in 1..30 loop
   for side in 0..1 loop
    attackers:=case when side=0 then hl else al end;ar:=case when side=0 then rh else ra end;
    role_pid:=(case when side=0 then home_state else away_state end)#>>'{roles,penalty}';
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,'penalties')desc,p->>'id'offset((i-1)%(11-jsonb_array_length(ar)))limit 1;
    keeper_skill:=case when side=0 then(a->>'goalkeeping')::numeric else(h->>'goalkeeping')::numeric end;
    goal:=galactic_private.random_value(seed,4000+i*2+side)<least(.92,greatest(.45,.76+(galactic_private.skill(shooter,'penalties')-keeper_skill)/400));
    if i=30 and side=1 then goal:=(hp=ap);end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_setup',(shooter->>'name')||' برای پنالتی پشت توپ قرار می‌گیرد؛ نگاه‌ها به دروازه است.',side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',2500));
    if side=0 then ht:=ht+1;if goal then hp:=hp+1;end if;else ataken:=ataken+1;if goal then ap:=ap+1;end if;end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_kick',(shooter->>'name')||case when goal then ' ضربه می‌زند... گل!'else ' ضربه می‌زند... پنالتی از دست می‌رود!'end,side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',3500));
    if ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht))then exit;end if;
   end loop;
   if(ht=ataken and ht>=5 and hp<>ap)or(ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht)))then exit;end if;
  end loop;winner:=case when hp>ap then hm.id else am.id end;penalties:=jsonb_build_object('home',hp,'away',ap);
 else winner:=case when hs>aws then hm.id when aws>hs then am.id end;end if;
 raw:=raw||jsonb_build_array(galactic_private.scene(case when extra then 120 else 90 end,'final',case when winner is null then 'مسابقه با تساوی تمام شد؛ هر تیم یک امتیاز می‌گیرد.'else '«'||case when winner=hm.id then hm.team_name else am.team_name end||'» برندهٔ مسابقه شد.'end,null,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',case when penalties is not null then hp end,'penaltyAway',case when penalties is not null then ap end));
 else
 raw:=raw||jsonb_build_array(galactic_private.scene(45,'halftime','پایان نیمهٔ اول؛ دو دقیقه برای تغییر آرایش، تاکتیک و حداکثر پنج تعویض.',null,hs,aws,stats,rh,ra)||jsonb_build_object('holdMs',120000));
 end if;
 for e in select value from jsonb_array_elements(raw)loop
  off_ms:=off_ms+greatest(0,(e->>'minute')::int-prev_min)*2000;hold:=coalesce((e->>'holdMs')::int,case when e->>'kind'='halftime'then 8000 else 5000 end);
  timeline:=timeline||jsonb_build_array((e-'holdMs')||jsonb_build_object('atMs',off_ms,'untilMs',off_ms+hold));off_ms:=off_ms+hold;prev_min:=(e->>'minute')::int;
 end loop;
 if not p_second then
  update galactic_private.matches set halftime_at=p_start+(off_ms-120000)*interval '1 millisecond',halftime_until=p_start+off_ms*interval '1 millisecond',stage='first',sim_state=jsonb_build_object('stats',stats,'hs',hs,'aws',aws,'rh',rh,'ra',ra,'yellows',yellows,'hcontrol',hcontrol,'total_control',total_control)where id=p_match;
 else update galactic_private.matches set stage='second'where id=p_match;end if;
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',4)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;


create or replace function galactic_private.offer(p_room uuid,p_member uuid,p_context text,p_slot text,p_reroll boolean default false,p_formation text default null)returns jsonb language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;d galactic_private.datasets%rowtype;mem galactic_private.members%rowtype;mm galactic_private.matches%rowtype;o galactic_private.offers%rowtype;role text;f text;ord int;target int;chosen jsonb;old_best int;v_round int;
begin
 select * into r from galactic_private.rooms where id=p_room;select * into mem from galactic_private.members where room_id=p_room and id=p_member;select * into d from galactic_private.datasets where version=r.dataset_version;
 f:=mem.formation;
 if p_context<>'draft'then
  select * into mm from galactic_private.matches where id=p_context::uuid and room_id=p_room and(mem.id=home_id or mem.id=away_id);
  if mm.id is null or(case when mm.home_id=mem.id then mm.home_saved else mm.away_saved end)or mm.stage<>'first'or clock_timestamp()<mm.halftime_at or clock_timestamp()>=mm.halftime_until then raise exception 'زمان تغییرات بین دو نیمه نیست.';end if;
  f:=case when mem.id=mm.home_id then mm.home_setup else mm.away_setup end->>'formation';v_round:=mm.round;
 elsif r.phase<>'draft'then raise exception 'زمان انتخاب بازیکن نیست.';end if;
 if p_context<>'draft'and p_formation is not null and(d.config->'formations')?p_formation then f:=p_formation;end if;
 select s->>'role',i::int into role,ord from jsonb_array_elements(d.config#>array['formations',f,'slots'])with ordinality q(s,i)where s->>'id'=p_slot;
 if role is null then raise exception 'جایگاه معتبر نیست.';end if;
 select * into o from galactic_private.offers where room_id=p_room and member_id=p_member and context=p_context and slot=p_slot;
 if p_reroll and mem.rerolls?p_context then raise exception 'ری‌رول این نوبت قبلاً استفاده شده است.';end if;
 if o.room_id is not null and not p_reroll then return o.players;end if;
 target:=case when (ord+floor(galactic_private.random_value(r.seed||p_member::text,1)*11)::int)%11<4 then 86 else 78 end;
 select max((p->>'overall')::int)into old_best from jsonb_array_elements(d.players)p where o.players?(p->>'id');
 if p_reroll then target:=least(99,coalesce(old_best,target)+4);end if;
 select coalesce(jsonb_agg(p->>'id'),'[]')into chosen from(
  select p from jsonb_array_elements(d.players)p where p->'positions'?role
  and not exists(select 1 from galactic_private.picks pk where pk.room_id=p_room and pk.player_id=p->>'id')
  and not exists(select 1 from galactic_private.reserves z where z.room_id=p_room and z.round=v_round and z.player_id=p->>'id')
  and(not p_reroll or not coalesce(o.players,'[]')?(p->>'id'))
  order by case when p_reroll then greatest(0,coalesce(old_best,0)+1-(p->>'overall')::int)else greatest(0,abs((p->>'overall')::int-target)-4)end,
  galactic_private.random_value(r.seed||p_member::text||p_context||p_slot||case when p_reroll then ':reroll'else ''end,hashtext(p->>'id')) limit 5
 )q;
 if p_reroll and(select max((p->>'overall')::int)from jsonb_array_elements(d.players)p where chosen?(p->>'id'))<=old_best then raise exception 'بازیکن قوی‌تری برای این جایگاه باقی نمانده؛ ری‌رول تو حفظ شد.';end if;
 if jsonb_array_length(chosen)=0 then raise exception 'بازیکن آزادی برای این جایگاه باقی نمانده است.';end if;
 insert into galactic_private.offers values(p_room,p_member,p_context,p_slot,chosen,p_reroll)on conflict(room_id,member_id,context,slot)do update set players=excluded.players,rerolled=excluded.rerolled;
 if p_reroll then update galactic_private.members set rerolls=rerolls||jsonb_build_object(p_context,true)where id=p_member;end if;
 return chosen;
end;$$;


create or replace function public.galactic_act(p_code text,p_action jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;mem galactic_private.members%rowtype;d galactic_private.datasets%rowtype;stamp timestamptz:=clock_timestamp();kind text:=p_action->>'type';mm galactic_private.matches%rowtype;s jsonb;initial jsonb;submitted jsonb;lineup jsonb;f text;t text;context text;slot text;pid text;opts jsonb;sent jsonb;v_roles jsonb;v_count int;is_home boolean;other_id uuid;
begin
 select * into r from galactic_private.rooms where code=upper(trim(p_code))for update;
 if r.id is null then raise exception 'اتاق پیدا نشد.';end if;select * into mem from galactic_private.members where room_id=r.id and user_id=u;
 if mem.id is null then raise exception 'عضو این اتاق نیستی.'using errcode='42501';end if;
 stamp:=clock_timestamp();perform galactic_private.advance(r.id,stamp);select * into r from galactic_private.rooms where id=r.id;select * into d from galactic_private.datasets where version=r.dataset_version;
 if kind in('offers','reroll')then
  if r.selection<>'draft'then raise exception 'این اتاق حالت انتخاب آزاد دارد.';end if;
  context:=coalesce(p_action->>'match','draft');slot:=p_action->>'slot';
  opts:=galactic_private.offer(r.id,mem.id,context,slot,kind='reroll',p_action->>'formation');
 elsif kind='roles'then
  if r.phase not in('draft','tournament')or exists(select 1 from galactic_private.matches where room_id=r.id and status='live')then raise exception 'مسئولیت‌ها را پیش از شروع بازی یا در پنجرهٔ بین دو نیمه تغییر بده.';end if;
  v_roles:=galactic_private.checked_roles(galactic_private.lineup(r.id,mem.id),p_action->'roles');update galactic_private.members set roles=v_roles where id=mem.id;
 elsif kind='halftime'then
  select * into mm from galactic_private.matches where id=(p_action->>'match')::uuid and room_id=r.id and(mem.id=home_id or mem.id=away_id);
  if mm.id is null or mm.stage<>'first'or stamp<mm.halftime_at or stamp>=mm.halftime_until then raise exception 'زمان دو دقیقه‌ای بین دو نیمه تمام شده یا هنوز شروع نشده است.';end if;
  if coalesce((d.config->>'engineVersion')::int,1)>=5 and(case when mm.home_id=mem.id then mm.home_saved else mm.away_saved end)then raise exception 'تغییرات ذخیره و قفل شده‌اند؛ منتظر ادامهٔ بازی باش.';end if;
  is_home:=mem.id=mm.home_id;s:=case when is_home then mm.home_setup else mm.away_setup end;initial:=case when is_home then mm.initial_home else mm.initial_away end;sent:=case when is_home then mm.sim_state->'rh'else mm.sim_state->'ra'end;
  f:=p_action->>'formation';t:=p_action->>'tactic';submitted:=p_action->'players';
  if not(d.config->'formations')?coalesce(f,'')or not(d.config->'tactics')?coalesce(t,'')or jsonb_typeof(submitted)is distinct from 'array'or jsonb_array_length(submitted)<>11 then raise exception 'ترکیب باید یازده جایگاه معتبر داشته باشد.';end if;
  if(select count(distinct p->>'id')from jsonb_array_elements(submitted)p)<>11 or(select count(distinct p->>'slot')from jsonb_array_elements(submitted)p)<>11 then raise exception 'بازیکن یا جایگاه تکراری است.';end if;
  select count(*)into v_count from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id');
  if v_count>5 then raise exception 'حداکثر پنج تعویض مجاز است.';end if;
  if exists(select 1 from jsonb_array_elements_text(sent)q(id)where not exists(select 1 from jsonb_array_elements(submitted)p where p->>'id'=q.id))then raise exception 'بازیکن اخراج‌شده قابل تعویض نیست.';end if;
  if exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(d.players)dp where dp->>'id'=p->>'id')or not exists(select 1 from jsonb_array_elements(d.config#>array['formations',f,'slots'])sp where sp->>'id'=p->>'slot'))then raise exception 'بازیکن یا جایگاه ناشناخته است.';end if;
  if exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id')and(exists(select 1 from galactic_private.picks pk where pk.room_id=r.id and pk.player_id=p->>'id')or exists(select 1 from galactic_private.reserves z where z.room_id=r.id and z.round=mm.round and z.member_id<>mem.id and z.player_id=p->>'id')))then raise exception 'این بازیکن در اختیار تیم دیگری است.';end if;
  if r.selection='draft'and exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id')and not exists(select 1 from galactic_private.offers o where o.room_id=r.id and o.member_id=mem.id and o.context=mm.id::text and o.players?(p->>'id')))then raise exception 'تعویض در حالت درفت فقط از پیشنهادهای ذخیره‌شده مجاز است.';end if;
  select jsonb_agg(dp||sp||jsonb_build_object('slot',sp->>'id','id',dp->>'id','fit',galactic_private.fit(dp->'positions',sp->>'role',d.config),'joinedMinute',case when exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=dp->>'id')then 0 else 45 end)order by ord)into lineup from jsonb_array_elements(submitted)p join jsonb_array_elements(d.players)dp on dp->>'id'=p->>'id'join jsonb_array_elements(d.config#>array['formations',f,'slots'])with ordinality q(sp,ord)on sp->>'id'=p->>'slot';
  v_roles:=galactic_private.checked_roles(lineup,p_action->'roles',sent);lineup:=galactic_private.decorate(lineup,d.config,v_roles);
  s:=jsonb_build_object('formation',f,'tactic',t,'roles',v_roles,'players',lineup);
  delete from galactic_private.reserves where match_id=mm.id and member_id=mem.id;
  insert into galactic_private.reserves select r.id,mm.round,mm.id,mem.id,p->>'id'from jsonb_array_elements(lineup)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id');
  if is_home then update galactic_private.matches set home_setup=s where id=mm.id;else update galactic_private.matches set away_setup=s where id=mm.id;end if;
  if coalesce((d.config->>'engineVersion')::int,1)>=5 then
   if is_home then update galactic_private.matches set home_saved=true where id=mm.id;else update galactic_private.matches set away_saved=true where id=mm.id;end if;
   select * into mm from galactic_private.matches where id=mm.id;
   if mm.home_saved and mm.away_saved then
    update galactic_private.matches set halftime_until=stamp,ends_at=stamp,timeline=jsonb_set(timeline,array[(jsonb_array_length(timeline)-1)::text,'untilMs'],to_jsonb(floor(extract(epoch from(stamp-started_at))*1000)::bigint))where id=mm.id;
    perform galactic_private.advance(r.id,stamp);
   end if;
  end if;
 else
  if kind='pick'and r.selection='draft'then
   pid:=p_action->>'player';slot:=p_action->>'slot';opts:=galactic_private.offer(r.id,mem.id,'draft',slot,false);
   if not opts?coalesce(pid,'')then raise exception 'فقط از پنج پیشنهاد این جایگاه انتخاب کن.';end if;
  end if;
  return galactic_private.act_v3(p_code,p_action);
 end if;
 update galactic_private.rooms set version=version+1,updated_at=stamp where id=r.id;perform galactic_private.notify_room(r.id);return galactic_private.room_view(r.id,u,stamp);
end;$$;


create or replace function galactic_private.room_view(p_room uuid,p_uid uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;r galactic_private.rooms%rowtype;mid uuid;mm galactic_private.matches%rowtype;own jsonb;offers jsonb;members jsonb;
begin
 v:=galactic_private.room_view_v3(p_room,p_uid,p_now);select * into r from galactic_private.rooms where id=p_room;mid:=(v->>'self')::uuid;
 select * into mm from galactic_private.matches where room_id=p_room and status='live'and(home_id=mid or away_id=mid)order by round desc limit 1;
 if mm.stage='first'and p_now>=mm.halftime_at and p_now<mm.halftime_until then own:=jsonb_build_object('match',mm.id,'until',mm.halftime_until,'saved',case when mm.home_id=mid then mm.home_saved else mm.away_saved end,'setup',galactic_private.public_setup(case when mm.home_id=mid then mm.home_setup else mm.away_setup end),'initial',galactic_private.public_setup(case when mm.home_id=mid then mm.initial_home else mm.initial_away end),'sentOff',case when mm.home_id=mid then mm.sim_state->'rh'else mm.sim_state->'ra'end);end if;
 select coalesce(jsonb_agg(jsonb_build_object('context',context,'slot',slot,'players',players,'rerolled',rerolled)),'[]')into offers from galactic_private.offers where room_id=p_room and member_id=mid;
 select jsonb_agg(p||jsonb_build_object('roles',m.roles))into members from jsonb_array_elements(v->'members')p join galactic_private.members m on m.id=(p->>'id')::uuid;
 return v||jsonb_build_object('competition',r.competition,'selection',r.selection,'members',members,'standings',case when r.competition='league'then galactic_private.standings(p_room)else '[]'::jsonb end,'offers',offers,'rerolls',(select rerolls from galactic_private.members where id=mid),'halftime',own,'unavailable',(select coalesce(jsonb_agg(player_id),'[]')from galactic_private.reserves where room_id=p_room and round=mm.round and member_id<>mid));
end;$$;


create or replace function galactic_private.match_view(p_match uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;m galactic_private.matches%rowtype;h jsonb;a jsonb;
begin
 v:=galactic_private.match_view_v3(p_match,p_now);if v is null then return null;end if;select * into m from galactic_private.matches where id=p_match;if m.stage is null then return v;end if;
 if coalesce((m.stats->>'engine')::int,0)>=5 then v:=jsonb_set(v,'{playback}',(v->'playback')||jsonb_build_object('minuteMs',800,'stoppageBase',(v->'events'->-1)->'stoppageBase'));end if;
 h:=case when m.stage='first'then m.initial_home else m.home_setup end;a:=case when m.stage='first'then m.initial_away else m.away_setup end;
 return v||jsonb_build_object('home',(v->'home')||galactic_private.public_setup(h),'away',(v->'away')||galactic_private.public_setup(a),'halftime',m.stage='first'and p_now>=m.halftime_at and p_now<m.halftime_until,'halftimeUntil',case when p_now>=m.halftime_at then m.halftime_until end);
end;$$;


revoke execute on all functions in schema galactic_private from public,anon,authenticated;
