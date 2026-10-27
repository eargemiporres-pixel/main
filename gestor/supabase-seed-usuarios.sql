-- OPCIONAL: crea usuarios tipo ya listos para entrar. Contraseña inicial: Muttto2026!
-- (cámbiala después). Ejecutar DESPUÉS de supabase.sql. Si algún usuario no pudiera
-- entrar, créalo en Authentication > Users > Add user, o regístralo desde la propia web.
create extension if not exists pgcrypto;

do $$
declare u record; uid uuid;
begin
  for u in select * from (values
    ('proyectos@muttto.com','Responsable de Proyectos','Reformas e interiorismo','proyectos'),
    ('comercial@muttto.com','Equipo Comercial','Comercial','comercial'),
    ('marketing@muttto.com','Equipo Marketing','Marketing','marketing'),
    ('operaciones@muttto.com','Equipo Operaciones','Operaciones','operaciones')
  ) as t(email,name,role,department)
  loop
    if not exists (select 1 from auth.users where email = u.email) then
      uid := gen_random_uuid();
      insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
        raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',u.email,
        crypt('Muttto2026!',gen_salt('bf')),now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('name',u.name,'role',u.role,'department',u.department),now(),now(),'','','','');
      insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
      values (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email',u.email),'email',now(),now(),now());
    end if;
  end loop;
end $$;
