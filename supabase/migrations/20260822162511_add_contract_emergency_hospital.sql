alter table public.contract_sitter_summaries
  add column emergency_hospital text;

alter table public.contract_sitter_summaries
  add constraint contract_sitter_summaries_emergency_hospital_length
  check (char_length(coalesce(emergency_hospital, '')) <= 500);

comment on column public.contract_sitter_summaries.preferred_hospital is
  'Regular appointment veterinary hospital selected by the owner, including name and address.';

comment on column public.contract_sitter_summaries.emergency_hospital is
  '24-hour emergency veterinary hospital selected by the owner, including name and address.';
