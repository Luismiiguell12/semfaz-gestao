import {
  Bell, Building2, CalendarDays, ClipboardList, FileBarChart, FileSignature, Gauge, History, Home, KeyRound,
  Network, PlugZap, Stamp, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permissão necessária para exibir o item (a autorização real é a RLS). */
  permission?: string;
  /** Módulo de fase futura: exibido desabilitado como "Em breve". */
  comingSoon?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Geral",
    items: [
      { label: "Painel", href: "/", icon: Gauge },
      { label: "Notificações", href: "/notificacoes/", icon: Bell },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Aprovações", href: "/aprovacoes/", icon: Stamp, comingSoon: true },
      { label: "Imóveis e locações", href: "/imoveis/", icon: Home, comingSoon: true },
      { label: "Contratos", href: "/contratos/", icon: FileSignature, comingSoon: true },
      { label: "Unidades consumidoras", href: "/unidades/", icon: PlugZap, comingSoon: true },
      { label: "Financeiro", href: "/financeiro/", icon: Wallet, comingSoon: true },
      { label: "Demandas", href: "/demandas/", icon: ClipboardList, comingSoon: true },
      { label: "Calendário", href: "/calendario/", icon: CalendarDays, comingSoon: true },
      { label: "Produtividade", href: "/produtividade/", icon: TrendingUp, comingSoon: true },
      { label: "Relatórios", href: "/relatorios/", icon: FileBarChart, comingSoon: true },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Departamentos", href: "/administracao/departamentos/", icon: Network, permission: "departments.manage" },
      { label: "Usuários", href: "/administracao/usuarios/", icon: Users, permission: "users.manage" },
      { label: "Perfis de acesso", href: "/administracao/perfis/", icon: KeyRound, permission: "roles.manage" },
      { label: "Auditoria", href: "/administracao/auditoria/", icon: History, permission: "audit.view" },
    ],
  },
];

/** Rótulos para breadcrumbs, por segmento de rota. */
export const ROUTE_LABELS: Record<string, string> = {
  notificacoes: "Notificações",
  "minha-conta": "Minha conta",
  administracao: "Administração",
  departamentos: "Departamentos",
  usuarios: "Usuários",
  perfis: "Perfis de acesso",
  auditoria: "Auditoria",
  detalhe: "Detalhe",
};

export const ORGANIZATION_ICON = Building2;
