export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      const pathname = url.pathname;

      const AVAILABLE_DOMAINS = (env.DOMAINS || env.DOMAIN || 'miuzy.web.id').split(',').map(d => d.trim());
      const ADMIN_KEY = env.ADMIN_KEY;

      // Security Headers Default
      const securityHeaders = {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      if (pathname === '/robots.txt') {
        return new Response('User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: Facebot\nAllow: /', {
          headers: { 
            'Content-Type': 'text/plain',
            ...securityHeaders,
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      if (pathname === '/favicon.ico') {
        return new Response('', { status: 204, headers: securityHeaders });
      }

      const rootDomain = AVAILABLE_DOMAINS.find(d => hostname.endsWith(d));
      if (rootDomain && hostname !== rootDomain && !hostname.startsWith('www.')) {
        const sub = hostname.split('.')[0];
        // Ambil path tanpa leading slash
        const pathCode = pathname.slice(1) || '';
        return await handleRedirect(request, env, sub, pathCode, ctx, securityHeaders);
      }

      if (pathname.startsWith('/api/')) {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${ADMIN_KEY}`) {
          return json({ error: 'Unauthorized' }, 401, securityHeaders);
        }

        if (pathname === '/api/create' && request.method === 'POST') {
          return handleCreate(request, env, securityHeaders);
        }
        if (pathname === '/api/list' && request.method === 'GET') {
          return handleList(env, securityHeaders);
        }
        if (pathname.startsWith('/api/delete/') && request.method === 'DELETE') {
          return handleDelete(env, pathname.split('/').pop(), securityHeaders);
        }
      }

      if (pathname === '/' || pathname === '') {
        return new Response(getDashboardHTML(AVAILABLE_DOMAINS), {
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            ...securityHeaders
          }
        });
      }

      return new Response('Not Found', { status: 404, headers: securityHeaders });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  }
};

const OFFER_LINKS = {
  'GACOR': 'https://fdeddg.hubss.one/p/yCTUy',
  'DENNY': 'https://fdeddg.hubss.one/p/gK3ud',
  'RONGGOLAWE': 'https://fdeddg.hubss.one/p/7vKE6',
  'PENTOLKOREK': 'https://fdeddg.hubss.one/p/g1V27',
  'KLOWOR': 'https://fdeddg.hubss.one/p/A8Se6',
  'DENNOK': 'https://fdeddg.hubss.one/p/ylgz0',
  'CUSTOM': null
};

const GIRL_NAMES = [
  'Emma', 'Olivia', 'Sophia', 'Ava', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  'Abigail', 'Emily', 'Ella', 'Elizabeth', 'Sofia', 'Avery', 'Mila', 'Aria', 'Scarlett', 'Victoria',
  'Madison', 'Luna', 'Grace', 'Chloe', 'Penelope', 'Layla', 'Riley', 'Zoey', 'Nora', 'Lily',
  'Eleanor', 'Hannah', 'Lillian', 'Addison', 'Aubrey', 'Ellie', 'Stella', 'Natalie', 'Zoe', 'Leah',
  'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Claire', 'Skylar', 'Lucy'
];

const DEFAULT_TITLES = [
  "HI! I'M ANGEL - ON LIVE SHOWS!",
  "HI! I'M MONA - ON LIVE SHOWS!",
  "HI! I'M LUNA - ON LIVE SHOWS!",
  "HI! I'M MONICA - ON LIVE SHOWS!",
  "HI! I'M JESSICA - ON LIVE SHOWS!"
];

const DEFAULT_DESCS = [
  "673.829 Online Members",
  "671.817 Online Members",
  "473.829 Online Members",
  "573.729 Online Members",
  "483.829 Online Members"
];

const DEFAULT_IMAGES = [
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEia5EZN81KImOLwCf4Maw9Rx93SMzi-Y1sl4FlymVs-p7A7fzpnnwzV3PPTRw95HtjanyPfOC7wGpR7PWlJbeLoK1fmtI5Siziuo1SMQJDqnwd7BZhjbHDuErzJIXkaXqw6Mp8WRohL9fyh93oJhDEgPbpV0ErLx6V5mA15iSO1gWlduuNVAOwxo7Ev455P/s1600/1000273276.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg8Dww4NmXkBhQklIJkpCwUwSGlpEwRlO_v9xk2Sif9c0IqxCkx9_2Bh2Trg-Ghidlqty_ZxX_jvdVsyQGNp7fGaek0EzoQ-i1_DMglfA9ATJzhn2yfmWbOD9HItFSPAgq24eM6KMRLxwNNxeLaLuo4N8VDwUurVtBBYhmAw5Lhi7K_MhE2fKzWxiMqNuXv/s1600/1000281899.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgLmLDHXtTQrS45ZtnxZdnkIcWi1JJR1sJeC2OnzAO2V9zH1h7gaiAvNpkiaQIk1kwulp84CqoKfEDxnV3cnGHSFBgSrLoL6__uvdsiH392xvwxdFQIiws2OL1E2dCR_4Csa4iVdnNInHkrBmo-i-U8CGaI9mYrMDndq1fWogmCCUQGS4p-yFlA253eOfmY/s16000/1000278957.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhY2U1nNExdEb1EmswodAdiZqFJvBi-j5qmXYihXFcnIUndSXE3u4zxS6yuKvKFCL6Y2dh0hdqk3Oc0oZZ1tg5pYWMzcRoaIlT3NVw0pZ7fldLwJCdE5mfn8UNtwDTnksPulL9NK3yG5cp7HYdKjmB8rdyv7kAt-B5Jrlu3P5o0xUbwIC8TDOXWpyKjimZN/s1600/1000277246.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgVt6Bj8uzv9tZc5AChsYKNjcPzFOtR8yM5WUrG3hseYZl_RrEyU_6MOsu2CtaUuKrQ7WkPvfGIGvzGxQurpR7P5rKo1aAEwsn6zXl1t-jZf4Uz0jeTdsVr_c3L5pvMNukqOTfMLaw9yVw62_fzDUs9bSIQmvQ39OmLEp0k6H-nJS_HLp48-5CA1QYRdU6Y/s1600/1000271008.jpg",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh_X109SK-QhlSOb1NiSyRSnY54QJNX0WKy0UsOtgMA-sYsqzk6qhC9D3WHovVRF3uK_cIMA-J1K8hWmc__ZUG_gihjOYjwBg54bZVNlDKWiNtfbTpEOvSj-Nd2_aRX_fYaiFdsZBNZdlehyo14bgl-Dxgk9qNDepHwfwNFidERYyAAjsWhWMY5_PyASPSP/s1600/1000270623.jpg"
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate random string a-z, A-Z, 0-9
function generateRandomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleRedirect(req, env, sub, pathCode, ctx, securityHeaders) {
  const dataRaw = await env.LINKS_DB.get(`link:${sub}`);
  if (!dataRaw) return new Response('Link Tidak Ditemukan', { status: 404, headers: securityHeaders });

  const data = JSON.parse(dataRaw);
  const ua = req.headers.get('User-Agent') || '';
  
  // Validasi path code (optional - untuk keamanan tambahan)
  // Jika ingin strict, uncomment line di bawah:
  // if (pathCode && pathCode !== data.pathCode) return new Response('Invalid Code', { status: 404 });
  
  const isFacebookCrawler = /facebookexternalhit|Facebot/i.test(ua);
  const isFacebookApp = /FBAN|FBAV|FB_IAB/i.test(ua);
  
  ctx.waitUntil(updateStats(env, sub));

  const crawlerHeaders = {
    ...securityHeaders,
    'Cache-Control': 'public, max-age=3600',
    'Vary': 'User-Agent'
  };

  if (isFacebookCrawler && !isFacebookApp) {
    return new Response(getOgHTML(data, sub, pathCode), {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...crawlerHeaders
      }
    });
  }

  return new Response(getRedirectHTML(data.targetUrl, data.uniqueCode), {
    status: 200,
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders
    }
  });
}

async function handleCreate(req, env, securityHeaders) {
  try {
    const body = await req.json();
    
    const offerId = body.offerId || 'CUSTOM';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const randomGirlName = getRandom(GIRL_NAMES).toLowerCase();
    
    const sub = body.customCode 
      ? body.customCode.toLowerCase().trim() 
      : randomGirlName + '-' + randomSuffix;
    
    // Generate path code acak (contoh: x7d9a2F4)
    const pathCode = generateRandomString(8);
    
    let targetUrl = body.targetUrl;
    if (offerId !== 'CUSTOM' && OFFER_LINKS[offerId]) {
      targetUrl = OFFER_LINKS[offerId];
    }
    
    if (!targetUrl) {
      return json({ error: 'URL Tujuan tidak ditemukan' }, 400, securityHeaders);
    }

    if (await env.LINKS_DB.get(`link:${sub}`)) {
      return json({ error: 'Subdomain sudah ada' }, 409, securityHeaders);
    }

    const uniqueCode = generateRandomString(6).toUpperCase();
    const imageUrl = body.imageUrl?.trim() 
      ? body.imageUrl.trim() 
      : getRandom(DEFAULT_IMAGES);

    const data = {
      subdomain: sub,
      pathCode: pathCode, // Simpan path code
      domain: body.domain,
      title: body.title?.trim() || getRandom(DEFAULT_TITLES),
      description: body.description?.trim() || getRandom(DEFAULT_DESCS),
      imageUrl: imageUrl,
      targetUrl: targetUrl,
      offerId: offerId,
      uniqueCode: uniqueCode,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(data));
    
    // Return URL lengkap dengan path code
    const fullUrl = `https://${sub}.${body.domain}/${pathCode}`;
    
    return json({ 
      success: true, 
      url: fullUrl,
      shortId: sub,
      pathCode: pathCode,
      uniqueCode: uniqueCode
    }, 200, securityHeaders);
  } catch (err) {
    return json({ error: err.message }, 500, securityHeaders);
  }
}

async function handleList(env, securityHeaders) {
  try {
    const list = await env.LINKS_DB.list({ prefix: 'link:' });
    const links = [];
    for (const key of list.keys) {
      const val = await env.LINKS_DB.get(key.name);
      if (val) links.push(JSON.parse(val));
    }
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json({ success: true, data: links }, 200, securityHeaders);
  } catch (err) {
    return json({ error: err.message }, 500, securityHeaders);
  }
}

async function handleDelete(env, sub, securityHeaders) {
  try {
    if (!sub || sub.trim() === '') {
      return json({ error: 'Subdomain tidak valid' }, 400, securityHeaders);
    }
    
    await env.LINKS_DB.delete(`link:${sub}`);
    await env.LINKS_DB.delete(`clicks:${sub}`);
    
    return json({ success: true, message: 'Link berhasil dihapus' }, 200, securityHeaders);
  } catch (err) {
    return json({ error: err.message }, 500, securityHeaders);
  }
}

async function updateStats(env, sub) {
  try {
    const raw = await env.LINKS_DB.get(`link:${sub}`);
    if (raw) {
      const obj = JSON.parse(raw);
      obj.clicks = (obj.clicks || 0) + 1;
      await env.LINKS_DB.put(`link:${sub}`, JSON.stringify(obj));
    }
  } catch (e) {
    console.error('Stats update failed:', e);
  }
}

function getRedirectHTML(url, uniqueCode) {
  const cleanUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const trackingParam = uniqueCode ? `?ref=${uniqueCode}` : '';
  const finalUrl = cleanUrl.includes('?') ? `${cleanUrl}&ref=${uniqueCode}` : `${cleanUrl}${trackingParam}`;
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="googlebot" content="noindex, nofollow">
    <meta http-equiv="refresh" content="1; url=${finalUrl}">
    <title>Loading...</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{
            background:#f0f2f5;
            display:flex;
            justify-content:center;
            align-items:center;
            min-height:100vh;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        }
        .loader{
            width:36px;
            height:36px;
            border:3px solid #e4e6eb;
            border-top:3px solid #1877f2;
            border-radius:50%;
            animation:spin 1s linear infinite;
        }
        @keyframes spin{
            0%{transform:rotate(0deg)}
            100%{transform:rotate(360deg)}
        }
    </style>
    <script>
        setTimeout(()=>window.location.href="${finalUrl}",1200);
    </script>
</head>
<body>
    <div class="loader"></div>
</body>
</html>`;
}

function getOgHTML(d, sub, pathCode) {
  const img = d.imageUrl || 'https://via.placeholder.com/1200x630/1877f2/ffffff?text=Video';
  const title = (d.title || '').replace(/"/g, '&quot;');
  const desc = (d.description || '').replace(/"/g, '&quot;');
  const domain = d.domain || '';
  const path = pathCode || d.pathCode || '';
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://${sub}.${domain}/${path}">
<meta property="og:type" content="website">
<meta property="fb:app_id" content="966242223397117">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="strict-origin">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0; 
    padding: 0; 
    background: #000; 
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}
.container {
    width: 100%;
    max-width: 1200px;
    position: relative;
}
.image-wrapper {
    width: 100%;
    position: relative;
    background: #000;
}
.image-wrapper img {
    width: 100%;
    height: auto;
    display: block;
}
.overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%);
    padding: 40px 20px 30px;
    color: white;
}
.title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    line-height: 1.3;
}
.description {
    font-size: 16px;
    color: rgba(255,255,255,0.9);
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
@media (max-width: 768px) {
    .title { font-size: 18px; }
    .description { font-size: 14px; }
    .overlay { padding: 30px 15px 20px; }
}
</style>
</head>
<body>
<div class="container">
    <div class="image-wrapper">
        <img src="${img}" alt="${title}">
        <div class="overlay">
            <h1 class="title">${title}</h1>
            <p class="description">${desc}</p>
        </div>
    </div>
</div>
</body>
</html>`;
}

function getDashboardHTML(domains) {
  const options = domains.map(d => `<option value="${d}">${d}</option>`).join('');
  const offerOptions = Object.keys(OFFER_LINKS)
    .filter(k => k !== 'CUSTOM')
    .map(k => `<option value="${k}">${k}</option>`).join('');
  
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Secure Link Generator - Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  :root{
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --primary-light: #818cf8;
    --danger: #ef4444;
    --success: #10b981;
    --warning: #f59e0b;
    --bg: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.8);
    --text: #f8fafc;
    --text-secondary: #94a3b8;
    --border: rgba(148, 163, 184, 0.2);
    --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    --radius: 16px;
    --radius-sm: 8px;
    --glass: rgba(255, 255, 255, 0.05);
  }
  
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif}
  
  body{
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    background-image: 
      radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
      radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.15) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
      radial-gradient(at 0% 100%, rgba(236, 72, 153, 0.15) 0px, transparent 50%);
    background-attachment: fixed;
  }
  
  .app-container{max-width:1400px;margin:0 auto;display:flex;min-height:100vh;position:relative}
  
  .sidebar{
    width:280px;
    background: var(--glass);
    backdrop-filter: blur(20px);
    border-right: 1px solid var(--border);
    padding: 32px 24px;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    z-index: 100;
    display: none;
  }
  
  .sidebar-logo{
    font-size: 28px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--primary-light) 0%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 40px;
    padding: 0 12px;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .sidebar-logo::before{
    content: "⚡";
    -webkit-text-fill-color: var(--primary-light);
    font-size: 24px;
  }
  
  .nav-item{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    margin: 6px 0;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 600;
    font-size: 15px;
    transition: all 0.3s ease;
    cursor: pointer;
    border: 1px solid transparent;
  }
  
  .nav-item:hover, .nav-item.active{
    background: rgba(99, 102, 241, 0.1);
    color: var(--text);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateX(4px);
  }
  
  .nav-item.active{
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.1) 100%);
    color: var(--primary-light);
  }
  
  .sidebar-footer{
    position: absolute;
    bottom: 32px;
    left: 24px;
    right: 24px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  
  .main-content{
    flex: 1;
    margin-left: 0;
    padding: 24px;
    width: 100%;
    padding-bottom: 100px;
  }
  
  .mobile-header{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    margin: -24px -24px 24px -24px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 99;
  }
  
  .mobile-title{
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--primary-light) 0%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .card{
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 32px;
    margin-bottom: 24px;
    box-shadow: var(--shadow);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .card:hover{
    transform: translateY(-2px);
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);
  }
  
  .card-title{
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .card-subtitle{
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
    margin-bottom: 24px;
  }
  
  .form-group{margin-bottom: 20px}
  
  label{
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  input, select, textarea{
    width: 100%;
    padding: 14px 18px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 15px;
    background: rgba(15, 23, 42, 0.6);
    color: var(--text);
    transition: all 0.3s ease;
    min-height: 48px;
  }
  
  input:focus, select:focus, textarea:focus{
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: rgba(15, 23, 42, 0.8);
  }
  
  input::placeholder, textarea::placeholder{
    color: var(--text-secondary);
    opacity: 0.6;
  }
  
  select{
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 16px center;
    padding-right: 40px;
  }
  
  textarea{
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }
  
  .form-row{
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .btn{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 28px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 48px;
    position: relative;
    overflow: hidden;
  }
  
  .btn::before{
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s;
  }
  
  .btn:hover::before{
    left: 100%;
  }
  
  .btn-primary{
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: #fff;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
  }
  
  .btn-primary:hover{
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6);
  }
  
  .btn-secondary{
    background: rgba(148, 163, 184, 0.1);
    color: var(--text);
    border: 1px solid var(--border);
  }
  
  .btn-secondary:hover{
    background: rgba(148, 163, 184, 0.2);
    border-color: var(--text-secondary);
  }
  
  .btn-success{
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
  }
  
  .btn-success:hover{
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.6);
  }
  
  .btn-danger{
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: #fff;
  }
  
  .btn-sm{padding: 10px 20px; font-size: 13px}
  .btn-logout{
    background: transparent;
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 10px 20px;
    font-size: 13px;
    width: auto;
  }
  
  .btn-logout:hover{
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--danger);
  }
  
  .btn-full{width: 100%}
  
  .offer-select{
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
    color: var(--primary-light);
    font-weight: 700;
    border: 2px solid var(--primary);
  }
  
  .offer-badge{
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, var(--primary) 0%, #ec4899 100%);
    color: #fff;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
  }
  
  .links-grid{
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .link-item{
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .link-item::before{
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(to bottom, var(--primary), #ec4899);
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .link-item:hover{
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    border-color: rgba(99, 102, 241, 0.3);
  }
  
  .link-item:hover::before{
    opacity: 1;
  }
  
  .link-header{
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .link-title{
    font-weight: 700;
    font-size: 16px;
    color: var(--text);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .link-url{
    font-size: 13px;
    color: var(--primary-light);
    background: rgba(99, 102, 241, 0.1);
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    word-break: break-all;
    border: 1px solid rgba(99, 102, 241, 0.2);
    font-family: 'Courier New', monospace;
    letter-spacing: 0.5px;
  }
  
  .link-meta{
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  
  .link-actions{
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    margin-top: 12px;
  }
  
  .unique-code{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  
  .login-container{
    max-width: 420px;
    margin: 80px auto;
    padding: 0 20px;
  }
  
  .login-card{
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 48px 40px;
    text-align: center;
    box-shadow: var(--shadow);
  }
  
  .login-logo{
    font-size: 36px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--primary-light) 0%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 12px;
  }
  
  .login-subtitle{
    color: var(--text-secondary);
    margin-bottom: 32px;
    font-size: 15px;
  }
  
  .result-box{
    background: rgba(16, 185, 129, 0.1);
    border: 2px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--radius-sm);
    padding: 24px;
    margin: 24px 0;
    text-align: center;
    display: none;
  }
  
  .result-box.show{display: block; animation: slideIn 0.3s ease}
  
  @keyframes slideIn{
    from{opacity: 0; transform: translateY(-10px)}
    to{opacity: 1; transform: translateY(0)}
  }
  
  .result-url{
    font-family: 'Courier New', monospace;
    font-size: 14px;
    color: #10b981;
    font-weight: 600;
    word-break: break-all;
    margin-bottom: 12px;
    padding: 12px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    border: 1px dashed rgba(16, 185, 129, 0.3);
  }
  
  .hidden{display: none !important}
  .text-center{text-align: center}
  .mt-1{margin-top: 8px}
  .mt-2{margin-top: 16px}
  .mb-2{margin-bottom: 16px}
  
  .toast{
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    color: var(--text);
    padding: 16px 24px;
    border-radius: var(--radius-sm);
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    z-index: 1000;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    border: 1px solid var(--border);
    border-left: 4px solid var(--primary);
  }
  
  .toast.show{
    transform: translateY(0);
    opacity: 1;
  }
  
  .toast.error{border-left-color: var(--danger)}
  .toast.success{border-left-color: var(--success)}
  
  @media(min-width:768px){
    .main-content{padding: 32px 40px; padding-bottom: 40px}
    .form-row{grid-template-columns: repeat(2, 1fr)}
    .links-grid{grid-template-columns: repeat(auto-fill, minmax(350px, 1fr))}
  }
  
  @media(min-width:1024px){
    .sidebar{display: block}
    .main-content{margin-left: 280px; padding: 40px 48px}
    .mobile-header{display: none}
    .btn{width: auto}
    .btn-full{width: 100%}
    .link-actions{grid-template-columns: 1fr 90px}
  }
  
  @media(min-width:1280px){
    .links-grid{grid-template-columns: repeat(3, 1fr)}
  }
  
  .loading-dots{
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  
  .loading-dots span{
    width: 4px;
    height: 4px;
    background: currentColor;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }
  
  .loading-dots span:nth-child(1){animation-delay: -0.32s}
  .loading-dots span:nth-child(2){animation-delay: -0.16s}
  
  @keyframes bounce{
    0%, 80%, 100%{transform: scale(0.6)}
    40%{transform: scale(1)}
  }
  
  .path-highlight{
    color: #f59e0b;
    font-weight: 700;
  }
</style>
</head>
<body>

<!-- LOGIN VIEW -->
<div id="loginView" class="login-container">
  <div class="login-card">
    <div class="login-logo">⚡ Link Generator</div>
    <div class="login-subtitle">Secure URL Management System</div>
    <div class="form-group">
      <input type="password" id="pass" placeholder="Masukkan Password Admin" onkeypress="if(event.key==='Enter')doLogin()">
    </div>
    <button class="btn btn-primary btn-full" onclick="doLogin()">Masuk Dashboard</button>
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-secondary);">
      Protected System • Anti-Spam Detection
    </div>
  </div>
</div>

<!-- MAIN APP -->
<div id="appView" class="app-container hidden">
  <!-- Sidebar Desktop -->
  <nav class="sidebar">
    <div class="sidebar-logo">Link Generator</div>
    <a class="nav-item active" onclick="showSection('create')"><span>🚀 Buat Link</span></a>
    <a class="nav-item" onclick="showSection('list')"><span>📋 Riwayat Link</span></a>
    <div class="sidebar-footer">
      <div style="margin-bottom: 8px">🔒 Secure Connection</div>
      Tools by Sesepuh © 2025<br>
      <span style="font-size:11px;opacity:0.7">v3.0 Anti-Spam Edition</span>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <span class="mobile-title">⚡ Link Generator</span>
      <button class="btn btn-logout btn-sm" onclick="doLogout()">Logout</button>
    </header>

    <!-- Create Section -->
    <section id="createSection" class="section">
      <div class="card">
        <div class="card-title">
          <div>
            Buat Link Baru
            <div class="card-subtitle">Generate secure shortlink dengan random path</div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Pilih Offer ID</label>
            <select id="offerId" class="offer-select" onchange="handleOfferChange()">
              ${offerOptions}
              <option value="CUSTOM">CUSTOM (Manual)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Domain</label>
            <select id="dom">${options}</select>
          </div>
        </div>

        <div id="customUrlGroup" class="form-group hidden">
          <label>URL Tujuan Custom</label>
          <input type="url" id="target" placeholder="https://example.com/offer">
        </div>

        <div class="form-group">
          <label>Judul Postingan <span style="font-weight:400;color:var(--text-secondary)">(Opsional)</span></label>
          <input type="text" id="t" placeholder="Contoh: HI! I'M ANGEL - ON LIVE SHOWS!">
        </div>

        <div class="form-group">
          <label>Deskripsi <span style="font-weight:400;color:var(--text-secondary)">(Opsional)</span></label>
          <textarea id="desc" placeholder="Contoh: 673.829 Online Members"></textarea>
        </div>

        <div class="form-group">
          <label>URL Gambar <span style="font-weight:400;color:var(--text-secondary)">(Opsional)</span></label>
          <input type="url" id="img" placeholder="https://example.com/image.jpg">
        </div>

        <div class="form-group">
          <label>Custom Subdomain <span style="font-weight:400;color:var(--text-secondary)">(Opsional)</span></label>
          <input type="text" id="code" placeholder="promo-gacor">
        </div>

        <button class="btn btn-primary btn-full" onclick="create()" id="btnGenerate">
          <span>🚀 Generate Link</span>
        </button>
        
        <!-- Result Box -->
        <div id="resultBox" class="result-box">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">✅ Link berhasil dibuat!</div>
          <div class="result-url" id="resultUrl"></div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
            Format: <span class="path-highlight">subdomain.domain.com/path-random</span>
          </div>
          <button class="btn btn-success btn-full" onclick="copyResult()" id="btnCopy">
            📋 Salin Link
          </button>
        </div>
        
        <div class="nav-buttons">
          <button class="btn btn-secondary" onclick="showSection('list')">📋 Lihat Riwayat</button>
        </div>
      </div>
    </section>

    <!-- List Section -->
    <section id="listSection" class="section hidden">
      <div class="card">
        <div class="card-title">
          <div>
            Riwayat Link
            <div class="card-subtitle">Semua link dengan random path</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showSection('create')">+ Buat Baru</button>
        </div>
        
        <div style="margin-bottom: 24px;">
          <button class="btn btn-secondary btn-sm" onclick="showSection('create')" style="width:auto">← Kembali</button>
        </div>
        
        <div id="linksContainer" class="links-grid">
          <div class="text-center mt-2" style="color:var(--text-secondary);grid-column:1/-1;padding:40px">
            <div class="loading-dots" style="justify-content:center;margin-bottom:16px">
              <span></span><span></span><span></span>
            </div>
            Memuat data...
          </div>
        </div>
      </div>
    </section>

    <div class="text-center" style="color:var(--text-secondary);font-size:12px;padding:20px 0">
      🔒 Sistem Keamanan Anti-Spam • All Rights Reserved © 2025
    </div>
  </main>
</div>

<div id="toast" class="toast"></div>

<script>
let k = localStorage.getItem('k');
let currentGeneratedUrl = '';

if(k) showApp();

function showToast(msg, type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast ' + type;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

function doLogin(){
  k = document.getElementById('pass').value;
  if(!k){showToast('Password wajib diisi', 'error');return;}
  localStorage.setItem('k', k);
  showApp();
}

function doLogout(){
  localStorage.removeItem('k');
  location.reload();
}

function showApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  showSection('create');
  load();
}

function showSection(name){
  document.getElementById('createSection').classList.toggle('hidden',name!=='create');
  document.getElementById('listSection').classList.toggle('hidden',name!=='list');
  document.querySelectorAll('.nav-item').forEach((el,idx)=>{
    el.classList.toggle('active',(name==='create'&&idx===0)||(name==='list'&&idx===1));
  });
  if(name==='list')load();
}

function handleOfferChange(){
  const isCustom = document.getElementById('offerId').value==='CUSTOM';
  document.getElementById('customUrlGroup').classList.toggle('hidden',!isCustom);
}

async function create(){
  const btn=document.getElementById('btnGenerate');
  const resultBox=document.getElementById('resultBox');
  const originalText=btn.innerHTML;
  
  resultBox.classList.remove('show');
  
  btn.innerHTML='<div class="loading-dots"><span></span><span></span><span></span></div> Generating...';
  btn.disabled=true;
  
  const offerId=document.getElementById('offerId').value;
  let targetUrl='';
  
  if(offerId==='CUSTOM'){
    targetUrl=document.getElementById('target').value;
    if(!targetUrl){
      showToast('URL Custom wajib diisi', 'error');
      btn.innerHTML=originalText;
      btn.disabled=false;
      return;
    }
  }
  
  const payload={
    title:document.getElementById('t').value,
    description:document.getElementById('desc').value,
    imageUrl:document.getElementById('img').value,
    targetUrl:targetUrl,
    domain:document.getElementById('dom').value,
    customCode:document.getElementById('code').value,
    offerId:offerId
  };
  
  try{
    const res=await fetch('/api/create',{
      method:'POST',
      headers:{'Authorization':'Bearer '+k,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    
    if(res.ok){
      const data=await res.json();
      currentGeneratedUrl = data.url;
      
      // Tampilkan URL lengkap dengan path
      document.getElementById('resultUrl').innerHTML = 
        \`https://\${data.shortId}.\${document.getElementById('dom').value}/<span class="path-highlight">\${data.pathCode}</span>\`;
      
      resultBox.classList.add('show');
      resultBox.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      
      showToast('Link berhasil dibuat!', 'success');
      
      // Clear form
      document.getElementById('t').value='';
      document.getElementById('desc').value='';
      document.getElementById('img').value='';
      document.getElementById('target').value='';
      document.getElementById('code').value='';
    }else{
      const err=await res.json();
      showToast('Gagal: '+err.error, 'error');
      if(res.status===401){localStorage.removeItem('k');location.reload();}
    }
  }catch(e){
    showToast('Error: '+e.message, 'error');
  }
  
  btn.innerHTML=originalText;
  btn.disabled=false;
}

function copyResult(){
  if(currentGeneratedUrl){
    copyToClipboard(currentGeneratedUrl);
    showToast('Link disalin ke clipboard!', 'success');
  }
}

async function load(){
  const container=document.getElementById('linksContainer');
  try{
    const res=await fetch('/api/list',{headers:{'Authorization':'Bearer '+k}});
    if(res.status===401){localStorage.removeItem('k');location.reload();return;}
    const d=await res.json();
    
    if(d.success&&d.data.length>0){
      container.innerHTML=d.data.map(i=>{
        const date=new Date(i.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        const fullUrl = \`https://\${i.subdomain}.\${i.domain}/\${i.pathCode}\`;
        return \`
        <div class="link-item">
          <div class="link-header">
            <span class="offer-badge">\${i.offerId}</span>
            <span class="link-title" title="\${i.title}">\${i.title}</span>
          </div>
          <div class="link-url">\${i.subdomain}.\${i.domain}/<span class="path-highlight">\${i.pathCode}</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <span class="unique-code">REF: \${i.uniqueCode || 'N/A'}</span>
          </div>
          <div class="link-meta">
            <span>\${date}</span>
            <span style="font-weight:600;color:var(--text)">\${i.clicks||0} klik</span>
          </div>
          <div class="link-actions">
            <button class="btn btn-success btn-sm" onclick="copyToClipboard('\${fullUrl}')">📋 Salin</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink('\${i.subdomain}')">🗑️</button>
          </div>
        </div>
        \`;
      }).join('');
    }else{
      container.innerHTML='<div class="text-center mt-2" style="color:var(--text-secondary);grid-column:1/-1;padding:40px">Belum ada link. Buat link pertama Anda!</div>';
    }
  }catch(e){
    container.innerHTML='<div class="text-center mt-2" style="color:var(--danger);grid-column:1/-1;padding:40px">Gagal memuat data</div>';
  }
}

async function deleteLink(sub){
  if(!confirm('Yakin ingin menghapus link ini?'))return;
  try{
    const res = await fetch('/api/delete/'+sub,{method:'DELETE',headers:{'Authorization':'Bearer '+k}});
    const data = await res.json();
    if(res.ok && data.success){
      showToast('Link berhasil dihapus', 'success');
      load();
    }else{
      showToast('Gagal menghapus: ' + (data.error || 'Unknown error'), 'error');
    }
  }catch(e){
    showToast('Gagal menghapus: ' + e.message, 'error');
  }
}

function copyToClipboard(text){
  if(navigator.clipboard){
    navigator.clipboard.writeText(text);
  }else{
    const el=document.createElement('textarea');
    el.value=text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}
</script>

</body></html>`;
}

function json(d, s = 200, headers = {}) {
  return new Response(JSON.stringify(d), {
    status: s, 
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
