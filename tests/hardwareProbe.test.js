import test from "node:test";
import assert from "node:assert/strict";
import { redact } from "../src/hardwareProbe.js";

test("redacts stable network identifiers from raw probe output", () => {
  const redacted = redact(`
    MAC Address: 1c:f6:4c:47:f3:23
    IPv4 Addresses: 192.168.1.48
    Router: 192.168.1.254
    Addresses: fd33:7220:a6bf:ac68:4b5:7a5b:876f:7fc8
    Network Signature: IPv4.Router=192.168.1.254;IPv4.RouterHardwareAddress=24:0b:88:45:2e:50
    NetworkSignatureHash: {length = 20, bytes = 0x29e35f58065723bc2f7ee9652ed1a19fc495f06b}
  `);

  assert.doesNotMatch(redacted, /1c:f6:4c:47:f3:23/i);
  assert.doesNotMatch(redacted, /192\.168\.1\.48/);
  assert.doesNotMatch(redacted, /fd33:7220/i);
  assert.match(redacted, /\[mac-redacted\]/);
  assert.match(redacted, /\[ip-redacted\]/);
  assert.match(redacted, /\[redacted\]/);
});
