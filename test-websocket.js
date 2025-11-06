const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', function open() {
  console.log('✅ WebSocket 연결 성공!');
});

ws.on('message', function message(data) {
  const systemInfo = JSON.parse(data);
  console.log('\n========== 시스템 모니터링 데이터 ==========');
  console.log(`📅 시간: ${new Date().toLocaleString()}`);
  console.log(`\n🔥 CPU:`);
  console.log(`   - 모델: ${systemInfo.cpu.brand}`);
  console.log(`   - 코어: ${systemInfo.cpu.physicalCores}개 (${systemInfo.cpu.cores} 스레드)`);
  console.log(`   - 사용률: ${systemInfo.cpu.load}%`);
  console.log(`   - 온도: ${systemInfo.cpu.temperature}°C`);

  console.log(`\n💾 메모리:`);
  console.log(`   - 사용량: ${(systemInfo.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB / ${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`   - 사용률: ${systemInfo.memory.usagePercent}%`);

  console.log(`\n🌐 네트워크:`);
  console.log(`   - 다운로드: ${(systemInfo.network.totalRx / 1024).toFixed(2)} KB/s`);
  console.log(`   - 업로드: ${(systemInfo.network.totalTx / 1024).toFixed(2)} KB/s`);

  console.log(`\n💿 디스크:`);
  systemInfo.disk.filesystems.forEach(disk => {
    console.log(`   - ${disk.mount}: ${disk.usagePercent}% 사용중`);
  });

  console.log(`\n⚙️ 프로세스:`);
  console.log(`   - 실행 중: ${systemInfo.processes.running}`);
  console.log(`   - 전체: ${systemInfo.processes.all}`);

  console.log('\n✅ 모니터링 시스템이 정상 작동 중입니다!');
  console.log('==========================================\n');

  // 한 번만 보여주고 종료
  ws.close();
  process.exit(0);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket 에러:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏱️ 타임아웃');
  process.exit(1);
}, 5000);
