const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const si = require('systeminformation');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// Collect system information
async function getSystemInfo() {
  try {
    const [
      cpu,
      cpuCurrentSpeed,
      cpuTemperature,
      mem,
      fsSize,
      networkStats,
      currentLoad,
      processes,
      diskLayout,
      graphics,
      osInfo,
      battery
    ] = await Promise.all([
      si.cpu(),
      si.cpuCurrentSpeed(),
      si.cpuTemperature(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.currentLoad(),
      si.processes(),
      si.diskLayout(),
      si.graphics(),
      si.osInfo(),
      si.battery()
    ]);

    // Calculate network usage
    let networkUsage = {
      rx: 0,
      tx: 0,
      interfaces: []
    };

    networkStats.forEach(net => {
      networkUsage.rx += net.rx_sec || 0;
      networkUsage.tx += net.tx_sec || 0;
      networkUsage.interfaces.push({
        iface: net.iface,
        rx: net.rx_sec || 0,
        tx: net.tx_sec || 0
      });
    });

    // GPU information
    const gpuInfo = graphics.controllers.map(gpu => ({
      model: gpu.model,
      vendor: gpu.vendor,
      vram: gpu.vram,
      temperature: gpu.temperatureGpu || 'N/A'
    }));

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpuCurrentSpeed.avg,
        temperature: cpuTemperature.main || 'N/A',
        load: currentLoad.currentLoad.toFixed(2),
        usage: currentLoad.cpus.map(c => c.load.toFixed(2))
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usagePercent: ((mem.used / mem.total) * 100).toFixed(2),
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused
      },
      disk: {
        layout: diskLayout.map(d => ({
          device: d.device,
          type: d.type,
          name: d.name,
          size: d.size,
          temperature: d.temperature || 'N/A'
        })),
        filesystems: fsSize.map(fs => ({
          fs: fs.fs,
          type: fs.type,
          size: fs.size,
          used: fs.used,
          available: fs.available,
          usagePercent: fs.use.toFixed(2),
          mount: fs.mount
        }))
      },
      network: {
        totalRx: networkUsage.rx,
        totalTx: networkUsage.tx,
        interfaces: networkUsage.interfaces
      },
      gpu: gpuInfo,
      processes: {
        all: processes.all,
        running: processes.running,
        blocked: processes.blocked,
        sleeping: processes.sleeping,
        list: processes.list.slice(0, 10).map(p => ({
          pid: p.pid,
          name: p.name,
          cpu: p.cpu.toFixed(2),
          mem: p.mem.toFixed(2)
        }))
      },
      system: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: osInfo.uptime
      },
      battery: {
        hasBattery: battery.hasBattery,
        percent: battery.percent || 'N/A',
        charging: battery.isCharging,
        timeRemaining: battery.timeRemaining || 'N/A'
      }
    };
  } catch (error) {
    console.error('Error collecting system info:', error);
    return { error: error.message };
  }
}

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send system info every second
  const interval = setInterval(async () => {
    if (ws.readyState === WebSocket.OPEN) {
      const systemInfo = await getSystemInfo();
      ws.send(JSON.stringify(systemInfo));
    }
  }, 1000);

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('System Resource Monitor is ready!');
});
