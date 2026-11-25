-- =============================================================================
-- SEMFAZ Gestão — Fase 7: índices nas chaves estrangeiras usadas em consultas.
-- A revisão de integridade encontrou chaves estrangeiras sem índice. Estas são
-- usadas em filtros, fichas e verificações de escopo (locador, fornecedor,
-- categoria, escopo por imóvel, estornos, gestor/fiscal). As demais (autoria,
-- solicitação de origem) só são lidas a partir do próprio registro.
-- =============================================================================
create index if not exists contract_landlords_landlord_idx on public.contract_landlords (landlord_id);
create index if not exists property_landlords_landlord_idx on public.property_landlords (landlord_id);
create index if not exists invoices_supplier_idx on public.invoices (supplier_id);
create index if not exists tasks_category_idx on public.tasks (category_id);
create index if not exists user_property_access_property_idx on public.user_property_access (property_id);
create index if not exists payments_reversal_of_idx on public.payments (reversal_of) where reversal_of is not null;
create index if not exists consumption_records_invoice_idx on public.consumption_records (invoice_id);
create index if not exists contracts_manager_idx on public.contracts (manager_id) where manager_id is not null;
create index if not exists contracts_inspector_idx on public.contracts (inspector_id) where inspector_id is not null;
create index if not exists approval_requests_department_idx on public.approval_requests (department_id);
create index if not exists task_comments_author_idx on public.task_comments (author_id);
