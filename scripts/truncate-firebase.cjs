#!/usr/bin/env node
/*
  scripts/truncate-firebase.cjs

  Safe helper to truncate (delete) data from a Firebase Realtime Database using
  the Admin SDK. This script intentionally defaults to a dry-run and asks for
  confirmation before performing a destructive delete.

  Usage examples:
    # Dry-run (default) - lists top-level keys and counts
    node scripts/truncate-firebase.cjs --serviceAccount ./service-account.json --databaseUrl https://your-db.firebaseio.com

    # Actually delete the specified path (root by default)
    node scripts/truncate-firebase.cjs --serviceAccount ./service-account.json --databaseUrl https://your-db.firebaseio.com --path / --yes

  Notes:
  - You must provide a Firebase service account JSON (path) via --serviceAccount
    or the FIREBASE_SERVICE_ACCOUNT env var (content of the JSON). If you pass
    the JSON content in the env var, it must be valid JSON string.
  - The script requires the `firebase-admin` npm package. Install with:
      npm install firebase-admin

  Safety:
  - By default the script runs in dry-run mode and will NOT delete anything.
  - To perform deletion, pass --yes to skip the interactive confirmation.

*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg || typeof arg !== 'string') continue;
        if (arg.startsWith('--')) {
            // Support both --flag=value and --flag value
            const eq = arg.indexOf('=');
            if (eq !== -1) {
                const k = arg.slice(2, eq);
                const v = arg.slice(eq + 1);
                out[k] = v === undefined ? true : v;
            } else {
                const k = arg.slice(2);
                const next = args[i + 1];
                if (next !== undefined && typeof next === 'string' && !next.startsWith('--')) {
                    out[k] = next;
                    i++; // consume next token as value
                } else {
                    out[k] = true;
                }
            }
        }
    }
    return out;
}

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

(async function main() {
    const args = parseArgs();
    const svcPath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const svcEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const dbUrl = args.databaseUrl || process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
    const targetPath = typeof args.path === 'string' ? args.path : (args.path === true ? '/' : '/');
    const assumeYes = !!args.yes;
    const dryRunExplicit = args.dryRun !== undefined ? !!args.dryRun : undefined;

    // Prefer explicit dry-run flag if provided; otherwise default to dry-run unless --yes is passed.
    const dryRun = dryRunExplicit !== undefined ? dryRunExplicit : !assumeYes;

    if (!svcPath && !svcEnv) {
        console.error('\nERROR: Service account JSON path or FIREBASE_SERVICE_ACCOUNT env var is required.');
        console.error('Provide --serviceAccount=./service-account.json or set FIREBASE_SERVICE_ACCOUNT to JSON content.');
        process.exit(2);
    }

    if (!dbUrl) {
        console.error('\nERROR: Database URL is required. Pass --databaseUrl=https://<your-db>.firebaseio.com or set FIREBASE_DATABASE_URL or VITE_FIREBASE_DATABASE_URL.');
        process.exit(2);
    }

    let serviceAccount;
    try {
        if (svcEnv) {
            serviceAccount = JSON.parse(svcEnv);
        } else {
            const resolved = path.resolve(svcPath);
            // Helpful error when file not found
            if (!fs.existsSync(resolved)) {
                console.error(`\nERROR: Service account file not found at: ${resolved}`);
                process.exit(2);
            }
            const raw = fs.readFileSync(resolved, 'utf8');
            serviceAccount = JSON.parse(raw);
        }
    } catch (err) {
        console.error('\nERROR: Failed to load/parse service account JSON:', (err && err.message) ? err.message : err);
        if (svcPath) {
            try {
                console.error('Attempted path:', path.resolve(svcPath));
            } catch { }
        }
        process.exit(2);
    }

    // Try to require firebase-admin
    let admin;
    try {
        admin = require('firebase-admin');
    } catch (err) {
        console.error('\nERROR: `firebase-admin` module not found. Install it with: npm install firebase-admin');
        process.exit(2);
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl,
        });
    } catch (err) {
        console.error('\nERROR: Failed to initialize firebase-admin:', err.message || err);
        process.exit(2);
    }

    const db = admin.database();
    const ref = db.ref(targetPath);

    console.log('\nFirebase truncate helper');
    console.log('  Database URL:', dbUrl);
    console.log('  Target path:', targetPath);
    console.log('  Dry run:', dryRun ? 'YES' : 'NO');

    try {
        const snap = await ref.once('value');
        const val = snap.val();

        if (val === null) {
            console.log('\nNothing found at target path. Nothing to delete.');
            process.exit(0);
        }

        // If this is an object, summarize child keys
        if (typeof val === 'object' && !Array.isArray(val)) {
            const keys = Object.keys(val);
            console.log(`\nFound ${keys.length} top-level child(ren) under ${targetPath}:`);
            const max = Math.min(keys.length, 200);
            for (let i = 0; i < max; i++) {
                const k = keys[i];
                console.log(`  - ${k}`);
            }
            if (keys.length > max) console.log(`  ... and ${keys.length - max} more`);
        } else {
            console.log('\nFound non-object value at target path. This will be removed if confirmed.');
            console.log('Value preview:', JSON.stringify(val).slice(0, 400));
        }

        if (dryRun) {
            console.log('\nDry-run mode: no data will be deleted.');
            console.log('To actually delete, re-run with --yes.');
            process.exit(0);
        }

        if (!assumeYes) {
            const answer = String(await ask('Are you sure you want to DELETE the data at this path? This is irreversible. (yes/no) ')).trim().toLowerCase();
            if (answer !== 'yes' && answer !== 'y') {
                console.log('Aborted by user. Nothing was deleted.');
                process.exit(0);
            }
        }

        console.log('\nDeleting...');
        await ref.remove();
        console.log('Delete completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('\nERROR: Failed during operation:', err && err.message ? err.message : err);
        process.exit(1);
    }
})();
