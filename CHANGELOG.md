# Changelog

Este arquivo registra as mudanças relevantes do Voya durante o desenvolvimento.

## Em desenvolvimento

### Adicionado

- Estrutura mobile-first em React com rotas lazy, autenticação local e feedback assíncrono.
- Backend Fastify, PostgreSQL exclusivo, migrations e dados iniciais da família.
- Visão geral da viagem, calendário, roteiro, lugares, viajantes e orçamento.
- Checklists compartilhados e individuais persistidos no PostgreSQL.
- Documentos associados a viajantes e atividades, com upload, visualização e armazenamento na NAS.
- Disponibilidade offline e compartilhamento nativo de documentos, com fallback de download.
- Tela Hoje conectada aos dados da viagem, com atividade em destaque, linha do tempo e conclusão de atividades.
- Checklist contextual na tela Hoje, com pendências priorizadas, conclusão direta e acesso à lista completa.
- Criação e edição persistente de atividades do roteiro, com marcação de atividades importantes.
- Preferências pessoais de lembrete, com ativação por perfil e antecedência padrão de 15 min, 30 min, 1 hora ou 1 dia.
- Configuração de lembrete por atividade importante, com antecedência própria e seleção de destinatários da viagem.
- Jobs persistentes de lembrete com agendamento idempotente, cancelamento e reagendamento automático.
- Central de configurações com estado dos lembretes, próximo aviso, preferências pessoais e situação do dispositivo.

### Melhorado

- Fluxo de entrega separado entre imagem de validação `develop` e imagem estável `latest`.
- Inicialização do container aplica migrations pendentes antes de subir a API.
- Navegação entre Configurações e o perfil de viajantes preserva o destino correto do botão voltar.
- Estados de carregamento, vazio, erro e sucesso nos fluxos principais.
- Transições da navegação, onboarding, seletor de dias e skeleton da tela Hoje.
- Acessibilidade de movimento com suporte a `prefers-reduced-motion`.

### Corrigido

- Navegação de retorno dos detalhes e do visualizador de documentos, que agora fecha o popup antes de sair da página Documentos.
- Retorno contextual da checklist: acessos pela tela Hoje voltam para Hoje, enquanto acessos pelo menu Mais voltam para Mais.
- Controle offline de documentos resiliente ao carregamento de estilos antigos, sem expor mensagens internas na interface.
- Conflito de estilos do onboarding que sobrepunha os cartões da linha do tempo na primeira entrada da tela Hoje.
- Calendário incompleto em produção; as visões de dia, semana e mês agora usam todos os dias persistidos na API.
- Identificadores persistidos dos itens de checklist.
- Continuidade visual ao navegar entre dias e ao terminar o carregamento da tela Hoje.

### Alterado

- A associação de um documento ao roteiro passou a ficar recolhida em uma ação secundária, reduzindo a poluição visual dos detalhes.
- A disponibilidade offline dos documentos passou a usar um controle compacto de nuvem no topo dos detalhes, verde quando existe uma cópia local.
- A logo foi removida do cabeçalho da tela Hoje, incluindo o espaço correspondente no skeleton.
