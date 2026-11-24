// Forma do retorno de public.get_my_access().
export interface AccessRole {
  id: string;
  code: string;
  name: string;
}

export interface AccessContext {
  status: "active" | "inactive" | "blocked" | "no_profile";
  profile?: {
    id: string;
    full_name: string;
    email: string;
    username: string;
    job_title: string | null;
    department_id: string | null;
    organization_id: string;
    organization_wide_access: boolean;
  };
  organization?: { id: string; name: string; short_name: string };
  department?: { id: string; name: string; acronym: string | null } | null;
  roles?: AccessRole[];
  is_admin?: boolean;
  mfa?: { enrolled: boolean; required: boolean; current_aal: string; satisfied: boolean };
  permissions?: string[];
  permissions_pending_mfa?: string[];
}
