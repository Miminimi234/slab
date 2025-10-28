// Buffer polyfill - Use the global Buffer that's already set up in index.html
// Import the proper buffer package as fallback
import { Buffer as BufferPackage } from 'buffer';

// Use global Buffer if available, otherwise use the package
const Buffer = globalThis.Buffer || BufferPackage;

// Make Buffer globally available for browser compatibility
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).global = globalThis;
}

// Ensure process is available
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = {
    env: {},
    version: '',
    platform: 'browser',
    browser: true
  };
}

// AGGRESSIVE BUFFER POLYFILL
// Make Buffer available everywhere possible
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).globalThis = window;
}

// Also make it available on globalThis
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).global = globalThis;
}

// Set up process if needed
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = { env: {} };
}

// Ensure Buffer is available immediately
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export { Buffer };

