import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';

export type GpuInfo = {
  name: string;
  vramTotalMb: number;
  vramUsedMb: number;
  utilizationPct: number;
  temperatureC: number;
};

export type SystemInternals = {
  generatedAt: string;
  local: boolean;
  host: string;
  uptimeHours: number;
  cpu: { model: string; cores: number; usagePct: number | null };
  ram: { totalMb: number; usedMb: number; usedPct: number };
  disk: { drive: string; totalGb: number; freeGb: number } | null;
  gpu: GpuInfo | null;
  pressure: { ram: boolean; vram: boolean };
};

function cpuTimes() {
  return os.cpus().reduce(
    (acc, c) => {
      acc.idle += c.times.idle;
      acc.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
      return acc;
    },
    { idle: 0, total: 0 }
  );
}

async function sampleCpuUsage(ms = 150): Promise<number | null> {
  try {
    const a = cpuTimes();
    await new Promise(r => setTimeout(r, ms));
    const b = cpuTimes();
    const total = b.total - a.total;
    if (total <= 0) return null;
    return Math.round((1 - (b.idle - a.idle) / total) * 100);
  } catch {
    return null;
  }
}

function readDisk(): SystemInternals['disk'] {
  try {
    const drive = process.platform === 'win32' ? 'C:\\' : '/';
    const s = fs.statfsSync(drive);
    const totalGb = (s.blocks * s.bsize) / 1e9;
    const freeGb = (s.bavail * s.bsize) / 1e9;
    return { drive, totalGb: Math.round(totalGb), freeGb: Math.round(freeGb) };
  } catch {
    return null;
  }
}

// Read-only GPU probe. nvidia-smi query is the only dependency-free way to read
// VRAM on Windows; it mutates nothing and is absent on hosted, where the catch
// path returns null and the UI hides the strip.
function readGpu(): Promise<GpuInfo | null> {
  return new Promise(resolve => {
    try {
      const child = execFile(
        'nvidia-smi',
        ['--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu', '--format=csv,noheader,nounits'],
        { timeout: 1500, windowsHide: true },
        (err, stdout) => {
          if (err || !stdout.trim()) return resolve(null);
          const [name, total, used, util, temp] = stdout.trim().split('\n')[0].split(',').map(x => x.trim());
          resolve({
            name,
            vramTotalMb: Number(total) || 0,
            vramUsedMb: Number(used) || 0,
            utilizationPct: Number(util) || 0,
            temperatureC: Number(temp) || 0,
          });
        }
      );
      child.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

export async function getSystemInternals(opts: { sampleCpu?: boolean } = {}): Promise<SystemInternals> {
  const totalMb = Math.round(os.totalmem() / 1048576);
  const usedMb = Math.round((os.totalmem() - os.freemem()) / 1048576);
  const usedPct = Math.round((usedMb / totalMb) * 100);
  const [gpu, usagePct] = await Promise.all([readGpu(), opts.sampleCpu === false ? Promise.resolve(null) : sampleCpuUsage()]);
  const cpus = os.cpus();
  return {
    generatedAt: new Date().toISOString(),
    local: !process.env.VERCEL,
    host: os.hostname(),
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    cpu: { model: cpus[0]?.model?.trim() || 'unknown', cores: cpus.length, usagePct },
    ram: { totalMb, usedMb, usedPct },
    disk: readDisk(),
    gpu,
    pressure: {
      ram: usedPct >= 92,
      vram: !!gpu && gpu.vramTotalMb > 0 && gpu.vramUsedMb / gpu.vramTotalMb >= 0.92,
    },
  };
}
