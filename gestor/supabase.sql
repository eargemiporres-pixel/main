-- Gestor de proyectos Muttto · esquema para Supabase (SQL Editor > New query > Run)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default '',
  role text not null default '',
  department text not null default 'proyectos'
);

create table if not exists public.projects (
  id uuid primary key,
  name text not null,
  description text default '',
  department text not null,
  line text default '',
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planificado',
  priority text not null default 'media',
  start_date date,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  notes text default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pendiente',
  priority text not null default 'media',
  start_date date,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

-- Perfil automático al registrarse un usuario
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, department)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'role', ''),
          coalesce(new.raw_user_meta_data->>'department', 'proyectos'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privacidad baja a propósito: cualquier usuario con sesión ve y edita todo.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.comments enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','projects','tasks','comments'] loop
    execute format('drop policy if exists "equipo" on public.%I', t);
    execute format('create policy "equipo" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
