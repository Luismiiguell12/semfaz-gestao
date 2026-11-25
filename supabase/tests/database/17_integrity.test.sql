-- Fase 7: integridade estrutural do banco.
begin;
\ir _helpers.psql
select plan(11);

select is(
  (select count(*)::int from information_schema.columns c
     join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and (c.column_name ~ '(amount|_value|valor)$' or c.column_name in ('global_value', 'monthly_value'))
      and (c.data_type <> 'numeric' or c.numeric_precision <> 14 or c.numeric_scale <> 2)),
  0, 'Todo valor monetário é numeric(14,2)');

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and data_type in ('real', 'double precision', 'money')),
  0, 'Nenhum valor em ponto flutuante ou tipo money');

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and data_type = 'timestamp without time zone'),
  0, 'Datas e horas sempre com fuso (timestamptz)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f'
                        and k.confrelid = 'public.organizations'::regclass)),
  0, 'Toda tabela com organization_id referencia organizations');

select is(
  (select count(*)::int from information_schema.columns c
     join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.column_name = 'organization_id'
      and c.is_nullable = 'YES' and c.table_name <> 'audit_logs'),
  0, 'organization_id obrigatório (exceto auditoria de eventos sem organização, como login falho)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p')),
  0, 'Toda tabela tem chave primária');

select is(
  (select count(*)::int from (values
      ('contract_landlords', 'landlord_id'), ('property_landlords', 'landlord_id'), ('invoices', 'supplier_id'),
      ('tasks', 'category_id'), ('user_property_access', 'property_id'), ('payments', 'reversal_of'),
      ('consumption_records', 'invoice_id')) v(t, col)
    where not exists (
      select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
       where i.indrelid = ('public.' || v.t)::regclass and a.attname = v.col)),
  0, 'Chaves estrangeiras usadas em consultas têm índice');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and cmd = 'SELECT'
     and (qual ~ 'can_access_(property|unit)\(' )),
  0, 'Políticas de leitura não verificam o escopo linha a linha (desempenho)');

-- Equivalência: o conjunto calculado uma vez por consulta = verificação por registro.
insert into public.departments (id, organization_id, kind, name) values
  ('97000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Integridade');
insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose) values
  ('97000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel SEMFAZ', 'Rua A', '1', 'Centro', '49400-000', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste'),
  ('97000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Imóvel Fora', 'Rua B', '2', 'Centro', '49400-000', 'Lagarto', 'SE', '97000000-0000-4000-8000-000000000009', 'Teste'),
  ('97000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Imóvel Selecionado', 'Rua C', '3', 'Centro', '49400-000', 'Lagarto', 'SE', '97000000-0000-4000-8000-000000000009', 'Teste');
select tests.create_user('ig_gestor', array['manager']) as gestor \gset
select tests.create_user('ig_admin', array['admin']) as admin \gset
select tests.create_user('ig_sem', array[]::text[]) as sem \gset
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '00000000-0000-4000-8000-000000000101');
insert into public.user_property_access (organization_id, user_id, property_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '97000000-0000-4000-8000-000000000003');
create function tests.same_scope() returns boolean language sql as $$
  select coalesce(array_agg(p.id order by p.id), '{}') is not distinct from
         coalesce((select array_agg(x order by x) from unnest(private.accessible_property_ids()) x), '{}')
  from public.properties p where private.can_access_property(p.id)
$$;
select tests.set_claims(:'gestor');
select ok(tests.same_scope() and '97000000-0000-4000-8000-000000000003' = any (private.accessible_property_ids())
          and not '97000000-0000-4000-8000-000000000002' = any (private.accessible_property_ids()),
  'Gestor: mesmo conjunto de imóveis (secretaria + imóvel selecionado, sem o de fora)');
select tests.set_claims(:'admin', 'aal2');
select ok(tests.same_scope() and '97000000-0000-4000-8000-000000000002' = any (private.accessible_property_ids()),
  'Administrador: mesmo conjunto (toda a organização)');
select tests.set_claims(:'sem');
select ok(tests.same_scope() and cardinality(private.accessible_property_ids()) = 0,
  'Sem escopo: conjunto vazio');

select * from finish();
rollback;
