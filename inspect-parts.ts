import { db } from "c:/Users/Raghav/Desktop/knightcode/packages/database/src/client";

async function main() {
  const session = await db.session.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    console.log("No session found.");
    return;
  }

  console.log(`Session: ${session.id} - ${session.title}`);
  const messages = session.messages as any[];
  messages.forEach((msg, idx) => {
    console.log(`\nMessage ${idx + 1} - Role: ${msg.role}`);
    if (msg.role === "assistant" && msg.parts) {
      msg.parts.forEach((part: any, pIdx: number) => {
        const toolName =
          part.type === "dynamic-tool"
            ? part.toolName
            : part.type.startsWith("tool-")
            ? part.type.slice("tool-".length)
            : null;

        if (toolName) {
          console.log(`  Part ${pIdx + 1}: Tool Call - ${toolName}`);
          if (part.input) {
            console.log(`    Input: ${JSON.stringify(part.input)}`);
          }
          if (part.output) {
            console.log(`    Output: ${JSON.stringify(part.output)}`);
          }
        } else {
          console.log(`  Part ${pIdx + 1}: ${part.type} - ${part.text?.slice(0, 60)}...`);
        }
      });
    }
  });
}

main().catch(console.error).finally(() => db.$disconnect());
