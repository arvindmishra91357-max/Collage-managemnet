const { Tunnel } = require('cloudflared');
const localtunnel = require('localtunnel');
const http = require('http');

async function getPublicIP() {
  return new Promise((resolve) => {
    const req = http.get('http://api.ipify.org', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve('182.71.244.5'));
    req.on('timeout', () => { req.destroy(); resolve('182.71.244.5'); });
  });
}

function printBanner(url, method = 'Cloudflare Quick Tunnel (Direct HTTPS)') {
  console.log(`\n======================================================`);
  console.log(`🎉 PARUL UNIVERSITY PORTAL IS NOW LIVE ONLINE!`);
  console.log(`======================================================`);
  console.log(`🌐 Public Online URL : ${url}`);
  console.log(`🔒 Security Provider : ${method}`);
  console.log(`📱 Works On         : Any smartphone, laptop, or tablet`);
  console.log(`======================================================`);
  console.log(`🎓 Student Portal   : ${url}`);
  console.log(`⚙️ Admin Dashboard  : ${url} (Click "Staff / Admin Portal")`);
  console.log(`🔑 Demo Student     : 26UG033181 | Pass: Demo@123`);
  console.log(`🔑 Admin Login      : admin | Pass: Admin@123`);
  console.log(`======================================================\n`);
}

async function start() {
  const port = process.env.PORT || 3000;
  console.log(`[Online Tunnel] Exposing local server on port ${port} to the world...`);

  let resolved = false;

  // 1. Try Cloudflare Quick Tunnel
  try {
    const cfTunnel = Tunnel.quick(`http://localhost:${port}`);
    
    cfTunnel.on('url', (liveUrl) => {
      if (!resolved) {
        resolved = true;
        printBanner(liveUrl, 'Cloudflare SSL Tunnel');
      }
    });

    cfTunnel.on('error', (err) => {
      console.warn('[Cloudflare Error]', err.message || err);
    });

    // If Cloudflare doesn't resolve within 8s, fallback to localtunnel
    setTimeout(async () => {
      if (!resolved) {
        console.log('[Tunnel] Cloudflare taking longer, initiating Localtunnel fallback...');
        tryFallback(port);
      }
    }, 8000);

  } catch (err) {
    console.warn('[Cloudflare init failed]:', err.message);
    tryFallback(port);
  }
}

async function tryFallback(port) {
  try {
    const lt = await localtunnel({ port });
    const ip = await getPublicIP();
    console.log(`\n======================================================`);
    console.log(`🎉 PARUL UNIVERSITY PORTAL IS NOW LIVE ONLINE!`);
    console.log(`======================================================`);
    console.log(`🌐 Public Online URL : ${lt.url}`);
    console.log(`🔑 Tunnel Password   : ${ip}`);
    console.log(`   (If prompted on first visit, enter your IP: ${ip})`);
    console.log(`======================================================`);
    console.log(`🎓 Student Portal    : ${lt.url}`);
    console.log(`⚙️ Admin Dashboard   : ${lt.url} (Click "Staff / Admin Portal")`);
    console.log(`🔑 Demo Student      : 26UG033181 | Pass: Demo@123`);
    console.log(`🔑 Admin Login       : admin | Pass: Admin@123`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('[Fallback error]:', err.message);
  }
}

start();
