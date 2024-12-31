
export const MODELS = {
  CLAUDE: 'claude',
  GPT: 'gpt',
  DEEP_SEEK: 'deep-seek',
}

export type Model = typeof MODELS[keyof typeof MODELS];
