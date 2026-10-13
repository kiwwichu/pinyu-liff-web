export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      // Applied ledger schema; synchronized from 20260909183359 source, no schema execution.
      order_financial_entries: {
        Row: { request_id:string;order_id:string;ledger:string;kind:string;amount:number;occurred_at:string;channel:string;platform_name_snapshot:string|null;method:string;note:string;recorded_by:string;recorded_at:string }
        Insert: { request_id:string;order_id:string;ledger:string;kind:string;amount:number;occurred_at:string;channel:string;platform_name_snapshot?:string|null;method:string;note?:string;recorded_by:string;recorded_at?:string }
        Update: never
        Relationships: [
          {foreignKeyName:'order_financial_entries_order_id_fkey';columns:['order_id'];isOneToOne:false;referencedRelation:'orders';referencedColumns:['order_id']},
          {foreignKeyName:'order_financial_entries_recorded_by_fkey';columns:['recorded_by'];isOneToOne:false;referencedRelation:'app_users';referencedColumns:['user_id']}
        ]
      }
      sitter_payment_entries: {
        Row: {
          request_id: string; order_id: string; order_item_id: string; sitter_id_snapshot: number;
          order_updated_at_snapshot: string; item_updated_at_snapshot: string;
          remuneration_snapshot: Json; due_amount_snapshot: number; amount: number;
          paid_at: string; method: string; difference_reason: string; recorded_by: string; recorded_at: string;
        }
        Insert: {
          request_id: string; order_id: string; order_item_id: string; sitter_id_snapshot: number;
          order_updated_at_snapshot: string; item_updated_at_snapshot: string;
          remuneration_snapshot: Json; due_amount_snapshot: number; amount: number;
          paid_at: string; method: string; difference_reason?: string; recorded_by: string; recorded_at?: string;
        }
        Update: never
        Relationships: [
          { foreignKeyName: "sitter_payment_entries_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["order_id"] },
          { foreignKeyName: "sitter_payment_entries_order_item_id_fkey"; columns: ["order_item_id"]; isOneToOne: false; referencedRelation: "order_items"; referencedColumns: ["order_item_id"] },
          { foreignKeyName: "sitter_payment_entries_sitter_id_snapshot_fkey"; columns: ["sitter_id_snapshot"]; isOneToOne: false; referencedRelation: "sitters"; referencedColumns: ["sitter_id"] },
          { foreignKeyName: "sitter_payment_entries_recorded_by_fkey"; columns: ["recorded_by"]; isOneToOne: false; referencedRelation: "app_users"; referencedColumns: ["user_id"] }
        ]
      }
      app_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          can_create_orders: boolean
          can_edit_orders: boolean
          can_send_notifications: boolean
          can_view_money: boolean
          created_at: string
          display_name: string
          google_email: string | null
          last_login_at: string | null
          legacy_created_at: string | null
          legacy_data: Json
          line_user_id: string | null
          notes: string | null
          role: string
          source_row: number | null
          status: string
          updated_at: string
          user_id: string
          visible_families: string | null
        }
        Insert: {
          can_create_orders?: boolean
          can_edit_orders?: boolean
          can_send_notifications?: boolean
          can_view_money?: boolean
          created_at?: string
          display_name: string
          google_email?: string | null
          last_login_at?: string | null
          legacy_created_at?: string | null
          legacy_data?: Json
          line_user_id?: string | null
          notes?: string | null
          role: string
          source_row?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          visible_families?: string | null
        }
        Update: {
          can_create_orders?: boolean
          can_edit_orders?: boolean
          can_send_notifications?: boolean
          can_view_money?: boolean
          created_at?: string
          display_name?: string
          google_email?: string | null
          last_login_at?: string | null
          legacy_created_at?: string | null
          legacy_data?: Json
          line_user_id?: string | null
          notes?: string | null
          role?: string
          source_row?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          visible_families?: string | null
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          care_needs: string
          cat_count: number
          converted_order_id: string | null
          created_at: string
          customer_type: string
          distance_km: number
          district: string
          dog_count: number
          location_note: string | null
          near_mrt: boolean
          nearest_mrt: string
          other_pets: string | null
          request_id: string
          request_number: string
          request_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_end_date: string
          service_periods: Json
          service_start_date: string
          source: string
          source_ip_hash: string | null
          submitted_by_line_user_id: string | null
          updated_at: string
        }
        Insert: {
          care_needs: string
          cat_count?: number
          converted_order_id?: string | null
          created_at?: string
          customer_type?: string
          distance_km: number
          district: string
          dog_count?: number
          location_note?: string | null
          near_mrt: boolean
          nearest_mrt: string
          other_pets?: string | null
          request_id?: string
          request_number: string
          request_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_end_date: string
          service_periods?: Json
          service_start_date: string
          source?: string
          source_ip_hash?: string | null
          submitted_by_line_user_id?: string | null
          updated_at?: string
        }
        Update: {
          care_needs?: string
          cat_count?: number
          converted_order_id?: string | null
          created_at?: string
          customer_type?: string
          distance_km?: number
          district?: string
          dog_count?: number
          location_note?: string | null
          near_mrt?: boolean
          nearest_mrt?: string
          other_pets?: string | null
          request_id?: string
          request_number?: string
          request_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_end_date?: string
          service_periods?: Json
          service_start_date?: string
          source?: string
          source_ip_hash?: string | null
          submitted_by_line_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contract_sitter_summaries: {
        Row: {
          approved_at: string | null
          approved_by_owner: boolean
          contract_id: string
          cpr_consent: boolean | null
          created_at: string
          emergency_authorizer: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_hospital: string | null
          emergency_transport_consent: boolean | null
          hospitalization_consent: boolean | null
          medical_spending_limit: number | null
          preferred_hospital: string | null
          treatment_notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_owner?: boolean
          contract_id: string
          cpr_consent?: boolean | null
          created_at?: string
          emergency_authorizer?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_hospital?: string | null
          emergency_transport_consent?: boolean | null
          hospitalization_consent?: boolean | null
          medical_spending_limit?: number | null
          preferred_hospital?: string | null
          treatment_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_owner?: boolean
          contract_id?: string
          cpr_consent?: boolean | null
          created_at?: string
          emergency_authorizer?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_hospital?: string | null
          emergency_transport_consent?: boolean | null
          hospitalization_consent?: boolean | null
          medical_spending_limit?: number | null
          preferred_hospital?: string | null
          treatment_notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_sitter_summaries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "family_contracts"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_sitter_summaries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      families: {
        Row: {
          contract_status: string | null
          created_at: string
          customer_category: string | null
          distance_km: number | null
          district: string | null
          established_at: string | null
          family_id: string
          first_inquiry_date: string | null
          home_visit_at: string | null
          instagram_permission: string | null
          legacy_data: Json
          legacy_unique_key: string | null
          marketing_channel: string | null
          notes: string | null
          notification_channel: string | null
          owner_name: string
          source_row: number | null
          travel_fee: number | null
          updated_at: string
        }
        Insert: {
          contract_status?: string | null
          created_at?: string
          customer_category?: string | null
          distance_km?: number | null
          district?: string | null
          established_at?: string | null
          family_id: string
          first_inquiry_date?: string | null
          home_visit_at?: string | null
          instagram_permission?: string | null
          legacy_data?: Json
          legacy_unique_key?: string | null
          marketing_channel?: string | null
          notes?: string | null
          notification_channel?: string | null
          owner_name: string
          source_row?: number | null
          travel_fee?: number | null
          updated_at?: string
        }
        Update: {
          contract_status?: string | null
          created_at?: string
          customer_category?: string | null
          distance_km?: number | null
          district?: string | null
          established_at?: string | null
          family_id?: string
          first_inquiry_date?: string | null
          home_visit_at?: string | null
          instagram_permission?: string | null
          legacy_data?: Json
          legacy_unique_key?: string | null
          marketing_channel?: string | null
          notes?: string | null
          notification_channel?: string | null
          owner_name?: string
          source_row?: number | null
          travel_fee?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      family_contracts: {
        Row: {
          contract_id: string
          contract_status: string
          created_at: string
          created_by: string | null
          document_storage_path: string | null
          family_id: string
          owner_signature_storage_path: string | null
          signed_at: string | null
          signed_document_storage_path: string | null
          template_name: string
          template_version: string | null
          typed_party_data: Json
          updated_at: string
        }
        Insert: {
          contract_id?: string
          contract_status?: string
          created_at?: string
          created_by?: string | null
          document_storage_path?: string | null
          family_id: string
          owner_signature_storage_path?: string | null
          signed_at?: string | null
          signed_document_storage_path?: string | null
          template_name?: string
          template_version?: string | null
          typed_party_data?: Json
          updated_at?: string
        }
        Update: {
          contract_id?: string
          contract_status?: string
          created_at?: string
          created_by?: string | null
          document_storage_path?: string | null
          family_id?: string
          owner_signature_storage_path?: string | null
          signed_at?: string | null
          signed_document_storage_path?: string | null
          template_name?: string
          template_version?: string | null
          typed_party_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_contracts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      family_private_contacts: {
        Row: {
          address: string | null
          created_at: string
          family_id: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          family_id: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          family_id?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_private_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "family_private_contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      google_calendar_sync_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          google_event_id: string | null
          last_error: string | null
          next_attempt_at: string
          order_id: string
          sync_action: string
          sync_job_id: number
          sync_status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          google_event_id?: string | null
          last_error?: string | null
          next_attempt_at?: string
          order_id: string
          sync_action?: string
          sync_job_id?: never
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          google_event_id?: string | null
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string
          sync_action?: string
          sync_job_id?: never
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "google_calendar_sync_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_export"
            referencedColumns: ["order_id"]
          },
        ]
      }
      home_visit_pet_records: {
        Row: {
          behavior_notes: string | null
          care_checklist: Json
          created_at: string
          feeding_notes: string | null
          health_notes: string | null
          home_visit_id: string
          medication_notes: string | null
          pet_id: string
          touch_restrictions: string | null
          updated_at: string
          walk_and_toilet_notes: string | null
        }
        Insert: {
          behavior_notes?: string | null
          care_checklist?: Json
          created_at?: string
          feeding_notes?: string | null
          health_notes?: string | null
          home_visit_id: string
          medication_notes?: string | null
          pet_id: string
          touch_restrictions?: string | null
          updated_at?: string
          walk_and_toilet_notes?: string | null
        }
        Update: {
          behavior_notes?: string | null
          care_checklist?: Json
          created_at?: string
          feeding_notes?: string | null
          health_notes?: string | null
          home_visit_id?: string
          medication_notes?: string | null
          pet_id?: string
          touch_restrictions?: string | null
          updated_at?: string
          walk_and_toilet_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_visit_pet_records_home_visit_id_fkey"
            columns: ["home_visit_id"]
            isOneToOne: false
            referencedRelation: "home_visit_records"
            referencedColumns: ["home_visit_id"]
          },
          {
            foreignKeyName: "home_visit_pet_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      home_visit_records: {
        Row: {
          access_notes: string | null
          assigned_sitter_id: string | null
          completed_at: string | null
          confirmed_fee: number | null
          created_at: string
          created_by: string | null
          environment_notes: string | null
          family_id: string
          fee_decision: string
          fee_reason: string | null
          follow_up_notes: string | null
          general_notes: string | null
          home_visit_id: string
          proposed_fee: number | null
          scheduled_at: string | null
          updated_at: string
          visit_status: string
          visit_type: string
        }
        Insert: {
          access_notes?: string | null
          assigned_sitter_id?: string | null
          completed_at?: string | null
          confirmed_fee?: number | null
          created_at?: string
          created_by?: string | null
          environment_notes?: string | null
          family_id: string
          fee_decision?: string
          fee_reason?: string | null
          follow_up_notes?: string | null
          general_notes?: string | null
          home_visit_id?: string
          proposed_fee?: number | null
          scheduled_at?: string | null
          updated_at?: string
          visit_status?: string
          visit_type?: string
        }
        Update: {
          access_notes?: string | null
          assigned_sitter_id?: string | null
          completed_at?: string | null
          confirmed_fee?: number | null
          created_at?: string
          created_by?: string | null
          environment_notes?: string | null
          family_id?: string
          fee_decision?: string
          fee_reason?: string | null
          follow_up_notes?: string | null
          general_notes?: string | null
          home_visit_id?: string
          proposed_fee?: number | null
          scheduled_at?: string | null
          updated_at?: string
          visit_status?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_visit_records_assigned_sitter_id_fkey"
            columns: ["assigned_sitter_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "home_visit_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "home_visit_records_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      line_bindings: {
        Row: {
          binding_status: string
          bound_at: string | null
          created_at: string
          family_id: string
          is_enabled: boolean
          last_interaction_at: string | null
          legacy_data: Json
          line_user_id: string
          source_row: number | null
          updated_at: string
        }
        Insert: {
          binding_status?: string
          bound_at?: string | null
          created_at?: string
          family_id: string
          is_enabled?: boolean
          last_interaction_at?: string | null
          legacy_data?: Json
          line_user_id: string
          source_row?: number | null
          updated_at?: string
        }
        Update: {
          binding_status?: string
          bound_at?: string | null
          created_at?: string
          family_id?: string
          is_enabled?: boolean
          last_interaction_at?: string | null
          legacy_data?: Json
          line_user_id?: string
          source_row?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_bindings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      order_home_visits: {
        Row: {
          created_at: string
          home_visit_id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          home_visit_id: string
          order_id: string
        }
        Update: {
          created_at?: string
          home_visit_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_home_visits_home_visit_id_fkey"
            columns: ["home_visit_id"]
            isOneToOne: false
            referencedRelation: "home_visit_records"
            referencedColumns: ["home_visit_id"]
          },
          {
            foreignKeyName: "order_home_visits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
      order_item_pets: {
        Row: {
          created_at: string
          order_item_id: string
          pet_id: string
        }
        Insert: {
          created_at?: string
          order_item_id: string
          pet_id: string
        }
        Update: {
          created_at?: string
          order_item_id?: string
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_pets_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_item_pets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      order_items: {
        Row: {
          allocation_note: string | null
          assigned_sitter_id: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          charged_unit_price: number
          commission_base_amount: number
          commission_rate_snapshot: number | null
          company_discount_absorbed_amount: number
          company_share_amount: number
          created_at: string
          created_by: string | null
          custom_unit_price: number | null
          display_order: number
          duration_minutes_snapshot: number | null
          end_time: string | null
          home_visit_execution_mode: string | null
          item_name_snapshot: string
          item_status: string
          item_type: string
          line_amount: number
          order_id: string
          order_item_id: string
          provider_type_snapshot: string
          quantity: number
          service_date: string | null
          service_plan_id: string | null
          sitter_earnings_amount: number
          specified_time_note: string | null
          standard_unit_price_snapshot: number
          start_time: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allocation_note?: string | null
          assigned_sitter_id?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charged_unit_price: number
          commission_base_amount?: number
          commission_rate_snapshot?: number | null
          company_discount_absorbed_amount?: number
          company_share_amount?: number
          created_at?: string
          created_by?: string | null
          custom_unit_price?: number | null
          display_order?: number
          duration_minutes_snapshot?: number | null
          end_time?: string | null
          home_visit_execution_mode?: string | null
          item_name_snapshot: string
          item_status?: string
          item_type: string
          line_amount: number
          order_id: string
          order_item_id?: string
          provider_type_snapshot?: string
          quantity?: number
          service_date?: string | null
          service_plan_id?: string | null
          sitter_earnings_amount?: number
          specified_time_note?: string | null
          standard_unit_price_snapshot?: number
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allocation_note?: string | null
          assigned_sitter_id?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charged_unit_price?: number
          commission_base_amount?: number
          commission_rate_snapshot?: number | null
          company_discount_absorbed_amount?: number
          company_share_amount?: number
          created_at?: string
          created_by?: string | null
          custom_unit_price?: number | null
          display_order?: number
          duration_minutes_snapshot?: number | null
          end_time?: string | null
          home_visit_execution_mode?: string | null
          item_name_snapshot?: string
          item_status?: string
          item_type?: string
          line_amount?: number
          order_id?: string
          order_item_id?: string
          provider_type_snapshot?: string
          quantity?: number
          service_date?: string | null
          service_plan_id?: string | null
          sitter_earnings_amount?: number
          specified_time_note?: string | null
          standard_unit_price_snapshot?: number
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_assigned_sitter_id_fkey"
            columns: ["assigned_sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
          {
            foreignKeyName: "order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders: {
        Row: {
          balance_amount_due: number | null
          booking_request_id: string | null
          booking_segment: string | null
          calculated_at: string | null
          calculation_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          caregiver: string | null
          company_discount_absorbed: number | null
          company_earnings_before_platform: number | null
          company_service_share_total: number | null
          completed_at: string | null
          confirmation_result: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          custom_deposit: number | null
          custom_deposit_amount: number | null
          custom_price: number | null
          customer_total: number | null
          deposit_amount_due: number | null
          deposit_rate_snapshot: number | null
          deposit_rule_type: string | null
          discount: number | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          established_at: string | null
          family_id: string | null
          home_visit_fee: number | null
          home_visit_fee_total: number | null
          hours: number | null
          last_notified_at: string | null
          legacy_data: Json
          legacy_notification_status: string | null
          legacy_order_id: string
          line_user_id_snapshot: string | null
          net_income: number | null
          notes: string | null
          notification_command: string | null
          notification_state: string | null
          order_id: string
          order_model_version: number | null
          order_number: string | null
          order_platform: string | null
          order_source: string | null
          order_status: string
          owner_earnings_total: number | null
          owner_name_snapshot: string | null
          pet_name_snapshot: string | null
          payment_status: string | null
          plan_name: string | null
          platform_actual_payout: number | null
          platform_name: string | null
          platform_order_ref: string | null
          platform_payout_status: string | null
          quantity: number | null
          remaining_payment: number | null
          service_date_raw: string | null
          service_subtotal: number | null
          service_type: string | null
          sitter_earnings_total: number | null
          sitter_id: number | null
          source_row: number | null
          specified_time: string | null
          standard_deposit: number | null
          standard_price: number | null
          tip: number | null
          tip_total: number | null
          total: number | null
          total_before_discount: number | null
          travel_fee: number | null
          travel_fee_total: number | null
          unpaid_balance: number | null
          updated_at: string
          updated_by: string | null
          uses_wallet: boolean
          visits_command: string | null
        }
        Insert: {
          balance_amount_due?: number | null
          booking_request_id?: string | null
          booking_segment?: string | null
          calculated_at?: string | null
          calculation_version?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          caregiver?: string | null
          company_discount_absorbed?: number | null
          company_earnings_before_platform?: number | null
          company_service_share_total?: number | null
          completed_at?: string | null
          confirmation_result?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_deposit?: number | null
          custom_deposit_amount?: number | null
          custom_price?: number | null
          customer_total?: number | null
          deposit_amount_due?: number | null
          deposit_rate_snapshot?: number | null
          deposit_rule_type?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          established_at?: string | null
          family_id?: string | null
          home_visit_fee?: number | null
          home_visit_fee_total?: number | null
          hours?: number | null
          last_notified_at?: string | null
          legacy_data?: Json
          legacy_notification_status?: string | null
          legacy_order_id: string
          line_user_id_snapshot?: string | null
          net_income?: number | null
          notes?: string | null
          notification_command?: string | null
          notification_state?: string | null
          order_id: string
          order_model_version?: number | null
          order_number?: string | null
          order_platform?: string | null
          order_source?: string | null
          order_status: string
          owner_earnings_total?: number | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          payment_status?: string | null
          plan_name?: string | null
          platform_actual_payout?: number | null
          platform_name?: string | null
          platform_order_ref?: string | null
          platform_payout_status?: string | null
          quantity?: number | null
          remaining_payment?: number | null
          service_date_raw?: string | null
          service_subtotal?: number | null
          service_type?: string | null
          sitter_earnings_total?: number | null
          sitter_id?: number | null
          source_row?: number | null
          specified_time?: string | null
          standard_deposit?: number | null
          standard_price?: number | null
          tip?: number | null
          tip_total?: number | null
          total?: number | null
          total_before_discount?: number | null
          travel_fee?: number | null
          travel_fee_total?: number | null
          unpaid_balance?: number | null
          updated_at?: string
          updated_by?: string | null
          uses_wallet?: boolean
          visits_command?: string | null
        }
        Update: {
          balance_amount_due?: number | null
          booking_request_id?: string | null
          booking_segment?: string | null
          calculated_at?: string | null
          calculation_version?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          caregiver?: string | null
          company_discount_absorbed?: number | null
          company_earnings_before_platform?: number | null
          company_service_share_total?: number | null
          completed_at?: string | null
          confirmation_result?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_deposit?: number | null
          custom_deposit_amount?: number | null
          custom_price?: number | null
          customer_total?: number | null
          deposit_amount_due?: number | null
          deposit_rate_snapshot?: number | null
          deposit_rule_type?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          established_at?: string | null
          family_id?: string | null
          home_visit_fee?: number | null
          home_visit_fee_total?: number | null
          hours?: number | null
          last_notified_at?: string | null
          legacy_data?: Json
          legacy_notification_status?: string | null
          legacy_order_id?: string
          line_user_id_snapshot?: string | null
          net_income?: number | null
          notes?: string | null
          notification_command?: string | null
          notification_state?: string | null
          order_id?: string
          order_model_version?: number | null
          order_number?: string | null
          order_platform?: string | null
          order_source?: string | null
          order_status?: string
          owner_earnings_total?: number | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          payment_status?: string | null
          plan_name?: string | null
          platform_actual_payout?: number | null
          platform_name?: string | null
          platform_order_ref?: string | null
          platform_payout_status?: string | null
          quantity?: number | null
          remaining_payment?: number | null
          service_date_raw?: string | null
          service_subtotal?: number | null
          service_type?: string | null
          sitter_earnings_total?: number | null
          sitter_id?: number | null
          source_row?: number | null
          specified_time?: string | null
          standard_deposit?: number | null
          standard_price?: number | null
          tip?: number | null
          tip_total?: number | null
          total?: number | null
          total_before_discount?: number | null
          travel_fee?: number | null
          travel_fee_total?: number | null
          unpaid_balance?: number | null
          updated_at?: string
          updated_by?: string | null
          uses_wallet?: boolean
          visits_command?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "orders_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
        ]
      }
      pets: {
        Row: {
          age_text: string | null
          behavior_notes: string | null
          breed: string | null
          created_at: string
          established_on: string | null
          family_id: string
          feeding_notes: string | null
          is_enabled: boolean
          legacy_data: Json
          medical_notes: string | null
          neuter_status: string | null
          pet_id: string
          pet_name: string
          sex: string | null
          source_row: number | null
          species: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age_text?: string | null
          behavior_notes?: string | null
          breed?: string | null
          created_at?: string
          established_on?: string | null
          family_id: string
          feeding_notes?: string | null
          is_enabled?: boolean
          legacy_data?: Json
          medical_notes?: string | null
          neuter_status?: string | null
          pet_id: string
          pet_name: string
          sex?: string | null
          source_row?: number | null
          species?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age_text?: string | null
          behavior_notes?: string | null
          breed?: string | null
          created_at?: string
          established_on?: string | null
          family_id?: string
          feeding_notes?: string | null
          is_enabled?: boolean
          legacy_data?: Json
          medical_notes?: string | null
          neuter_status?: string | null
          pet_id?: string
          pet_name?: string
          sex?: string | null
          source_row?: number | null
          species?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      postal_codes: {
        Row: {
          city: string
          district: string
          postal_code: string
          source_row: number | null
        }
        Insert: {
          city: string
          district: string
          postal_code: string
          source_row?: number | null
        }
        Update: {
          city?: string
          district?: string
          postal_code?: string
          source_row?: number | null
        }
        Relationships: []
      }
      public_site_settings: {
        Row: {
          created_at: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          expires_at: string
          last_seen_at: string
          rate_limit_key: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          last_seen_at: string
          rate_limit_key: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          last_seen_at?: string
          rate_limit_key?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          details: string | null
          family_id: string | null
          legacy_data: Json
          legacy_family_id: string | null
          legacy_order_id: string | null
          logged_at: string | null
          order_id: string | null
          reminder_key: string
          reminder_type: string
          result: string | null
          source_row: number | null
          target_date: string | null
        }
        Insert: {
          details?: string | null
          family_id?: string | null
          legacy_data?: Json
          legacy_family_id?: string | null
          legacy_order_id?: string | null
          logged_at?: string | null
          order_id?: string | null
          reminder_key: string
          reminder_type: string
          result?: string | null
          source_row?: number | null
          target_date?: string | null
        }
        Update: {
          details?: string | null
          family_id?: string | null
          legacy_data?: Json
          legacy_family_id?: string | null
          legacy_order_id?: string | null
          logged_at?: string | null
          order_id?: string | null
          reminder_key?: string
          reminder_type?: string
          result?: string | null
          source_row?: number | null
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "reminder_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "reminder_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_export"
            referencedColumns: ["order_id"]
          },
        ]
      }
      service_plans: {
        Row: {
          created_at: string
          duration_minutes: number | null
          is_enabled: boolean
          legacy_data: Json
          legacy_key: string | null
          plan_id: string
          plan_name: string
          price: number
          service_type: string
          source_row: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          is_enabled?: boolean
          legacy_data?: Json
          legacy_key?: string | null
          plan_id?: string
          plan_name: string
          price?: number
          service_type: string
          source_row?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          is_enabled?: boolean
          legacy_data?: Json
          legacy_key?: string | null
          plan_id?: string
          plan_name?: string
          price?: number
          service_type?: string
          source_row?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      service_reviews: {
        Row: {
          allow_anonymous_publication: boolean
          care_quality: number | null
          communication: number | null
          created_at: string
          family_id: string
          feedback: string | null
          last_modified_at: string | null
          legacy_data: Json
          legacy_order_id: string
          line_user_id: string | null
          order_id: string | null
          overall_rating: number
          pet_comfort: number | null
          public_name: string | null
          punctuality: number | null
          report_clarity: number | null
          review_id: string
          source_row: number | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          allow_anonymous_publication?: boolean
          care_quality?: number | null
          communication?: number | null
          created_at?: string
          family_id: string
          feedback?: string | null
          last_modified_at?: string | null
          legacy_data?: Json
          legacy_order_id: string
          line_user_id?: string | null
          order_id?: string | null
          overall_rating: number
          pet_comfort?: number | null
          public_name?: string | null
          punctuality?: number | null
          report_clarity?: number | null
          review_id: string
          source_row?: number | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_anonymous_publication?: boolean
          care_quality?: number | null
          communication?: number | null
          created_at?: string
          family_id?: string
          feedback?: string | null
          last_modified_at?: string | null
          legacy_data?: Json
          legacy_order_id?: string
          line_user_id?: string | null
          order_id?: string | null
          overall_rating?: number
          pet_comfort?: number | null
          public_name?: string | null
          punctuality?: number | null
          report_clarity?: number | null
          review_id?: string
          source_row?: number | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_reviews_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "service_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "service_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_export"
            referencedColumns: ["order_id"]
          },
        ]
      }
      sitter_access_profiles: {
        Row: {
          access_level: number
          binding_status: string
          can_view_assigned_address: boolean
          can_view_assigned_family_basics: boolean
          can_view_assigned_phone: boolean
          can_view_contract_summary: boolean
          can_view_reviews: boolean
          created_at: string
          line_display_name: string | null
          line_user_id: string | null
          performance_score: number
          sitter_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_level?: number
          binding_status?: string
          can_view_assigned_address?: boolean
          can_view_assigned_family_basics?: boolean
          can_view_assigned_phone?: boolean
          can_view_contract_summary?: boolean
          can_view_reviews?: boolean
          created_at?: string
          line_display_name?: string | null
          line_user_id?: string | null
          performance_score?: number
          sitter_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_level?: number
          binding_status?: string
          can_view_assigned_address?: boolean
          can_view_assigned_family_basics?: boolean
          can_view_assigned_phone?: boolean
          can_view_contract_summary?: boolean
          can_view_reviews?: boolean
          created_at?: string
          line_display_name?: string | null
          line_user_id?: string | null
          performance_score?: number
          sitter_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sitter_access_profiles_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: true
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
          {
            foreignKeyName: "sitter_access_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sitter_availability: {
        Row: {
          availability_id: number
          availability_status: string
          available_date: string
          buffer_minutes: number
          created_at: string
          created_by: string | null
          ends_at: string | null
          internal_note: string | null
          public_note: string | null
          sitter_id: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          availability_id?: never
          availability_status?: string
          available_date: string
          buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          internal_note?: string | null
          public_note?: string | null
          sitter_id: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          availability_id?: never
          availability_status?: string
          available_date?: string
          buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          internal_note?: string | null
          public_note?: string | null
          sitter_id?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitter_availability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sitter_availability_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
        ]
      }
      sitter_binding_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          invite_id: string
          sitter_id: number
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          invite_id?: string
          sitter_id: number
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          invite_id?: string
          sitter_id?: number
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sitter_binding_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sitter_binding_invites_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
        ]
      }
      sitter_commission_rates: {
        Row: {
          change_note: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          rate_id: number
          rate_percent: number
          sitter_id: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_until?: string | null
          rate_id?: never
          rate_percent: number
          sitter_id: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          rate_id?: never
          rate_percent?: number
          sitter_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sitter_commission_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sitter_commission_rates_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
        ]
      }
      sitter_recurring_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          ends_at: string
          is_enabled: boolean
          label: string
          recurring_block_id: number
          sitter_id: number
          starts_at: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          ends_at: string
          is_enabled?: boolean
          label: string
          recurring_block_id?: never
          sitter_id: number
          starts_at: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          ends_at?: string
          is_enabled?: boolean
          label?: string
          recurring_block_id?: never
          sitter_id?: number
          starts_at?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "sitter_recurring_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sitter_recurring_blocks_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
        ]
      }
      sitter_recurring_block_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          exception_date: string
          recurring_block_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exception_date: string
          recurring_block_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exception_date?: string
          recurring_block_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sitter_recurring_block_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sitter_recurring_block_exceptions_recurring_block_id_fkey"
            columns: ["recurring_block_id"]
            isOneToOne: false
            referencedRelation: "sitter_recurring_blocks"
            referencedColumns: ["recurring_block_id"]
          },
        ]
      }
      sitter_schedule_settings: {
        Row: {
          afternoon_end: string
          afternoon_start: string
          buffer_minutes: number
          created_at: string
          evening_end: string
          evening_start: string
          monthly_order_limit: number | null
          morning_end: string
          morning_start: string
          sitter_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          afternoon_end?: string
          afternoon_start?: string
          buffer_minutes?: number
          created_at?: string
          evening_end?: string
          evening_start?: string
          monthly_order_limit?: number | null
          morning_end?: string
          morning_start?: string
          sitter_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          afternoon_end?: string
          afternoon_start?: string
          buffer_minutes?: number
          created_at?: string
          evening_end?: string
          evening_start?: string
          monthly_order_limit?: number | null
          morning_end?: string
          morning_start?: string
          sitter_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sitter_schedule_settings_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: true
            referencedRelation: "sitters"
            referencedColumns: ["sitter_id"]
          },
          {
            foreignKeyName: "sitter_schedule_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sitters: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          notes: string | null
          sitter_id: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          notes?: string | null
          sitter_id?: never
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          notes?: string | null
          sitter_id?: never
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      visits: {
        Row: {
          created_at: string
          established_at: string | null
          family_id: string | null
          hours: number | null
          inventory_sync_key: string | null
          inventory_sync_status: string | null
          inventory_synced_at: string | null
          is_slot_locked: boolean
          legacy_data: Json
          legacy_order_id: string
          notes: string | null
          order_id: string | null
          order_status_snapshot: string | null
          owner_name_snapshot: string | null
          pet_name_snapshot: string | null
          plan_name: string | null
          service_date: string | null
          service_type: string | null
          slot_code: string | null
          slot_text: string | null
          source_order_row: number | null
          source_row: number | null
          specified_time: string | null
          sync_status: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          established_at?: string | null
          family_id?: string | null
          hours?: number | null
          inventory_sync_key?: string | null
          inventory_sync_status?: string | null
          inventory_synced_at?: string | null
          is_slot_locked?: boolean
          legacy_data?: Json
          legacy_order_id: string
          notes?: string | null
          order_id?: string | null
          order_status_snapshot?: string | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          plan_name?: string | null
          service_date?: string | null
          service_type?: string | null
          slot_code?: string | null
          slot_text?: string | null
          source_order_row?: number | null
          source_row?: number | null
          specified_time?: string | null
          sync_status?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          established_at?: string | null
          family_id?: string | null
          hours?: number | null
          inventory_sync_key?: string | null
          inventory_sync_status?: string | null
          inventory_synced_at?: string | null
          is_slot_locked?: boolean
          legacy_data?: Json
          legacy_order_id?: string
          notes?: string | null
          order_id?: string | null
          order_status_snapshot?: string | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          plan_name?: string | null
          service_date?: string | null
          service_type?: string | null
          slot_code?: string | null
          slot_text?: string | null
          source_order_row?: number | null
          source_row?: number | null
          specified_time?: string | null
          sync_status?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "visits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "visits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_export"
            referencedColumns: ["order_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          family_id: string
          legacy_data: Json
          legacy_transaction_id: string | null
          notes: string | null
          occurred_on: string
          order_id: string | null
          source_row: number | null
          source_sheet: string
          transaction_id: string
          transaction_type: string
          uses_wallet: boolean
        }
        Insert: {
          amount: number
          created_at?: string
          family_id: string
          legacy_data?: Json
          legacy_transaction_id?: string | null
          notes?: string | null
          occurred_on: string
          order_id?: string | null
          source_row?: number | null
          source_sheet: string
          transaction_id?: string
          transaction_type: string
          uses_wallet?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          family_id?: string
          legacy_data?: Json
          legacy_transaction_id?: string | null
          notes?: string | null
          occurred_on?: string
          order_id?: string | null
          source_row?: number | null
          source_sheet?: string
          transaction_id?: string
          transaction_type?: string
          uses_wallet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_export"
            referencedColumns: ["order_id"]
          },
        ]
      }
    }
    Views: {
      orders_export: {
        Row: {
          booking_segment: string | null
          caregiver: string | null
          confirmation_result: string | null
          custom_deposit: number | null
          custom_price: number | null
          discount: number | null
          established_at: string | null
          family_id: string | null
          home_visit_fee: number | null
          hours: number | null
          legacy_order_id: string | null
          line_user_id_snapshot: string | null
          net_income: number | null
          notes: string | null
          notification_command: string | null
          notification_status: string | null
          order_id: string | null
          order_platform: string | null
          order_status: string | null
          owner_name_snapshot: string | null
          pet_name_snapshot: string | null
          plan_name: string | null
          quantity: number | null
          remaining_payment: number | null
          service_date_raw: string | null
          service_type: string | null
          specified_time: string | null
          standard_deposit: number | null
          standard_price: number | null
          tip: number | null
          total: number | null
          total_before_discount: number | null
          travel_fee: number | null
          unpaid_balance: number | null
          uses_wallet: boolean | null
          visits_command: string | null
        }
        Insert: {
          booking_segment?: string | null
          caregiver?: string | null
          confirmation_result?: string | null
          custom_deposit?: number | null
          custom_price?: number | null
          discount?: number | null
          established_at?: string | null
          family_id?: string | null
          home_visit_fee?: number | null
          hours?: number | null
          legacy_order_id?: string | null
          line_user_id_snapshot?: string | null
          net_income?: number | null
          notes?: string | null
          notification_command?: string | null
          notification_status?: never
          order_id?: string | null
          order_platform?: string | null
          order_status?: string | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          plan_name?: string | null
          quantity?: number | null
          remaining_payment?: number | null
          service_date_raw?: string | null
          service_type?: string | null
          specified_time?: string | null
          standard_deposit?: number | null
          standard_price?: number | null
          tip?: number | null
          total?: number | null
          total_before_discount?: number | null
          travel_fee?: number | null
          unpaid_balance?: number | null
          uses_wallet?: boolean | null
          visits_command?: string | null
        }
        Update: {
          booking_segment?: string | null
          caregiver?: string | null
          confirmation_result?: string | null
          custom_deposit?: number | null
          custom_price?: number | null
          discount?: number | null
          established_at?: string | null
          family_id?: string | null
          home_visit_fee?: number | null
          hours?: number | null
          legacy_order_id?: string | null
          line_user_id_snapshot?: string | null
          net_income?: number | null
          notes?: string | null
          notification_command?: string | null
          notification_status?: never
          order_id?: string | null
          order_platform?: string | null
          order_status?: string | null
          owner_name_snapshot?: string | null
          pet_name_snapshot?: string | null
          plan_name?: string | null
          quantity?: number | null
          remaining_payment?: number | null
          service_date_raw?: string | null
          service_type?: string | null
          specified_time?: string | null
          standard_deposit?: number | null
          standard_price?: number | null
          tip?: number | null
          total?: number | null
          total_before_discount?: number | null
          travel_fee?: number | null
          unpaid_balance?: number | null
          uses_wallet?: boolean | null
          visits_command?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      wallet_activity: {
        Row: {
          amount: number | null
          balance_after_transaction: number | null
          family_id: string | null
          legacy_transaction_id: string | null
          notes: string | null
          occurred_on: string | null
          transaction_type: string | null
          uses_wallet: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          balance: number | null
          family_id: string | null
          last_activity_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["family_id"]
          },
        ]
      }
    }
    Functions: {
      append_sitter_payment_v2: {
        Args: { p_entry: Json; p_actor_id: string; p_expected_order_updated_at: string; p_expected_item_updated_at: string }
        Returns: Json
      }
      get_order_ledger_v2: {
        Args: { p_order_id: string; p_actor_id: string }
        Returns: Json
      }
      append_order_ledger_v2: {
        Args: { p_entry: Json; p_actor_id: string; p_expected_updated_at: string }
        Returns: Json
      }
      bind_sitter_invite: {
        Args: { p_line_user_id: string; p_token_hash: string }
        Returns: {
          bound_display_name: string
          bound_sitter_id: number
        }[]
      }
      create_order_v2: {
        Args: { p_items: Json; p_order: Json }
        Returns: string
      }
      create_sitter_with_rate: {
        Args: {
          p_change_note: string
          p_created_by: string
          p_display_name: string
          p_effective_from: string
          p_rate_percent: number
        }
        Returns: {
          created_rate_id: number
          created_sitter_id: number
        }[]
      }
      save_order_v2: {
        Args: {
          p_expected_updated_at?: string | null
          p_items: Json
          p_order: Json
        }
        Returns: string
      }
      save_order_v2_with_relations: {
        Args: {
          p_expected_updated_at?: string | null
          p_items: Json
          p_order: Json
        }
        Returns: string
      }
      set_sitter_commission_rate: {
        Args: {
          p_change_note: string
          p_created_by: string
          p_effective_from: string
          p_rate_percent: number
          p_sitter_id: number
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
