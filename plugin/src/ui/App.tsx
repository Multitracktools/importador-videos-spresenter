import { FormEvent, useEffect, useMemo, useState } from 'react';
import { postMessage, onMessage } from '@spresenter/plugin-sdk/ui';
import { Root, Header, Panel, Row, Stack, Field, TextInput, Select, Button, StatusIndicator } from '@spresenter/plugin-sdk/ui-kit/react';

type VideoInfo = { title: string; uploader?: string; thumbnail?: string; duration?: number };
type Job = { id: string; status: 'downloading' | 'ready' | 'error'; percent?: number; speed?: string; eta?: string; error?: string; importPercent?: number; importStatus?: string };
type Asset = { guid: string; title?: string; type?: string };
type PixabayVariant = { name: string; url: string; width: number; height: number; size: number; thumbnail: string };
type PixabayVideo = { id: number; pageURL: string; tags: string; duration: number; user: string; variants: PixabayVariant[] };
const HELPER = 'http://127.0.0.1:17843';

async function helperRequest(path: string, method = 'GET', payload?: unknown) {
  const response = await fetch(`${HELPER}${path}`, { method, headers: payload === undefined ? undefined : { 'Content-Type': 'text/plain;charset=UTF-8' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

function formatDuration(value?: number) {
  if (!value || value < 1) return '';
  const total = Math.round(value), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function formatSize(value?: number) { return value ? value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.round(value / 1024)} KB` : ''; }
function pixabayTitle(item: PixabayVideo) { return item.tags.split(',')[0]?.trim() || `Fundo Pixabay ${item.id}`; }

export function App() {
  const [mode, setMode] = useState<'youtube' | 'pixabay'>('youtube');
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
  const [pixabayConfigured, setPixabayConfigured] = useState<boolean | null>(null);
  const [pixabayKey, setPixabayKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [pixabayQuery, setPixabayQuery] = useState('');
  const [pixabaySearching, setPixabaySearching] = useState(false);
  const [pixabayItems, setPixabayItems] = useState<PixabayVideo[]>([]);
  const [pixabayPage, setPixabayPage] = useState(1);
  const [pixabayTotal, setPixabayTotal] = useState(0);
  const [pixabayHasSearched, setPixabayHasSearched] = useState(false);

  const applyHealth = (data: any) => {
    setHelperOnline(!!data.ok); setHelperVersion(data.ytDlpVersion || ''); setFfmpegFound(!!data.ffmpegFound);
    setHelperError(data.ok ? '' : data.error || 'O auxiliar ainda não terminou de iniciar.');
  };
  useEffect(() => {
    helperRequest('/health').then(applyHealth).catch((e) => { setHelperOnline(false); setHelperError(e.message || 'Auxiliar não encontrado.'); });
    helperRequest('/pixabay/settings').then((data) => setPixabayConfigured(!!data.configured)).catch(() => setPixabayConfigured(false));
    return onMessage((raw) => {
      const msg = raw as any;
      if (msg.type === 'conversion-progress') { setConversionPercent(Number(msg.percent || 0)); setMessage(msg.message || 'Processando no Spresenter…'); }
      if (msg.type === 'import-complete') {
        if (msg.jobId) helperRequest(`/cleanup/${encodeURIComponent(msg.jobId)}`, 'POST', {}).catch(() => {});
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
    const timer = window.setInterval(() => helperRequest(`/jobs/${encodeURIComponent(job.id)}`).then((next) => {
      setJob(next); if (next.status === 'error') setError(next.error || 'O download falhou.'); if (next.status === 'ready') setMessage('Download concluído. Preparando a importação…');
    }).catch((e) => setError(e.message)), 1000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);
  useEffect(() => {
    if (job?.status !== 'ready' || !info) return;
    let cancelled = false;
    const finish = async () => {
      try {
        setConversionPercent(8);
        if (destination === 'video') {
          setMessage('Criando o pacote nativo do Spresenter…'); setConversionPercent(5);
          const timer = window.setInterval(() => helperRequest(`/jobs/${encodeURIComponent(job.id)}`).then((current) => {
            if (!cancelled && current.importPercent !== undefined) { setConversionPercent(current.importPercent); setMessage(current.importStatus === 'registering' ? 'Registrando o vídeo na biblioteca…' : 'Enviando o vídeo ao Spresenter…'); }
          }).catch(() => {}), 500);
          try { const asset = await helperRequest('/package-video', 'POST', { jobId: job.id, title: info.title }); if (!cancelled) postMessage({ type: 'native-video-complete', jobId: job.id, asset }); }
          finally { window.clearInterval(timer); }
          return;
        }
        setMessage('Transferindo o fundo para o Spresenter…');
        const response = await fetch(`${HELPER}/base64/${encodeURIComponent(job.id)}`);
        if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao ler o MP4.`);
        const contentBase64 = await response.text();
        if (!cancelled) postMessage({ type: 'import-background', jobId: job.id, title: info.title, contentBase64 });
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setJob(null); } }
    };
    void finish(); return () => { cancelled = true; };
  }, [job?.status]);

  const validUrl = useMemo(() => /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url.trim()), [url]);
  const resetProgress = () => { setError(''); setImported(null); setJob(null); setConversionPercent(null); setMessage(''); };
  const checkHelper = async () => { setHelperOnline(null); setHelperError(''); try { applyHealth(await helperRequest('/health')); } catch (e) { setHelperOnline(false); setHelperError(e instanceof Error ? e.message : String(e)); } };
  const analyze = async () => {
    setAnalyzing(true); setInfo(null); resetProgress(); setMessage('Analisando…');
    try { setInfo(await helperRequest('/analyze', 'POST', { url: url.trim() })); setHelperOnline(true); setMessage(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setAnalyzing(false); }
  };
  const downloadYoutube = async () => {
    if (!info) return; resetProgress(); setMessage('Iniciando o download… mantenha o auxiliar aberto.');
    try { const next = await helperRequest('/download', 'POST', { url: url.trim(), quality }); setJob({ id: next.jobId, status: next.status || 'downloading', percent: next.percent || 0 }); setMessage('Baixando o vídeo…'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const savePixabayKey = async (event: FormEvent) => {
    event.preventDefault(); setSavingKey(true); setError('');
    try { await helperRequest('/pixabay/settings', 'POST', { apiKey: pixabayKey }); setPixabayConfigured(true); setPixabayKey(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSavingKey(false); }
  };
  const searchPixabay = async (page = 1) => {
    setPixabaySearching(true); setError(''); setImported(null); setMessage('');
    try { const data = await helperRequest(`/pixabay/search?q=${encodeURIComponent(pixabayQuery.trim())}&page=${page}`); setPixabayItems(data.items || []); setPixabayTotal(data.total || 0); setPixabayPage(page); setPixabayHasSearched(true); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setPixabaySearching(false); }
  };
  const changePixabayKey = async () => {
    try { await helperRequest('/pixabay/settings', 'DELETE'); setPixabayConfigured(false); setPixabayItems([]); setPixabayHasSearched(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const importPixabay = async (item: PixabayVideo) => {
    const variant = item.variants.find((value) => value.name === 'small') || item.variants[0]; if (!variant) return;
    resetProgress(); setDestination('backgroundVideo'); setInfo({ title: pixabayTitle(item), uploader: item.user, thumbnail: variant.thumbnail, duration: item.duration }); setMessage('Baixando o fundo do Pixabay…');
    try { const next = await helperRequest('/pixabay/download', 'POST', { url: variant.url }); setJob({ id: next.jobId, status: next.status || 'downloading', percent: next.percent || 0 }); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const busy = !!job || analyzing || pixabaySearching || savingKey;
  return <Root>
    <Header title="Importador de Vídeos" subtitle="Importe por link ou encontre fundos gratuitos para sua projeção." />
    <Panel label="Auxiliar local"><Row style={{ alignItems: 'center' }}><div style={{ flex: 1 }}><StatusIndicator state={helperOnline && ffmpegFound ? 'ok' : helperOnline === false ? 'error' : 'warn'} label={helperOnline ? 'Auxiliar conectado' : helperOnline === false ? 'Auxiliar desconectado' : 'Verificando…'} detail={helperOnline && helperVersion ? `yt-dlp ${helperVersion} · ${ffmpegFound ? 'FFmpeg pronto' : 'FFmpeg não localizado'}` : undefined} /></div><Button size="sm" onClick={checkHelper}>Verificar</Button></Row>{helperOnline === false && <p className="hint">Instale e abra o <strong>Auxiliar do Importador para Spresenter</strong>.</p>}{helperError && <p className="error-detail">{helperError}</p>}</Panel>
    <div className="source-tabs"><button disabled={busy} className={mode === 'youtube' ? 'active' : ''} onClick={() => { setMode('youtube'); resetProgress(); }}>Link do YouTube</button><button disabled={busy} className={mode === 'pixabay' ? 'active' : ''} onClick={() => { setMode('pixabay'); resetProgress(); }}>Pesquisar no Pixabay</button></div>

    {mode === 'youtube' ? <>
      <Panel label="Link do YouTube"><Stack><Field label="URL do vídeo" hint={!url || validUrl ? '' : 'Informe um endereço do YouTube ou youtu.be.'}><TextInput value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && validUrl && helperOnline && analyze()} placeholder="https://www.youtube.com/watch?v=…" /></Field><Button variant="primary" disabled={!validUrl || busy} onClick={analyze}>{analyzing ? 'Analisando…' : 'Analisar vídeo'}</Button></Stack></Panel>
      {info && !job && !imported && <Panel label="Vídeo encontrado"><div className="video-card">{info.thumbnail && <img src={info.thumbnail} alt="Miniatura" />}<div className="video-meta"><strong>{info.title}</strong><span>{[info.uploader, formatDuration(info.duration)].filter(Boolean).join(' · ')}</span></div></div><Row style={{ marginTop: 12 }}><Field label="Importar para"><Select value={destination} onChange={(e) => setDestination(e.target.value as any)}><option value="backgroundVideo">Fundos</option><option value="video">Vídeos</option></Select></Field><Field label="Qualidade"><Select value={quality} onChange={(e) => setQuality(e.target.value as any)}><option value="compatible">Melhor compatível (até 720p)</option><option value="light">Leve (até 360p)</option></Select></Field></Row><Button variant="success" onClick={downloadYoutube}>Baixar e importar</Button></Panel>}
    </> : <>
      {pixabayConfigured === false && <Panel label="Conectar ao Pixabay"><form onSubmit={savePixabayKey}><Stack><p className="hint pixabay-intro">Use gratuitamente sua chave pessoal da API. Ela será guardada somente neste computador.</p><Field label="Chave da API" hint="Encontre sua chave em pixabay.com/api/docs"><TextInput type="password" value={pixabayKey} onChange={(e) => setPixabayKey(e.target.value)} placeholder="Cole sua chave do Pixabay" /></Field><Row><Button variant="primary" disabled={!pixabayKey.trim() || savingKey}>{savingKey ? 'Verificando…' : 'Salvar chave'}</Button><a className="external-link" href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer">Obter chave gratuita</a></Row></Stack></form></Panel>}
      {pixabayConfigured && <Panel label="Fundos gratuitos do Pixabay"><Stack><Row><div style={{ flex: 1 }}><TextInput value={pixabayQuery} onChange={(e) => setPixabayQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pixabayQuery.trim() && searchPixabay(1)} placeholder="Ex.: natureza, céu, partículas, igreja…" /></div><Button variant="primary" disabled={!pixabayQuery.trim() || busy} onClick={() => searchPixabay(1)}>{pixabaySearching ? 'Pesquisando…' : 'Pesquisar'}</Button></Row><Row className="pixabay-credit"><span>Vídeos gratuitos fornecidos por <a href="https://pixabay.com/" target="_blank" rel="noreferrer">Pixabay</a> · conteúdo seguro · resolução mínima HD</span><button className="link-button" onClick={changePixabayKey}>Trocar chave</button></Row></Stack></Panel>}
      {pixabayHasSearched && !pixabaySearching && !pixabayItems.length && <Panel label="Resultados"><p className="empty-state">Nenhum fundo HD foi encontrado. Tente usar outras palavras.</p></Panel>}
      {!!pixabayItems.length && <Panel label={`${pixabayTotal} resultados encontrados`}><div className="pixabay-grid">{pixabayItems.map((item) => { const variant = item.variants.find((value) => value.name === 'small') || item.variants[0]; return <article className="pixabay-card" key={item.id}><img src={variant.thumbnail} alt={item.tags} /><div className="pixabay-card-body"><strong>{pixabayTitle(item)}</strong><span>{item.user} · {formatDuration(item.duration)}</span><span>{variant.width}×{variant.height} · {formatSize(variant.size)}</span><Button size="sm" variant="success" disabled={busy} onClick={() => importPixabay(item)}>Adicionar aos Fundos</Button><a href={item.pageURL} target="_blank" rel="noreferrer">Ver no Pixabay</a></div></article>; })}</div><Row className="pagination"><Button size="sm" disabled={pixabayPage <= 1 || busy} onClick={() => searchPixabay(pixabayPage - 1)}>Anterior</Button><span>Página {pixabayPage}</span><Button size="sm" disabled={pixabayPage >= 25 || pixabayPage * 12 >= pixabayTotal || busy} onClick={() => searchPixabay(pixabayPage + 1)}>Próxima</Button></Row></Panel>}
    </>}

    {(job || message || error || imported) && <Panel label="Andamento">{job?.status === 'downloading' && <><p className="phase-label">1 de 2 · Download</p><div className="progress"><div style={{ width: `${Math.max(2, Math.min(100, job.percent || 0))}%` }} /></div><Row className="progress-label"><strong>{Math.round(job.percent || 0)}%</strong><span>{[job.speed, job.eta && `Restante: ${job.eta}`].filter(Boolean).join(' · ')}</span></Row></>}{conversionPercent !== null && !imported && <><p className="phase-label">2 de 2 · Processamento no Spresenter</p><div className="progress conversion"><div style={{ width: `${Math.max(2, Math.min(100, conversionPercent))}%` }} /></div><Row className="progress-label"><strong>{Math.round(conversionPercent)}%</strong><span>{destination === 'video' ? 'Gerando o pacote .scp' : 'Adicionando aos Fundos'}</span></Row></>}{error ? <StatusIndicator state="error" label="Não foi possível concluir" detail={error} /> : <StatusIndicator state={imported ? 'ok' : 'warn'} label={imported ? 'Importação concluída' : message || 'Processando…'} detail={imported?.title} />}</Panel>}
  </Root>;
}
