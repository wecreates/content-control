// Test-process-only guard: no provider or other off-machine connections.
import net from 'node:net';
import {syncBuiltinESMExports} from 'node:module';
const local = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = normalized[0];
  const host = options && typeof options === 'object'
    ? options.host || options.hostname || 'localhost'
    : typeof normalized[1] === 'string' ? normalized[1] : 'localhost';
  if (!local(host)) throw new Error(`SECURITY_SMOKE_NONLOCAL_CONNECTION_BLOCKED: ${host}`);
  return Reflect.apply(connect, this, args);
};
const fetch = globalThis.fetch;
globalThis.fetch = function (input, ...args) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) throw new Error(`SECURITY_SMOKE_NONLOCAL_FETCH_BLOCKED: ${url.hostname}`);
  return Reflect.apply(fetch, this, [input, ...args]);
};
syncBuiltinESMExports();
