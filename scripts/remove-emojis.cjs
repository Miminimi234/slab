#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function isDocFile(file) {
    return file.endsWith('.md') || file.endsWith('.txt');
}

function walk(dir) {
    const results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of list) {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            if (['node_modules', '.git', 'dist'].includes(dirent.name)) continue;
            results.push(...walk(full));
        } else if (dirent.isFile() && isDocFile(dirent.name)) {
            results.push(full);
        }
    }
    return results;
}

const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

function removeEmojisFromText(text) {
    return text.replace(emojiRegex, '');
}

function main() {
    const files = walk(root);
    if (!files.length) {
        console.log('No markdown/text files found to process.');
        return;
    }

    let totalChanged = 0;
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const cleaned = removeEmojisFromText(content);
            if (cleaned !== content) {
                fs.writeFileSync(file, cleaned, 'utf8');
                console.log(`Stripped emojis from: ${path.relative(root, file)}`);
                totalChanged++;
            }
        } catch (err) {
            console.error('Failed processing', file, err.message);
        }
    }

    console.log(`Done. Files modified: ${totalChanged}`);
}

main();
