-- =============================================================================
-- SEMFAZ Gestão — CARGA DE DEMONSTRAÇÃO (somente HOMOLOGAÇÃO / ambiente local).
--
-- Dados 100% FICTÍCIOS para apresentar o sistema: pessoas, locadores, CPFs/CNPJs
-- (gerados com dígitos verificadores válidos), endereços, valores e demandas são
-- inventados. Os servidores fictícios NÃO têm senha (não conseguem entrar) e usam
-- e-mails no domínio reservado ".invalid" (nunca entregam mensagens).
--
-- Identificação: todos os registros-raiz usam ids com prefixo "d" (d1… a d8…);
-- os demais (aluguéis, faturas, pagamentos, histórico) pertencem a eles.
-- Remoção: scripts/demo/remover-demonstracao.sql.
-- As datas são relativas ao dia da execução (contratos vencendo em 30/60/90 dias,
-- faturas dos últimos 12 meses, demandas atrasadas etc.).
-- Execução: workflow "Carga de demonstração" (homologação) ou, localmente,
--   docker exec -i supabase_db_semfaz-gestao psql -U postgres -v ON_ERROR_STOP=1 < scripts/demo/carga-demonstracao.sql
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.departments where id = 'd1000000-0000-4000-8000-000000000001') then
    raise exception 'A carga de demonstração já foi aplicada neste banco (nada foi alterado).';
  end if;
end $$;

-- ----------------------------------------------------------------------------- utilitários
create function pg_temp.cpf(p9 text) returns text language plpgsql as $$
declare d int[]; s int; i int; v1 int; v2 int;
begin
  d := array(select substr(p9, g, 1)::int from generate_series(1, 9) g);
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  v1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0; for i in 1..9 loop s := s + d[i] * (12 - i); end loop; s := s + v1 * 2;
  v2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return p9 || v1 || v2;
end $$;
create function pg_temp.cnpj(p12 text) returns text language plpgsql as $$
declare w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
        s int := 0; i int; v1 int; v2 int; b text := p12;
begin
  for i in 1..12 loop s := s + substr(b, i, 1)::int * w1[i]; end loop;
  v1 := case when s % 11 < 2 then 0 else 11 - s % 11 end; b := b || v1; s := 0;
  for i in 1..13 loop s := s + substr(b, i, 1)::int * w2[i]; end loop;
  v2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return b || v2;
end $$;
create function pg_temp.id(p text, n int) returns uuid language sql as $$
  select (p || '000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.ts(d date, h text default '10:00') returns timestamptz language sql as $$
  select (d + h::time) at time zone 'America/Maceio' $$;

-- ----------------------------------------------------------------------------- estrutura
-- Secretarias usuárias dos imóveis e diretorias da SEMFAZ (fictícias, para demonstração).
insert into public.departments (id, organization_id, kind, name, parent_id) values
  (pg_temp.id('d1', 1), '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Municipal de Educação', null),
  (pg_temp.id('d1', 2), '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Municipal de Saúde', null),
  (pg_temp.id('d1', 3), '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Municipal de Assistência Social', null),
  (pg_temp.id('d1', 4), '00000000-0000-4000-8000-000000000001', 'secretariat', 'Secretaria Municipal de Administração', null),
  (pg_temp.id('d1', 5), '00000000-0000-4000-8000-000000000001', 'directorate', 'Diretoria de Arrecadação', '00000000-0000-4000-8000-000000000101'),
  (pg_temp.id('d1', 6), '00000000-0000-4000-8000-000000000001', 'directorate', 'Diretoria de Tesouraria', '00000000-0000-4000-8000-000000000101'),
  (pg_temp.id('d1', 7), '00000000-0000-4000-8000-000000000001', 'directorate', 'Diretoria de Contabilidade e Patrimônio', '00000000-0000-4000-8000-000000000101');

-- Servidores fictícios (sem senha; não entram no sistema).
create temporary table demo_people (n int, full_name text, username text, job text, dept uuid, role text) on commit drop;
insert into demo_people values
  (1, 'Ana Cláudia Menezes Santos', 'ana.menezes', 'Diretora de Contabilidade e Patrimônio', pg_temp.id('d1', 7), 'manager'),
  (2, 'Roberto Carlos Andrade Lima', 'roberto.andrade', 'Diretor de Arrecadação', pg_temp.id('d1', 5), 'manager'),
  (3, 'Juliana Prado Fontes', 'juliana.fontes', 'Técnica em Contabilidade', pg_temp.id('d1', 7), 'collaborator'),
  (4, 'Marcos Vinícius Oliveira', 'marcos.oliveira', 'Assistente Administrativo', pg_temp.id('d1', 7), 'collaborator'),
  (5, 'Fernanda Lúcia Barreto', 'fernanda.barreto', 'Fiscal de Contratos', pg_temp.id('d1', 6), 'collaborator'),
  (6, 'Paulo Henrique Sobral', 'paulo.sobral', 'Agente Fazendário', pg_temp.id('d1', 5), 'collaborator'),
  (7, 'Carla Regina Teles', 'carla.teles', 'Assistente Financeira', pg_temp.id('d1', 6), 'collaborator'),
  (8, 'Diego Nascimento Rocha', 'diego.rocha', 'Auxiliar Administrativo', pg_temp.id('d1', 7), 'collaborator'),
  (9, 'Luciana Matos Cardoso', 'luciana.cardoso', 'Controladora Interna', '00000000-0000-4000-8000-000000000101', 'viewer'),
  (10, 'Tiago Almeida Feitosa', 'tiago.feitosa', 'Assessor Técnico', '00000000-0000-4000-8000-000000000101', 'viewer');

-- Mesmo formato dos usuários criados pelo Supabase: campos de token como texto vazio
-- (NULL quebra a leitura pelo serviço de autenticação) e identidade "email".
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new,
                        email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', pg_temp.id('d2', n), 'authenticated', 'authenticated',
       username || '@demonstracao.invalid', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
       '', '', '', '', '', '', '', ''
from demo_people;
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select pg_temp.id('d2', n)::text, pg_temp.id('d2', n),
       jsonb_build_object('sub', pg_temp.id('d2', n)::text, 'email', username || '@demonstracao.invalid', 'email_verified', true),
       'email', now(), now()
from demo_people;
insert into public.profiles (id, organization_id, full_name, email, username, job_title, department_id, employee_number)
select pg_temp.id('d2', n), '00000000-0000-4000-8000-000000000001', full_name, '', username, job, dept, 'DEMO-' || lpad(n::text, 3, '0')
from demo_people;
insert into public.user_roles (organization_id, user_id, role_id)
select '00000000-0000-4000-8000-000000000001', pg_temp.id('d2', p.n), r.id
from demo_people p join public.roles r on r.code = p.role and r.organization_id = '00000000-0000-4000-8000-000000000001';
-- Escopo: gestores e equipe da SEMFAZ acompanham os imóveis de todas as secretarias usuárias.
insert into public.user_department_access (organization_id, user_id, department_id)
select '00000000-0000-4000-8000-000000000001', pg_temp.id('d2', p.n), d.id
from demo_people p cross join (values ('00000000-0000-4000-8000-000000000101'::uuid), (pg_temp.id('d1', 1)), (pg_temp.id('d1', 2)),
                                      (pg_temp.id('d1', 3)), (pg_temp.id('d1', 4))) d(id)
where p.role in ('manager', 'collaborator', 'viewer');

-- ----------------------------------------------------------------------------- locadores
insert into public.landlords (id, organization_id, person_type, name, document, phone, email, address) values
  (pg_temp.id('d3', 1), '00000000-0000-4000-8000-000000000001', 'individual', 'José Augusto Fontes de Carvalho', pg_temp.cpf('318472659'), '79991234501', null, 'Rua Laranjeiras, 120, Centro, Lagarto/SE'),
  (pg_temp.id('d3', 2), '00000000-0000-4000-8000-000000000001', 'individual', 'Maria do Socorro Almeida Prado', pg_temp.cpf('427581936'), '79991234502', 'socorro.prado@exemplo.invalid', 'Av. Contorno, 845, Cidade Nova, Lagarto/SE'),
  (pg_temp.id('d3', 3), '00000000-0000-4000-8000-000000000001', 'individual', 'Antônio Carlos Reis Menezes', pg_temp.cpf('536194827'), '79991234503', null, 'Rua Sete de Setembro, 33, Centro, Lagarto/SE'),
  (pg_temp.id('d3', 4), '00000000-0000-4000-8000-000000000001', 'individual', 'Francisca Helena Sobral Dantas', pg_temp.cpf('645273918'), '79991234504', null, 'Povoado Brasília, s/n, Zona Rural, Lagarto/SE'),
  (pg_temp.id('d3', 5), '00000000-0000-4000-8000-000000000001', 'individual', 'Raimundo Nonato Batista', pg_temp.cpf('754362819'), '79991234505', null, 'Rua do Rosário, 410, Centro, Lagarto/SE'),
  (pg_temp.id('d3', 6), '00000000-0000-4000-8000-000000000001', 'individual', 'Lúcia de Fátima Teles Santana', pg_temp.cpf('863451729'), '79991234506', 'lucia.santana@exemplo.invalid', 'Rua Projetada A, 15, Exposição, Lagarto/SE'),
  (pg_temp.id('d3', 7), '00000000-0000-4000-8000-000000000001', 'individual', 'Geraldo Magela Fonseca', pg_temp.cpf('972548136'), '79991234507', null, 'Rua Getúlio Vargas, 98, Centro, Lagarto/SE'),
  (pg_temp.id('d3', 8), '00000000-0000-4000-8000-000000000001', 'individual', 'Terezinha Costa Vasconcelos', pg_temp.cpf('183627945'), '79991234508', null, 'Av. Rotary, 1200, Horta, Lagarto/SE'),
  (pg_temp.id('d3', 9), '00000000-0000-4000-8000-000000000001', 'individual', 'Edvaldo Pereira Lisboa', pg_temp.cpf('294736158'), '79991234509', null, 'Rua Dom Pedro II, 77, Centro, Aracaju/SE'),
  (pg_temp.id('d3', 10), '00000000-0000-4000-8000-000000000001', 'company', 'Imobiliária Vale do Piauitinga Ltda.', pg_temp.cnpj('482937160001'), '7936311001', 'contato@valedopiauitinga.invalid', 'Praça Filomeno Hora, 50, Centro, Lagarto/SE'),
  (pg_temp.id('d3', 11), '00000000-0000-4000-8000-000000000001', 'company', 'Construtora Serra Verde Empreendimentos S.A.', pg_temp.cnpj('593048270001'), '7932145566', null, 'Rod. SE-170, km 3, Lagarto/SE'),
  (pg_temp.id('d3', 12), '00000000-0000-4000-8000-000000000001', 'company', 'Agreste Participações e Locações Ltda.', pg_temp.cnpj('604159380001'), '7930214455', null, 'Av. Barão de Maruim, 300, Centro, Aracaju/SE');

-- ----------------------------------------------------------------------------- imóveis
create temporary table demo_props (n int, name text, street text, num text, district text, city text, cep text, dept uuid,
                                   purpose text, responsible int, status public.property_status) on commit drop;
insert into demo_props values
  (1, 'Escola Municipal Profª Maria das Dores Santos', 'Rua Coronel Souza Freire', '214', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 1), 'Funcionamento de escola de ensino fundamental (anos iniciais)', 4, 'active'),
  (2, 'Creche Municipal Pequeno Príncipe', 'Rua Sergipe', '57', 'Cidade Nova', 'Lagarto', '49400-000', pg_temp.id('d1', 1), 'Creche para crianças de 0 a 3 anos', 4, 'active'),
  (3, 'Unidade Básica de Saúde Cidade Nova', 'Av. Contorno', '1450', 'Cidade Nova', 'Lagarto', '49400-000', pg_temp.id('d1', 2), 'Atenção básica à saúde (UBS)', 8, 'active'),
  (4, 'Centro de Especialidades Médicas', 'Rua Rio Branco', '330', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 2), 'Consultas especializadas e exames', 8, 'active'),
  (5, 'CRAS Novo Horizonte', 'Rua Projetada B', '22', 'Novo Horizonte', 'Lagarto', '49400-000', pg_temp.id('d1', 3), 'Centro de Referência de Assistência Social', 3, 'active'),
  (6, 'Conselho Tutelar', 'Rua Josino Menezes', '91', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 3), 'Sede do Conselho Tutelar', 3, 'active'),
  (7, 'Anexo da SEMFAZ — Atendimento ao Contribuinte', 'Praça da Piedade', '18', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 5), 'Atendimento presencial ao contribuinte (IPTU, ISS e certidões)', 6, 'active'),
  (8, 'Arquivo Geral da Fazenda', 'Rua Laranjeiras', '402', 'Exposição', 'Lagarto', '49400-000', pg_temp.id('d1', 7), 'Guarda de documentos fiscais e contábeis', 4, 'active'),
  (9, 'Almoxarifado Central', 'Rod. SE-170', 'km 2', 'Distrito Industrial', 'Lagarto', '49400-000', pg_temp.id('d1', 4), 'Armazenamento de materiais de consumo e permanentes', 8, 'active'),
  (10, 'Junta de Serviço Militar', 'Rua Getúlio Vargas', '145', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 4), 'Alistamento militar e atendimento ao cidadão', 3, 'active'),
  (11, 'Escola Municipal Rural Povoado Brasília', 'Povoado Brasília', 's/n', 'Zona Rural', 'Lagarto', '49400-000', pg_temp.id('d1', 1), 'Escola de ensino fundamental na zona rural', 4, 'active'),
  (12, 'Posto do Cadastro Imobiliário', 'Av. Rotary', '890', 'Horta', 'Lagarto', '49400-000', pg_temp.id('d1', 5), 'Atualização cadastral de imóveis para o IPTU', 6, 'active'),
  (13, 'Casa de Apoio ao Paciente em Aracaju', 'Rua Itabaiana', '610', 'São José', 'Aracaju', '49015-110', pg_temp.id('d1', 2), 'Hospedagem de pacientes em tratamento na capital', 8, 'active'),
  (14, 'Antigo Depósito da Rua do Rosário', 'Rua do Rosário', '505', 'Centro', 'Lagarto', '49400-000', pg_temp.id('d1', 4), 'Depósito desocupado após o fim do contrato', 8, 'vacated');
insert into public.properties (id, organization_id, name, street, address_number, district, postal_code, city, state, department_id,
                               purpose, internal_responsible_id, status, occupation_date)
select pg_temp.id('d4', n), '00000000-0000-4000-8000-000000000001', name, street, num, district, cep, city, 'SE', dept,
       purpose, pg_temp.id('d2', responsible), status, (private.today_local() - (n * 97 + 200))::date
from demo_props;

-- Locadores de cada imóvel (um imóvel com dois locadores, 60% / 40%).
insert into public.property_landlords (organization_id, property_id, landlord_id, share_percent)
select '00000000-0000-4000-8000-000000000001', pg_temp.id('d4', p), pg_temp.id('d3', l), s
from (values (1, 10, null::numeric), (2, 1, null), (3, 11, null), (4, 12, null), (5, 2, null), (6, 3, null), (7, 5, 60), (7, 6, 40),
             (8, 7, null), (9, 11, null), (10, 8, null), (11, 4, null), (12, 10, null), (13, 9, null), (14, 3, null)) v(p, l, s);

-- ----------------------------------------------------------------------------- contratos
-- (imóvel, início relativo em meses, duração em meses, valor mensal, gestor, fiscal, ajuste do fim em dias)
-- Os vencimentos ficam distribuídos: em ~20, ~50 e ~80 dias e um contrato vencido há 40 dias.
create temporary table demo_contracts (n int, start_date date, end_date date, monthly numeric, mgr int, insp int) on commit drop;
insert into demo_contracts
select n, s, e, m, mgr, insp from (values
  (1, -22, 36, 4800.00, 1, 5), (2, -30, null, 3900.00, 1, 5), (3, -14, 24, 5200.00, 2, 5), (4, -34, null, 8900.00, 2, 7),
  (5, -10, 30, 2600.00, 1, 7), (6, -26, null, 2100.00, 1, 7), (7, -18, 36, 6500.00, 2, 5), (8, -40, null, 3100.00, 1, 5),
  (9, -12, 24, 7400.00, 2, 7), (10, -8, 24, 1900.00, 1, 7), (11, -20, 36, 2300.00, 1, 5), (12, -6, 24, 2800.00, 2, 5),
  (13, -16, 24, 3500.00, 2, 7)) v(n, rel, dur, m, mgr, insp)
cross join lateral (select (date_trunc('month', private.today_local()) + make_interval(months => rel))::date + 4 as s) a
cross join lateral (select case n
    when 2 then private.today_local() + 50
    when 4 then private.today_local() + 20
    when 6 then private.today_local() - 40
    when 8 then private.today_local() + 80
    else (s + make_interval(months => dur))::date - 1 end as e) b;

insert into public.contracts (id, organization_id, property_id, contract_number, process_number, modality_id, object, signed_on,
                              start_date, end_date, global_value, monthly_value, adjustment_index_id, base_date, manager_id, inspector_id)
select pg_temp.id('d5', c.n), '00000000-0000-4000-8000-000000000001', pg_temp.id('d4', c.n),
       lpad((c.n * 7 % 90 + 3)::text, 3, '0') || '/' || extract(year from c.start_date),
       'PA ' || lpad((c.n * 131 % 900 + 100)::text, 4, '0') || '/' || extract(year from c.start_date),
       (select id from public.contract_modalities order by name limit 1),
       'Locação do imóvel destinado a: ' || p.purpose, c.start_date - 6, c.start_date, c.end_date,
       round(c.monthly * greatest(1, ((c.end_date - c.start_date) / 30.44)::numeric), 2), c.monthly,
       (select id from public.adjustment_indexes where name = case when c.n % 3 = 0 then 'IGP-M' else 'IPCA' end limit 1),
       c.start_date, pg_temp.id('d2', c.mgr), pg_temp.id('d2', c.insp)
from demo_contracts c join demo_props p on p.n = c.n;

insert into public.contract_landlords (organization_id, contract_id, landlord_id, share_percent)
select '00000000-0000-4000-8000-000000000001', pg_temp.id('d5', p.n), pl.landlord_id, pl.share_percent
from demo_props p join public.property_landlords pl on pl.property_id = pg_temp.id('d4', p.n)
where p.n <= 13;

-- Aditivos: reajuste pelo IPCA no anexo da SEMFAZ e prorrogação do Arquivo Geral.
insert into public.contract_amendments (organization_id, contract_id, amendment_number, kind, signed_on, new_monthly_value,
                                        value_effective_from, new_end_date, description)
values
  ('00000000-0000-4000-8000-000000000001', pg_temp.id('d5', 7), '1º Termo Aditivo', 'value',
   (date_trunc('month', private.today_local()) - interval '6 month')::date, 6890.00,
   (date_trunc('month', private.today_local()) - interval '6 month')::date + 4, null,
   'Reajuste anual do aluguel pelo IPCA acumulado de 6,0%.'),
  ('00000000-0000-4000-8000-000000000001', pg_temp.id('d5', 8), '2º Termo Aditivo', 'term',
   (private.today_local() - 300), null, null, (select end_date from demo_contracts where n = 8),
   'Prorrogação da vigência por 12 meses, mantidas as demais cláusulas.');

-- ----------------------------------------------------------------------------- pagamentos dos aluguéis
-- Aluguéis já gerados pelo sistema a partir dos contratos. Pagos até o mês passado,
-- com exceções: Conselho Tutelar com as duas últimas parcelas em atraso, Junta Militar
-- com a última em atraso e um pagamento parcial na Casa de Apoio.
insert into public.payments (organization_id, rent_charge_id, kind, amount, paid_on, notes)
select r.organization_id, r.id, 'payment',
       case when r.contract_id = pg_temp.id('d5', 13) and r.competence = (date_trunc('month', private.today_local()) - interval '1 month')::date
            then round(r.amount / 2, 2) else r.amount end,
       least(r.due_date - (abs(hashtext(r.id::text)) % 4), private.today_local()),
       'Ordem bancária ' || (abs(hashtext(r.id::text)) % 90000 + 10000)
from public.rent_charges r
where r.contract_id in (select pg_temp.id('d5', n) from demo_contracts)
  and r.due_date < private.today_local()
  and not (r.contract_id = pg_temp.id('d5', 6) and r.competence >= (date_trunc('month', private.today_local()) - interval '2 month')::date)
  and not (r.contract_id = pg_temp.id('d5', 10) and r.competence >= (date_trunc('month', private.today_local()) - interval '1 month')::date);

-- ----------------------------------------------------------------------------- unidades consumidoras e faturas
do $$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_energy uuid := (select id from public.suppliers where kind = 'energy' and organization_id = v_org order by name limit 1);
  v_water uuid := (select id from public.suppliers where kind = 'water' and organization_id = v_org order by name limit 1);
  v_m0 date := date_trunc('month', private.today_local())::date;
  p record;
  k int;
  v_comp date;
  v_due date;
  v_kwh numeric;
  v_m3 numeric;
  v_amount numeric;
  v_inv uuid;
  v_season numeric;
begin
  for p in select n, (select start_date from demo_contracts c where c.n = dp.n) as since from demo_props dp where n <= 13 loop
    insert into public.consumer_units (id, organization_id, supplier_id, identifier, holder_name, meter_number, address)
    values (pg_temp.id('d6', p.n * 2 - 1), v_org, v_energy, (300000000 + p.n * 7919)::text, 'Prefeitura Municipal de Lagarto',
            'MED-' || (52000 + p.n * 37), null),
           (pg_temp.id('d6', p.n * 2), v_org, v_water, (8800000 + p.n * 4241)::text, 'Prefeitura Municipal de Lagarto',
            'HID-' || (71000 + p.n * 53), null);
    insert into public.unit_assignments (organization_id, unit_id, property_id, start_date)
    values (v_org, pg_temp.id('d6', p.n * 2 - 1), pg_temp.id('d4', p.n), p.since),
           (v_org, pg_temp.id('d6', p.n * 2), pg_temp.id('d4', p.n), p.since);

    -- 12 competências (do mês atual para trás), a partir da ocupação. A do mês atual
    -- vence no próximo mês e aparece como pendente.
    for k in reverse 11..0 loop
      v_comp := (v_m0 - make_interval(months => k))::date;
      continue when v_comp < date_trunc('month', p.since);
      v_due := (v_comp + interval '1 month')::date + 9;
      v_season := case when extract(month from v_comp) in (12, 1, 2, 3) then 1.25 when extract(month from v_comp) in (6, 7) then 0.85 else 1 end;
      v_kwh := round((600 + (p.n * 337) % 3800) * v_season * (0.93 + (abs(hashtext(p.n || '-' || k)) % 15) / 100.0));
      -- Aumento atípico de consumo na UBS no último mês (gera alerta de consumo).
      if p.n = 3 and k = 1 then v_kwh := round(v_kwh * 1.55); end if;
      v_m3 := round((14 + (p.n * 23) % 95) * (0.92 + (abs(hashtext(k || '-' || p.n)) % 18) / 100.0));
      for v_inv, v_amount in
        insert into public.invoices (organization_id, unit_id, supplier_id, property_id, invoice_number, competence, consumption,
                                     measure_unit, amount, issue_date, due_date)
        values (v_org, pg_temp.id('d6', p.n * 2 - 1), v_energy, pg_temp.id('d4', p.n),
                'EN' || to_char(v_comp, 'YYYYMM') || lpad(p.n::text, 4, '0'), v_comp, v_kwh, 'kWh', round(v_kwh * 0.93 + 48.70, 2),
                v_due - 15, v_due),
               (v_org, pg_temp.id('d6', p.n * 2), v_water, pg_temp.id('d4', p.n),
                'AG' || to_char(v_comp, 'YYYYMM') || lpad(p.n::text, 4, '0'), v_comp, v_m3, 'm³', round(v_m3 * 11.84 + 38.20, 2),
                v_due - 12, v_due)
        returning id, amount
      loop
        -- Pagas no vencimento, exceto: água do Conselho Tutelar (2 meses em atraso)
        -- e as faturas ainda não vencidas.
        if v_due < private.today_local() and not (p.n = 6 and k <= 2 and v_amount < 1000) then
          insert into public.payments (organization_id, invoice_id, kind, amount, paid_on, notes)
          values (v_org, v_inv, 'payment', v_amount, v_due - (abs(hashtext(v_inv::text)) % 3), 'Débito automático');
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------- demandas
-- Datas retroativas (como no histórico real): gatilhos de data desligados só neste bloco.
set local session_replication_role = replica;
do $$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_today date := private.today_local();
  v_admin uuid := coalesce((select p.id from public.profiles p join public.user_roles ur on ur.user_id = p.id
                             join public.roles r on r.id = ur.role_id and r.code = 'admin'
                            where p.id::text not like 'd2%' and p.deleted_at is null order by p.created_at limit 1),
                           pg_temp.id('d2', 1));
  t record;
  v_created timestamptz;
  v_done timestamptz;
  v_id uuid;
begin
  for t in select * from (values
    -- n, título, categoria, secretaria, responsável, participantes, status, criado há (dias), prazo (dias a partir de hoje), conclusão (dias após criar), urgência, prioridade, complexidade
    (1, 'Conferir faturas de energia de outubro', 'Financeiro', 7, 3, array[4], 'done', 40, -30, 6, 'medium', 'normal', 'simple'),
    (2, 'Renovação do contrato do Centro de Especialidades', 'Contratos', 7, 1, array[5, 3], 'in_progress', 25, 15, null, 'high', 'urgent', 'complex'),
    (3, 'Vistoria no imóvel da Creche Pequeno Príncipe', 'Contratos', 7, 5, array[8], 'todo', 6, 12, null, 'medium', 'high', 'medium'),
    (4, 'Relatório mensal de despesas com aluguéis', 'Relatórios', 7, 3, array[]::int[], 'done', 70, -55, 9, 'low', 'normal', 'medium'),
    (5, 'Atualizar cadastro do locador da UBS Cidade Nova', 'Controle administrativo', 7, 4, array[]::int[], 'done', 9, -4, 3, 'low', 'low', 'simple'),
    (6, 'Cobrar segunda via da conta de água do Conselho Tutelar', 'Financeiro', 6, 7, array[5], 'waiting', 18, -2, null, 'high', 'high', 'simple'),
    (7, 'Levantamento de imóveis próprios desocupados', 'Controle administrativo', 7, 8, array[4], 'in_progress', 30, 20, null, 'medium', 'normal', 'complex'),
    (8, 'Parecer sobre reajuste pelo IPCA do Anexo SEMFAZ', 'Contratos', 7, 1, array[3], 'done', 190, -170, 12, 'medium', 'high', 'complex'),
    (9, 'Atender pedido de informação da Câmara sobre aluguéis', 'Atendimento', 7, 2, array[6], 'review', 12, 3, null, 'high', 'urgent', 'medium'),
    (10, 'Organizar arquivo de comprovantes de pagamento', 'Controle administrativo', 7, 8, array[]::int[], 'done', 95, -80, 14, 'low', 'low', 'medium'),
    (11, 'Pesquisa de preços para novo imóvel da Farmácia Básica', 'Licitações e compras', 7, 2, array[5, 6], 'in_progress', 15, 25, null, 'medium', 'high', 'very_complex'),
    (12, 'Conciliar pagamentos de aluguel do trimestre', 'Financeiro', 6, 7, array[3], 'done', 130, -110, 8, 'medium', 'normal', 'medium'),
    (13, 'Notificar locador do Conselho Tutelar sobre o fim do contrato', 'Contratos', 7, 5, array[1], 'todo', 9, -5, null, 'critical', 'urgent', 'simple'),
    (14, 'Consolidar consumo de água das escolas', 'Relatórios', 7, 4, array[3], 'done', 160, -140, 11, 'low', 'normal', 'medium'),
    (15, 'Responder ofício da Controladoria sobre contratos vencidos', 'Atendimento', 7, 1, array[9], 'done', 12, -5, 4, 'high', 'high', 'medium'),
    (16, 'Revisar memória de cálculo dos aluguéis proporcionais', 'Financeiro', 6, 3, array[7], 'todo', 4, 10, null, 'medium', 'normal', 'complex'),
    (17, 'Treinamento da equipe no SEMFAZ Gestão', 'Outros', 7, 1, array[3, 4, 7, 8], 'done', 7, -3, 1, 'low', 'normal', 'simple'),
    (18, 'Atualizar lista de fiscais de contratos', 'Controle administrativo', 7, 5, array[]::int[], 'done', 100, -90, 5, 'low', 'low', 'simple'),
    (19, 'Análise do aumento de energia na UBS Cidade Nova', 'Financeiro', 6, 7, array[8], 'in_progress', 3, 7, null, 'high', 'high', 'medium'),
    (20, 'Elaborar termo aditivo de prazo do Arquivo Geral', 'Contratos', 7, 1, array[5], 'done', 310, -295, 10, 'medium', 'high', 'complex'),
    (21, 'Digitalizar contratos de 2023', 'Controle administrativo', 7, 4, array[8], 'cancelled', 80, -60, null, 'low', 'low', 'medium'),
    (22, 'Planilha de previsão de despesas para a LOA', 'Relatórios', 6, 2, array[7, 3], 'todo', 2, 30, null, 'medium', 'normal', 'very_complex'),
    (23, 'Conferir faturas de água do mês anterior', 'Financeiro', 6, 7, array[]::int[], 'done', 5, -4, 2, 'medium', 'normal', 'simple'),
    (24, 'Atendimento a locador sobre atraso de pagamento', 'Atendimento', 6, 6, array[7], 'done', 20, -15, 2, 'high', 'high', 'simple'),
    (25, 'Relatório de produtividade do semestre', 'Relatórios', 7, 1, array[]::int[], 'todo', 1, 20, null, 'low', 'normal', 'medium')
  ) v(n, title, cat, dept, resp, parts, status, ago, due, took, urg, pri, cx) loop
    v_id := pg_temp.id('d7', t.n);
    v_created := pg_temp.ts(v_today - t.ago, '08:' || lpad((t.n * 7 % 60)::text, 2, '0'));
    v_done := case when t.status = 'done' then v_created + make_interval(days => t.took, hours => 5) end;
    insert into public.tasks (id, organization_id, department_id, title, description, requester_user_id, responsible_id, category_id,
                              start_date, due_date, urgency, priority, complexity, status, completed_at, completed_by, completion_note,
                              cancelled_at, created_at, updated_at, created_by)
    values (v_id, v_org, pg_temp.id('d1', t.dept), t.title,
            'Demanda de demonstração (dados fictícios). ' || t.title || '.',
            case when t.n % 4 = 0 then v_admin else pg_temp.id('d2', case when t.resp in (1, 2) then 9 else 1 end) end,
            pg_temp.id('d2', t.resp), (select id from public.task_categories where name = t.cat and organization_id = v_org limit 1),
            (v_today - t.ago)::date, v_today + t.due, t.urg::public.task_urgency, t.pri::public.task_priority,
            t.cx::public.task_complexity, t.status::public.task_status, v_done,
            case when t.status = 'done' then pg_temp.id('d2', t.resp) end,
            case when t.status = 'done' then 'Concluída conforme combinado.' end,
            case when t.status = 'cancelled' then v_created + interval '10 days' end,
            v_created, coalesce(v_done, v_created), pg_temp.id('d2', 1));
    insert into public.task_assignees (organization_id, task_id, user_id, role, created_at)
    values (v_org, v_id, pg_temp.id('d2', t.resp), 'responsible', v_created);
    insert into public.task_assignees (organization_id, task_id, user_id, role, created_at)
    select v_org, v_id, pg_temp.id('d2', x), 'participant', v_created from unnest(t.parts) x where x <> t.resp;
    -- O administrador real acompanha algumas demandas (aparecem em "Minhas demandas").
    if t.n in (2, 9, 13, 19) and v_admin::text not like 'd2%' then
      insert into public.task_assignees (organization_id, task_id, user_id, role, created_at)
      values (v_org, v_id, v_admin, 'participant', v_created);
    end if;
    -- Histórico de status.
    if t.status in ('in_progress', 'waiting', 'review', 'done') then
      insert into public.task_status_history (organization_id, task_id, from_status, to_status, changed_by, changed_at)
      values (v_org, v_id, 'todo', 'in_progress', pg_temp.id('d2', t.resp), v_created + interval '1 day');
    end if;
    if t.status in ('waiting', 'review') then
      insert into public.task_status_history (organization_id, task_id, from_status, to_status, changed_by, changed_at)
      values (v_org, v_id, 'in_progress', t.status::public.task_status, pg_temp.id('d2', t.resp), v_created + interval '2 days');
    end if;
    if t.status = 'done' then
      insert into public.task_status_history (organization_id, task_id, from_status, to_status, changed_by, changed_at)
      values (v_org, v_id, 'in_progress', 'done', pg_temp.id('d2', t.resp), v_done);
    end if;
    if t.status = 'cancelled' then
      insert into public.task_status_history (organization_id, task_id, from_status, to_status, changed_by, changed_at, note)
      values (v_org, v_id, 'todo', 'cancelled', pg_temp.id('d2', 1), v_created + interval '10 days',
              'Substituída pela digitalização feita pelo setor de arquivo.');
    end if;
    -- Comentários.
    if t.n % 3 <> 0 then
      insert into public.task_comments (organization_id, task_id, author_id, body, created_at)
      values (v_org, v_id, pg_temp.id('d2', t.resp), 'Iniciei a análise e anexarei os documentos assim que receber do setor.',
              v_created + interval '1 day 2 hours');
    end if;
    if t.n % 4 = 1 and cardinality(t.parts) > 0 then
      insert into public.task_comments (organization_id, task_id, author_id, body, created_at)
      values (v_org, v_id, pg_temp.id('d2', t.parts[1]), 'Conferi os valores com o sistema financeiro; estão de acordo.',
              v_created + interval '2 days 3 hours');
    end if;
  end loop;
end $$;
set local session_replication_role = origin;

-- ----------------------------------------------------------------------------- calendário
insert into public.task_events (id, organization_id, kind, title, description, location, starts_at, ends_at, all_day, task_id, created_by)
values
  (pg_temp.id('d8', 1), '00000000-0000-4000-8000-000000000001', 'meeting', 'Reunião de acompanhamento dos contratos de locação',
   'Pauta: contratos vencendo nos próximos 90 dias.', 'Sala de reuniões da SEMFAZ',
   pg_temp.ts(private.today_local() + 2, '09:00'), pg_temp.ts(private.today_local() + 2, '10:30'), false, pg_temp.id('d7', 2), pg_temp.id('d2', 1)),
  (pg_temp.id('d8', 2), '00000000-0000-4000-8000-000000000001', 'appointment', 'Vistoria na Creche Pequeno Príncipe',
   null, 'Rua Sergipe, 57 — Cidade Nova', pg_temp.ts(private.today_local() + 5, '14:00'), pg_temp.ts(private.today_local() + 5, '16:00'),
   false, pg_temp.id('d7', 3), pg_temp.id('d2', 5)),
  (pg_temp.id('d8', 3), '00000000-0000-4000-8000-000000000001', 'deadline', 'Prazo para resposta à Câmara Municipal',
   null, null, pg_temp.ts(private.today_local() + 3, '00:00'), null, true, pg_temp.id('d7', 9), pg_temp.id('d2', 2)),
  (pg_temp.id('d8', 4), '00000000-0000-4000-8000-000000000001', 'meeting', 'Alinhamento com a Secretaria de Saúde',
   'Consumo de energia da UBS e nova sede da Farmácia Básica.', 'Secretaria de Saúde',
   pg_temp.ts(private.today_local() + 8, '10:00'), pg_temp.ts(private.today_local() + 8, '11:00'), false, null, pg_temp.id('d2', 2)),
  (pg_temp.id('d8', 5), '00000000-0000-4000-8000-000000000001', 'reminder', 'Enviar relatório mensal de despesas',
   null, null, pg_temp.ts(private.today_local() + 10, '08:00'), null, false, null, pg_temp.id('d2', 3)),
  (pg_temp.id('d8', 6), '00000000-0000-4000-8000-000000000001', 'meeting', 'Reunião semanal da equipe',
   null, 'Sala de reuniões da SEMFAZ', pg_temp.ts(private.today_local() - 5, '08:30'), pg_temp.ts(private.today_local() - 5, '09:30'),
   false, null, pg_temp.id('d2', 1)),
  (pg_temp.id('d8', 7), '00000000-0000-4000-8000-000000000001', 'meeting', 'Reunião semanal da equipe',
   null, 'Sala de reuniões da SEMFAZ', pg_temp.ts(private.today_local() + 9, '08:30'), pg_temp.ts(private.today_local() + 9, '09:30'),
   false, null, pg_temp.id('d2', 1));
insert into public.task_event_attendees (organization_id, event_id, user_id)
select '00000000-0000-4000-8000-000000000001', pg_temp.id('d8', e), pg_temp.id('d2', u)
from (values (1, 1), (1, 5), (1, 3), (2, 5), (2, 8), (3, 2), (3, 6), (4, 2), (4, 7), (5, 3), (6, 1), (6, 3), (6, 4), (6, 7), (6, 8),
             (7, 1), (7, 3), (7, 4), (7, 7), (7, 8)) v(e, u);

-- ----------------------------------------------------------------------------- solicitações aguardando aprovação
-- Criadas pelas mesmas funções da interface, em nome de um gestor fictício, para aparecer
-- na Central de Aprovações do administrador.
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.id('d2', 2), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select public.request_property_create(jsonb_build_object(
  'name', 'Farmácia Básica Municipal — nova sede', 'street', 'Rua Rio Branco', 'address_number', '512', 'district', 'Centro',
  'postal_code', '49400-000', 'city', 'Lagarto', 'state', 'SE', 'department_id', pg_temp.id('d1', 2),
  'purpose', 'Dispensação de medicamentos da atenção básica'),
  'Imóvel escolhido após pesquisa de preços (demanda "Pesquisa de preços para novo imóvel da Farmácia Básica").');
select public.request_payment(jsonb_build_object(
  'rent_charge_id', (select id from public.rent_charges where contract_id = pg_temp.id('d5', 10) order by competence desc limit 1),
  'kind', 'payment',
  'amount', (select amount from public.rent_charges where contract_id = pg_temp.id('d5', 10) order by competence desc limit 1),
  'paid_on', private.today_local()),
  'Pagamento do aluguel da Junta de Serviço Militar realizado hoje (ordem bancária anexa).');
select set_config('request.jwt.claims', '', true);

-- ----------------------------------------------------------------------------- rotinas diárias
-- As mesmas rotinas que o sistema executa às 6h: alertas de contratos (90/60/30 dias e
-- vencido), faturas vencidas e lembretes de prazos de demandas.
select private.generate_contract_alerts();
select private.generate_invoice_alerts();
select private.generate_task_reminders();

-- ----------------------------------------------------------------------------- resumo
select 'Carga de demonstração aplicada' as resultado,
  (select count(*) from public.properties where id::text like 'd4%') as imoveis,
  (select count(*) from public.contracts where id::text like 'd5%') as contratos,
  (select count(*) from public.rent_charges where contract_id::text like 'd5%') as alugueis,
  (select count(*) from public.invoices where unit_id::text like 'd6%') as faturas,
  (select count(*) from public.payments p where p.invoice_id in (select id from public.invoices where unit_id::text like 'd6%')
      or p.rent_charge_id in (select id from public.rent_charges where contract_id::text like 'd5%')) as pagamentos,
  (select count(*) from public.tasks where id::text like 'd7%') as demandas;
commit;
