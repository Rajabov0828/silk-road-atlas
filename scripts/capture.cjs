const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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
    const WebSocket = require('ws');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'https://d3fx98y0gpu4w7.cloudfront.net/' } }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id === 10) {
        fs.writeFileSync('live_screenshot.png', Buffer.from(msg.result.data, 'base64'));
        console.log('Saved live_screenshot.png, size:', fs.statSync('live_screenshot.png').size);
        ws.close();
        proc.kill();
        process.exit(0);
      }
    });

    // Wait 5 seconds for tiles to render, then capture screenshot
    setTimeout(() => {
      ws.send(JSON.stringify({ id: 10, method: 'Page.captureScreenshot' }));
    }, 4500);

  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
