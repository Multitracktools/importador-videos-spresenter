# Importador de Vídeos — protótipo 0.2.2

Protótipo experimental para baixar um vídeo por link do YouTube e importá-lo nas categorias **Fundos** ou **Vídeos** do Spresenter.

## Instalação

O kit possui duas partes:

1. Instale `Importador-de-Videos-Spresenter-0.2.2.zip` em **Configurações → Plugins → Instalar**.
2. Instale e abra uma vez o **Auxiliar do Importador para Spresenter** correspondente ao seu sistema.
3. Nas próximas inicializações, o auxiliar abrirá automaticamente em segundo plano.
4. Na primeira execução, o auxiliar baixa o `yt-dlp` oficial.

## Utilização

1. Abra o painel **Importador de Vídeos** no Spresenter.
2. Confira se aparece **Auxiliar conectado**.
3. Cole o link do YouTube e clique em **Analisar vídeo**.
4. Escolha **Fundos** ou **Vídeos** e a qualidade.
5. Clique em **Baixar e importar**.

A versão 0.2.2 utiliza um aplicativo auxiliar em segundo plano no Windows ou macOS. Ele usa o FFmpeg incluído no Spresenter, baixa vídeo e áudio separadamente, gera um MP4 e o transfere pelo método Base64 exigido pelo SDK. Como o arquivo já chega em H.264/AAC, o plugin pula a normalização interna para evitar vídeos presos na fila do macOS.

## Observações

- Requer Windows e Spresenter 0.3.45 ou superior.
- O auxiliar trabalha apenas em `127.0.0.1:17843` e não fica acessível a outros computadores da rede.
- Os arquivos temporários são removidos depois que o Spresenter termina a importação.
- Este é um protótipo experimental e mudanças do YouTube podem exigir atualização do `yt-dlp`.
