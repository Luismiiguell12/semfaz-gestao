# Tratamento de dados pessoais (LGPD)

> Documento para validação pelo encarregado de dados (DPO) da Prefeitura.
> Nenhum dado oficial real deve ser carregado antes da validação institucional
> de segurança, LGPD, infraestrutura e governança.

## Dados pessoais tratados (até a Fase 1)

| Dado                              | Titular          | Finalidade                                        | Base legal sugerida (a validar)                                                              | Quem acessa                                                          |
| --------------------------------- | ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Nome completo                     | servidor usuário | identificação no sistema e na trilha de auditoria | execução de políticas públicas / cumprimento de obrigação legal (art. 7º, II e III; art. 23) | o próprio; colegas da organização (diretório mínimo); `users.manage` |
| E-mail institucional              | servidor usuário | login e envio de convite/recuperação de senha     | idem                                                                                         | o próprio; `users.manage`                                            |
| Nome de usuário                   | servidor usuário | identificação de exibição                         | idem                                                                                         | o próprio; colegas (diretório); `users.manage`                       |
| Matrícula funcional (opcional)    | servidor usuário | identificação funcional                           | idem                                                                                         | o próprio; `users.manage`                                            |
| Cargo e lotação                   | servidor usuário | organização do trabalho e escopo de acesso        | idem                                                                                         | o próprio; colegas (diretório); `users.manage`                       |
| Endereço IP e agente do navegador | servidor usuário | segurança e auditoria de acessos                  | legítimo interesse / segurança da informação                                                 | `audit.view`                                                         |
| Registros de ações (auditoria)    | servidor usuário | rastreabilidade de decisões administrativas       | cumprimento de obrigação legal                                                               | `audit.view`                                                         |
| Segredo TOTP (MFA)                | servidor usuário | autenticação em duas etapas                       | segurança                                                                                    | somente o Supabase Auth (não acessível pela aplicação)               |

Previstos nas próximas fases (serão detalhados quando implementados):

- **Locadores** (Fase 2): nome/razão social, CPF/CNPJ, telefone, e-mail e endereço.
  CPF e telefone **mascarados por padrão**; completos só com `landlords.view_sensitive`.
  **Dados bancários de locadores não são armazenados** (decisão da SEMFAZ).
- **Produtividade** (Fase 5): métricas individuais — cada usuário vê as próprias; equipe só com `productivity.view_team`. Os relatórios exibirão o aviso de que não constituem avaliação automática e definitiva.

## Medidas aplicadas

- **Minimização**: apenas os campos necessários; matrícula opcional; o diretório de colegas (`user_directory`) não expõe e-mail nem matrícula.
- **Controle de acesso** por permissão e escopo, garantido por RLS no banco.
- **MFA** obrigatório para administradores.
- **Auditoria** imutável de alterações e acessos.
- **Logs sem dados pessoais**: as Edge Functions não registram conteúdo de requisições; mensagens de erro ao usuário não incluem dados pessoais; erros inesperados retornam mensagem genérica.
- **Armazenamento de arquivos privado** com URLs temporárias.
- **Região dos dados**: projeto Supabase em São Paulo (sa-east-1).
- **Repositório público**: nenhum dado real, segredo ou credencial no código ou no histórico; dados de teste são fictícios (domínio `teste.invalid`).

## Retenção

Por decisão da SEMFAZ, **dados e documentos são guardados permanentemente**:
não há expurgo, exclusão física nem rotinas de retenção. Exclusões são lógicas.

**Ponto para validação do DPO:** compatibilizar a guarda permanente com o
princípio da necessidade e com a tabela de temporalidade documental do
município; definir o procedimento para pedidos de titulares (acesso,
correção) — a anonimização não está implementada, pois contraria a regra de
guarda permanente.

## Pendências de validação institucional

1. Bases legais de cada tratamento.
2. Política de retenção x guarda permanente.
3. Aviso de privacidade para os usuários do sistema.
4. Contrato/termos com o Supabase como operador (região São Paulo, plano Pro).
5. Procedimento de resposta a incidentes.
