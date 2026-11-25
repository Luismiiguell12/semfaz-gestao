
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adjustment_indexes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "adjustment_indexes_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_rules": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"days_before": number,"description": string,"id": string,"is_active": boolean,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"days_before": number,"description": string,"id"?: string,"is_active"?: boolean,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"days_before"?: number,"description"?: string,"id"?: string,"is_active"?: boolean,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_rules_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": string,"id": string,"milestone_date": string,"organization_id": string,"rule_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": string,"id"?: string,"milestone_date": string,"organization_id": string,"rule_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"milestone_date"?: string,"organization_id"?: string,"rule_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_rule_id_fkey"
      columns: ["rule_id"]
isOneToOne: false
      referencedRelation: "alert_rules"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_decisions": {
                  Row: {
                    "comment": string | null,"decided_at": string,"decided_by": string,"decision": string,"id": string,"organization_id": string,"request_id": string,"step_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"decided_at"?: string,"decided_by": string,"decision": string,"id"?: string,"organization_id": string,"request_id": string,"step_id": string
                  }
                  Update: {
                    "comment"?: string | null,"decided_at"?: string,"decided_by"?: string,"decision"?: string,"id"?: string,"organization_id"?: string,"request_id"?: string,"step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_decisions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_decisions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_decisions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_decisions_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_decisions_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "approval_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_operations": {
                  Row: {
                    "code": string,"created_at": string,"description": string,"entity_type": string,"handler": string,"module": string,"request_permission": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description": string,"entity_type": string,"handler": string,"module": string,"request_permission": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string,"entity_type"?: string,"handler"?: string,"module"?: string,"request_permission"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_operations_request_permission_fkey"
      columns: ["request_permission"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["code"]
    }
                  ]
                },"approval_requests": {
                  Row: {
                    "applied_at": string | null,"base_hash": string | null,"cancelled_at": string | null,"created_at": string,"created_by": string | null,"current_snapshot": Json | null,"decided_at": string | null,"decided_by": string | null,"decision_comment": string | null,"department_id": string | null,"entity_id": string | null,"entity_type": string,"failure_reason": string | null,"id": string,"justification": string,"operation_code": string,"organization_id": string,"proposed_data": NonNullable<Json>,"requested_at": string,"requested_by": string,"result_entity_id": string | null,"status": Database["public"]['Enums']["approval_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"base_hash"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_snapshot"?: Json | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"department_id"?: string | null,"entity_id"?: string | null,"entity_type": string,"failure_reason"?: string | null,"id"?: string,"justification": string,"operation_code": string,"organization_id": string,"proposed_data": NonNullable<Json>,"requested_at"?: string,"requested_by": string,"result_entity_id"?: string | null,"status"?: Database["public"]['Enums']["approval_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "applied_at"?: string | null,"base_hash"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_snapshot"?: Json | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"department_id"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"failure_reason"?: string | null,"id"?: string,"justification"?: string,"operation_code"?: string,"organization_id"?: string,"proposed_data"?: NonNullable<Json>,"requested_at"?: string,"requested_by"?: string,"result_entity_id"?: string | null,"status"?: Database["public"]['Enums']["approval_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_operation_code_fkey"
      columns: ["operation_code"]
isOneToOne: false
      referencedRelation: "approval_operations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "approval_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_rules": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"operation_code": string,"organization_id": string,"requires_approval": boolean,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"operation_code": string,"organization_id": string,"requires_approval"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"operation_code"?: string,"organization_id"?: string,"requires_approval"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_rules_operation_code_fkey"
      columns: ["operation_code"]
isOneToOne: false
      referencedRelation: "approval_operations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "approval_rules_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_steps": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"organization_id": string,"request_id": string,"required_permission": string,"status": Database["public"]['Enums']["approval_status"],"step_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"organization_id": string,"request_id": string,"required_permission"?: string,"status"?: Database["public"]['Enums']["approval_status"],"step_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"organization_id"?: string,"request_id"?: string,"required_permission"?: string,"status"?: Database["public"]['Enums']["approval_status"],"step_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_steps_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_steps_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_steps_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_steps_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_steps_required_permission_fkey"
      columns: ["required_permission"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["code"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "actor_id": string | null,"actor_type": string,"changed_fields": (string)[] | null,"id": string,"ip_address": unknown,"justification": string | null,"metadata": NonNullable<Json>,"module": string,"new_data": Json | null,"occurred_at": string,"old_data": Json | null,"operation": string,"organization_id": string | null,"record_id": string | null,"table_name": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_type": string,"changed_fields"?: (string)[] | null,"id"?: string,"ip_address"?: unknown,"justification"?: string | null,"metadata"?: NonNullable<Json>,"module": string,"new_data"?: Json | null,"occurred_at"?: string,"old_data"?: Json | null,"operation": string,"organization_id"?: string | null,"record_id"?: string | null,"table_name"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_type"?: string,"changed_fields"?: (string)[] | null,"id"?: string,"ip_address"?: unknown,"justification"?: string | null,"metadata"?: NonNullable<Json>,"module"?: string,"new_data"?: Json | null,"occurred_at"?: string,"old_data"?: Json | null,"operation"?: string,"organization_id"?: string | null,"record_id"?: string | null,"table_name"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"consumer_units": {
                  Row: {
                    "address": string | null,"complement": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"holder_name": string,"id": string,"identifier": string,"meter_number": string | null,"notes": string | null,"organization_id": string,"status": Database["public"]['Enums']["unit_status"],"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"complement"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"holder_name": string,"id"?: string,"identifier": string,"meter_number"?: string | null,"notes"?: string | null,"organization_id": string,"status"?: Database["public"]['Enums']["unit_status"],"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"complement"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"holder_name"?: string,"id"?: string,"identifier"?: string,"meter_number"?: string | null,"notes"?: string | null,"organization_id"?: string,"status"?: Database["public"]['Enums']["unit_status"],"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consumer_units_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consumer_units_supplier_fk"
      columns: ["supplier_id","organization_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"consumption_records": {
                  Row: {
                    "competence": string,"consumption": number,"created_at": string,"id": string,"increase_percent": number | null,"invoice_id": string,"organization_id": string,"previous_average": number | null,"status": string,"threshold_percent": number,"unit_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "competence": string,"consumption": number,"created_at"?: string,"id"?: string,"increase_percent"?: number | null,"invoice_id": string,"organization_id": string,"previous_average"?: number | null,"status": string,"threshold_percent": number,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "competence"?: string,"consumption"?: number,"created_at"?: string,"id"?: string,"increase_percent"?: number | null,"invoice_id"?: string,"organization_id"?: string,"previous_average"?: number | null,"status"?: string,"threshold_percent"?: number,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consumption_records_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consumption_records_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consumption_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consumption_records_unit_fk"
      columns: ["unit_id","organization_id"]
isOneToOne: false
      referencedRelation: "consumer_units"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"contract_amendments": {
                  Row: {
                    "amendment_number": string,"approval_request_id": string | null,"contract_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"description": string,"id": string,"kind": Database["public"]['Enums']["amendment_kind"],"new_end_date": string | null,"new_monthly_value": number | null,"organization_id": string,"signed_on": string,"updated_at": string,"updated_by": string | null,"value_effective_from": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amendment_number": string,"approval_request_id"?: string | null,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description": string,"id"?: string,"kind": Database["public"]['Enums']["amendment_kind"],"new_end_date"?: string | null,"new_monthly_value"?: number | null,"organization_id": string,"signed_on": string,"updated_at"?: string,"updated_by"?: string | null,"value_effective_from"?: string | null
                  }
                  Update: {
                    "amendment_number"?: string,"approval_request_id"?: string | null,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["amendment_kind"],"new_end_date"?: string | null,"new_monthly_value"?: number | null,"organization_id"?: string,"signed_on"?: string,"updated_at"?: string,"updated_by"?: string | null,"value_effective_from"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_amendments_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_amendments_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contract_amendments_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contract_amendments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_landlords": {
                  Row: {
                    "contract_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"id": string,"landlord_id": string,"organization_id": string,"share_percent": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"landlord_id": string,"organization_id": string,"share_percent"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"landlord_id"?: string,"organization_id"?: string,"share_percent"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_landlords_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contract_landlords_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contract_landlords_landlord_fk"
      columns: ["landlord_id","organization_id"]
isOneToOne: false
      referencedRelation: "landlords"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contract_landlords_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_modalities": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_modalities_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "adjustment_index_id": string | null,"admin_status": Database["public"]['Enums']["contract_admin_status"],"approval_request_id": string | null,"base_date": string | null,"contract_number": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"end_date": string,"global_value": number,"id": string,"inspector_id": string | null,"manager_id": string | null,"modality_id": string | null,"monthly_value": number,"notes": string | null,"object": string,"organization_id": string,"process_number": string | null,"property_id": string,"signed_on": string,"start_date": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_index_id"?: string | null,"admin_status"?: Database["public"]['Enums']["contract_admin_status"],"approval_request_id"?: string | null,"base_date"?: string | null,"contract_number": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"end_date": string,"global_value": number,"id"?: string,"inspector_id"?: string | null,"manager_id"?: string | null,"modality_id"?: string | null,"monthly_value": number,"notes"?: string | null,"object": string,"organization_id": string,"process_number"?: string | null,"property_id": string,"signed_on": string,"start_date": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "adjustment_index_id"?: string | null,"admin_status"?: Database["public"]['Enums']["contract_admin_status"],"approval_request_id"?: string | null,"base_date"?: string | null,"contract_number"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"end_date"?: string,"global_value"?: number,"id"?: string,"inspector_id"?: string | null,"manager_id"?: string | null,"modality_id"?: string | null,"monthly_value"?: number,"notes"?: string | null,"object"?: string,"organization_id"?: string,"process_number"?: string | null,"property_id"?: string,"signed_on"?: string,"start_date"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_index_fk"
      columns: ["adjustment_index_id","organization_id"]
isOneToOne: false
      referencedRelation: "adjustment_indexes"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_inspector_fk"
      columns: ["inspector_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_inspector_fk"
      columns: ["inspector_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_manager_fk"
      columns: ["manager_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_manager_fk"
      columns: ["manager_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_modality_fk"
      columns: ["modality_id","organization_id"]
isOneToOne: false
      referencedRelation: "contract_modalities"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "acronym": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["department_kind"],"name": string,"organization_id": string,"parent_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acronym"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["department_kind"],"name": string,"organization_id": string,"parent_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "acronym"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["department_kind"],"name"?: string,"organization_id"?: string,"parent_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_parent_fk"
      columns: ["parent_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "bucket_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"description": string | null,"entity_id": string,"entity_type": string,"id": string,"is_current": boolean,"mime_type": string,"organization_id": string,"original_name": string,"previous_version_id": string | null,"sha256": string,"size_bytes": number,"storage_path": string,"updated_at": string,"updated_by": string | null,"uploaded_at": string,"uploaded_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description"?: string | null,"entity_id": string,"entity_type": string,"id"?: string,"is_current"?: boolean,"mime_type": string,"organization_id": string,"original_name": string,"previous_version_id"?: string | null,"sha256": string,"size_bytes": number,"storage_path": string,"updated_at"?: string,"updated_by"?: string | null,"uploaded_at"?: string,"uploaded_by": string,"version"?: number
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description"?: string | null,"entity_id"?: string,"entity_type"?: string,"id"?: string,"is_current"?: boolean,"mime_type"?: string,"organization_id"?: string,"original_name"?: string,"previous_version_id"?: string | null,"sha256"?: string,"size_bytes"?: number,"storage_path"?: string,"updated_at"?: string,"updated_by"?: string | null,"uploaded_at"?: string,"uploaded_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_previous_version_id_fkey"
      columns: ["previous_version_id"]
isOneToOne: true
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount": number,"approval_request_id": string | null,"cancellation_reason": string | null,"cancelled_at": string | null,"competence": string,"consumption": number,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"due_date": string,"id": string,"invoice_number": string | null,"is_justified_duplicate": boolean,"issue_date": string | null,"measure_unit": string,"organization_id": string,"property_id": string,"supplier_id": string,"unit_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approval_request_id"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"competence": string,"consumption": number,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"due_date": string,"id"?: string,"invoice_number"?: string | null,"is_justified_duplicate"?: boolean,"issue_date"?: string | null,"measure_unit": string,"organization_id": string,"property_id": string,"supplier_id": string,"unit_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"approval_request_id"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"competence"?: string,"consumption"?: number,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"due_date"?: string,"id"?: string,"invoice_number"?: string | null,"is_justified_duplicate"?: boolean,"issue_date"?: string | null,"measure_unit"?: string,"organization_id"?: string,"property_id"?: string,"supplier_id"?: string,"unit_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "invoices_supplier_fk"
      columns: ["supplier_id","organization_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "invoices_unit_fk"
      columns: ["unit_id","organization_id"]
isOneToOne: false
      referencedRelation: "consumer_units"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"landlords": {
                  Row: {
                    "address": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"document": string,"document_masked": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"organization_id": string,"person_type": Database["public"]['Enums']["person_type"],"phone": string | null,"phone_masked": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"document": string,"document_masked"?: never,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"organization_id": string,"person_type": Database["public"]['Enums']["person_type"],"phone"?: string | null,"phone_masked"?: never,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"document"?: string,"document_masked"?: never,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"organization_id"?: string,"person_type"?: Database["public"]['Enums']["person_type"],"phone"?: string | null,"phone_masked"?: never,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "landlords_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_email_queue": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"last_error": string | null,"notification_id": string,"organization_id": string,"processed_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"notification_id": string,"organization_id": string,"processed_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"notification_id"?: string,"organization_id"?: string,"processed_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_email_queue_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: true
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_email_queue_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_email_queue_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "notification_email_queue_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "created_at": string,"created_by": string | null,"email": boolean,"id": string,"in_app": boolean,"organization_id": string,"type_code": string,"updated_at": string,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: boolean,"id"?: string,"in_app"?: boolean,"organization_id": string,"type_code": string,"updated_at"?: string,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: boolean,"id"?: string,"in_app"?: boolean,"organization_id"?: string,"type_code"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_preferences_type_code_fkey"
      columns: ["type_code"]
isOneToOne: false
      referencedRelation: "notification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "notification_preferences_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "notification_preferences_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"notification_types": {
                  Row: {
                    "code": string,"created_at": string,"default_email": boolean,"default_in_app": boolean,"description": string,"is_available": boolean,"module": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"default_email"?: boolean,"default_in_app"?: boolean,"description": string,"is_available"?: boolean,"module": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"default_email"?: boolean,"default_in_app"?: boolean,"description"?: string,"is_available"?: boolean,"module"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"link_path": string | null,"organization_id": string,"read_at": string | null,"title": string,"type_code": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"link_path"?: string | null,"organization_id": string,"read_at"?: string | null,"title": string,"type_code": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"link_path"?: string | null,"organization_id"?: string,"read_at"?: string | null,"title"?: string,"type_code"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_type_code_fkey"
      columns: ["type_code"]
isOneToOne: false
      referencedRelation: "notification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "notifications_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "notifications_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"short_name": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"short_name": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"short_name"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"approval_request_id": string | null,"created_at": string,"created_by": string | null,"id": string,"invoice_id": string | null,"kind": Database["public"]['Enums']["payment_kind"],"notes": string | null,"organization_id": string,"paid_on": string,"rent_charge_id": string | null,"reversal_of": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approval_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string | null,"kind": Database["public"]['Enums']["payment_kind"],"notes"?: string | null,"organization_id": string,"paid_on": string,"rent_charge_id"?: string | null,"reversal_of"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"approval_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string | null,"kind"?: Database["public"]['Enums']["payment_kind"],"notes"?: string | null,"organization_id"?: string,"paid_on"?: string,"rent_charge_id"?: string | null,"reversal_of"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_invoice_fk"
      columns: ["invoice_id","organization_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "payments_invoice_fk"
      columns: ["invoice_id","organization_id"]
isOneToOne: false
      referencedRelation: "invoices_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "payments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_rent_fk"
      columns: ["rent_charge_id","organization_id"]
isOneToOne: false
      referencedRelation: "rent_charges"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "payments_rent_fk"
      columns: ["rent_charge_id","organization_id"]
isOneToOne: false
      referencedRelation: "rent_charges_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "payments_reversal_of_fkey"
      columns: ["reversal_of"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "code": string,"created_at": string,"description": string,"is_privileged": boolean,"module": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description": string,"is_privileged"?: boolean,"module": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string,"is_privileged"?: boolean,"module"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"department_id": string | null,"email": string,"employee_number": string | null,"full_name": string,"id": string,"job_title": string | null,"organization_id": string,"organization_wide_access": boolean,"status": Database["public"]['Enums']["user_status"],"status_reason": string | null,"updated_at": string,"updated_by": string | null,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"department_id"?: string | null,"email": string,"employee_number"?: string | null,"full_name": string,"id": string,"job_title"?: string | null,"organization_id": string,"organization_wide_access"?: boolean,"status"?: Database["public"]['Enums']["user_status"],"status_reason"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"username": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"department_id"?: string | null,"email"?: string,"employee_number"?: string | null,"full_name"?: string,"id"?: string,"job_title"?: string | null,"organization_id"?: string,"organization_wide_access"?: boolean,"status"?: Database["public"]['Enums']["user_status"],"status_reason"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"username"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_department_fk"
      columns: ["department_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"properties": {
                  Row: {
                    "address_number": string,"approval_request_id": string | null,"city": string,"complement": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"department_id": string,"district": string,"id": string,"internal_responsible_id": string | null,"name": string,"notes": string | null,"occupation_date": string | null,"organization_id": string,"postal_code": string,"purpose": string,"state": string,"status": Database["public"]['Enums']["property_status"],"street": string,"unit_department_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_number": string,"approval_request_id"?: string | null,"city": string,"complement"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"department_id": string,"district": string,"id"?: string,"internal_responsible_id"?: string | null,"name": string,"notes"?: string | null,"occupation_date"?: string | null,"organization_id": string,"postal_code": string,"purpose": string,"state": string,"status"?: Database["public"]['Enums']["property_status"],"street": string,"unit_department_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address_number"?: string,"approval_request_id"?: string | null,"city"?: string,"complement"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"department_id"?: string,"district"?: string,"id"?: string,"internal_responsible_id"?: string | null,"name"?: string,"notes"?: string | null,"occupation_date"?: string | null,"organization_id"?: string,"postal_code"?: string,"purpose"?: string,"state"?: string,"status"?: Database["public"]['Enums']["property_status"],"street"?: string,"unit_department_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "properties_department_fk"
      columns: ["department_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "properties_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "properties_responsible_fk"
      columns: ["internal_responsible_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "properties_responsible_fk"
      columns: ["internal_responsible_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "properties_unit_fk"
      columns: ["unit_department_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"property_landlords": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"id": string,"landlord_id": string,"organization_id": string,"property_id": string,"share_percent": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"landlord_id": string,"organization_id": string,"property_id": string,"share_percent"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"id"?: string,"landlord_id"?: string,"organization_id"?: string,"property_id"?: string,"share_percent"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_landlords_landlord_fk"
      columns: ["landlord_id","organization_id"]
isOneToOne: false
      referencedRelation: "landlords"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "property_landlords_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_landlords_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"rent_charges": {
                  Row: {
                    "amount": number,"calc_memo": NonNullable<Json>,"calculated_amount": number,"cancellation_reason": string | null,"cancelled_at": string | null,"competence": string,"contract_id": string,"correction_note": string | null,"created_at": string,"created_by": string | null,"due_date": string,"id": string,"organization_id": string,"property_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"calc_memo": NonNullable<Json>,"calculated_amount": number,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"competence": string,"contract_id": string,"correction_note"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date": string,"id"?: string,"organization_id": string,"property_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"calc_memo"?: NonNullable<Json>,"calculated_amount"?: number,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"competence"?: string,"contract_id"?: string,"correction_note"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"id"?: string,"organization_id"?: string,"property_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rent_charges_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "rent_charges_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "rent_charges_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rent_charges_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"organization_id": string,"permission_code": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"organization_id": string,"permission_code": string,"role_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"organization_id"?: string,"permission_code"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_permissions_permission_code_fkey"
      columns: ["permission_code"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "role_permissions_role_fk"
      columns: ["role_id","organization_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"description": string | null,"id": string,"is_system": boolean,"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description"?: string | null,"id"?: string,"is_system"?: boolean,"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"deletion_reason"?: string | null,"description"?: string | null,"id"?: string,"is_system"?: boolean,"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["supplier_kind"],"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["supplier_kind"],"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["supplier_kind"],"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"system_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"id": string,"key": string,"organization_id": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"key": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"key"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "system_settings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"unit_assignments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"end_date": string | null,"id": string,"organization_id": string,"property_id": string,"start_date": string,"unit_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"id"?: string,"organization_id": string,"property_id": string,"start_date": string,"unit_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"end_date"?: string | null,"id"?: string,"organization_id"?: string,"property_id"?: string,"start_date"?: string,"unit_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_assignments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_assignments_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "unit_assignments_unit_fk"
      columns: ["unit_id","organization_id"]
isOneToOne: false
      referencedRelation: "consumer_units"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"user_department_access": {
                  Row: {
                    "created_at": string,"created_by": string | null,"department_id": string,"id": string,"organization_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"department_id": string,"id"?: string,"organization_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"department_id"?: string,"id"?: string,"organization_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_department_access_department_fk"
      columns: ["department_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_department_access_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_department_access_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_department_access_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"user_property_access": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"organization_id": string,"property_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"property_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"property_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_property_access_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_property_access_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_property_access_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_property_access_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"organization_id": string,"role_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"role_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_role_fk"
      columns: ["role_id","organization_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_roles_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "user_roles_user_fk"
      columns: ["user_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                }
          }
          Views: {
            "contracts_overview": {
                  Row: {
                    "adjustment_index_id": string | null,"admin_status": Database["public"]['Enums']["contract_admin_status"],"approval_request_id": string | null,"base_date": string | null,"contract_number": string,"created_at": string,"created_by": string | null,"days_to_end": number | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"department_id": string,"effective_end_date": string | null,"effective_monthly_value": number | null,"end_date": string,"global_value": number,"id": string,"inspector_id": string | null,"manager_id": string | null,"modality_id": string | null,"monthly_value": number,"next_adjustment_date": string | null,"notes": string | null,"object": string,"organization_id": string,"process_number": string | null,"property_id": string,"property_name": string,"signed_on": string,"start_date": string,"updated_at": string,"updated_by": string | null,"validity_status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "contracts_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_index_fk"
      columns: ["adjustment_index_id","organization_id"]
isOneToOne: false
      referencedRelation: "adjustment_indexes"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_inspector_fk"
      columns: ["inspector_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_inspector_fk"
      columns: ["inspector_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_manager_fk"
      columns: ["manager_id","organization_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_manager_fk"
      columns: ["manager_id","organization_id"]
isOneToOne: false
      referencedRelation: "user_directory"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_modality_fk"
      columns: ["modality_id","organization_id"]
isOneToOne: false
      referencedRelation: "contract_modalities"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "contracts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"invoices_overview": {
                  Row: {
                    "amount": number,"approval_request_id": string | null,"balance": number | null,"cancellation_reason": string | null,"cancelled_at": string | null,"competence": string,"consumption": number,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"deletion_reason": string | null,"department_id": string,"due_date": string,"id": string,"invoice_number": string | null,"is_justified_duplicate": boolean,"issue_date": string | null,"last_paid_on": string | null,"measure_unit": string,"organization_id": string,"paid_total": number | null,"property_id": string,"property_name": string,"status": string | null,"supplier_id": string,"supplier_kind": Database["public"]['Enums']["supplier_kind"],"supplier_name": string,"unit_id": string,"unit_identifier": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoices_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "invoices_supplier_fk"
      columns: ["supplier_id","organization_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "invoices_unit_fk"
      columns: ["unit_id","organization_id"]
isOneToOne: false
      referencedRelation: "consumer_units"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"rent_charges_overview": {
                  Row: {
                    "amount": number,"balance": number | null,"calc_memo": NonNullable<Json>,"calculated_amount": number,"cancellation_reason": string | null,"cancelled_at": string | null,"competence": string,"contract_id": string,"contract_number": string,"correction_note": string | null,"created_at": string,"created_by": string | null,"department_id": string,"due_date": string,"id": string,"last_paid_on": string | null,"organization_id": string,"paid_total": number | null,"property_id": string,"property_name": string,"status": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "rent_charges_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "rent_charges_contract_fk"
      columns: ["contract_id","organization_id"]
isOneToOne: false
      referencedRelation: "contracts_overview"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "rent_charges_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rent_charges_property_fk"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"user_directory": {
                  Row: {
                    "department_id": string | null,"full_name": string,"id": string,"job_title": string | null,"organization_id": string,"status": Database["public"]['Enums']["user_status"],"username": string
                  }
                  ComputedFields: never
                  Insert: {
                           "department_id"?: string | null,"full_name"?: string | null,"id"?: string | null,"job_title"?: string | null,"organization_id"?: string | null,"status"?: Database["public"]['Enums']["user_status"] | null,"username"?: string | null
                         }
                        Update: {
                           "department_id"?: string | null,"full_name"?: string | null,"id"?: string | null,"job_title"?: string | null,"organization_id"?: string | null,"status"?: Database["public"]['Enums']["user_status"] | null,"username"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "profiles_department_fk"
      columns: ["department_id","organization_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_create_profile":
{ Args: { "p_department_id": string,"p_department_ids": (string)[],"p_employee_number": string,"p_full_name": string,"p_job_title": string,"p_organization_wide_access"?: boolean,"p_role_ids": (string)[],"p_user_id": string,"p_username": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"department_id": string | null,
"email": string,
"employee_number": string | null,
"full_name": string,
"id": string,
"job_title": string | null,
"organization_id": string,
"organization_wide_access": boolean,
"status": Database["public"]['Enums']["user_status"],
"status_reason": string | null,
"updated_at": string,
"updated_by": string | null,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_delete_role":
{ Args: { "p_reason": string,"p_role_id": string }; Returns: undefined
                           },
"admin_list_properties_for_scope":
{ Args: Record<PropertyKey, never>; Returns: {
              "department_id": string,"id": string,"name": string
            }[]
                           },
"admin_list_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "confirmed_at": string,"created_at": string,"department_access": Json,"department_id": string,"department_name": string,"email": string,"employee_number": string,"full_name": string,"id": string,"invited_at": string,"job_title": string,"last_sign_in_at": string,"mfa_enrolled": boolean,"organization_wide_access": boolean,"roles": Json,"status": Database["public"]['Enums']["user_status"],"status_reason": string,"username": string
            }[]
                           },
"admin_precheck_invite":
{ Args: { "p_email": string,"p_username": string }; Returns: undefined
                           },
"admin_save_role":
{ Args: { "p_code": string,"p_description": string,"p_name": string,"p_permission_codes": (string)[],"p_reason": string,"p_role_id": string }; Returns: {
              "code": string,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"description": string | null,
"id": string,
"is_system": boolean,
"name": string,
"organization_id": string,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "roles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_user_access":
{ Args: { "p_department_ids": (string)[],"p_organization_wide_access": boolean,"p_reason": string,"p_role_ids": (string)[],"p_user_id": string }; Returns: undefined
                           },
"admin_set_user_property_access":
{ Args: { "p_property_ids": (string)[],"p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"admin_set_user_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["user_status"],"p_user_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"department_id": string | null,
"email": string,
"employee_number": string | null,
"full_name": string,
"id": string,
"job_title": string | null,
"organization_id": string,
"organization_wide_access": boolean,
"status": Database["public"]['Enums']["user_status"],
"status_reason": string | null,
"updated_at": string,
"updated_by": string | null,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_update_profile":
{ Args: { "p_department_id": string,"p_employee_number": string,"p_full_name": string,"p_job_title": string,"p_reason": string,"p_user_id": string,"p_username": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"department_id": string | null,
"email": string,
"employee_number": string | null,
"full_name": string,
"id": string,
"job_title": string | null,
"organization_id": string,
"organization_wide_access": boolean,
"status": Database["public"]['Enums']["user_status"],
"status_reason": string | null,
"updated_at": string,
"updated_by": string | null,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"assign_consumer_unit":
{ Args: { "p_property_id": string,"p_reason": string,"p_start_date": string,"p_unit_id": string }; Returns: string
                           },
"bootstrap_first_admin":
{ Args: { "p_full_name": string,"p_organization_id": string,"p_user_id": string,"p_username": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"department_id": string | null,
"email": string,
"employee_number": string | null,
"full_name": string,
"id": string,
"job_title": string | null,
"organization_id": string,
"organization_wide_access": boolean,
"status": Database["public"]['Enums']["user_status"],
"status_reason": string | null,
"updated_at": string,
"updated_by": string | null,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_attach_document":
{ Args: { "p_entity_id": string,"p_entity_type": string }; Returns: boolean
                           },
"cancel_approval_request":
{ Args: { "p_reason": string,"p_request_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_invoice":
{ Args: { "p_data": Json,"p_justification"?: string }; Returns: Json
                           },
"dashboard_contract_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"dashboard_finance_stats":
{ Args: { "p_department_id"?: string,"p_months"?: number }; Returns: Json
                           },
"dashboard_foundation_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"decide_approval":
{ Args: { "p_comment"?: string,"p_decision": string,"p_request_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"end_consumer_unit_assignment":
{ Args: { "p_end_date": string,"p_reason": string,"p_unit_id": string }; Returns: undefined
                           },
"get_landlord_sensitive":
{ Args: { "p_landlord_id": string }; Returns: Json
                           },
"get_my_access":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"has_permission":
{ Args: { "department_id"?: string,"permission": string }; Returns: boolean
                           },
"log_client_event":
{ Args: { "p_metadata"?: Json,"p_module": string,"p_operation": string }; Returns: string
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"mark_notification_read":
{ Args: { "p_notification_id": string }; Returns: undefined
                           },
"request_amendment_create":
{ Args: { "p_data": Json,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_contract_create":
{ Args: { "p_data": Json,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_contract_term_change":
{ Args: { "p_contract_id": string,"p_end_date": string,"p_justification": string,"p_start_date": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_contract_value_change":
{ Args: { "p_contract_id": string,"p_global_value": number,"p_justification": string,"p_monthly_value": number }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_invoice_cancel":
{ Args: { "p_invoice_id": string,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_invoice_correction":
{ Args: { "p_data": Json,"p_invoice_id": string,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_payment":
{ Args: { "p_data": Json,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_property_address_change":
{ Args: { "p_data": Json,"p_justification": string,"p_property_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_property_create":
{ Args: { "p_data": Json,"p_justification": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_property_department_change":
{ Args: { "p_department_id": string,"p_justification": string,"p_property_id": string,"p_unit_department_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_rent_cancel":
{ Args: { "p_justification": string,"p_rent_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_rent_correction":
{ Args: { "p_amount": number,"p_justification": string,"p_rent_id": string }; Returns: {
              "applied_at": string | null,
"base_hash": string | null,
"cancelled_at": string | null,
"created_at": string,
"created_by": string | null,
"current_snapshot": Json | null,
"decided_at": string | null,
"decided_by": string | null,
"decision_comment": string | null,
"department_id": string | null,
"entity_id": string | null,
"entity_type": string,
"failure_reason": string | null,
"id": string,
"justification": string,
"operation_code": string,
"organization_id": string,
"proposed_data": NonNullable<Json>,
"requested_at": string,
"requested_by": string,
"result_entity_id": string | null,
"status": Database["public"]['Enums']["approval_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "approval_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_consumer_unit":
{ Args: { "p_data": Json,"p_reason"?: string,"p_unit_id": string }; Returns: string
                           },
"save_landlord":
{ Args: { "p_data": Json,"p_landlord_id": string,"p_reason"?: string }; Returns: string
                           },
"service_register_document":
{ Args: { "p_description"?: string,"p_entity_id": string,"p_entity_type": string,"p_mime_type": string,"p_original_name": string,"p_replaces_document_id"?: string,"p_sha256": string,"p_size_bytes": number,"p_storage_path": string,"p_user_id": string }; Returns: {
              "bucket_id": string,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"description": string | null,
"entity_id": string,
"entity_type": string,
"id": string,
"is_current": boolean,
"mime_type": string,
"organization_id": string,
"original_name": string,
"previous_version_id": string | null,
"sha256": string,
"size_bytes": number,
"storage_path": string,
"updated_at": string,
"updated_by": string | null,
"uploaded_at": string,
"uploaded_by": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "documents"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_property_landlords":
{ Args: { "p_items": Json,"p_property_id": string,"p_reason": string }; Returns: undefined
                           },
"soft_delete_department":
{ Args: { "p_department_id": string,"p_reason": string }; Returns: undefined
                           },
"update_contract_details":
{ Args: { "p_contract_id": string,"p_data": Json,"p_reason": string }; Returns: {
              "adjustment_index_id": string | null,
"admin_status": Database["public"]['Enums']["contract_admin_status"],
"approval_request_id": string | null,
"base_date": string | null,
"contract_number": string,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"end_date": string,
"global_value": number,
"id": string,
"inspector_id": string | null,
"manager_id": string | null,
"modality_id": string | null,
"monthly_value": number,
"notes": string | null,
"object": string,
"organization_id": string,
"process_number": string | null,
"property_id": string,
"signed_on": string,
"start_date": string,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "contracts"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_property_details":
{ Args: { "p_data": Json,"p_property_id": string,"p_reason": string }; Returns: {
              "address_number": string,
"approval_request_id": string | null,
"city": string,
"complement": string | null,
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"deletion_reason": string | null,
"department_id": string,
"district": string,
"id": string,
"internal_responsible_id": string | null,
"name": string,
"notes": string | null,
"occupation_date": string | null,
"organization_id": string,
"postal_code": string,
"purpose": string,
"state": string,
"status": Database["public"]['Enums']["property_status"],
"street": string,
"unit_department_id": string | null,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "properties"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "amendment_kind": "term"|"value"|"term_and_value"|"other","approval_status": "pending"|"approved"|"rejected"|"cancelled"|"failed","contract_admin_status": "active"|"suspended"|"terminated"|"closed","department_kind": "secretariat"|"directorate"|"unit","payment_kind": "payment"|"reversal","person_type": "individual"|"company","property_status": "active"|"inactive"|"vacated","supplier_kind": "energy"|"water","unit_status": "active"|"inactive","user_status": "active"|"inactive"|"blocked"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "amendment_kind": ["term", "value", "term_and_value", "other"],"approval_status": ["pending", "approved", "rejected", "cancelled", "failed"],"contract_admin_status": ["active", "suspended", "terminated", "closed"],"department_kind": ["secretariat", "directorate", "unit"],"payment_kind": ["payment", "reversal"],"person_type": ["individual", "company"],"property_status": ["active", "inactive", "vacated"],"supplier_kind": ["energy", "water"],"unit_status": ["active", "inactive"],"user_status": ["active", "inactive", "blocked"]
          }
        }
} as const
