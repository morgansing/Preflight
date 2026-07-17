import { describe, expect, it } from "vitest";
import { isPrivateHost } from "./net-guard";

describe("net-guard", () => {
  it("flags loopback, private ranges, link-local and metadata hosts", () => {
    for (const host of [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "metadata.google.internal",
      "api.internal",
      "::1",
      "[::1]",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateHost(host), host).toBe(true);
    }
  });

  it("allows public hosts", () => {
    for (const host of [
      "example.com",
      "api.yourco.com",
      "172.15.0.1",
      "172.32.0.1",
      "8.8.8.8",
      "100.128.0.1",
      "internal-api.example.com",
    ]) {
      expect(isPrivateHost(host), host).toBe(false);
    }
  });
});
