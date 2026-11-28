import { EventEmitter } from 'events';

/** In-process feed so an open ops desk hears a sale the moment it is stored. */
const liveFeed = new EventEmitter();
liveFeed.setMaxListeners(100);

export function publishOpsEvent(event) {
    liveFeed.emit('event', { ...event, at: new Date().toISOString() });
}

export function subscribeOpsEvents(listener) {
    liveFeed.on('event', listener);
    return () => liveFeed.off('event', listener);
}
