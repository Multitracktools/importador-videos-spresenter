import type {} from '@spresenter/plugin-sdk/code';

type Destination = 'video' | 'backgroundVideo';
type UiMessage = { type?: string; destination?: Destination; jobId?: string; title?: string; contentBase64?: string; asset?: { guid: string; title?: string; type?: string; extension?: string } };

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function safeFilename(title: string) {
  const clean = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${clean || 'video-do-youtube'}.mp4`;
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMessage;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'native-video-complete' && msg.jobId && msg.asset) {
    spresenter.ui.postMessage({ type: 'conversion-progress', percent: 100, message: 'Pacote de vídeo criado.' });
    spresenter.ui.postMessage({ type: 'import-complete', asset: msg.asset, jobId: msg.jobId, nativePackage: true });
    return;
  }
  if (msg.type === 'import-background' && msg.jobId && msg.title && msg.contentBase64) {
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    try {
      spresenter.ui.postMessage({ type: 'conversion-progress', percent: 4, message: 'Enviando o vídeo ao Spresenter…' });
      const isBackground = true;
      let conversionPercent = 8;
      progressTimer = setInterval(() => {
        conversionPercent = Math.min(70, conversionPercent + 2);
        spresenter.ui.postMessage({ type: 'conversion-progress', percent: conversionPercent, message: isBackground ? 'Adicionando aos Fundos…' : 'Convertendo para o formato do Spresenter…' });
      }, 1000);
      const asset = await spresenter.assets.createFile({
        filename: safeFilename(msg.title), title: msg.title,
        type: 'backgroundVideo',
        contentBase64: msg.contentBase64,
        // Fundos reproduzem o MP4 diretamente. A categoria Vídeos precisa gerar
        // o pacote interno .scp, incluindo duração, áudio e controles.
        optimize: false,
        allowEncode: false,
      });
      clearInterval(progressTimer);
      progressTimer = undefined;

      spresenter.ui.postMessage({ type: 'conversion-progress', percent: 100, message: 'Fundo adicionado.' });
      spresenter.ui.postMessage({ type: 'import-complete', asset, jobId: msg.jobId });
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      spresenter.ui.postMessage({ type: 'import-error', error: error instanceof Error ? error.message : String(error), jobId: msg.jobId });
    }
  }
};

console.log('Plugin carregado:', spresenter.manifest.name);
