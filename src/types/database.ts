
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
            "audit_logs": {
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
            "user_directory": {
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
"dashboard_foundation_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
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
"soft_delete_department":
{ Args: { "p_department_id": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "department_kind": "secretariat"|"directorate"|"unit","user_status": "active"|"inactive"|"blocked"
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
            "department_kind": ["secretariat", "directorate", "unit"],"user_status": ["active", "inactive", "blocked"]
          }
        }
} as const
