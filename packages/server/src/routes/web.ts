import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { convert } from "html-to-text";
import { searchTavily } from "../lib/tavily";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireCreditsBalance } from "../middleware/require-credits-balance";

const searchSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(5),
});

const fetchSchema = z.object({
  url: z.string().url(),
  maxLength: z.number().optional().default(20000),
});

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
        const raw = await response.text();
        let text: string;

        if (contentType.includes("text/html") || contentType.includes("xhtml")) {
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
