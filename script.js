let countdownInterval = null, isAutoEnabled = false, timeLeft = 3, audioCtx = null, measurementHistory = [], gauges = [];

const params = [
    { name: "Напруга первинна", unit: "кВ", min: 105, max: 115, normal: [108, 112], warning: [106, 114] },
    { name: "Напруга вторинна", unit: "кВ", min: 9.5, max: 10.5, normal: [9.8, 10.2], warning: [9.6, 10.4] },
    { name: "Струм навантаження", unit: "А", min: 50, max: 450, normal: [100, 350], warning: [60, 400] },
    { name: "Температура масла", unit: "°C", min: 30, max: 90, normal: [50, 75], warning: [40, 85] }
];

function initGauges() {
    params.forEach((p, i) => {
        const canvas = document.getElementById(`gauge${i}`);
        if (!canvas) return;
        gauges[i] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#2ecc71', 'rgba(0,0,0,0.1)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                    cutout: '80%'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
    });
}

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playAlarm() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function generateSensorData() {
    return params.map(p => {
        const rand = Math.random();
        let val = (rand > 0.95) ? (Math.random() > 0.5 ? p.max + 1.5 : p.min - 1.5) :
                  (rand > 0.80) ? (Math.random() > 0.5 ? p.warning[1] - 0.2 : p.warning[0] + 0.2) :
                  (p.normal[0] + Math.random() * (p.normal[1] - p.normal[0]));
        return val.toFixed(p.unit.includes('°') ? 0 : 1);
    });
}

function checkStatus(value, limits) {
    const v = parseFloat(value);
    if (v >= limits.normal[0] && v <= limits.normal[1]) return 'normal';
    return (v >= limits.warning[0] && v <= limits.warning[1]) ? 'warning' : 'danger';
}

function getSystemStatus(values) {
    const statuses = values.map((v, i) => checkStatus(v, params[i]));
    return statuses.includes('danger') ? "АВАРІЯ" : (statuses.includes('warning') ? "УВАГА" : "НОРМА");
}

function updateHistoryTable(data) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    const status = getSystemStatus(data);
    const color = status === 'АВАРІЯ' ? '#e74c3c' : (status === 'УВАГА' ? '#f39c12' : '#2ecc71');
    const row = `<tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
        <td style="padding: 10px;">${new Date().toLocaleTimeString('uk-UA')}</td>
        <td style="padding: 10px; color: ${color}; font-weight: bold;">${status}</td>
        <td style="padding: 10px;">${data[2]} А</td>
    </tr>`;
    tbody.insertAdjacentHTML('afterbegin', row);
    if (tbody.children.length > 5) tbody.removeChild(tbody.lastChild);
}

function updateDisplay(data) {
    let hasDanger = false;
    data.forEach((value, idx) => {
        const valElement = document.getElementById('param' + idx),
              indicator = document.getElementById('status' + idx),
              progress = document.getElementById('progress' + idx),
              card = document.getElementById('card' + idx),
              status = checkStatus(value, params[idx]);
        
        let currentColor = status === 'danger' ? '#e74c3c' : (status === 'warning' ? '#f39c12' : '#2ecc71');
        if (status === 'danger') hasDanger = true;

        if (valElement) valElement.textContent = value;
        if (indicator) {
            indicator.className = 'status-indicator' + (status === 'danger' ? ' status-critical' : '');
            indicator.style.color = currentColor;
            indicator.innerHTML = `●`;
        }
        if (card) {
            card.classList.remove('card-warning', 'card-danger');
            if (status !== 'normal') card.classList.add('card-' + status);
        }
        if (progress) {
            let percent = Math.min(Math.max(((value - params[idx].min) / (params[idx].max - params[idx].min)) * 100, 0), 100);
            progress.style.width = percent + '%';
            progress.style.backgroundColor = currentColor;
            progress.style.backgroundImage = 'none';
        }
        if (gauges[idx]) {
            let percent = Math.min(Math.max(((value - params[idx].min) / (params[idx].max - params[idx].min)) * 100, 0), 100);
            gauges[idx].data.datasets[0].data = [percent, 100 - percent];
            gauges[idx].data.datasets[0].backgroundColor[0] = currentColor;
            gauges[idx].update('none');
        }
    });
    if (hasDanger) playAlarm();
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('uk-UA');
    updateHistoryTable(data);
}

function manualUpdate() {
    initAudio();
    const data = generateSensorData();
    updateDisplay(data);
    measurementHistory.push({ time: new Date().toLocaleTimeString('uk-UA'), values: data });
}

function toggleAutoUpdate() {
    initAudio();
    const btn = document.getElementById('autoUpdateBtn'), statusLabel = document.getElementById('autoStatus'), countdownText = document.getElementById('countdown');
    if (!isAutoEnabled) {
        isAutoEnabled = true;
        btn.classList.replace('btn-success', 'btn-danger');
        statusLabel.textContent = 'Оновлення: ';
        countdownText.style.display = 'inline';
        countdownInterval = setInterval(() => {
            if (--timeLeft <= 0) { manualUpdate(); timeLeft = 3; }
            if (countdownText) countdownText.textContent = timeLeft;
        }, 1000);
    } else {
        isAutoEnabled = false;
        clearInterval(countdownInterval);
        btn.classList.replace('btn-danger', 'btn-success');
        statusLabel.textContent = 'Вимкнено';
        countdownText.style.display = 'none';
        timeLeft = 3;
    }
}

function exportToCSV() {
    if (!measurementHistory.length) return;
    let csv = "Час;Напруга 1;Напруга 2;Струм;Температура;СТАТУС\n";
    measurementHistory.forEach(r => csv += `${r.time};${r.values.join(';')};${getSystemStatus(r.values)}\n`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Report_${Date.now()}.csv`;
    link.click();
}

const powerChart = new Chart(document.getElementById('powerChart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Навантаження (%)', data: [], borderColor: '#3498db', tension: 0.4, fill: true, backgroundColor: 'rgba(52, 152, 219, 0.1)' }] },
    options: { responsive: true, maintainAspectRatio: false }
});

setInterval(() => {
    powerChart.data.labels.push(new Date().toLocaleTimeString());
    powerChart.data.datasets[0].data.push((40 + Math.random() * 20).toFixed(1));
    if (powerChart.data.labels.length > 10) { powerChart.data.labels.shift(); powerChart.data.datasets[0].data.shift(); }
    powerChart.update('none');
}, 3000);

document.addEventListener('DOMContentLoaded', () => {
    initGauges(); manualUpdate();
    document.getElementById('updateBtn').addEventListener('click', manualUpdate);
    document.getElementById('autoUpdateBtn').addEventListener('click', toggleAutoUpdate);
    document.getElementById('themeToggle').addEventListener('click', () => document.body.classList.toggle('dark-theme'));
});