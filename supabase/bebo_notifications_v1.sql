-- Bebo.nz notifications v1: private in-site inbox, event triggers and maintenance alerts.
-- Browser alerts require user opt-in and an OPEN Bebo tab. This does not implement offline Web Push or email.
create table if not exists public.bebo_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check(kind in (
    'message','wall_comment','friend_request','friend_accepted','luv','whiteboard',
    'blog_comment','video_comment','verified','suggestion_update','announcement'
  )),
  title text not null check(char_length(title) between 1 and 130),
  body text not null default '' check(char_length(body)<=240),
  target_path text not null default '#/notifications'
    check(char_length(target_path)<=170 and target_path like '#/%'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists bebo_notifications_inbox_idx
  on public.bebo_notifications(recipient_id,created_at desc);
create index if not exists bebo_notifications_unread_idx
  on public.bebo_notifications(recipient_id,created_at desc) where read_at is null;
alter table public.bebo_notifications enable row level security;
revoke all on public.bebo_notifications from public,anon,authenticated;
grant select on public.bebo_notifications to authenticated;
grant update(read_at) on public.bebo_notifications to authenticated;
drop policy if exists "bebo read own notifications" on public.bebo_notifications;
create policy "bebo read own notifications" on public.bebo_notifications
  for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists "bebo mark own notifications read" on public.bebo_notifications;
create policy "bebo mark own notifications read" on public.bebo_notifications
  for update to authenticated using(recipient_id=(select auth.uid()))
  with check(recipient_id=(select auth.uid()));
-- Browser clients cannot insert, impersonate another user, delete or edit notification content.
create or replace function bebo_private.enqueue_bebo_notice(
  recipient uuid, actor uuid, k text, heading text, summary text, destination text
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if recipient is null or (actor is not null and actor=recipient) then return; end if;
  if actor is not null and exists (
    select 1 from public.bebo_blocks b where
      (b.blocker_id=actor and b.blocked_id=recipient) or
      (b.blocker_id=recipient and b.blocked_id=actor)
  ) then return; end if;
  insert into public.bebo_notifications(recipient_id,actor_id,kind,title,body,target_path)
    values(recipient,actor,k,left(heading,130),left(coalesce(summary,''),240),left(destination,170));
end;
$$;
revoke all on function bebo_private.enqueue_bebo_notice(uuid,uuid,text,text,text,text)
  from public,anon,authenticated;

create or replace function bebo_private.create_bebo_event_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare receiver uuid; actor uuid; k text; heading text; summary text;
  destination text := '#/notifications'; owner_name text;
begin
  if tg_table_name='bebo_mail' and tg_op='INSERT' then
    receiver:=new.recipient_id; actor:=new.sender_id; k:='message';
    heading:='✉ New private message'; summary:='Someone sent you Bebo Mail.';
    destination:='#/messages';
  elsif tg_table_name='bebo_wall_posts' and tg_op='INSERT' then
    receiver:=new.profile_id; actor:=new.author_id; k:='wall_comment';
    heading:='💬 New profile comment'; summary:='Someone wrote on your Bebo wall.';
    select username into owner_name from public.bebo_profiles where id=receiver;
    destination:='#/u/'||coalesce(owner_name,'');
  elsif tg_table_name='bebo_friendships' then
    if tg_op='INSERT' and new.status='pending' then
      receiver:=new.addressee_id;actor:=new.requester_id;k:='friend_request';
      heading:='♥ New friend request';summary:='Someone wants to be your Bebo friend.';
      destination:='#/friends';
    elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
      receiver:=new.requester_id;actor:=new.addressee_id;k:='friend_accepted';
      heading:='♥ Friend request accepted';summary:='You made a new Bebo friend!';
      destination:='#/friends';
    end if;
  elsif tg_table_name='bebo_luv' and tg_op='INSERT' then
    receiver:=new.recipient_id;actor:=new.sender_id;k:='luv';
    heading:='💖 You received Bebo Luv';summary:='Someone sent you Luv.';
    destination:='#/profile';
  elsif tg_table_name='bebo_whiteboards' and tg_op='INSERT' then
    receiver:=new.profile_id;actor:=new.author_id;k:='whiteboard';
    heading:='🎨 New whiteboard drawing';summary:='Someone drew on your Bebo whiteboard.';
    destination:='#/profile';
  elsif tg_table_name='bebo_blog_comments' and tg_op='INSERT' then
    select owner_id into receiver from public.bebo_blogs where id=new.blog_id;
    actor:=new.author_id;k:='blog_comment';heading:='✎ New blog comment';
    summary:='Someone commented on your blog.';destination:='#/blog/'||new.blog_id::text;
  elsif tg_table_name='bebo_video_comments' and tg_op='INSERT' then
    select owner_id into receiver from public.bebo_videos where id=new.video_id;
    actor:=new.author_id;k:='video_comment';heading:='🎬 New video comment';
    summary:='Someone commented on your video.';destination:='#/videos';
  elsif tg_table_name='bebo_verified_profiles' and tg_op='INSERT' then
    receiver:=new.user_id;actor:=null;k:='verified';heading:='✓ Bebo Verified approved';
    summary:='Your Bebo community verification is approved.';destination:='#/profile';
  elsif tg_table_name='bebo_suggestions' and tg_op='UPDATE' then
    if new.status is distinct from old.status or new.admin_note is distinct from old.admin_note then
      receiver:=new.author_id;actor:=null;k:='suggestion_update';
      heading:='💡 Your suggestion was updated';
      summary:='The Bebo team has reviewed your feedback.';destination:='#/suggestions';
    end if;
  end if;
  if receiver is not null and k is not null then
    perform bebo_private.enqueue_bebo_notice(receiver,actor,k,heading,summary,destination);
  end if;
  return new;
end;
$$;
revoke all on function bebo_private.create_bebo_event_notification()
  from public,anon,authenticated;
drop trigger if exists bebo_notify_mail on public.bebo_mail;
create trigger bebo_notify_mail after insert on public.bebo_mail
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_wall on public.bebo_wall_posts;
create trigger bebo_notify_wall after insert on public.bebo_wall_posts
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_friends on public.bebo_friendships;
create trigger bebo_notify_friends after insert or update of status on public.bebo_friendships
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_luv on public.bebo_luv;
create trigger bebo_notify_luv after insert on public.bebo_luv
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_whiteboard on public.bebo_whiteboards;
create trigger bebo_notify_whiteboard after insert on public.bebo_whiteboards
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_blogs on public.bebo_blog_comments;
create trigger bebo_notify_blogs after insert on public.bebo_blog_comments
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_videos on public.bebo_video_comments;
create trigger bebo_notify_videos after insert on public.bebo_video_comments
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_verified on public.bebo_verified_profiles;
create trigger bebo_notify_verified after insert on public.bebo_verified_profiles
  for each row execute function bebo_private.create_bebo_event_notification();
drop trigger if exists bebo_notify_suggestions on public.bebo_suggestions;
create trigger bebo_notify_suggestions after update of status,admin_note on public.bebo_suggestions
  for each row execute function bebo_private.create_bebo_event_notification();

-- Owner broadcasts use the existing Admin > Announcements publishing workflow.
-- Send at first publish only, not every edit. The existing public banner remains in place.
create or replace function bebo_private.notify_bebo_announcement()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.published and (tg_op='INSERT' or not old.published) then
    insert into public.bebo_notifications(recipient_id,actor_id,kind,title,body,target_path)
    select u.id,null,'announcement',left('📢 '||new.title,130),
      left(new.body,240),'#/notifications'
    from auth.users u;
  end if;
  return new;
end;
$$;
revoke all on function bebo_private.notify_bebo_announcement()
  from public,anon,authenticated;
drop trigger if exists bebo_notify_announcement on public.bebo_announcements;
create trigger bebo_notify_announcement after insert or update of published on public.bebo_announcements
  for each row execute function bebo_private.notify_bebo_announcement();
