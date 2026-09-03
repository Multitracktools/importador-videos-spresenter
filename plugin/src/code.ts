import type {} from '@spresenter/plugin-sdk/code';

type Destination = 'video' | 'backgroundVideo';
type UiMessage = { type?: string; destination?: Destination; jobId?: string; title?: string; contentBase64?: string };

function safeFilename(title: string) {
  const clean = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${clean || 'video-do-youtube'}.mp4`;
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMessage;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'import' && msg.jobId && msg.title && msg.contentBase64) {
    try {
      spresenter.ui.postMessage({ type: 'import-progress', message: 'Importando para a biblioteca do Spresenter…' });
      const isBackground = msg.destination === 'backgroundVideo';
      const asset = await spresenter.assets.createFile({
        filename: safeFilename(msg.title), title: msg.title,
        type: isBackground ? 'backgroundVideo' : 'video',
        contentBase64: msg.contentBase64,
        // Fundos reproduzem o MP4 diretamente. A categoria Vídeos precisa da
        // normalização leve para gerar duração, áudio e controles internos.
        // Como o auxiliar já entrega H.264/AAC, recusamos recodificação pesada.
        optimize: !isBackground,
        allowEncode: false,
      });
      spresenter.ui.postMessage({ type: 'import-complete', asset, jobId: msg.jobId });
    } catch (error) { spresenter.ui.postMessage({ type: 'import-error', error: error instanceof Error ? error.message : String(error) }); }
  }
};

console.log('Plugin carregado:', spresenter.manifest.name);
