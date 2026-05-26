import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { convert } from "html-to-text";
import dns from "node:dns/promises";
import { z } from "zod";
import { searchTavily } from "../lib/tavily";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireCreditsBalance } from "../middleware/require-credits-balance";

const searchSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(5),
});

const fetchSchema = z.object({
  url: z.url(),
  maxLength: z.number().int().min(1).max(200_000).optional().default(20_000),
});

function isPrivateIp(ip: string): boolean {
  // Minimal: expand as needed (RFC1918, loopback, link-local, ULA, etc.)
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

async function assertSafeTarget(rawUrl: string) {
  const u = new URL(rawUrl);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("Only http/https URLs are allowed");
  }
  const records = await dns.lookup(u.hostname, { all: true });
  if (records.some((r) => isPrivateIp(r.address))) {
    throw new Error("Target host is not allowed");
  }
}

const app = new Hono<AuthenticatedEnv>()
  .post(
    "/search",
    requireCreditsBalance,
    zValidator("json", searchSchema),
    async (c) => {
      const { query, maxResults } = c.req.valid("json");
      try {
        const results = await searchTavily(query, maxResults);
        return c.json(results);
      } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
      }
    },
  )
  .post(
    "/fetch",
    requireCreditsBalance,
    zValidator("json", fetchSchema),
    async (c) => {
      const { url, maxLength } = c.req.valid("json");
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; KnightCode/1.0; +https://knightcode.dev)",
            Accept: "text/html, application/xhtml+xml, text/plain",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          return c.json(
            { error: `HTTP ${response.status}: ${response.statusText}` },
            502,
          );
        }
        const contentType = response.headers.get("content-type") ?? "";
        const contentLength = Number(
          response.headers.get("content-length") ?? "0",
        );
        if (contentLength > maxLength * 5) {
          return c.json({ error: "Response too large to fetch safely" }, 413);
        }
        const raw = await response.text();
        let text: string;

        if (
          contentType.includes("text/html") ||
          contentType.includes("xhtml")
        ) {
          text = convert(raw, {
            wordwrap: 120,
            selectors: [
              { selector: "img", format: "skip" },
              { selector: "script", format: "skip" },
              { selector: "style", format: "skip" },
              { selector: "nav", format: "skip" },
              { selector: "footer", format: "skip" },
              { selector: "a", options: { ignoreHref: true } },
            ],
          });
        } else {
          text = raw;
        }

        const truncated = text.length > maxLength;
        return c.json({
          content: truncated ? text.slice(0, maxLength) : text,
          truncated,
          totalLength: text.length,
          url,
        });
      } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
      }
    },
  );

export default app;
