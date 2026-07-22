export type SkillUsage = { name: string; category: string; useCount: number };
export type McpStatus = { name: string; connected: boolean; tools: number };
export type ToolkitData = { topSkills: SkillUsage[]; mcpServers: McpStatus[] };
