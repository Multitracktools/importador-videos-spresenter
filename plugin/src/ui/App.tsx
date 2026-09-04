import { useEffect, useMemo, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import { Root, Header, Panel, Row, Stack, Field, TextInput, Select, Button, StatusIndicator } from '@spresenter/plugin-sdk/ui-kit/react';

type VideoInfo = { title: string; uploader?: string; thumbnail?: string; duration?: number };
type Job = { id: string; status: 'downloading' | 'ready' | 'error'; percent?: number; speed?: string; eta?: string; error?: string };
type Asset = { guid: string; title?: string; type?: string };
const HELPER = 'http://127.0.0.1:17843';

async function helperRequest(path: string, method = 'GET', payload?: unknown) {
  const response = await fetch(`${HELPER}${path}`, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

function formatDuration(value?: number) {
  if (!value || value < 1) return '';
  const total = Math.round(value), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function App() {
  const [url, setUrl] = useState('');
  const [helperOnline, setHelperOnline] = useState<boolean | null>(null);
  const [helperVersion, setHelperVersion] = useState('');
  const [ffmpegFound, setFfmpegFound] = useState(false);
  const [helperError, setHelperError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [destination, setDestination] = useState<'backgroundVideo' | 'video'>('backgroundVideo');
  const [quality, setQuality] = useState<'compatible' | 'light'>('compatible');
  const [job, setJob] = useState<Job | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imported, setImported] = useState<Asset | null>(null);
  const [conversionPercent, setConversionPercent] = useState<number | null>(null);

  useEffect(() => {
    helperRequest('/health').then((data) => {
      setHelperOnline(true); setHelperVersion(data.ytDlpVersion || ''); setFfmpegFound(!!data.ffmpegFound); setHelperError('');
    }).catch((directError) => {
      setHelperOnline(false); setHelperError(directError.message || 'Auxiliar não encontrado.');
    });
    return onMessage((raw) => {
      const msg = raw as any;
      if (msg.type === 'helper-status') {
        setHelperOnline(!!msg.online); setHelperVersion(msg.version || ''); setFfmpegFound(!!msg.ffmpegFound);
        setHelperError(msg.online ? '' : [helperError, msg.error && `Plugin: ${msg.error}`].filter(Boolean).join(' | '));
      }
      if (msg.type === 'analyze-result') {
        setAnalyzing(false);
        if (msg.ok) { setInfo(msg.info); setError(''); setMessage(''); }
        else { setInfo(null); setError(msg.error || 'Não foi possível analisar o link.'); }
      }
      if (msg.type === 'download-started') { setJob({ id: msg.jobId, status: 'downloading', percent: 0 }); setMessage('Download iniciado…'); }
      if (msg.type === 'download-error') setError(msg.error || 'Não foi possível iniciar o download.');
      if (msg.type === 'job-status') {
        setJob(msg.job);
        if (msg.job?.status === 'error') setError(msg.job.error || 'O download falhou.');
        if (msg.job?.status === 'ready') setMessage('Download concluído. Preparando a importação…');
      }
      if (msg.type === 'import-progress') setMessage(msg.message || 'Importando…');
      if (msg.type === 'conversion-progress') { setConversionPercent(Number(msg.percent || 0)); setMessage(msg.message || 'Processando no Spresenter…'); }
      if (msg.type === 'import-complete') {
        const completedId = msg.jobId;
        if (completedId) helperRequest(`/cleanup/${encodeURIComponent(completedId)}`, 'POST', {}).catch(() => {});
        setImported(msg.asset); setJob(null); setConversionPercent(100); setMessage('Vídeo importado com sucesso.'); setError('');
      }
      if (msg.type === 'import-error') {
        if (msg.jobId) helperRequest(`/cleanup/${encodeURIComponent(msg.jobId)}`, 'POST', {}).catch(() => {});
        setError(msg.error || 'Falha ao importar no Spresenter.'); setJob(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!job || job.status !== 'downloading') return;
    const timer = window.setInterval(() => {
      helperRequest(`/jobs/${encodeURIComponent(job.id)}`).then((next) => {
        setJob(next);
        if (next.status === 'error') setError(next.error || 'O download falhou.');
        if (next.status === 'ready') setMessage('Download concluído. Preparando a importação…');
      }).catch((e) => setError(e.message));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (job?.status !== 'ready' || !info) return;
    setMessage('Entregando o MP4 ao importador nativo do Spresenter…');
    postMessage({ type: 'import', jobId: job.id, title: info.title, destination, sourceUrl: `${HELPER}/file/${encodeURIComponent(job.id)}` });
  }, [job?.status]);

  const validUrl = useMemo(() => /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url.trim()), [url]);
  const checkHelper = async () => {
    setHelperOnline(null); setHelperError('');
    try { const data = await helperRequest('/health'); setHelperOnline(true); setHelperVersion(data.ytDlpVersion || ''); setFfmpegFound(!!data.ffmpegFound); }
    catch (e) { setHelperOnline(false); setHelperError(e instanceof Error ? e.message : String(e)); }
  };
  const analyze = async () => {
    setAnalyzing(true); setError(''); setInfo(null); setImported(null); setJob(null); setConversionPercent(null); setMessage('Analisando…');
    try { setInfo(await helperRequest('/analyze', 'POST', { url: url.trim() })); setHelperOnline(true); setMessage(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setAnalyzing(false); }
  };
  const download = async () => {
    if (!info) return; setError(''); setImported(null); setConversionPercent(null); setMessage('Iniciando o download… mantenha o auxiliar aberto.');
    try { const next = await helperRequest('/download', 'POST', { url: url.trim(), quality }); setJob({ id: next.jobId, status: next.status || 'downloading', percent: next.percent || 0 }); setMessage('Baixando o vídeo…'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return <Root>
    <Header title="Importador de Vídeos" subtitle="Baixe um vídeo pelo link e adicione-o à biblioteca do Spresenter." />
    <Panel label="Auxiliar local">
      <Row style={{ alignItems: 'center' }}>
        <div style={{ flex: 1 }}><StatusIndicator state={helperOnline && ffmpegFound ? 'ok' : helperOnline === false ? 'error' : 'warn'} label={helperOnline ? 'Auxiliar conectado' : helperOnline === false ? 'Auxiliar desconectado' : 'Verificando…'} detail={helperOnline && helperVersion ? `yt-dlp ${helperVersion} · ${ffmpegFound ? 'FFmpeg pronto' : 'FFmpeg não localizado'}` : undefined} /></div>
        <Button size="sm" onClick={checkHelper}>Verificar</Button>
      </Row>
      {helperOnline === false && <p className="hint">Instale e abra o <strong>Auxiliar do Importador para Spresenter</strong>. Ele iniciará automaticamente nas próximas vezes.</p>}
      {helperError && <p className="error-detail">{helperError}</p>}
    </Panel>
    <Panel label="Link do YouTube"><Stack>
      <Field label="URL do vídeo" hint={!url || validUrl ? '' : 'Informe um endereço do YouTube ou youtu.be.'}><TextInput value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && validUrl && helperOnline && analyze()} placeholder="https://www.youtube.com/watch?v=…" /></Field>
      <Button variant="primary" disabled={!validUrl || analyzing || !!job} onClick={analyze}>{analyzing ? 'Analisando…' : 'Analisar vídeo'}</Button>
    </Stack></Panel>
    {info && <Panel label="Vídeo encontrado">
      <div className="video-card">{info.thumbnail && <img src={info.thumbnail} alt="Miniatura" />}<div className="video-meta"><strong>{info.title}</strong><span>{[info.uploader, formatDuration(info.duration)].filter(Boolean).join(' · ')}</span></div></div>
      <Row style={{ marginTop: 12 }}>
        <Field label="Importar para"><Select value={destination} onChange={(e) => setDestination(e.target.value as any)} disabled={!!job}><option value="backgroundVideo">Fundos</option><option value="video">Vídeos</option></Select></Field>
        <Field label="Qualidade"><Select value={quality} onChange={(e) => setQuality(e.target.value as any)} disabled={!!job}><option value="compatible">Melhor compatível (até 720p)</option><option value="light">Leve (até 360p)</option></Select></Field>
      </Row>
      <Button variant="success" disabled={!!job} onClick={download}>Baixar e importar</Button>
    </Panel>}
    {(job || message || error || imported) && <Panel label="Andamento">
      {job?.status === 'downloading' && <><p className="phase-label">1 de 2 · Download</p><div className="progress"><div style={{ width: `${Math.max(2, Math.min(100, job.percent || 0))}%` }} /></div><Row className="progress-label"><strong>{Math.round(job.percent || 0)}%</strong><span>{[job.speed, job.eta && `Restante: ${job.eta}`].filter(Boolean).join(' · ')}</span></Row></>}
      {conversionPercent !== null && !imported && <><p className="phase-label">2 de 2 · Processamento no Spresenter</p><div className="progress conversion"><div style={{ width: `${Math.max(2, Math.min(100, conversionPercent))}%` }} /></div><Row className="progress-label"><strong>{Math.round(conversionPercent)}%</strong><span>{destination === 'video' ? 'Gerando o pacote .scp' : 'Adicionando aos Fundos'}</span></Row></>}
      {error ? <StatusIndicator state="error" label="Não foi possível concluir" detail={error} /> : <StatusIndicator state={imported ? 'ok' : 'warn'} label={imported ? 'Importação concluída' : message || 'Processando…'} detail={imported?.title} />}
    </Panel>}
  </Root>;
}
