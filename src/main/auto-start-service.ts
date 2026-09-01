import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAutoStartAction } from './auto-start-policy';

export class AutoStartService {
  private readonly filePath = path.join(os.homedir(), '.config', 'autostart', 'tama-asr.desktop');

  apply(enabled: boolean): void {
    const action = resolveAutoStartAction(app.isPackaged, enabled);
    if (action === 'unchanged') return;
    if (action === 'write-hidden-override') {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=TamaASR',
        'Hidden=true',
        ''
      ].join('\n'), { mode: 0o644 });
      return;
    }
    fs.rmSync(this.filePath, { force: true });
  }
}
