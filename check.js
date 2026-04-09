// check.js — GitHub Actions'da çalışır, her 30 dakikada bir pozisyonları kontrol eder

import admin from 'firebase-admin';
import fetch from 'node-fetch';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db  = admin.firestore();
const fcm = admin.messaging();

const THRESH_WARN  = 6;
const THRESH_ALERT = 3;
const DTE_WARN     = 14;

function getDTE(expiryStr) {
  if (!expiryStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(expiryStr) - now) / 86400000);
}

function getBaseTicker(ticker) {
  return ticker.trim().split(' ')[0].toUpperCase();
}

async function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ? parseFloat(price) : null;
  } catch { return null; }
}

function calcDistance(spot, strikeStr, type) {
  const str = String(strikeStr);

  // IC: "260/330" formatı
  if (str.includes('/')) {
    const [putStrike, callStrike] = str.split('/').map(Number);
    const putDist  = ((spot - putStrike)  / spot) * 100;
    const callDist = ((callStrike - spot) / spot) * 100;
    return Math.min(putDist, callDist);
  }

  const strike = parseFloat(str);
  if (isNaN(strike)) return null;

  const t = type.toUpperCase();

  // Short put tipler: spot strike'ın altına düşerse tehlike
  if (['CSP', 'PCS'].includes(t)) {
    return ((spot - strike) / spot) * 100;
  }

  // Short call tipler: spot strike'ın üstüne çıkarsa tehlike
  // BCS = Bear Call Spread → CC ile aynı mantık
  if (['CC', 'PMCC', 'BCS'].includes(t)) {
    return ((strike - spot) / spot) * 100;
  }

  return null;
}

async function main() {
  const doc = await db.collection('optionflow').doc('main').get();
  if (!doc.exists) { console.log('Firestore belgesi yok.'); return; }

  const { positions = [], token } = doc.data();
  if (!token) { console.log('FCM token yok.'); return; }

  const open = positions.filter(p => !p.closed);
  if (!open.length) { console.log('Açık pozisyon yok.'); return; }

  // Fiyatları çek
  const tickers = [...new Set(open.map(p => getBaseTicker(p.ticker)))];
  const prices  = {};
  await Promise.all(tickers.map(async t => {
    const price = await fetchPrice(t);
    if (price) prices[t] = price;
    console.log(`${t}: $${price ?? 'N/A'}`);
  }));

  const notifications = [];

  for (const p of open) {
    const ticker = getBaseTicker(p.ticker);
    const spot   = prices[ticker];
    const dte    = getDTE(p.expiry);

    // DTE kontrolü — her çalışmada, eşik altındaysa bildir
    if (dte !== null && dte <= DTE_WARN) {
      notifications.push({
        title: `⏰ Vade Yaklaşıyor — ${ticker}`,
        body:  `${p.type} $${p.strike} | ${dte} gün kaldı (${p.expiry})`,
      });
    }

    // Mesafe kontrolü — her çalışmada, eşik altındaysa bildir
    if (spot && p.strike) {
      const dist = calcDistance(spot, String(p.strike), p.type);
      if (dist !== null) {
        if (dist <= THRESH_ALERT) {
          notifications.push({
            title: `🔴 Kritik — ${ticker} ${p.type}`,
            body:  `Spot $${spot.toFixed(2)} | Strike $${p.strike} | Mesafe %${dist.toFixed(1)}`,
          });
        } else if (dist <= THRESH_WARN) {
          notifications.push({
            title: `🟡 Uyarı — ${ticker} ${p.type}`,
            body:  `Spot $${spot.toFixed(2)} | Strike $${p.strike} | Mesafe %${dist.toFixed(1)}`,
          });
        }
      }
    }
  }

  if (!notifications.length) {
    console.log('Tetiklenen koşul yok, bildirim gönderilmedi.');
    return;
  }

  for (const n of notifications) {
    await fcm.send({
      token,
      notification: { title: n.title, body: n.body },
      android: { priority: 'high' },
    });
    console.log('Gönderildi:', n.title);
  }
}

main().catch(console.error);
