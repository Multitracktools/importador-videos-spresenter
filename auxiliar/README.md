# Auxiliar do Importador para Spresenter

Aplicativo gratuito que executa em segundo plano e atende ao plugin Importador de Vídeos. Após a instalação, inicia automaticamente com Windows ou macOS e elimina a necessidade de abrir um CMD.

## Compilar no GitHub

1. Envie o conteúdo desta pasta para um repositório GitHub.
2. Abra **Actions > Gerar instaladores > Run workflow**.
3. Ao terminar, baixe os artefatos `instaladores-Windows` e `instaladores-macOS`.

O instalador do macOS é experimental e não assinado. Na primeira abertura, pode ser necessário usar **Ajustes do Sistema > Privacidade e Segurança > Abrir Mesmo Assim**.

## Funcionamento

- Porta local: `127.0.0.1:17843`.
- Baixa o executável oficial do yt-dlp na primeira inicialização.
- Localiza o FFmpeg incluído no Spresenter.
- Guarda downloads temporários na pasta de dados do aplicativo e os apaga após a importação.
- Não envia vídeos a servidores externos do projeto.

Use apenas conteúdos que você tenha autorização para baixar.
