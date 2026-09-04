const { app, Tray, Menu, nativeImage, dialog } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const PORT = 17843;
let tray;
let server;
let ready = false;
let lastError = '';
let ytdlp = '';
let ffmpeg = '';
const jobs = new Map();

const dataDir = () => app.getPath('userData');
const binDir = () => path.join(dataDir(), 'bin');
const downloadsDir = () => path.join(dataDir(), 'downloads');
const exeName = () => process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytdlpUrl = () => process.platform === 'win32'
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Redirecionamentos demais ao baixar yt-dlp.'));
    https.get(url, { headers: { 'User-Agent': 'Spresenter-Video-Importer/0.2.0' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return download(new URL(response.headers.location, url).toString(), destination, redirects + 1).then(resolve, reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`Falha ao baixar yt-dlp: HTTP ${response.statusCode}`));
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function run(file, args, timeout = 0) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout }, (error, stdout, stderr) => {
    if (error) return reject(new Error((stderr || stdout || error.message).trim()));
    resolve(stdout);
  }));
}

function startVideoDownload(job, args) {
  const child = spawn(ytdlp, args, { windowsHide: true });
  let stderr = '';
  const inspect = chunk => {
    const text = String(chunk);
    stderr = `${stderr}${text}`.slice(-16000);
    for (const line of text.split(/\r?\n/)) {
      const percent = line.match(/\[download\]\s+([\d.]+)%/i);
      if (percent) job.percent = Math.max(job.percent || 0, Math.min(99, Number(percent[1])));
      const speed = line.match(/\bat\s+([^\s]+\/s)/i);
      const eta = line.match(/\bETA\s+([^\s]+)/i);
      if (speed) job.speed = speed[1];
      if (eta) job.eta = eta[1];
    }
  };
  child.stdout.on('data', inspect);
  child.stderr.on('data', inspect);
  child.on('error', error => Object.assign(job, { status: 'error', error: error.message || String(error) }));
  child.on('close', code => {
    if (job.status === 'error') return;
    if (code !== 0) return Object.assign(job, { status: 'error', error: stderr.trim() || `yt-dlp terminou com código ${code}.` });
    if (!fs.existsSync(job.file)) return Object.assign(job, { status: 'error', error: 'O MP4 não foi encontrado após o download.' });
    Object.assign(job, { status: 'ready', percent: 100, speed: '', eta: '' });
  });
}

function findFfmpeg() {
  const winRel = path.join('resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  const macRel = path.join('Resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Spresenter', winRel),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'spresenter', winRel),
    path.join(process.env.ProgramFiles || '', 'Spresenter', winRel),
    path.join(process.env.ProgramFiles || '', 'Sonext', 'Spresenter', winRel),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Sonext', 'Spresenter', winRel)
  ] : [
    path.join('/Applications', 'Spresenter.app', 'Contents', macRel),
    path.join('/Applications', 'spresenter.app', 'Contents', macRel),
    path.join(os.homedir(), 'Applications', 'Spresenter.app', 'Contents', macRel)
  ];
  return candidates.find(p => p && fs.existsSync(p)) || '';
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const content = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': content.length, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Cache-Control': 'no-store' });
  res.end(content);
}
function json(res, status, value) { send(res, status, JSON.stringify(value)); }
function readBody(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', c => { body += c; if (body.length > 1024 * 1024) req.destroy(); }); req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
function safeTitle(value) { return String(value || 'video').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 120); }

function spresenterJson(method, route, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const request = http.request({ hostname: '127.0.0.1', port: 5050, path: route, method, headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(data.message || data.error || `Spresenter respondeu HTTP ${response.statusCode}.`));
        resolve(data);
      });
    });
    request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error('O Spresenter demorou demais para processar o vídeo.')));
    request.on('error', error => reject(new Error(`Não foi possível comunicar com o Spresenter. Confirme que ele está aberto. ${error.message}`)));
    request.end(body);
  });
}

function createNativeVideo(filePath, title, onProgress) {
  return new Promise((resolve, reject) => {
    const boundary = `----SpresenterImporter${Date.now().toString(16)}`;
    const fields = [
      ['title', String(title || 'Novo Vídeo')],
      ['optimize', 'false'],
      ['allowEncode', 'false']
    ];
    const fieldParts = fields.map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    // Sem sublinhado no nome: a rotina nativa atribui a primeira saída como video_0.mp4.
    const fileHeader = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`);
    const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fileSize = fs.statSync(filePath).size;
    const total = fieldParts.reduce((sum, part) => sum + part.length, 0) + fileHeader.length + fileSize + closing.length;
    let sent = 0;
    const request = http.request({ hostname: '127.0.0.1', port: 5050, path: '/asset/videoPresentation', method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': total } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(data.message || data.error || `Spresenter respondeu HTTP ${response.statusCode}.`));
        resolve(data);
      });
    });
    request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error('O Spresenter demorou demais para criar o pacote de vídeo.')));
    request.on('error', error => reject(new Error(`Não foi possível enviar o vídeo ao Spresenter. Confirme que ele está aberto. ${error.message}`)));
    for (const part of fieldParts) { request.write(part); sent += part.length; }
    request.write(fileHeader); sent += fileHeader.length;
    const source = fs.createReadStream(filePath);
    source.on('data', chunk => {
      sent += chunk.length;
      onProgress(Math.max(5, Math.min(90, Math.round((sent / total) * 90))));
    });
    source.on('error', error => request.destroy(error));
    source.on('end', () => request.end(closing));
    source.pipe(request, { end: false });
  });
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      ffmpeg = findFfmpeg();
      let version = '';
      if (ready) version = String(await run(ytdlp, ['--version'], 10000)).trim();
      return json(res, 200, { ok: ready, ytDlpVersion: version, ffmpegFound: !!ffmpeg, desktopHelper: true, error: lastError });
    }
    if (req.method === 'POST' && url.pathname === '/analyze') {
      const body = await readBody(req);
      const raw = await run(ytdlp, ['--encoding', 'utf-8', '--dump-single-json', '--skip-download', '--no-playlist', '--no-warnings', '--', body.url], 120000);
      const meta = JSON.parse(raw);
      return json(res, 200, { title: meta.title, uploader: meta.uploader, thumbnail: meta.thumbnail, duration: meta.duration, webpageUrl: meta.webpage_url });
    }
    if (req.method === 'POST' && url.pathname === '/download') {
      const body = await readBody(req);
      ffmpeg = findFfmpeg();
      if (!ffmpeg) throw new Error('FFmpeg do Spresenter não foi localizado. Abra o Spresenter e tente novamente.');
      const id = `${Date.now()}${Math.random().toString(16).slice(2)}`;
      const output = path.join(downloadsDir(), `${id}.mp4`);
      const template = path.join(downloadsDir(), `${id}.%(ext)s`);
      const format = body.quality === 'light'
        ? 'bv*[height<=360][vcodec^=avc1]+ba[ext=m4a]/b[height<=360][vcodec^=avc1][acodec^=mp4a]'
        : 'bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][vcodec^=avc1][acodec^=mp4a]';
      const job = { id, file: output, status: 'downloading', percent: 0, speed: '', eta: '' };
      jobs.set(id, job);
      startVideoDownload(job, ['--encoding', 'utf-8', '--no-playlist', '--newline', '--ffmpeg-location', ffmpeg, '-f', format, '--merge-output-format', 'mp4', '--recode-video', 'mp4', '-o', template, '--', body.url]);
      return json(res, 202, { jobId: id, status: job.status, percent: job.percent });
    }
    const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return json(res, 404, { error: 'Download não encontrado.' });
      return json(res, 200, { id: job.id, status: job.status, percent: job.percent, speed: job.speed, eta: job.eta, error: job.error });
    }
    const base64Match = url.pathname.match(/^\/base64\/([a-f0-9]+)$/);
    if (req.method === 'GET' && base64Match) {
      const job = jobs.get(base64Match[1]);
      if (!job || !fs.existsSync(job.file)) return json(res, 404, { error: 'Arquivo não encontrado.' });
      return send(res, 200, fs.readFileSync(job.file).toString('base64'), 'text/plain; charset=us-ascii');
    }
    const fileMatch = url.pathname.match(/^\/file\/([a-f0-9]+)$/);
    if (req.method === 'GET' && fileMatch) {
      const job = jobs.get(fileMatch[1]);
      if (!job || job.status !== 'ready' || !fs.existsSync(job.file)) return json(res, 404, { error: 'Vídeo não encontrado ou ainda não concluído.' });
      const stat = fs.statSync(job.file);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${job.id}.mp4"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      return fs.createReadStream(job.file).pipe(res);
    }
    if (req.method === 'POST' && url.pathname === '/package-video') {
      const body = await readBody(req);
      const job = jobs.get(String(body.jobId || ''));
      if (!job || job.status !== 'ready' || !fs.existsSync(job.file)) throw new Error('O download não está pronto para criar o pacote.');
      job.importPercent = 5;
      job.importStatus = 'uploading';
      const created = await createNativeVideo(job.file, body.title, percent => { job.importPercent = percent; });
      job.importPercent = 94;
      job.importStatus = 'registering';
      // Este segundo pedido é indispensável: ele grava o asset no catálogo do
      // Spresenter. Somente criar a pasta deixa o vídeo como "arquivo sem dono".
      const saved = await spresenterJson('POST', `/asset/videoPresentation/${encodeURIComponent(created.guid)}/save`, {
        ...created,
        title: String(body.title || created.title || 'Novo Vídeo'),
        parent: 'root'
      });
      job.importPercent = 100;
      job.importStatus = 'done';
      return json(res, 200, saved);
    }
    const cleanupMatch = url.pathname.match(/^\/cleanup\/([a-f0-9]+)$/);
    if (req.method === 'POST' && cleanupMatch) {
      const job = jobs.get(cleanupMatch[1]);
      if (job && fs.existsSync(job.file)) fs.unlinkSync(job.file);
      jobs.delete(cleanupMatch[1]);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) { return json(res, 500, { error: error.message || String(error) }); }
}

async function initialize() {
  fs.mkdirSync(binDir(), { recursive: true });
  fs.mkdirSync(downloadsDir(), { recursive: true });
  ytdlp = path.join(binDir(), exeName());
  if (!fs.existsSync(ytdlp)) await download(ytdlpUrl(), ytdlp);
  if (process.platform !== 'win32') {
    fs.chmodSync(ytdlp, 0o755);
    // O yt-dlp é baixado na primeira execução. No macOS, remove somente o
    // atributo de quarentena desse componente para que possa ser executado.
    try { await run('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', ytdlp], 10000); } catch {}
  }
  ffmpeg = findFfmpeg();
  ready = true;
}

app.requestSingleInstanceLock() || app.quit();
app.on('second-instance', () => dialog.showMessageBox({ type: 'info', message: 'O Auxiliar do Importador já está em execução.' }));
app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Importador de Vídeos para Spresenter');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Sobre o aplicativo',
      click: () => dialog.showMessageBox({
        type: 'info',
        title: 'Sobre o aplicativo',
        message: 'Importador de Vídeos para Spresenter',
        detail: `Versão ${app.getVersion()}\n\nEste auxiliar trabalha em segundo plano para baixar e preparar vídeos solicitados pelo plugin do Spresenter.\n\nA comunicação acontece somente dentro deste computador. Ele não abre acesso externo à sua rede e não recebe conexões de outros dispositivos.\n\nO processamento dos vídeos é realizado localmente. Use apenas conteúdos que você tenha autorização para baixar.`,
        buttons: ['Fechar'],
        noLink: true
      })
    },
    { label: 'Iniciar com o sistema', type: 'checkbox', checked: true, click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Sair', click: () => { server?.close(); app.quit(); } }
  ]));
  server = http.createServer(handler).listen(PORT, '127.0.0.1');
  try { await initialize(); } catch (e) { lastError = e.message || String(e); }
});
app.on('window-all-closed', event => event.preventDefault());
