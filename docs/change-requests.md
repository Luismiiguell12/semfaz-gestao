# Solicitações de alteração

> Complementam o prompt principal do projeto e prevalecem sobre ele **somente**
> nos pontos descritos. Sessões futuras devem considerá-las junto com o prompt
> principal. As demais regras (segurança, RLS, auditoria, aprovações, testes,
> documentação, hospedagem estática com Supabase) continuam valendo.

## Alteração 01 — Fluxo integrado de cadastro, reorganização dos menus e Relatórios de despesas

Recebida em 25/11/2026, durante a validação conjunta das Fases 2 e 3. Situação: **aplicada, aguardando validação**.

### Resumo do pedido

1. **Fluxo real da SEMFAZ:** recebe o contrato → cadastra o locador → cadastra o imóvel → cadastra as
   unidades consumidoras (Energisa e Iguá). Os cadastros devem ser integrados, sem redigitação.
2. **Cadastro guiado a partir do contrato** (menu Gestão), em 5 etapas: dados do contrato; locador(es)
   (pesquisar por nome/CPF/CNPJ ou cadastrar ali mesmo, sem duplicar CPF/CNPJ, com percentuais);
   imóvel (existente ou novo, com aviso de duplicidade por CEP e endereço, vínculo automático dos
   locadores); unidades consumidoras (opcional: novas, vínculo ou transferência com histórico; data
   sugerida = início da vigência; endereço do imóvel sugerido para a Iguá); revisão e envio com
   justificativa.
   - Rascunho no banco (tabela própria, só o autor vê, RLS), nunca em `localStorage`.
   - Locador novo é gravado na hora (não exige aprovação).
   - Imóvel (se novo), contrato, vínculos de locadores e de unidades formam **uma única solicitação de
     aprovação**, efetivada de forma transacional (tudo ou nada); rejeitada, nada do pacote é criado
     (o locador permanece).
   - Os cadastros individuais continuam existindo.
3. **Integração entre cadastros:** chaves estrangeiras em vez de cópia; contrato mostra endereço e
   secretaria do imóvel e sugere o valor global (mensal × meses); ficha única do imóvel (locadores,
   contratos atual e anteriores, aditivos, unidades atuais e histórico, documentos, histórico); ficha
   do locador (imóveis e contratos); unidade mostra imóvel atual, secretaria e histórico; faturas
   preenchem imóvel (vínculo na competência), fornecedor, secretaria e unidade de medida; aluguéis
   herdam imóvel, locador(es) e secretaria do contrato; nomes relacionados são links; registros sem
   acesso aparecem como "acesso restrito".
4. **Menus:** Painel · Gestão (Novo cadastro a partir de contrato, Contratos, Locadores, Imóveis,
   Unidades consumidoras) · Financeiro (Faturas, Aluguéis, Pagamentos, Relatórios de despesas) ·
   Demandas · Calendário · Aprovações · Relatórios · Administração. Itens ainda não implementados
   aparecem desabilitados com "Em breve". Unidades consumidoras passam a ser cadastro da Gestão, com
   permissões próprias (`consumer_units.view`, `consumer_units.manage`), sem ampliar nem reduzir acessos.
5. **Relatórios de despesas** (Financeiro): filtros (período, base competência/pagamento, tipo,
   secretaria, imóvel, fornecedor/locador, situação); cartões (total, pago, pendente, vencido);
   tabelas por tipo, imóvel, secretaria, fornecedor/locador, mensal, comparativo com o ano anterior e
   consumo; gráficos de evolução mensal, por imóvel, por secretaria, pago × pendente × vencido e
   consumo; números do banco respeitando a RLS; canceladas fora, estornos abatidos; clique abre os
   lançamentos; exportação Excel/PDF pelo mecanismo auditado (pendência da fase de Relatórios se ainda
   não existir); acesso por `finance.reports.view` (+ `reports.export` para exportar); as mesmas views
   alimentam o Painel. Substitui os "Relatórios financeiros" do Módulo 4 do prompt principal.

### Classificação

| Item                                                                  | Classe           | Situação                                                        |
| --------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| Cadastro guiado (rascunho, pacote único, efetivação transacional)     | A                | aplicado                                                        |
| Integração entre cadastros (fichas, links, sugestões, preenchimentos) | A                | aplicado                                                        |
| Reorganização do menu e permissões `consumer_units.*`                 | A                | aplicado                                                        |
| Tela Pagamentos (Financeiro)                                          | A                | aplicado                                                        |
| Relatórios de despesas (tela, views/funções, Painel)                  | A                | aplicado                                                        |
| Exportação Excel/PDF dos Relatórios de despesas                       | B                | incorporado à Fase 6 (mecanismo de exportação ainda não existe) |
| Demandas, Calendário e Relatórios gerais no novo menu                 | B                | entradas "Em breve"; Fases 4 e 6                                |
| Unidades consumidoras no escopo da fase de Imóveis e Contratos        | B (planejamento) | registrado no `PROJECT_STATUS.md`                               |

### Decisões de implementação

- O arquivo digital do contrato é anexado **na solicitação** logo após o envio (o rascunho não é um
  registro de negócio e não recebe anexos). O administrador vê o arquivo ao analisar o pacote.
- Os locadores do imóvel passam a ser os do novo contrato na efetivação; vínculos anteriores são
  encerrados por exclusão lógica, com o motivo registrado.
- Unidade vinculada a imóvel fora do escopo do usuário não pode ser transferida por ele (apenas a
  indicação de acesso restrito é mostrada); um administrador faz a transferência.
- Duplicidade de imóvel: mesmo CEP e mesmo número. Imóveis fora do escopo aparecem só na contagem.
- Relatórios: aluguéis com mais de um locador são distribuídos pelo percentual de participação; a
  base "por data de pagamento" soma os pagamentos aprovados no período (estornos abatidos).
- Além das entradas pedidas, o menu mantém **Notificações** (Geral) e **Produtividade** ("Em breve"),
  que fazem parte do prompt principal; Demandas, Calendário, Aprovações, Produtividade e Relatórios
  ficam agrupados em "Acompanhamento".
- As rotas existentes foram mantidas (`/imoveis/`, `/locadores/`, `/contratos/`, `/unidades/`); a
  mudança é de organização do menu e dos módulos, não de endereços.
