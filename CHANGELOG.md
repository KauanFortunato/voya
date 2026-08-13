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

### Melhorado

- Fluxo de entrega separado entre imagem de validação `develop` e imagem estável `latest`.
- Estados de carregamento, vazio, erro e sucesso nos fluxos principais.
- Transições da navegação, onboarding, seletor de dias e skeleton da tela Hoje.
- Acessibilidade de movimento com suporte a `prefers-reduced-motion`.

### Corrigido

- Identificadores persistidos dos itens de checklist.
- Continuidade visual ao navegar entre dias e ao terminar o carregamento da tela Hoje.
