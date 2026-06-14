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

// Stronger multi-word phrases that clearly indicate AYCE — single hits pass
const REVIEW_STRONG_KEYWORDS = [
  'all you can eat', 'ayce', 'all-you-can-eat',
  'unlimited food', 'unlimited eat', 'eat as much',
  'as much as you want', 'unlimited buffet',
]

// Weaker single words that require 2+ hits to pass
const REVIEW_WEAK_KEYWORDS = [
  'buffet', 'unlimited', 'endless',
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

  if (REVIEW_STRONG_KEYWORDS.some(kw => corpus.includes(kw))) return true

  const weakHits = REVIEW_WEAK_KEYWORDS.filter(kw => corpus.includes(kw)).length
  return weakHits >= 2
}
