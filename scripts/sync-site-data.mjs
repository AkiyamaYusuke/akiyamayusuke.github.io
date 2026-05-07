import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const assetConfigPath = path.join(rootDir, 'config', 'site-assets.json');
const projectDataPath = path.join(rootDir, 'data', 'projects.json');
const outputDir = path.join(rootDir, 'js', 'config');
const outputPath = path.join(outputDir, 'generated-site-data.js');

async function main() {
    const [assetText, projectText] = await Promise.all([
        fs.readFile(assetConfigPath, 'utf8'),
        fs.readFile(projectDataPath, 'utf8')
    ]);

    const assetConfig = JSON.parse(assetText);
    const projectCatalog = JSON.parse(projectText);
    const generatedAt = new Date().toISOString();

    const payload = {
        generatedAt,
        assets: assetConfig,
        projects: projectCatalog
    };

    const content = [
        'window.GeneratedSiteData = Object.freeze(',
        `${JSON.stringify(payload, null, 2)}`,
        ');',
        ''
    ].join('\n');

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
