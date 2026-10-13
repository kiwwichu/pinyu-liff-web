create table public.family_private_contacts (
  family_id text primary key references public.families(family_id) on update cascade on delete cascade,
  address text,
  phone text,
  updated_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_private_contacts_address_length check (char_length(coalesce(address, '')) <= 1000),
  constraint family_private_contacts_phone_length check (char_length(coalesce(phone, '')) <= 100)
);

comment on table public.family_private_contacts is
  'Sensitive family contact data. Access only through the authenticated admin Worker; never include in bootstrap lists.';

alter table public.family_private_contacts enable row level security;
revoke all on table public.family_private_contacts from public, anon, authenticated;
grant select, insert, update on table public.family_private_contacts to service_role;

create table public.family_contracts (
  contract_id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(family_id) on update cascade on delete restrict,
  template_name text not null default '尚未指定合約範本',
  template_version text,
  contract_status text not null default 'draft',
  typed_party_data jsonb not null default '{}'::jsonb,
  document_storage_path text,
  signed_document_storage_path text,
  owner_signature_storage_path text,
  signed_at timestamptz,
  created_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_contracts_status_check check (contract_status in ('draft', 'pending_signature', 'signed', 'void')),
  constraint family_contracts_template_name_length check (char_length(template_name) <= 200),
  constraint family_contracts_template_version_length check (char_length(coalesce(template_version, '')) <= 100)
);

create index family_contracts_family_id_idx on public.family_contracts(family_id);
create index family_contracts_family_status_idx on public.family_contracts(family_id, contract_status);

comment on table public.family_contracts is
  'Full contract metadata. Contract documents and signatures will use private Storage paths after the legal template is supplied.';

alter table public.family_contracts enable row level security;
revoke all on table public.family_contracts from public, anon, authenticated;
grant select, insert, update on table public.family_contracts to service_role;

create table public.contract_sitter_summaries (
  contract_id uuid primary key references public.family_contracts(contract_id) on update cascade on delete cascade,
  emergency_authorizer text,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_hospital text,
  emergency_transport_consent boolean,
  cpr_consent boolean,
  hospitalization_consent boolean,
  medical_spending_limit numeric(12, 2),
  treatment_notes text,
  approved_by_owner boolean not null default false,
  approved_at timestamptz,
  updated_by uuid references public.app_users(user_id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_sitter_summaries_spending_limit_check check (medical_spending_limit is null or medical_spending_limit >= 0),
  constraint contract_sitter_summaries_text_length check (
    char_length(coalesce(emergency_authorizer, '')) <= 200 and
    char_length(coalesce(emergency_contact_name, '')) <= 200 and
    char_length(coalesce(emergency_contact_phone, '')) <= 100 and
    char_length(coalesce(preferred_hospital, '')) <= 500 and
    char_length(coalesce(treatment_notes, '')) <= 3000
  )
);

comment on table public.contract_sitter_summaries is
  'Owner-approved structured emergency instructions. Sitter access must be limited by the Worker to assigned families and active service windows.';

alter table public.contract_sitter_summaries enable row level security;
revoke all on table public.contract_sitter_summaries from public, anon, authenticated;
grant select, insert, update on table public.contract_sitter_summaries to service_role;
