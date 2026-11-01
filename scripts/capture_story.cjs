const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9224;

const proc = spawn(CHROME, [
  '--headless',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--window-size=1280,800',
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
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

      // Switch to Caravan Story tab and advance
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: { expression: `
            (async () => {
              document.querySelectorAll('.tabs button')[1].click();
              await new Promise(r => setTimeout(r, 600));
              const btns = Array.from(document.querySelectorAll('#panel-story button.btn'));
              const nextBtn = btns.find(b => b.textContent.includes('journey') || b.textContent.includes('Next') || b.textContent.includes('Start'));
              if (nextBtn) nextBtn.click();
            })()
          ` }
        }));

        // Poll until story image is loaded
        const poll = setInterval(() => {
          ws.send(JSON.stringify({
            id: 4,
            method: 'Runtime.evaluate',
            params: { expression: "Boolean(document.querySelector('.story-image-card img'))" }
          }));
        }, 500);

        ws.on('message', data => {
          const msg = JSON.parse(data);
          if (msg.id === 4 && msg.result?.result?.value === true) {
            clearInterval(poll);
            setTimeout(() => {
              ws.send(JSON.stringify({ id: 5, method: 'Page.captureScreenshot' }));
            }, 1000);
          } else if (msg.id === 5) {
            fs.writeFileSync('C:/Users/user/.gemini/antigravity/brain/8cc78281-54a0-4631-bf9e-cda8aa6f4168/live_story_screenshot.png', Buffer.from(msg.result.data, 'base64'));
            console.log('Saved live_story_screenshot.png');
            ws.close();
            proc.kill();
            process.exit(0);
          }
        });
      }, 2000);
    });
  } catch(e) { console.error(e); proc.kill(); }
}, 2000);
