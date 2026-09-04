import type {} from '@spresenter/plugin-sdk/code';

type Destination = 'video' | 'backgroundVideo';
type UiMessage = { type?: string; destination?: Destination; jobId?: string; title?: string; sourceUrl?: string };

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function safeFilename(title: string) {
  const clean = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${clean || 'video-do-youtube'}.mp4`;
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMessage;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'import' && msg.jobId && msg.title && msg.sourceUrl) {
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    try {
      spresenter.ui.postMessage({ type: 'conversion-progress', percent: 4, message: 'Enviando o vídeo ao Spresenter…' });
      const isBackground = msg.destination === 'backgroundVideo';
      let conversionPercent = 8;
      progressTimer = setInterval(() => {
        conversionPercent = Math.min(70, conversionPercent + 2);
        spresenter.ui.postMessage({ type: 'conversion-progress', percent: conversionPercent, message: isBackground ? 'Adicionando aos Fundos…' : 'Convertendo para o formato do Spresenter…' });
      }, 1000);
      const asset = await spresenter.assets.createFile({
        filename: safeFilename(msg.title), title: msg.title,
        type: isBackground ? 'backgroundVideo' : 'video',
        // O Spresenter busca o arquivo diretamente no auxiliar local. Isso
        // evita transportar o vídeo inteiro em Base64 pelo painel do plugin.
        sourceUrl: msg.sourceUrl,
        // Fundos reproduzem o MP4 diretamente. A categoria Vídeos precisa gerar
        // o pacote interno .scp, incluindo duração, áudio e controles.
        optimize: !isBackground,
        allowEncode: !isBackground,
      });
      clearInterval(progressTimer);
      progressTimer = undefined;

      if (isBackground) {
        spresenter.ui.postMessage({ type: 'conversion-progress', percent: 100, message: 'Fundo adicionado.' });
        spresenter.ui.postMessage({ type: 'import-complete', asset, jobId: msg.jobId });
        return;
      }

      // A conversão pesada pode continuar na fila mesmo depois de createFile
      // retornar. Só concluímos quando a biblioteca expuser o pacote .scp.
      const startedAt = Date.now();
      const timeoutMs = 10 * 60 * 1000;
      let processed = asset;
      while (Date.now() - startedAt < timeoutMs) {
        const latest = await spresenter.assets.get(asset.guid);
        if (latest) processed = latest;
        const extension = String((processed as { extension?: string }).extension || '').toLowerCase();
        if (extension === '.scp') {
          spresenter.ui.postMessage({ type: 'conversion-progress', percent: 100, message: 'Conversão concluída.' });
          spresenter.ui.postMessage({ type: 'import-complete', asset: processed, jobId: msg.jobId });
          return;
        }
        const elapsed = Date.now() - startedAt;
        const percent = Math.min(95, 72 + Math.floor(elapsed / 8000));
        spresenter.ui.postMessage({ type: 'conversion-progress', percent, message: 'Aguardando o Spresenter finalizar o pacote de vídeo…' });
        await wait(1500);
      }
      throw new Error('O Spresenter não concluiu a conversão para .scp em 10 minutos. O MP4 foi recebido, mas o pacote de vídeo não ficou pronto.');
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      spresenter.ui.postMessage({ type: 'import-error', error: error instanceof Error ? error.message : String(error), jobId: msg.jobId });
    }
  }
};

console.log('Plugin carregado:', spresenter.manifest.name);
