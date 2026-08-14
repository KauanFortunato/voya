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
- Controle de permissão de notificações por dispositivo, solicitado apenas após ativação explícita e com estados permitido, bloqueado ou indisponível.
- Mapa interativo dos lugares guardados, com marcadores filtráveis, seleção de local e abertura de rotas no Google Maps.
- API de lugares ligada ao PostgreSQL, com coordenadas persistidas e atualização compartilhada do estado planeado.
- Preview sob demanda entre atividades consecutivas no Roteiro e na timeline Hoje, com modos a pé, transporte público e carro, distância, duração e horário sugerido de saída calculados pela Google Routes API sem expor a chave no cliente.

### Melhorado

- Animações de todos os dialogs e bottom sheets unificadas, com entrada e saída vertical consistentes e suporte a movimento reduzido.
- Expansão e recolhimento dos eventos do roteiro tornados simétricos, rápidos e sem flicker.
- Arraste das atividades do roteiro ajustado para responder pelo cartão completo e retornar de forma mais estável.
- Documentos ligados no editor de atividades passam a iniciar recolhidos para reduzir a poluição visual.
- Roteiro redesenhado como timeline diária, com cartões expansíveis, horários, duração, local, documentos e ações contextuais usando os dados reais da viagem.
- Reordenação do roteiro concentrada num modo explícito, deixando a leitura diária mais limpa e evitando arrastes acidentais.
- Fluxo de entrega separado entre imagem de validação `develop` e imagem estável `latest`.
- Inicialização do container aplica migrations pendentes antes de subir a API.
- Navegação entre Configurações e o perfil de viajantes preserva o destino correto do botão voltar.
- Estados de carregamento, vazio, erro e sucesso nos fluxos principais.
- Transições da navegação, onboarding, seletor de dias e skeleton da tela Hoje.
- Acessibilidade de movimento com suporte a `prefers-reduced-motion`.
- Carregamento lazy do motor de mapas e feedback próprio para mosaicos, erros de rede e lugares sem coordenadas.

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
