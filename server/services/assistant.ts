import { getAssistantsList, createAssistant } from '../queries/assistant';
import { randomUUID } from 'crypto';

export async function fetchAssistants() {
  return await getAssistantsList();
}

export async function addAssistant(input: {
  name: string;
  roleType: 'assistant' | 'alumni';
  portraitUrl?: string;
  email?: string;
  instagram?: string;
  batch: string;
}) {
  return await createAssistant({
    id: randomUUID(),
    name: input.name,
    roleType: input.roleType,
    portraitUrl: input.portraitUrl || null,
    email: input.email || null,
    instagram: input.instagram || null,
    batch: input.batch
  });
}
