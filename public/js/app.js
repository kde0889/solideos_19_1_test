// WebSocket connection
let ws;
let reconnectInterval;
let charts = {};

// Initialize charts
function initCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#a0a8c5'
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: '#2d3561'
                    },
                    ticks: {
                        color: '#a0a8c5'
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: '#2d3561'
                    },
                    ticks: {
                        color: '#a0a8c5'
                    }
                }
            }
        }
    };

    // CPU Chart
    charts.cpu = new Chart(document.getElementById('cpuChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'CPU Load (%)',
                data: [],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        }
    });

    // Memory Chart
    charts.memory = new Chart(document.getElementById('memoryChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Memory Usage (%)',
                data: [],
                borderColor: '#00ff88',
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
                tension: 0.4,
                fill: true
            }]
        }
    });

    // Network Chart
    charts.network = new Chart(document.getElementById('networkChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Download (KB/s)',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Upload (KB/s)',
                    data: [],
                    borderColor: '#ff3366',
                    backgroundColor: 'rgba(255, 51, 102, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        }
    });
}

// Update chart data
function updateChart(chart, label, value, maxPoints = 20) {
    if (chart.data.labels.length >= maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }

    chart.data.labels.push(label);
    if (Array.isArray(value)) {
        chart.data.datasets.forEach((dataset, index) => {
            dataset.data.push(value[index] || 0);
        });
    } else {
        chart.data.datasets[0].data.push(value);
    }
    chart.update('none');
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

// Update UI with system data
function updateUI(data) {
    if (data.error) {
        console.error('Data error:', data.error);
        return;
    }

    const now = new Date().toLocaleTimeString();

    // System Info
    if (data.system) {
        document.getElementById('hostname').textContent = data.system.hostname || '-';
        document.getElementById('platform').textContent = data.system.platform || '-';
        document.getElementById('distro').textContent = data.system.distro || '-';
        document.getElementById('uptime').textContent = formatUptime(data.system.uptime) || '-';
    }

    // CPU
    if (data.cpu) {
        document.getElementById('cpuModel').textContent = data.cpu.brand || '-';
        document.getElementById('cpuCores').textContent = `${data.cpu.physicalCores} (${data.cpu.cores} threads)`;
        document.getElementById('cpuSpeed').textContent = `${data.cpu.speed} GHz`;
        document.getElementById('cpuTemp').textContent =
            data.cpu.temperature !== 'N/A' ? `${data.cpu.temperature}°C` : 'N/A';
        document.getElementById('cpuLoad').textContent = `${data.cpu.load}%`;

        updateChart(charts.cpu, now, parseFloat(data.cpu.load));
    }

    // Memory
    if (data.memory) {
        document.getElementById('memUsage').textContent = `${data.memory.usagePercent}%`;
        document.getElementById('memUsed').textContent = formatBytes(data.memory.used);
        document.getElementById('memTotal').textContent = formatBytes(data.memory.total);

        updateChart(charts.memory, now, parseFloat(data.memory.usagePercent));
    }

    // Disk
    if (data.disk && data.disk.filesystems) {
        const diskList = document.getElementById('diskList');
        diskList.innerHTML = '';

        data.disk.filesystems.forEach(disk => {
            const diskItem = document.createElement('div');
            diskItem.className = 'disk-item';

            const usageClass = parseFloat(disk.usagePercent) > 80 ? 'high' : '';

            diskItem.innerHTML = `
                <div class="disk-header">
                    <span class="disk-name">${disk.mount || disk.fs}</span>
                    <span class="disk-usage">${disk.usagePercent}% used</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${usageClass}" style="width: ${disk.usagePercent}%"></div>
                </div>
                <div style="margin-top: 8px; font-size: 0.85em; color: #a0a8c5;">
                    ${formatBytes(disk.used)} / ${formatBytes(disk.size)} (${formatBytes(disk.available)} free)
                </div>
            `;

            diskList.appendChild(diskItem);
        });
    }

    // Network
    if (data.network) {
        const rxKB = (data.network.totalRx / 1024).toFixed(2);
        const txKB = (data.network.totalTx / 1024).toFixed(2);

        document.getElementById('networkRx').textContent = `${rxKB} KB/s`;
        document.getElementById('networkTx').textContent = `${txKB} KB/s`;

        updateChart(charts.network, now, [parseFloat(rxKB), parseFloat(txKB)]);
    }

    // GPU
    if (data.gpu && data.gpu.length > 0) {
        const gpuList = document.getElementById('gpuList');
        gpuList.innerHTML = '';

        data.gpu.forEach(gpu => {
            const gpuItem = document.createElement('div');
            gpuItem.className = 'gpu-item';

            gpuItem.innerHTML = `
                <div class="gpu-model">${gpu.model || 'Unknown GPU'}</div>
                <div class="gpu-details">
                    <span>Vendor: ${gpu.vendor || 'N/A'}</span>
                    <span>VRAM: ${gpu.vram ? gpu.vram + ' MB' : 'N/A'}</span>
                    <span>Temp: ${gpu.temperature !== 'N/A' ? gpu.temperature + '°C' : 'N/A'}</span>
                </div>
            `;

            gpuList.appendChild(gpuItem);
        });
    } else {
        document.getElementById('gpuList').innerHTML =
            '<div style="color: #a0a8c5;">No GPU detected or information unavailable</div>';
    }

    // Processes
    if (data.processes) {
        document.getElementById('processRunning').textContent = data.processes.running || 0;
        document.getElementById('processTotal').textContent = data.processes.all || 0;

        const tbody = document.getElementById('processTableBody');
        tbody.innerHTML = '';

        if (data.processes.list && data.processes.list.length > 0) {
            data.processes.list.forEach(process => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${process.pid}</td>
                    <td>${process.name}</td>
                    <td>${process.cpu}%</td>
                    <td>${process.mem}%</td>
                `;
                tbody.appendChild(row);
            });
        }
    }

    // Battery
    if (data.battery) {
        const batteryInfo = document.getElementById('batteryInfo');
        if (data.battery.hasBattery) {
            document.getElementById('batteryPercent').textContent =
                data.battery.percent !== 'N/A' ? `${data.battery.percent}%` : 'N/A';
            document.getElementById('batteryState').textContent =
                data.battery.charging ? '⚡ Charging' : '🔋 Discharging';
        } else {
            batteryInfo.innerHTML = '<div style="color: #a0a8c5;">No battery detected (Desktop system)</div>';
        }
    }

    // Update timestamp
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
}

// WebSocket connection
function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        const status = document.getElementById('connectionStatus');
        status.textContent = 'Connected';
        status.classList.add('connected');
        status.classList.remove('disconnected');

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            updateUI(data);
        } catch (error) {
            console.error('Error parsing data:', error);
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        const status = document.getElementById('connectionStatus');
        status.textContent = 'Disconnected';
        status.classList.remove('connected');
        status.classList.add('disconnected');

        // Attempt to reconnect
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('Attempting to reconnect...');
                connect();
            }, 5000);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Export to PDF
async function exportToPDF() {
    const button = document.getElementById('exportPdfBtn');
    button.textContent = '📄 Generating PDF...';
    button.disabled = true;

    try {
        const dashboard = document.getElementById('dashboard');

        // Use html2canvas to capture the dashboard
        const canvas = await html2canvas(dashboard, {
            scale: 2,
            backgroundColor: '#0a0e27',
            logging: false
        });

        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Add title
        pdf.setFontSize(20);
        pdf.setTextColor(0, 212, 255);
        pdf.text('System Resource Monitor Report', 105, 15, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setTextColor(160, 168, 197);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, 22, { align: 'center' });

        position = 30;

        // Add the captured image
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 267; // Remaining height after first page

        // Add extra pages if needed
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297;
        }

        // Save the PDF
        const filename = `system-monitor-report-${new Date().getTime()}.pdf`;
        pdf.save(filename);

        button.textContent = '✅ PDF Exported!';
        setTimeout(() => {
            button.textContent = '📄 Export to PDF';
            button.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error generating PDF:', error);
        button.textContent = '❌ Export Failed';
        setTimeout(() => {
            button.textContent = '📄 Export to PDF';
            button.disabled = false;
        }, 2000);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    connect();

    // PDF Export button
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
});
