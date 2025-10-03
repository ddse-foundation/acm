// StreamSink implementation
import type { StreamSink } from './types.js';

export class DefaultStreamSink implements StreamSink {
  private listeners = new Map<string, Array<(chunk: any) => void>>();

  attach(source: string, callback: (chunk: any) => void): void {
    if (!this.listeners.has(source)) {
      this.listeners.set(source, []);
    }
    this.listeners.get(source)!.push(callback);
  }

  emit(source: string, chunk: any): void {
    const callbacks = this.listeners.get(source);
    if (callbacks) {
      callbacks.forEach(cb => cb(chunk));
    }
  }

  close(source: string): void {
    this.listeners.delete(source);
  }
}
