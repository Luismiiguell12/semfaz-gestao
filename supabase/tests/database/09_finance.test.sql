-- Financeiro: unidades e vínculos, faturas, pagamentos/estornos, aluguéis e consumo.
begin;
\ir _helpers.psql
select plan(34);

select tests.create_user('fi_admin', array['admin']) as admin \gset
select tests.create_user('fi_colab', array['collaborator']) as colab \gset
select tests.create_user('fi_fora', array['manager']) as fora \gset
select tests.enroll_mfa(:'admin');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'colab', '00000000-0000-4000-8000-000000000101');
insert into public.departments (id, organization_id, kind, name) values
  ('90000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Fora Financeiro');
insert into public.user_department_access (organization_id, user_id, department_id) values
  ('00000000-0000-4000-8000-000000000001', :'fora', '90000000-0000-4000-8000-000000000009');

insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose) values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel Financeiro A', 'Rua A', '1', 'Centro', '49400-000', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste'),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Imóvel Financeiro B', 'Rua B', '2', 'Centro', '49400-000', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste');

select id as energisa from public.suppliers where name = 'Energisa' \gset
select private.today_local() as today \gset
select date_trunc('month', :'today'::date)::date as cur \gset

-- ---------------------------------------------------------------- Unidades
set local role authenticated;
select tests.set_claims(:'admin', 'aal2');
select public.save_consumer_unit(null, jsonb_build_object('supplier_id', :'energisa', 'identifier', 'uc-1001', 'holder_name', 'Prefeitura Teste')) as unit \gset
select throws_ok(format($$select public.save_consumer_unit(null, jsonb_build_object('supplier_id', %L, 'identifier', 'UC-1001', 'holder_name', 'Outro'))$$, :'energisa'),
  '23505', null, 'Número da UC é único por fornecedor');
select lives_ok(format($$select public.assign_consumer_unit(%L, '90000000-0000-4000-8000-000000000001', %L, 'Vínculo inicial da unidade')$$, :'unit', (:'cur'::date - interval '5 month')::date),
  'Unidade vinculada ao imóvel A');
select lives_ok(format($$select public.assign_consumer_unit(%L, '90000000-0000-4000-8000-000000000002', %L, 'Transferência para o imóvel B')$$, :'unit', :'cur'),
  'Transferência encerra o vínculo anterior e abre outro');
select is((select count(*)::int from public.unit_assignments where unit_id = :'unit'), 2, 'Histórico de vínculos preservado');
reset role;
select throws_ok(format($$insert into public.unit_assignments (organization_id, unit_id, property_id, start_date) values ('00000000-0000-4000-8000-000000000001', %L, '90000000-0000-4000-8000-000000000001', %L)$$, :'unit', (:'cur'::date - interval '1 month')::date),
  '23P01', null, 'Períodos sobrepostos são bloqueados por constraint de exclusão');
select throws_ok(format($$update public.unit_assignments set end_date = %L where unit_id = %L and end_date is not null$$, :'today', :'unit'),
  '42501', null, 'Vínculo encerrado não pode ser alterado');
set local role authenticated;
select tests.set_claims(:'admin', 'aal2');

-- ---------------------------------------------------------------- Faturas
-- Três meses anteriores (no imóvel A) com consumo 100; mês atual 140 (imóvel B).
select (public.create_invoice(jsonb_build_object('unit_id', :'unit', 'competence', (:'cur'::date - interval '3 month')::date, 'consumption', 100, 'amount', '200.00', 'due_date', (:'cur'::date - interval '2 month')::date)))->>'invoice_id' as inv_m3 \gset
select is((select status::text from public.invoices_overview where id = :'inv_m3'), 'overdue', 'Fatura vencida e sem pagamento: situação calculada "Vencida"');
select is((select property_id from public.invoices where id = :'inv_m3'), '90000000-0000-4000-8000-000000000001'::uuid, 'Imóvel derivado do vínculo na competência');
select is((select measure_unit from public.invoices where id = :'inv_m3'), 'kWh', 'Unidade de medida derivada do fornecedor');
select is((select status from public.consumption_records where invoice_id = :'inv_m3'), 'insufficient_history', 'Sem três meses de histórico: "histórico insuficiente"');
select public.create_invoice(jsonb_build_object('unit_id', :'unit', 'competence', (:'cur'::date - interval '2 month')::date, 'consumption', 100, 'amount', '200.00', 'due_date', (:'cur'::date - interval '1 month')::date)) is not null as ok2 \gset
select public.create_invoice(jsonb_build_object('unit_id', :'unit', 'competence', (:'cur'::date - interval '1 month')::date, 'consumption', 100, 'amount', '200.00', 'due_date', :'today')) is not null as ok3 \gset
select (public.create_invoice(jsonb_build_object('unit_id', :'unit', 'competence', :'cur', 'consumption', 140, 'amount', '280.00', 'due_date', (:'today'::date + 20))))->>'invoice_id' as inv_cur \gset
select is((select status from public.consumption_records where invoice_id = :'inv_cur'), 'alert', 'Aumento de 40% sobre a média dos 3 meses anteriores gera alerta');
select is((select increase_percent from public.consumption_records where invoice_id = :'inv_cur'), 40.00::numeric, 'Percentual de aumento registrado');
select is((select status::text from public.invoices_overview where id = :'inv_cur'), 'pending', 'Fatura a vencer sem pagamento: "Pendente"');
select is((select property_id from public.invoices where id = :'inv_cur'), '90000000-0000-4000-8000-000000000002'::uuid, 'Após transferência, a fatura vai para o novo imóvel');

-- Duplicidade (solicitada pelo colaborador)
select tests.set_claims(:'colab');
select throws_ok(format($$select public.create_invoice(jsonb_build_object('unit_id', %L, 'competence', %L, 'consumption', 10, 'amount', '50.00', 'due_date', %L))$$, :'unit', :'cur', :'today'),
  '23505', null, 'Fatura duplicada sem justificativa é bloqueada');
select (public.create_invoice(jsonb_build_object('unit_id', :'unit', 'competence', :'cur', 'consumption', 10, 'amount', '50.00', 'due_date', (:'today'::date + 20)), 'Segunda via com encargos de religação'))->>'approval_request_id' as req_dup \gset
select ok(:'req_dup' is not null, 'Duplicata justificada vira solicitação de aprovação');

-- ---------------------------------------------------------------- Pagamentos
select tests.set_claims(:'colab');
select (public.request_payment(jsonb_build_object('invoice_id', :'inv_cur', 'kind', 'payment', 'amount', '100.00', 'paid_on', :'today'), 'Pagamento parcial da fatura')).id as req_p1 \gset
select is((select status::text from public.invoices_overview where id = :'inv_cur'), 'pending', 'Pagamento solicitado não altera a situação antes da aprovação');
select throws_ok(format($$select public.request_payment(jsonb_build_object('invoice_id', %L, 'kind', 'payment', 'amount', '999.00', 'paid_on', %L), 'Pagamento acima do saldo')$$, :'inv_cur', :'today'),
  '23514', null, 'Pagamento acima do saldo em aberto é recusado');
select throws_ok(format($$select public.decide_approval(%L, 'approved')$$, :'req_p1'), '42501', null, 'Colaborador não aprova pagamento');

select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_p1', 'approved')).status::text, 'approved', 'Administrador aprova o pagamento parcial');
select is((select status::text from public.invoices_overview where id = :'inv_cur'), 'partially_paid', 'Situação calculada: "Parcialmente paga"');
select is((public.decide_approval(:'req_dup', 'approved')).status::text, 'approved', 'Duplicata justificada aprovada');
select is((select count(*)::int from public.invoices where unit_id = :'unit' and competence = :'cur' and cancelled_at is null), 2, 'Duas faturas na competência (uma marcada como duplicata justificada)');

select tests.set_claims(:'colab');
select (select id from public.payments where invoice_id = :'inv_cur') as pay1 \gset
select (public.request_payment(jsonb_build_object('invoice_id', :'inv_cur', 'kind', 'payment', 'amount', '180.00', 'paid_on', :'today'), 'Pagamento complementar')).id as req_p2 \gset
select (public.request_payment(jsonb_build_object('invoice_id', :'inv_cur', 'kind', 'reversal', 'reversal_of', :'pay1', 'amount', '100.00', 'paid_on', :'today'), 'Estorno do pagamento em duplicidade')).id as req_rev \gset
select tests.set_claims(:'admin', 'aal2');
select is((public.decide_approval(:'req_p2', 'approved')).status::text, 'approved', 'Complemento aprovado');
select is((select status::text from public.invoices_overview where id = :'inv_cur'), 'paid', 'Situação calculada: "Paga" (soma dos pagamentos aprovados)');
select is((public.decide_approval(:'req_rev', 'approved')).status::text, 'approved', 'Estorno aprovado como registro independente');
select is((select balance from public.invoices_overview where id = :'inv_cur'), 100.00::numeric, 'Estorno devolve o saldo em aberto');
select is((select count(*)::int from public.payments where invoice_id = :'inv_cur'), 3, 'Pagamento original preservado ao lado do complemento e do estorno');
reset role;
select throws_ok(format('update public.payments set amount = 1 where id = %L', :'pay1'), '42501', null, 'Pagamentos são imutáveis');
select throws_ok(format('delete from public.payments where id = %L', :'pay1'), '42501', null, 'Pagamentos não podem ser apagados');

-- ---------------------------------------------------------------- Aluguéis
insert into public.contracts (id, organization_id, property_id, contract_number, object, signed_on, start_date, end_date, global_value, monthly_value)
values ('90000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
        'CT-FIN-1', 'Contrato para teste financeiro', (:'cur'::date - interval '2 month')::date + 9, (:'cur'::date - interval '2 month')::date + 9,
        (:'cur'::date + interval '6 month')::date, 12000, 1000);
select is((select count(*)::int from public.rent_charges where contract_id = '90000000-0000-4000-8000-000000000010'), 3, 'Aluguéis gerados até a competência atual na aprovação/cadastro do contrato');
select is(private.generate_rent_charges(), 0, 'Geração idempotente: não duplica lançamentos');
select ok((select amount < 1000 and calc_memo ? 'periods' from public.rent_charges where contract_id = '90000000-0000-4000-8000-000000000010' order by competence limit 1),
  'Primeira competência proporcional, com memória de cálculo');

-- ---------------------------------------------------------------- Escopo
set local role authenticated;
select tests.set_claims(:'fora');
select is((select count(*)::int from public.invoices_overview) + (select count(*)::int from public.rent_charges_overview) + (select count(*)::int from public.payments),
  0, 'Usuário fora do escopo não vê faturas, aluguéis nem pagamentos');

select * from finish();
rollback;
