-- Alteração 01: relatórios de despesas. Totais conferidos contra os registros,
-- exclusão de canceladas, abatimento de estornos, rateio por locador e RLS.
begin;
\ir _helpers.psql
select plan(18);

select tests.create_user('er_gestor', array['manager']) as gestor \gset
select tests.create_user('er_fora', array['manager']) as fora \gset
select tests.create_user('er_sem', array[]::text[]) as sem \gset
insert into public.departments (id, organization_id, kind, name) values
  ('92000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Relatórios'),
  ('92000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Relatórios Teste');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'gestor', '92000000-0000-4000-8000-000000000008'),
  ('00000000-0000-4000-8000-000000000001', :'fora', '92000000-0000-4000-8000-000000000009');

insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose) values
  ('92000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel Relatório A', 'Rua A', '1', 'Centro', '49400-000', 'Lagarto', 'SE', '92000000-0000-4000-8000-000000000008', 'Teste'),
  ('92000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Imóvel Relatório B', 'Rua B', '2', 'Centro', '49400-000', 'Lagarto', 'SE', '92000000-0000-4000-8000-000000000009', 'Teste');
select id as energisa from public.suppliers where name = 'Energisa' \gset
select id as igua from public.suppliers where name = 'Iguá' \gset
insert into public.consumer_units (id, organization_id, supplier_id, identifier, holder_name) values
  ('92000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', :'energisa', 'REL-E1', 'Titular Teste'),
  ('92000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', :'igua', 'REL-A1', 'Titular Teste'),
  ('92000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', :'energisa', 'REL-E2', 'Titular Teste');
insert into public.unit_assignments (organization_id, unit_id, property_id, start_date) values
  ('00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', '92000000-0000-4000-8000-000000000001', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000012', '92000000-0000-4000-8000-000000000001', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000013', '92000000-0000-4000-8000-000000000002', '2024-01-01');

-- Faturas: energia 01/2025 (paga), 02/2025 (CANCELADA), 03/2025 (paga e estornada);
-- água 01/2025 (em aberto, vencida); água 01/2024 (ano anterior); imóvel B fora do escopo.
insert into public.invoices (id, organization_id, unit_id, supplier_id, property_id, competence, consumption, measure_unit, amount, due_date, cancelled_at, cancellation_reason) values
  ('92000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', :'energisa', '92000000-0000-4000-8000-000000000001', '2025-01-01', 100, 'kWh', 200.00, '2025-02-10', null, null),
  ('92000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', :'energisa', '92000000-0000-4000-8000-000000000001', '2025-02-01', 150, 'kWh', 300.00, '2025-03-10', now(), 'Fatura emitida em duplicidade pela concessionária'),
  ('92000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000011', :'energisa', '92000000-0000-4000-8000-000000000001', '2025-03-01', 50, 'kWh', 100.00, '2025-04-10', null, null),
  ('92000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000012', :'igua', '92000000-0000-4000-8000-000000000001', '2025-01-01', 12, 'm³', 80.00, '2025-02-10', null, null),
  ('92000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000012', :'igua', '92000000-0000-4000-8000-000000000001', '2024-01-01', 10, 'm³', 40.00, '2024-02-10', null, null),
  ('92000000-0000-4000-8000-000000000026', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000013', :'energisa', '92000000-0000-4000-8000-000000000002', '2025-01-01', 900, 'kWh', 500.00, '2025-02-10', null, null);

-- Contrato com dois locadores (60% e 40%): aluguéis de 01 a 03/2025 gerados automaticamente.
insert into public.landlords (id, organization_id, person_type, name, document) values
  ('92000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000001', 'individual', 'Locador Relatório Um', '52998224725'),
  ('92000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001', 'individual', 'Locador Relatório Dois', '11144477735');
insert into public.contracts (id, organization_id, property_id, contract_number, object, signed_on, start_date, end_date, global_value, monthly_value)
values ('92000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001',
        'CT-REL-1', 'Contrato do teste de relatórios', '2025-01-01', '2025-01-01', '2025-03-31', 3000, 1000);
insert into public.contract_landlords (organization_id, contract_id, landlord_id, share_percent) values
  ('00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000040', '92000000-0000-4000-8000-000000000031', 60),
  ('00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000040', '92000000-0000-4000-8000-000000000032', 40);

insert into public.payments (id, organization_id, invoice_id, rent_charge_id, kind, amount, paid_on, reversal_of) values
  ('92000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000021', null, 'payment', 200.00, '2025-02-05', null),
  ('92000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000023', null, 'payment', 100.00, '2025-03-10', null),
  ('92000000-0000-4000-8000-000000000053', '00000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000023', null, 'reversal', 100.00, '2025-03-15', '92000000-0000-4000-8000-000000000052');
insert into public.payments (organization_id, rent_charge_id, kind, amount, paid_on)
select '00000000-0000-4000-8000-000000000001', r.id, 'payment', 1000.00, '2025-01-10'
from public.rent_charges r where r.contract_id = '92000000-0000-4000-8000-000000000040' and r.competence = '2025-01-01';

select is((select count(*)::int from public.rent_charges where contract_id = '92000000-0000-4000-8000-000000000040'), 3, 'Três aluguéis gerados (01 a 03/2025)');

-- ------------------------------------------------------------ Base competência
set local role authenticated;
select tests.set_claims(:'gestor');
select public.expense_report('{"start":"2025-01-01","end":"2025-03-01"}') as rep \gset
select is((:'rep'::jsonb->'summary'->>'total')::numeric, 3380.00, 'Total = aluguéis 3.000 + energia 300 + água 80 (cancelada e imóvel fora do escopo ficam fora)');
select is((:'rep'::jsonb->'summary'->>'paid')::numeric, 1200.00, 'Pago = 1.000 + 200; pagamento estornado é abatido');
select is((:'rep'::jsonb->'summary'->>'overdue')::numeric, 2180.00, 'Vencido = aluguéis 02 e 03 + energia 03 (estornada) + água 01');
select is((:'rep'::jsonb->'summary'->>'pending')::numeric, 0.00, 'Nada pendente a vencer no período');
select is((select (x->>'total')::numeric from jsonb_array_elements(:'rep'::jsonb->'by_kind') x where x->>'kind' = 'energy'), 300.00,
  'Energia sem a fatura cancelada');
select is((select (x->>'total')::numeric from jsonb_array_elements(:'rep'::jsonb->'by_counterpart') x where x->>'name' = 'Locador Relatório Um'), 1800.00,
  'Aluguel rateado pelo percentual do locador (60%)');
select is((select sum((x->>'total')::numeric) from jsonb_array_elements(:'rep'::jsonb->'by_counterpart') x), 3380.00,
  'Soma por fornecedor/locador confere com o total');
select is((select sum((x->>'total')::numeric) from jsonb_array_elements(:'rep'::jsonb->'monthly') x), 3380.00,
  'Soma mensal confere com o total');
select is((select (x->>'percent')::numeric from jsonb_array_elements(:'rep'::jsonb->'comparison'->'by_kind') x where x->>'kind' = 'water'), 100.00,
  'Comparativo com o ano anterior: água 80 x 40 = +100%');
select is((select (x->>'consumption')::numeric from jsonb_array_elements(:'rep'::jsonb->'consumption') x
           where x->>'kind' = 'energy' and x->>'period' = '2025-01-01'), 100::numeric, 'Consumo de energia por imóvel e mês');

select is((public.expense_report('{"start":"2025-01-01","end":"2025-03-01","kinds":["water"],"statuses":["overdue"]}')->'summary'->>'total')::numeric,
  80.00, 'Filtros de tipo e situação');
select is((public.expense_report(jsonb_build_object('start', '2025-01-01', 'end', '2025-03-01', 'counterpart_id', '92000000-0000-4000-8000-000000000032'))->'summary'->>'total')::numeric,
  1200.00, 'Filtro por locador (40% dos aluguéis)');

-- ------------------------------------------------------------ Base pagamento
select is((public.expense_report('{"start":"2025-01-01","end":"2025-03-01","basis":"payment"}')->'summary'->>'total')::numeric,
  1200.00, 'Base pagamento: 1.000 + 200 + 100 - 100 (estorno)');
select is((select (x->>'total')::numeric from jsonb_array_elements(public.expense_report('{"start":"2025-01-01","end":"2025-03-01","basis":"payment"}')->'monthly') x
           where x->>'period' = '2025-03-01'), 0.00, 'Estorno abatido no mês do pagamento');

-- ------------------------------------------------------------ RLS e permissão
select tests.set_claims(:'fora');
select is((public.expense_report('{"start":"2025-01-01","end":"2025-03-01"}')->'summary'->>'total')::numeric, 500.00,
  'Outro escopo soma somente o próprio imóvel');
select tests.set_claims(:'sem');
select throws_ok($$select public.expense_report('{}')$$, '42501', null, 'Sem finance.reports.view não há relatório');

-- ------------------------------------------------------------ Painel usa a mesma base
select tests.set_claims(:'gestor');
select is(
  (select coalesce(sum((s->>'rent')::numeric + (s->>'water')::numeric + (s->>'energy')::numeric), 0) from jsonb_array_elements(public.dashboard_finance_stats(12)->'series') s),
  (public.expense_report(jsonb_build_object('start', (date_trunc('month', private.today_local()) - interval '11 month')::date,
                                            'end', date_trunc('month', private.today_local())::date))->'summary'->>'total')::numeric,
  'Gráficos do Painel e relatório usam a mesma base');

select * from finish();
rollback;
