// Registry client — stub for future skill marketplace
// Will connect to TaseesAI skill registry API

export interface RegistrySkill {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
}

export async function searchRegistry(
  _query: string
): Promise<RegistrySkill[]> {
  // TODO: Implement registry API client
  return [];
}

export async function fetchSkill(
  _name: string
): Promise<{ skillJson: string } | null> {
  // TODO: Implement registry download
  return null;
}
