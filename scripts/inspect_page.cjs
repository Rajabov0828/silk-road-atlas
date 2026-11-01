const { execSync, spawn } = require('child_process');
const http = require('http');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--no-sandbox',
  'https://d3fx98y0gpu4w7.cloudfront.net/'
]);

setTimeout(async () => {
  try {
    const tabs = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json`, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) {
      console.log('No page tab found');
      proc.kill();
      return;
    }

    const WebSocket = require('ws');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 5, method: 'Page.navigate', params: { url: 'https://d3fx98y0gpu4w7.cloudfront.net/' } }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      } else if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (r.status >= 400) {
          console.error('[HTTP ERROR]', r.status, r.url);
        }
      } else if (msg.method === 'Log.entryAdded') {
        console.log('[LOG]', msg.params.entry.level, msg.params.entry.text);
      }
    });

    setTimeout(() => {
      ws.close();
      proc.kill();
      process.exit(0);
    }, 6000);

  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
