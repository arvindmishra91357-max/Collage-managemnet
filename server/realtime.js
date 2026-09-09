// ==========================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) BROADCAST ENGINE
// ==========================================================================

const clients = new Set();

function registerClient(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  const client = {
    id: `${user.ug_id || user.username}_${Date.now()}`,
    res,
    user: {
      ug_id: user.ug_id || null,
      username: user.username || null,
      role: user.role,
      batch: user.batch || 'Both',
      division: user.division || '3CYBER7'
    }
  };

  clients.add(client);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'HANDSHAKE', status: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  // Periodic heartbeat ping to keep connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch (e) {
      clearInterval(pingInterval);
      clients.delete(client);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    clients.delete(client);
  });
}

function broadcastEvent(eventData) {
  const payload = {
    ...eventData,
    timestamp: eventData.timestamp || new Date().toISOString()
  };

  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    try {
      // Admins receive all events
      if (client.user.role === 'ADMIN') {
        client.res.write(dataStr);
        continue;
      }

      // If event is batch-scoped, only send to matching batch or 'Both'
      if (eventData.batch && eventData.batch !== 'Both') {
        if (client.user.batch && client.user.batch !== 'Both' && client.user.batch !== eventData.batch) {
          continue; // Skip student of different batch
        }
      }

      // If event is targeted to specific student
      if (eventData.target_ug_id && eventData.target_ug_id !== client.user.ug_id) {
        continue;
      }

      client.res.write(dataStr);
    } catch (err) {
      clients.delete(client);
    }
  }
}

function getActiveClientCount() {
  return clients.size;
}

module.exports = {
  registerClient,
  broadcastEvent,
  getActiveClientCount
};
