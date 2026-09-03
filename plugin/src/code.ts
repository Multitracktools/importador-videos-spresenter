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
      const asset = await spresenter.assets.createFile({
        filename: safeFilename(msg.title), title: msg.title,
        type: msg.destination === 'backgroundVideo' ? 'backgroundVideo' : 'video',
        contentBase64: msg.contentBase64,
        // O auxiliar já entrega MP4 H.264/AAC. Evita a fila interna de
        // normalização do Spresenter, que pode não iniciar no macOS.
        optimize: false, allowEncode: false,
      });
      spresenter.ui.postMessage({ type: 'import-complete', asset, jobId: msg.jobId });
    } catch (error) { spresenter.ui.postMessage({ type: 'import-error', error: error instanceof Error ? error.message : String(error) }); }
  }
};

console.log('Plugin carregado:', spresenter.manifest.name);
