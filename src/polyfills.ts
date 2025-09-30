// Lightweight Buffer polyfill for browser environments
// Ensures globalThis.Buffer is available for libraries expecting Node's Buffer
import * as buffer from 'buffer';

// Assign Buffer to global if not already present
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = (buffer as any).Buffer;
}

// Optionally, provide global process object parts if needed by deps
if (!(globalThis as any).process) {
  (globalThis as any).process = {} as any;
}
if (!(globalThis as any).process?.env) {
  (globalThis as any).process.env = {} as any;
}
