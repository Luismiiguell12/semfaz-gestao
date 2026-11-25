-- =============================================================================
-- SEMFAZ Gestão — Dados estruturais padrão das Fases 2 e 3
-- O `supabase db push --include-seed` executa o seed só na primeira vez; depois,
-- quando o arquivo muda, apenas atualiza o hash registrado sem executá-lo. Por
-- isso os itens acrescentados ao seed nas Fases 2 e 3 não chegaram aos ambientes
-- remotos. Esta migration os aplica de forma idempotente (não altera nem duplica
-- o que já existir). Daqui em diante, dados estruturais novos entram por migration.
-- =============================================================================
do $$
declare
  v_org constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.organizations where id = v_org) then
    return; -- banco ainda sem a organização inicial: o seed cuidará de tudo
  end if;

  insert into public.approval_rules (organization_id, operation_code, requires_approval)
  select v_org, o.code, true from public.approval_operations o
  on conflict (organization_id, operation_code) do nothing;

  insert into public.adjustment_indexes (organization_id, name) values (v_org, 'IPCA'), (v_org, 'IGP-M')
  on conflict do nothing;
  insert into public.contract_modalities (organization_id, name) values (v_org, 'Locação de imóvel (exemplo)')
  on conflict do nothing;

  insert into public.system_settings (organization_id, key, value, description) values
    (v_org, 'contracts.expiring_days', '90'::jsonb, 'Dias antes do fim da vigência para considerar o contrato "próximo do vencimento".'),
    (v_org, 'rents.due_day', '10'::jsonb, 'Dia de vencimento dos aluguéis gerados automaticamente (no próprio mês da competência).'),
    (v_org, 'consumption.alert_percent', '30'::jsonb, 'Aumento de consumo, em %, sobre a média dos três meses anteriores que gera alerta para análise.')
  on conflict (organization_id, key) do nothing;

  insert into public.alert_rules (organization_id, code, days_before, description) values
    (v_org, 'contract_expiring', 90, 'Contrato a 90 dias do fim da vigência'),
    (v_org, 'contract_expiring', 60, 'Contrato a 60 dias do fim da vigência'),
    (v_org, 'contract_expiring', 30, 'Contrato a 30 dias do fim da vigência'),
    (v_org, 'contract_expired', 0, 'Contrato vencido'),
    (v_org, 'contract_adjustment', 30, 'Data-base do contrato em até 30 dias (reajuste)'),
    (v_org, 'invoice_overdue', 0, 'Fatura vencida com saldo em aberto')
  on conflict (organization_id, code, days_before) do nothing;

  insert into public.suppliers (organization_id, name, kind) values
    (v_org, 'Energisa', 'energy'),
    (v_org, 'Iguá', 'water')
  on conflict do nothing;
end;
$$;
