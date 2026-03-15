// /health — Quick codebase health analysis
export async function handleHealth(args: string): Promise<string> {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    const { execSync } = require('child_process');
    const cwd = process.cwd();

    const lines: string[] = ['Codebase Health Report', '='.repeat(40), ''];

    // Package info
    const pkgPath = path.join(cwd, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJSON(pkgPath);
      lines.push(`Project: ${pkg.name || 'unnamed'} v${pkg.version || '0.0.0'}`);
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;
      lines.push(`Dependencies: ${depCount} prod, ${devDepCount} dev`);
      lines.push('');
    }

    // Git status
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8', timeout: 5000 });
      const modified = (status.match(/^ M/gm) || []).length;
      const untracked = (status.match(/^\?\?/gm) || []).length;
      const staged = (status.match(/^[AMDR] /gm) || []).length;
      lines.push(`Git: ${modified} modified, ${untracked} untracked, ${staged} staged`);

      const branch = execSync('git branch --show-current', { encoding: 'utf8', timeout: 5000 }).trim();
      lines.push(`Branch: ${branch}`);

      const commitCount = execSync('git rev-list --count HEAD 2>/dev/null || echo 0', { encoding: 'utf8', timeout: 5000 }).trim();
      lines.push(`Commits: ${commitCount}`);
    } catch {
      lines.push('Git: not a git repository');
    }
    lines.push('');

    // File counts by type
    try {
      const allFiles = execSync('find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" 2>/dev/null | head -500', {
        encoding: 'utf8', timeout: 10000
      });
      const files = allFiles.trim().split('\n').filter(Boolean);
      const exts: Record<string, number> = {};
      for (const f of files) {
        const ext = path.extname(f) || '(none)';
        exts[ext] = (exts[ext] || 0) + 1;
      }
      const sorted = Object.entries(exts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      lines.push('File types:');
      for (const [ext, count] of sorted) {
        lines.push(`  ${ext}: ${count}`);
      }
      lines.push(`  Total: ${files.length} files`);
    } catch {
      lines.push('Files: unable to scan');
    }
    lines.push('');

    // TODO/FIXME count
    try {
      const todos = execSync('grep -r "TODO\\|FIXME\\|HACK\\|XXX" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" -c . 2>/dev/null | tail -1 || echo "0"', {
        encoding: 'utf8', timeout: 10000
      });
      const todoLines = todos.trim().split('\n');
      let totalTodos = 0;
      for (const line of todoLines) {
        const count = parseInt(line.split(':').pop() || '0');
        if (!isNaN(count)) totalTodos += count;
      }
      lines.push(`TODOs/FIXMEs: ${totalTodos}`);
    } catch {
      lines.push('TODOs: unable to scan');
    }

    return lines.join('\n');
  } catch (e: any) {
    return `Health check error: ${e.message}`;
  }
}
