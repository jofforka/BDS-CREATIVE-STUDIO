const { PGlite } = require('@electric-sql/pglite');
const { btree_gist } = require('@electric-sql/pglite/contrib/btree_gist');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const fs = require('node:fs');

(async () => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema extensions; create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    'select nullif(current_setting(''request.jwt.claim.sub'', true),'''')::uuid';
  create function auth.jwt() returns jsonb language sql stable as 'select ''{}''::jsonb';
  grant usage on schema auth,storage to anon,authenticated;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(bucket_id text references storage.buckets(id), name text, created_at timestamptz default now(), primary key(bucket_id,name));
  alter table storage.objects enable row level security;
  grant select,insert,delete on storage.objects to anon,authenticated;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  `);
  for (const name of fs.readdirSync('supabase/migrations').sort()) {
    try { await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8')); }
    catch (error) { throw Error(name + ': ' + error.message, {cause:error}); }
  }
  for (const name of fs.readdirSync('supabase/tests').sort()) {
    await db.exec(fs.readFileSync('supabase/tests/' + name, 'utf8'));
    console.log(name + ' passed');
  }
  await db.close();
})().catch(error => { console.error(error.message); process.exit(1); });
