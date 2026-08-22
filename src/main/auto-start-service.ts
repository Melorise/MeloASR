import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function desktopEscape(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('`', '\\`').replaceAll('$', '\\$')}"`;
}

export class AutoStartService {
  private readonly filePath = path.join(os.homedir(), '.config', 'autostart', 'meloasr.desktop');

  apply(enabled: boolean): void {
    if (!enabled) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=MeloASR',
        'Hidden=true',
        ''
      ].join('\n'), { mode: 0o644 });
      return;
    }
    const args = app.isPackaged ? [] : [app.getAppPath()];
    const command = [process.execPath, ...args].map(desktopEscape).join(' ');
    const contents = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=MeloASR',
      `Exec=${command}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      'Comment=MeloASR',
      ''
    ].join('\n');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, contents, { mode: 0o644 });
  }
}
