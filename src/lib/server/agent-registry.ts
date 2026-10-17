export type AgentId =
  | 'content-studio'
  | 'research-agent'
  | 'workflow-planner'
  | 'strategy-planner';

export type AgentDefinition = {
  id: AgentId;
  name: string;
  description: string;
  capabilities: string[];
};

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: 'content-studio',
    name: 'Content Studio',
    description: 'Plans scripts, hooks, captions, and publishing metadata.',
    capabilities: ['youtube', 'shorts', 'reels', 'caption', 'script', 'hook', 'content']
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Plans research, comparison, source gathering, and evidence summaries.',
    capabilities: ['research', 'riset', 'compare', 'bandingkan', 'sources', 'sumber', 'analysis']
  },
  {
    id: 'workflow-planner',
    name: 'Workflow Planner',
    description: 'Plans repeatable automations and workflow integration steps.',
    capabilities: ['workflow', 'automation', 'otomasi', 'n8n', 'webhook', 'integrasi']
  },
  {
    id: 'strategy-planner',
    name: 'Strategy & Planner',
    description: 'Breaks general requests into an actionable plan.',
    capabilities: ['planning', 'strategy', 'general']
  }
];

export function routeTaskToAgent(text: string): AgentDefinition {
  const normalized = text.normalize('NFKC').toLowerCase();
  if (['youtube', 'shorts', 'reels', 'caption', 'skrip', 'script', 'hook', 'konten', 'video'].some((term) => normalized.includes(term))) {
    return AGENT_REGISTRY[0];
  }
  if (['research', 'riset', 'bandingkan', 'compare', 'sumber', 'referensi', 'analisis', 'analysis'].some((term) => normalized.includes(term))) {
    return AGENT_REGISTRY[1];
  }
  if (['workflow', 'otomasi', 'automation', 'n8n', 'webhook', 'integrasi', 'integrate'].some((term) => normalized.includes(term))) {
    return AGENT_REGISTRY[2];
  }
  return AGENT_REGISTRY[3];
}
