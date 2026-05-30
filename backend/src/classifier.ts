const PASS_NAME_KEYWORDS = [
  'buffet', 'all you can eat', 'ayce', 'smorgasbord',
  'churrascaria', 'brazilian grill', 'brazilian steakhouse',
  'korean bbq', 'hot pot', 'shabu', 'yakiniku',
  'unlimited', 'endless',
]

const REJECT_NAME_KEYWORDS = [
  'delivery', 'catering', 'grocery', 'supermarket', 'bakery',
  'food truck', 'convenience',
]

const REJECT_TYPES = ['grocery_or_supermarket', 'convenience_store', 'bakery']

const REVIEW_PASS_KEYWORDS = [
  'buffet', 'all you can eat', 'unlimited', 'ayce',
  'endless', 'refill', 'as much as you want',
]

export type ClassifyResult = 'pass' | 'reject' | 'uncertain'

export function classifyByNameAndTypes(name: string, types: string[]): ClassifyResult {
  const n = name.toLowerCase()

  if (PASS_NAME_KEYWORDS.some(kw => n.includes(kw))) return 'pass'
  if (REJECT_NAME_KEYWORDS.some(kw => n.includes(kw))) return 'reject'
  if (REJECT_TYPES.some(t => types.includes(t))) return 'reject'
  if (types.includes('meal_delivery') && !types.includes('restaurant')) return 'reject'

  return 'uncertain'
}

export function classifyByReviews(
  reviews: Array<{ text: string }>,
  editorialSummary?: string,
): boolean {
  const corpus = [
    editorialSummary ?? '',
    ...reviews.map(r => r.text),
  ].join(' ').toLowerCase()

  return REVIEW_PASS_KEYWORDS.some(kw => corpus.includes(kw))
}
