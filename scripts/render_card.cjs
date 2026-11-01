const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
const targetHtml = 'file:///' + path.resolve(__dirname, 'card_template.html').replace(/\\/g, '/');

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--window-size=1200,675',
  '--no-sandbox',
  targetHtml
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
      ws.send(JSON.stringify({
        id: 2,
        method: 'Emulation.setDeviceMetricsOverride',
        params: {
          width: 1200,
          height: 675,
          deviceScaleFactor: 1,
          mobile: false
        }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Page.captureScreenshot',
          params: {
            format: 'png',
            clip: { x: 0, y: 0, width: 1200, height: 675, scale: 1 }
          }
        }));
      }, 1500);

      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id === 3) {
          const buf = Buffer.from(msg.result.data, 'base64');
          fs.writeFileSync('thumbnail.png', buf);
          fs.writeFileSync('assets/hackathon_card.png', buf);
          fs.writeFileSync('web/public/card.png', buf);
          console.log('Saved 1200x675 hackathon card with Emulation override');
          ws.close();
          proc.kill();
          process.exit(0);
        }
      });
    });
  } catch (err) {
    console.error(err);
    proc.kill();
    process.exit(1);
  }
}, 2000);