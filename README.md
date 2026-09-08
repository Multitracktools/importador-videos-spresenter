# Importador de Vídeos para Spresenter

Plugin gratuito e comunitário para analisar um link, baixar um vídeo autorizado e importá-lo diretamente para as categorias **Fundos** ou **Vídeos** do Spresenter. Também pesquisa vídeos gratuitos no Pixabay e os adiciona aos **Fundos**.

## Estrutura

- `plugin/`: plugin instalado dentro do Spresenter.
- `auxiliar/`: aplicativo local para Windows e macOS. Ele inicia junto com o sistema e permanece na bandeja ou barra de menus.
- `.github/workflows/gerar-versao.yml`: compila automaticamente o plugin e os instaladores.

## Instalação para o usuário

Baixe os arquivos na página **Releases** do GitHub:

1. Instale o **Auxiliar do Importador para Spresenter** correspondente ao sistema.
2. Abra o auxiliar uma vez. Nas próximas vezes ele iniciará automaticamente.
3. Instale o ZIP do plugin em **Spresenter > Configurações > Plugins > Instalar**.
4. Abra o painel **Importador de Vídeos**, cole o link e escolha entre Fundos e Vídeos.

### Pesquisa no Pixabay

1. Crie uma conta gratuita e obtenha sua chave em **pixabay.com/api/docs**.
2. Abra a aba **Pesquisar no Pixabay** e salve a chave na primeira utilização.
3. Pesquise um tema e clique em **Adicionar aos Fundos** no vídeo desejado.

A chave fica somente na pasta de dados local do auxiliar. As pesquisas usam conteúdo seguro, resolução mínima HD e cache local de 24 horas.

O macOS poderá mostrar um aviso de desenvolvedor não identificado enquanto o aplicativo não estiver assinado e notarizado. Nesse caso, use **Ajustes do Sistema > Privacidade e Segurança > Abrir Mesmo Assim**.

## Gerar uma versão para teste

Abra **Actions > Gerar versão > Run workflow**. Ao terminar, os arquivos estarão na seção **Artifacts** da execução.

## Publicar uma versão

Crie uma tag no formato `v0.2.6`. A automação compilará tudo e criará uma publicação em **Releases** contendo:

- ZIP do plugin;
- instalador EXE do Windows;
- DMG do macOS Intel;
- DMG do macOS Apple Silicon.

## Andamento da importação

- **Download:** porcentagem, velocidade e tempo restante informados pelo `yt-dlp`.
- **Processamento no Spresenter:** andamento estimado enquanto o aplicativo gera o pacote interno `.scp`. A importação só é confirmada quando esse pacote aparece na biblioteca.

## Privacidade

O processamento ocorre na própria máquina. O projeto não mantém servidor para receber os vídeos baixados.

## Uso responsável

Use somente vídeos próprios, em domínio público ou para os quais você tenha autorização de download e utilização. O usuário é responsável por respeitar direitos autorais e os termos da plataforma de origem.

## Licença

Distribuído gratuitamente sob a licença MIT.
