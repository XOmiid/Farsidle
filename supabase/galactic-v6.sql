create or replace function galactic_private.simulate_v6(p_match uuid,p_start timestamptz,p_second boolean)returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;v3 boolean;play_minutes int[];vars jsonb;home_state jsonb;away_state jsonb;role_pid text;corner_play boolean;keeper_rush boolean;first_added int;second_added int;half_end int;keeper jsonb;detail jsonb;variation int;previous_text text:='';last_build_variant int:=-1;last_action_variant int:=-1;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
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
  select p into keeper from jsonb_array_elements(defenders)p where p->>'role'='GK'limit 1;
  seq_hold:=10000;
  for e in select value from jsonb_array_elements(seq)loop
   detail:=jsonb_build_object('actor',case when e->>'kind'in('yellow_card','red_card','foul')then jsonb_build_object('id',fouler->>'id','name',fouler->>'name','role',fouler->>'role','side',1-side)
     when e->>'kind'='corner_won'then jsonb_build_object('id',defender->>'id','name',defender->>'name','role',defender->>'role','side',1-side)
     when e->>'kind'in('goal','save','miss','woodwork','penalty_kick','free_kick','keeper_rush')then jsonb_build_object('id',shooter->>'id','name',shooter->>'name','role',shooter->>'role','side',side)
     else jsonb_build_object('id',creator->>'id','name',creator->>'name','role',creator->>'role','side',side)end);
   if e->>'kind'='red_card'then detail:=detail||jsonb_build_object('secondYellow',yellow);end if;
   if e->>'kind'in('goal','save','miss','woodwork')then
    detail:=detail||jsonb_build_object('keeper',jsonb_build_object('id',keeper->>'id','name',keeper->>'name','role','GK','side',1-side),'chanceType',path);
    if path not in('penalty_kick','free_kick','long','dribble')and creator->>'id'<>shooter->>'id'then detail:=detail||jsonb_build_object('provider',jsonb_build_object('id',creator->>'id','name',creator->>'name','role',creator->>'role','side',side));end if;
   end if;
   if e->>'kind'in('action','corner_delivery')and path not in('long','direct','dribble')then detail:=detail||jsonb_build_object('goodPass',true);end if;
   variation:=floor(galactic_private.random_value(seed,idx+600+case when e->>'kind'='build_up'then 1 else 2 end)*4)::int;
   if e->>'kind'='build_up'then
    if variation=last_build_variant then variation:=(variation+1)%4;end if;last_build_variant:=variation;
    txt:=case variation when 0 then (creator->>'name')||' با یک کنترل نه‌چندان خوب توپ را جلو می‌اندازد، اما دوباره آن را جمع می‌کند. '
      when 1 then (creator->>'name')||' با مکثی کوتاه بازیکن حریف را به سمت خود می‌کشد. '
      when 2 then (creator->>'name')||' با حرکت بدون توپ هم‌تیمی‌اش فضای تازه‌ای پیدا می‌کند. '
      else (creator->>'name')||' زیر فشار حریف آرام می‌ماند و سرش را برای دیدن گزینه‌ها بالا می‌آورد. 'end;
    detail:=detail||jsonb_build_object('mistake',variation=0);e:=jsonb_set(e,'{text}',to_jsonb(txt||(e->>'text')));
   elsif e->>'kind'='action'then
    if variation=last_action_variant then variation:=(variation+1)%4;end if;last_action_variant:=variation;
    txt:=case variation when 0 then 'مدافع کمی دیر واکنش نشان می‌دهد. 'when 1 then 'حرکت بدون توپ خط دفاع را جابه‌جا کرده است. 'when 2 then 'فشار مدافع اجازهٔ تصمیم‌گیری راحت نمی‌دهد. 'else 'هم‌تیمی‌ها برای پاس بعدی خود را آزاد می‌کنند. 'end;
    e:=jsonb_set(e,'{text}',to_jsonb(txt||(e->>'text')));
   end if;
   if previous_text=e->>'text'then e:=jsonb_set(e,'{text}',to_jsonb('حملهٔ تازه؛ '||(e->>'text')));end if;previous_text:=e->>'text';
   raw:=raw||jsonb_build_array(e||detail||jsonb_build_object('holdMs',greatest(seq_hold,least(16000,2500+char_length(e->>'text')*55)),'sequence',i,'dangerous',true,'period',case when extra then 3 when p_second then 2 else 1 end,'stoppageBase',case when i=5 then 45 when i=14 then 90 end));
  end loop;
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
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',6)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;


create or replace function galactic_private.match_view(p_match uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;m galactic_private.matches%rowtype;h jsonb;a jsonb;
begin
 v:=galactic_private.match_view_v3(p_match,p_now);if v is null then return null;end if;select * into m from galactic_private.matches where id=p_match;if m.stage is null then return v;end if;
 if coalesce((m.stats->>'engine')::int,0)>=5 then v:=jsonb_set(v,'{playback}',(v->'playback')||jsonb_build_object('minuteMs',800,'stoppageBase',(v->'events'->-1)->'stoppageBase'));end if;
 if coalesce((m.stats->>'engine')::int,0)>=6 then v:=jsonb_set(jsonb_set(v,'{home}',(v->'home')||jsonb_build_object('ratingPlayers',galactic_private.public_setup(m.initial_home)->'players')),'{away}',(v->'away')||jsonb_build_object('ratingPlayers',galactic_private.public_setup(m.initial_away)->'players'));end if;
 h:=case when m.stage='first'then m.initial_home else m.home_setup end;a:=case when m.stage='first'then m.initial_away else m.away_setup end;
 return v||jsonb_build_object('home',(v->'home')||galactic_private.public_setup(h),'away',(v->'away')||galactic_private.public_setup(a),'halftime',m.stage='first'and p_now>=m.halftime_at and p_now<m.halftime_until,'halftimeUntil',case when p_now>=m.halftime_at then m.halftime_until end);
end;$$;


revoke execute on all functions in schema galactic_private from public,anon,authenticated;
