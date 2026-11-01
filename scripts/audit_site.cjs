const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9225;

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--no-sandbox',
  'https://d3fx98y0gpu4w7.cloudfront.net/'
]);

setTimeout(async () => {
  try {
    const tabs = await new Promise((res, rej) => {
      http.get(`http://127.0.0.1:${PORT}/json`, r => {
        let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b)));
      }).on('error', rej);
    });
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    const logs = [];
    const netErrors = [];

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));

      ws.on('message', data => {
        const msg = JSON.parse(data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          logs.push(msg.params.type + ': ' + msg.params.args.map(a => a.value || a.description).join(' '));
        }
        if (msg.method === 'Log.entryAdded') {
          logs.push('LOG: ' + msg.params.entry.text);
        }
        if (msg.method === 'Network.responseReceived') {
          if (msg.params.response.status >= 400) {
            netErrors.push(msg.params.response.status + ' ' + msg.params.response.url);
          }
        }
      });

      setTimeout(() => {
        console.log('--- CONSOLE LOGS ---');
        console.log(logs.join('\n') || 'None');
        console.log('--- NETWORK ERRORS (>= 400) ---');
        console.log(netErrors.join('\n') || 'None');
        ws.close();
        proc.kill();
        process.exit(0);
      }, 5000);
    });
  } catch(e) { console.error(e); proc.kill(); }
}, 2000);
