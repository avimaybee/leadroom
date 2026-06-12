const fs = require('fs');
const path = require('path');

function removeEdge(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      removeEdge(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      if (original.includes("export const runtime = 'edge';")) {
        const updated = original.replace(/export const runtime = 'edge';\r?\n?/g, "");
        fs.writeFileSync(fullPath, updated);
        console.log('Fixed: ' + fullPath);
      }
    }
  }
}

removeEdge('src/app');
