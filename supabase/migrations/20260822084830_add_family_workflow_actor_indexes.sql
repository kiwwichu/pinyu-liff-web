create index family_private_contacts_updated_by_idx
  on public.family_private_contacts(updated_by)
  where updated_by is not null;

create index family_contracts_created_by_idx
  on public.family_contracts(created_by)
  where created_by is not null;

create index contract_sitter_summaries_updated_by_idx
  on public.contract_sitter_summaries(updated_by)
  where updated_by is not null;

create index home_visit_records_created_by_idx
  on public.home_visit_records(created_by)
  where created_by is not null;
