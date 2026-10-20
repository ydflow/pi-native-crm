import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: vi.fn() }));

import { createMcpServer } from "./server";
import { allTools } from "./tools";
import { TOOL_CATALOG } from "./tools/catalog";

describe("anotações de segurança do MCP público", () => {
  it("cada handler do catálogo declara os quatro booleanos explicitamente", () => {
    expect(allTools.length).toBeGreaterThan(0);
    expect(new Set(allTools.map((tool) => tool.name))).toEqual(
      new Set(TOOL_CATALOG.map((tool) => tool.name)),
    );
    for (const tool of allTools) {
      for (const key of [
        "readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint",
      ]) {
        expect(tool, `${tool.name}.${key}`).toHaveProperty(`annotations.${key}`, expect.any(Boolean));
      }
    }
  });

  it("tools/list transmite as anotações dos handlers sem alterar o gate de escrita", async () => {
    const server = createMcpServer({
      organizationId: "00000000-0000-4000-8000-000000000001",
      role: "viewer",
      actor: { type: "user", id: "00000000-0000-4000-8000-000000000002" },
      apiTokenId: "token-de-teste",
      scopes: ["mcp:read"],
    }, "req-annotations");
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "teste-annotations", version: "0.0.0" });
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const listed = (await client.listTools()).tools;
      expect(listed).toHaveLength(allTools.length);
      const find = (name: string) => {
        const tool = listed.find((entry) => entry.name === name);
        expect(tool, name).toBeDefined();
        return tool!;
      };
      // Consultar/preencher texto é diferente de enviar ou persistir uma proposta.
      expect(find("crm_render_message_template").annotations).toMatchObject({
        readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
      });
      expect(find("crm_propose_contact_field").annotations).toMatchObject({
        readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false,
      });
      expect(find("crm_send_whatsapp_message").annotations).toMatchObject({
        readOnlyHint: false, idempotentHint: false, openWorldHint: true,
      });
      expect(find("crm_request_human_handoff").annotations).toMatchObject({
        readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true,
      });
      expect(find("crm_search_knowledge").annotations).toMatchObject({
        readOnlyHint: true, openWorldHint: true,
      });
      expect(find("crm_get_conversation_history").annotations).toMatchObject({
        readOnlyHint: true, openWorldHint: true,
      });
      expect(find("crm_resume_ai_attendance").annotations).toMatchObject({
        readOnlyHint: false, idempotentHint: false,
      });
      for (const definition of allTools) {
        expect(find(definition.name).annotations).toEqual(
          (definition as { annotations?: unknown }).annotations,
        );
      }
      // As anotações são dicas, não autorização. Sem mcp:write, não chega ao DB.
      const denied = await client.callTool({
        name: "crm_save_org_memory",
        arguments: { titulo: "Regra local", corpo: "Uma política da organização para teste." },
      });
      expect(denied.isError).toBe(true);
      expect(JSON.stringify(denied.content)).toContain("mcp:write");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
