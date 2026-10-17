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

function hasWholeWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text);
}

function hasAnyWholeWord(text: string, terms: string[]): boolean {
  return terms.some((term) => hasWholeWord(text, term));
}

export function routeTaskToAgent(text: string): AgentDefinition {
  const normalized = text.normalize('NFKC').toLowerCase();

  // Match whole words so "webhook" does not hit the content keyword "hook".
  if (hasAnyWholeWord(normalized, ['youtube', 'shorts', 'reels', 'caption', 'skrip', 'script', 'hook', 'konten', 'video'])) {
    return AGENT_REGISTRY[0];
  }
  if (hasAnyWholeWord(normalized, ['research', 'riset', 'bandingkan', 'compare', 'sumber', 'referensi', 'analisis', 'analysis'])) {
    return AGENT_REGISTRY[1];
  }
  if (hasAnyWholeWord(normalized, ['workflow', 'otomasi', 'automation', 'n8n', 'webhook', 'integrasi', 'integrate'])) {
    return AGENT_REGISTRY[2];
  }
  return AGENT_REGISTRY[3];
}
