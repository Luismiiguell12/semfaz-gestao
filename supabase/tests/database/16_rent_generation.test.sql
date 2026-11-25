-- Fase 7: geração automática de aluguéis — vigência, proporcionalidade, aditivos e idempotência.
-- Datas no futuro para controlar a geração (p_until) e não depender do dia em que o teste roda.
begin;
\ir _helpers.psql
select plan(14);

select (date_trunc('month', private.today_local()) + interval '2 month')::date as m0 \gset
create function tests.dim(d date) returns int language sql as $$ select extract(day from (date_trunc('month', d) + interval '1 month' - interval '1 day'))::int $$;
create function tests.m(k int) returns date language sql as $$ select (date_trunc('month', private.today_local()) + make_interval(months => 2 + k))::date $$;

insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id, purpose) values
  ('96000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imóvel Aluguel Teste', 'Rua A', '1', 'Centro', '49400-000', 'Lagarto', 'SE', '00000000-0000-4000-8000-000000000101', 'Teste');
-- Vigência do dia 10 do mês m0 ao dia 20 do mês m0+5; R$ 3.100,00 mensais.
insert into public.contracts (id, organization_id, property_id, contract_number, object, signed_on, start_date, end_date, global_value, monthly_value)
values ('96000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001',
        'CT-ALUG-1', 'Contrato para teste de aluguéis', :'m0'::date, :'m0'::date + 9, tests.m(5) + 19, 18600, 3100);

select is((select count(*)::int from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010'), 0,
  'Nada é gerado antes da competência chegar');

select is(private.generate_rent_charges('96000000-0000-4000-8000-000000000010', tests.m(1)), 2,
  'Gera somente até a competência informada (m0 e m0+1)');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(0)),
  round(3100.00 / tests.dim(tests.m(0)) * (tests.dim(tests.m(0)) - 9), 2),
  'Primeiro mês proporcional (do dia 10 ao fim do mês)');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(1)),
  3100.00::numeric, 'Mês cheio: valor mensal');

-- Aditivo de valor a partir do dia 16 de m0+2 e aditivo de prazo até o fim de m0+7.
insert into public.contract_amendments (organization_id, contract_id, amendment_number, kind, signed_on, new_monthly_value, value_effective_from, description)
values ('00000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000010', '1º TA', 'value', :'m0'::date,
        3600, tests.m(2) + 15, 'Reajuste do valor mensal');
insert into public.contract_amendments (organization_id, contract_id, amendment_number, kind, signed_on, new_end_date, description)
values ('00000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000010', '2º TA', 'term', :'m0'::date,
        (tests.m(8) - 1), 'Prorrogação da vigência');

select is(private.generate_rent_charges('96000000-0000-4000-8000-000000000010', tests.m(10)), 6,
  'Com a prorrogação, gera até o novo fim (m0+2 a m0+7)');
select is((select count(*)::int from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010'), 8,
  'Oito competências no total; nada após a vigência efetiva');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(2)),
  round(3100.00 / tests.dim(tests.m(2)) * 15 + 3600.00 / tests.dim(tests.m(2)) * (tests.dim(tests.m(2)) - 15), 2),
  'Mês do reajuste dividido: 15 dias no valor antigo e o restante no novo');
select is((select jsonb_array_length(calc_memo->'periods') from public.rent_charges
            where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(2)), 2,
  'Memória de cálculo registra os dois períodos');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(3)),
  3600.00::numeric, 'Após o reajuste: novo valor mensal');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(5)),
  3600.00::numeric, 'Mês que era o último (dia 20) passa a ser cheio com a prorrogação');
select is((select amount from public.rent_charges where contract_id = '96000000-0000-4000-8000-000000000010' and competence = tests.m(0)),
  round(3100.00 / tests.dim(tests.m(0)) * (tests.dim(tests.m(0)) - 9), 2),
  'Competências já geradas não são recalculadas pelos aditivos');
select is((select contracts.monthly_value from public.contracts where id = '96000000-0000-4000-8000-000000000010'), 3100.00::numeric,
  'Valor original do contrato preservado');

select is(private.generate_rent_charges('96000000-0000-4000-8000-000000000010', tests.m(10)), 0,
  'Reexecução é idempotente (nenhuma competência duplicada)');

update public.contracts set admin_status = 'terminated' where id = '96000000-0000-4000-8000-000000000010';
select is(private.generate_rent_charges('96000000-0000-4000-8000-000000000010', tests.m(12)), 0,
  'Contrato encerrado não gera aluguéis');

select * from finish();
rollback;
