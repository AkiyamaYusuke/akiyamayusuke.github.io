import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const assetConfigPath = path.join(rootDir, 'config', 'site-assets.json');
const projectDataPath = path.join(rootDir, 'data', 'projects.json');
const circleGalleryPath = path.join(rootDir, 'config', 'portfolio-circle-gallery.json');
const siteCopyPath = path.join(rootDir, 'data', 'site-copy.json');
const outputDir = path.join(rootDir, 'js', 'config');
const outputPath = path.join(outputDir, 'generated-site-data.js');

// 与前端加载链保持一致：本地个人覆盖 <base>.local.json 存在时优先，否则读提交的实例 JSON。
async function readContent(canonicalPath) {
    const localPath = canonicalPath.replace(/\.json$/, '.local.json');
    try {
        await fs.access(localPath);
        return fs.readFile(localPath, 'utf8');
    } catch {
        return fs.readFile(canonicalPath, 'utf8');
    }
}

async function main() {
    const [assetText, projectText, circleGalleryText, siteCopyText] = await Promise.all([
        readContent(assetConfigPath),
        readContent(projectDataPath),
        readContent(circleGalleryPath),
        readContent(siteCopyPath)
    ]);

    const assetConfig = JSON.parse(assetText);
    const projectCatalog = JSON.parse(projectText);
    const circleGallery = JSON.parse(circleGalleryText);
    const siteCopy = JSON.parse(siteCopyText);
    const generatedAt = new Date().toISOString();

    const payload = {
        generatedAt,
        assets: assetConfig,
        projects: projectCatalog,
        circleGallery,
        siteCopy
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
