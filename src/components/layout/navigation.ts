import {
  Banknote,
  Bell,
  ChartColumn,
  FilePlus2,
  Receipt,
  SlidersHorizontal,
  UserRound,
  Building2,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FileSignature,
  Gauge,
  History,
  Home,
  KeyRound,
  Network,
  PlugZap,
  Stamp,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
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
      {
        label: "Novo cadastro a partir de contrato",
        href: "/cadastro-guiado/",
        icon: FilePlus2,
        permission: "contracts.manage",
      },
      { label: "Contratos", href: "/contratos/", icon: FileSignature, permission: "contracts.view" },
      { label: "Locadores", href: "/locadores/", icon: UserRound, permission: "landlords.view" },
      { label: "Imóveis", href: "/imoveis/", icon: Home, permission: "properties.view" },
      {
        label: "Unidades consumidoras",
        href: "/unidades/",
        icon: PlugZap,
        permission: "consumer_units.view",
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Faturas", href: "/financeiro/faturas/", icon: Receipt, permission: "invoices.view" },
      { label: "Aluguéis", href: "/financeiro/alugueis/", icon: Wallet, permission: "invoices.view" },
      { label: "Pagamentos", href: "/financeiro/pagamentos/", icon: Banknote, permission: "invoices.view" },
      {
        label: "Relatórios de despesas",
        href: "/financeiro/relatorios/",
        icon: ChartColumn,
        permission: "finance.reports.view",
      },
    ],
  },
  {
    label: "Acompanhamento",
    items: [
      { label: "Demandas", href: "/demandas/", icon: ClipboardList },
      { label: "Calendário", href: "/calendario/", icon: CalendarDays },
      { label: "Aprovações", href: "/aprovacoes/", icon: Stamp },
      {
        label: "Produtividade",
        href: "/produtividade/",
        icon: TrendingUp,
        permission: "productivity.view_own",
      },
      { label: "Relatórios", href: "/relatorios/", icon: FileBarChart },
    ],
  },
  {
    label: "Administração",
    items: [
      {
        label: "Departamentos",
        href: "/administracao/departamentos/",
        icon: Network,
        permission: "departments.manage",
      },
      { label: "Usuários", href: "/administracao/usuarios/", icon: Users, permission: "users.manage" },
      {
        label: "Perfis de acesso",
        href: "/administracao/perfis/",
        icon: KeyRound,
        permission: "roles.manage",
      },
      {
        label: "Regras e listas",
        href: "/administracao/regras/",
        icon: SlidersHorizontal,
        permission: "settings.manage",
      },
      { label: "Auditoria", href: "/administracao/auditoria/", icon: History, permission: "audit.view" },
    ],
  },
];

/** Rótulos para breadcrumbs: pelo caminho completo (prioridade) ou pelo segmento. */
export const ROUTE_LABELS: Record<string, string> = {
  notificacoes: "Notificações",
  "minha-conta": "Minha conta",
  administracao: "Administração",
  departamentos: "Departamentos",
  usuarios: "Usuários",
  perfis: "Perfis de acesso",
  auditoria: "Auditoria",
  detalhe: "Detalhe",
  aprovacoes: "Aprovações",
  imoveis: "Imóveis",
  locadores: "Locadores",
  contratos: "Contratos",
  novo: "Nova solicitação",
  regras: "Regras e listas",
  unidades: "Unidades consumidoras",
  financeiro: "Financeiro",
  faturas: "Faturas",
  alugueis: "Aluguéis",
  nova: "Novo lançamento",
  pagamentos: "Pagamentos",
  relatorios: "Relatórios de despesas",
  "/relatorios/": "Relatórios",
  "cadastro-guiado": "Novo cadastro a partir de contrato",
  editar: "Cadastro em andamento",
  demandas: "Demandas",
  calendario: "Calendário",
  categorias: "Categorias",
  produtividade: "Produtividade",
  lancamentos: "Lançamentos",
};

export const ORGANIZATION_ICON = Building2;
