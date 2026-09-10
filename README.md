# Importador de Vídeos — Zosma Labs

**Pesquise, baixe e importe vídeos para o SPresenter sem sair do fluxo de trabalho.**

Plugin gratuito da [Zosma Labs](https://zosma.com.br) para analisar links autorizados, baixar vídeos e importá-los para as categorias **Fundos** ou **Vídeos** do SPresenter. Também permite pesquisar vídeos gratuitos no Pixabay e no Pexels e adicioná-los diretamente aos Fundos.

> **Versão atual: 0.3.3**

[Baixar a versão mais recente](https://github.com/zosmalabs/importador-videos-spresenter/releases/latest) · [Tutorial](https://youtu.be/kxIf_o-fvas) · [Site da Zosma](https://zosma.com.br)

## Principais recursos

- Importação por link do YouTube;
- pesquisa integrada no Pixabay e no Pexels;
- importação direta para **Fundos** ou **Vídeos**;
- seleção de qualidade em HD, Full HD, 4K ou melhor disponível;
- progresso de download e processamento;
- auxiliar local para Windows e macOS;
- chaves de API armazenadas somente no computador do usuário;
- processamento local, sem servidor da Zosma para receber os vídeos baixados.

## Compatibilidade

- SPresenter 0.3.45 ou mais recente;
- Windows;
- macOS Intel;
- macOS Apple Silicon.

## Como funciona

O projeto é composto por duas partes:

- `plugin/`: plugin instalado dentro do SPresenter;
- `auxiliar/`: aplicativo local que realiza download e processamento e se comunica com o plugin pela própria máquina.

O auxiliar inicia junto com o sistema e permanece disponível na bandeja do Windows ou barra de menus do macOS.

## Instalação

Acesse a página de [Releases](https://github.com/zosmalabs/importador-videos-spresenter/releases/latest) e baixe os arquivos correspondentes ao seu sistema.

### Windows

1. Instale **Auxiliar-Importador-Spresenter-Windows**.
2. Instale o ZIP do plugin no SPresenter em **Configurações → Plugins → Instalar**.
3. Abra o painel **Importador de Vídeos** e confirme que aparece **Auxiliar conectado**.

### macOS

1. Baixe o DMG correspondente ao seu processador: Apple Silicon ou Intel.
2. Instale e abra o auxiliar.
3. Instale o ZIP do plugin no SPresenter.

Como o auxiliar ainda não possui assinatura e notarização da Apple, o macOS pode exibir um aviso de desenvolvedor não identificado. Nesse caso, use **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**.

## Pixabay e Pexels

As pesquisas utilizam chaves pessoais das APIs dessas plataformas. Elas são salvas apenas na pasta local do auxiliar e não são incluídas no plugin nem publicadas no GitHub.

Os resultados priorizam vídeos horizontais adequados para projeção e permitem selecionar a resolução desejada antes da importação.

## Desenvolvimento e publicação

O workflow `.github/workflows/gerar-versao.yml` compila automaticamente o plugin e os instaladores.

Para gerar uma versão de teste, use **Actions → Gerar versão → Run workflow**. Os arquivos ficarão disponíveis como artifacts da execução.

Ao publicar uma tag no formato `v0.3.3`, a automação gera a release com:

- ZIP do plugin;
- instalador EXE do Windows;
- DMG do macOS Intel;
- DMG do macOS Apple Silicon.

## Uso responsável

Use somente vídeos próprios, em domínio público ou para os quais você tenha autorização de download e utilização. O usuário é responsável por respeitar direitos autorais e os termos das plataformas de origem.

## Zosma Labs

**Ideias transformadas em software.**

[zosma.com.br](https://zosma.com.br)

## Licença

Distribuído gratuitamente sob a licença MIT.
