import { StatementColumnMapping, StatementFormatProfile, LearnedMerchantRule } from '../types/expenses';
import { PlannerExpenseLineItem, getPlannerExpenseCatalog } from './plannerCategories';
import { getCloudConfig } from '../auth/config';
import { AuthService } from '../auth/AuthService';

const STORAGE_KEY_PROFILES = 'retirement_planner_statement_profiles';
const STORAGE_KEY_RULES = 'retirement_planner_merchant_rules';
const STORAGE_KEY_GEMINI_KEY = 'retirement_planner_gemini_api_key';

let inMemoryProfiles: StatementFormatProfile[] = [];
let inMemoryRules: LearnedMerchantRule[] = [];

// --- Normalization & Fingerprinting ---

/**
 * Normalizes raw merchant strings by stripping POS wrappers, store numbers,
 * corporate suffixes, order hashes, and extraneous punctuation.
 */
export function normalizeMerchant(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();

  // Strip POS and payment gateway prefixes
  str = str.replace(/^(TST\s*\*|SQ\s*\*|SP\s*\*|PY\s*\*|PAYPAL\s*\*|GOOGLE\s*\*|APPLE\.COM\s*\*|AMAZON\s*MKTPL\s*\*|AMAZON\.COM\s*\*|AMZN\s*MKTP\s*\*)/i, '');

  // Amazon specific: if it contains amazon, normalize to AMAZON
  if (/\bAMAZON\b/i.test(raw)) {
    return 'AMAZON';
  }

  // Strip common store/order numbers: e.g. #192, #0265, #2550
  str = str.replace(/#\s*\d+/g, ' ');

  // Strip freestanding 3+ digit numbers at end or middle (like 2560 in THE HOME DEPOT 2560, or SHELL OIL 57543580203)
  str = str.replace(/\b\d{3,}\b/g, ' ');

  // Strip STORE numbers (e.g. STORE 1084)
  str = str.replace(/\bSTORE\s*#?\d+\b/gi, ' ');

  // Strip corporate suffixes (including LL abbreviation)
  str = str.replace(/\b(INC|LLC|L\.L\.C\.|LTD|CORP|CO|LL)\b/gi, ' ');

  // Collapse multiple spaces and clean edge punctuation
  str = str.replace(/[*_#,-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Return uppercase for consistent dictionary matching
  return str.toUpperCase();
}

/**
 * Computes a deterministic fingerprint from CSV column headers.
 */
export function calculateHeaderFingerprint(headers: string[]): string {
  const normalized = headers
    .map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
    .filter(Boolean)
    .sort();
  return normalized.join('|');
}

/**
 * Heuristically inspects headers and sample rows to guess column mapping and sign convention.
 */
export function guessColumnMapping(headers: string[], sampleRows: string[][] = []): StatementColumnMapping {
  const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // 1. Date column
  let dateCol = headers[0] || '';
  const dateIdx = cleanHeaders.findIndex(h => h.includes('transactiondate') || h === 'date' || h.includes('txndate'));
  const postDateIdx = cleanHeaders.findIndex(h => h.includes('postdate'));
  if (dateIdx !== -1) {
    dateCol = headers[dateIdx];
  } else if (postDateIdx !== -1) {
    dateCol = headers[postDateIdx];
  } else {
    const fallbackDateIdx = cleanHeaders.findIndex(h => h.includes('date'));
    if (fallbackDateIdx !== -1) dateCol = headers[fallbackDateIdx];
  }

  // 2. Description column
  let descCol = headers[1] || '';
  const descIdx = cleanHeaders.findIndex(
    h => h.includes('description') || h.includes('merchant') || h.includes('payee') || h.includes('memo') || h.includes('name')
  );
  if (descIdx !== -1) {
    descCol = headers[descIdx];
  }

  // 3. Amount / Debit / Credit mode
  const debitIdx = cleanHeaders.findIndex(h => h === 'debit' || h.includes('debitamount') || h === 'withdrawal');
  const creditIdx = cleanHeaders.findIndex(h => h === 'credit' || h.includes('creditamount') || h === 'deposit');
  const isSplit = debitIdx !== -1 && creditIdx !== -1;

  let amountCol = '';
  if (!isSplit) {
    const amtIdx = cleanHeaders.findIndex(h => h === 'amount' || h.includes('amt') || h.includes('spend'));
    if (amtIdx !== -1) {
      amountCol = headers[amtIdx];
    } else {
      // Fallback to last column if unknown
      amountCol = headers[headers.length - 1] || '';
    }
  }

  // 4. Category & Type columns
  const catIdx = cleanHeaders.findIndex(h => h === 'category' || h.includes('group') || h.includes('categorygroup'));
  const categoryCol = catIdx !== -1 ? headers[catIdx] : undefined;

  const typeIdx = cleanHeaders.findIndex(h => h.includes('type'));
  const typeCol = typeIdx !== -1 ? headers[typeIdx] : undefined;

  const notesIdx = cleanHeaders.findIndex(h => h.includes('notes') || h.includes('memo') || h.includes('comment'));
  const notesCol = notesIdx !== -1 && notesIdx !== descIdx ? headers[notesIdx] : undefined;

  // 5. Sign convention detection (charges are negative vs positive)
  let chargesAreNegative = false;
  if (!isSplit && sampleRows.length > 0) {
    const rawAmtIdx = headers.indexOf(amountCol);
    const rawTypeIdx = typeCol ? headers.indexOf(typeCol) : -1;

    let negativeSaleCount = 0;
    let positiveSaleCount = 0;

    for (const row of sampleRows.slice(0, 15)) {
      if (!row || row.length <= rawAmtIdx) continue;
      const amtVal = parseFloat((row[rawAmtIdx] || '0').replace(/[$,]/g, '').trim());
      const typeVal = rawTypeIdx !== -1 ? (row[rawTypeIdx] || '').toLowerCase() : '';

      if (typeVal.includes('sale') || typeVal.includes('debit') || typeVal.includes('purchase')) {
        if (amtVal < 0) negativeSaleCount++;
        if (amtVal > 0) positiveSaleCount++;
      } else if (amtVal < 0) {
        negativeSaleCount++;
      }
    }

    if (negativeSaleCount > positiveSaleCount) {
      chargesAreNegative = true;
    }
  }

  return {
    dateColumn: dateCol,
    descriptionColumn: descCol,
    amountMode: isSplit ? 'split_debit_credit' : 'single',
    amountColumn: isSplit ? undefined : amountCol,
    debitColumn: isSplit ? headers[debitIdx] : undefined,
    creditColumn: isSplit ? headers[creditIdx] : undefined,
    chargesAreNegative,
    categoryColumn: categoryCol,
    typeColumn: typeCol,
    notesColumn: notesCol,
  };
}

// --- Format Profiles Persistent Storage ---

export function getSavedFormatProfiles(): StatementFormatProfile[] {
  if (typeof window === 'undefined') return [...inMemoryProfiles];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read format profiles from localStorage:', err);
  }
  return [...inMemoryProfiles];
}

export function saveFormatProfile(profile: StatementFormatProfile): void {
  const existing = getSavedFormatProfiles();
  const idx = existing.findIndex(p => p.id === profile.id || p.fingerprint === profile.fingerprint);
  if (idx >= 0) {
    existing[idx] = { ...profile, updatedAt: new Date().toISOString() };
  } else {
    existing.push(profile);
  }
  inMemoryProfiles = [...existing];

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to save format profile to localStorage:', err);
    }
  }
}

export function deleteFormatProfile(id: string): void {
  const existing = getSavedFormatProfiles();
  const filtered = existing.filter(p => p.id !== id);
  inMemoryProfiles = [...filtered];

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(filtered));
    } catch (err) {
      console.error('Failed to delete format profile from localStorage:', err);
    }
  }
}

export function findMatchingFormatProfile(headers: string[]): StatementFormatProfile | undefined {
  const fp = calculateHeaderFingerprint(headers);
  const profiles = getSavedFormatProfiles();
  return profiles.find(p => p.fingerprint === fp);
}

// --- Learned Merchant Rules Persistent Storage ---

export function getLearnedMerchantRules(): LearnedMerchantRule[] {
  if (typeof window === 'undefined') return [...inMemoryRules];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read merchant rules from localStorage:', err);
  }
  return [...inMemoryRules];
}

export function saveLearnedMerchantRule(rule: LearnedMerchantRule): void {
  batchSaveLearnedMerchantRules([rule]);
}

export function batchSaveLearnedMerchantRules(rules: LearnedMerchantRule[]): void {
  if (rules.length === 0) return;
  const existing = getLearnedMerchantRules();
  const map = new Map<string, LearnedMerchantRule>();
  existing.forEach(r => map.set(r.normalizedKey, r));

  const now = new Date().toISOString();
  for (const r of rules) {
    const key = r.normalizedKey.trim().toUpperCase();
    if (!key) continue;
    const prev = map.get(key);
    map.set(key, {
      normalizedKey: key,
      category: r.category,
      lineItem: r.lineItem,
      lastUsed: now,
      matchCount: (prev?.matchCount || 0) + 1,
    });
  }

  const updated = Array.from(map.values());
  inMemoryRules = [...updated];

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to batch save merchant rules to localStorage:', err);
    }
  }
}


// --- Local Keyword Heuristics Dictionary ---

interface KeywordPattern {
  keywords: string[];
  category: string;
  lineItem: string;
}

const COMMON_KEYWORD_PATTERNS: KeywordPattern[] = [
  { keywords: ['GIANT', 'SAFEWAY', 'H MART', 'PATEL BROTHERS', 'TRADER JOE', 'WHOLE FOODS', 'WEGMANS', 'ALDI', 'GROCERY', 'GROCERIES', 'MARKET', 'LATINAS STORE'], category: 'Living', lineItem: 'Groceries' },
  { keywords: ['SHELL OIL', 'EXXON', 'MOBIL', 'BP', 'CHEVRON', 'LIBERTY', 'FLOWER HILL LIBERTY', 'SUNOCO', 'GAS', 'WAWA'], category: 'Transportation', lineItem: 'Gasoline' },
  { keywords: ['HOME DEPOT', 'LOWES', 'ACE HARDWARE', 'REGAL PAINT', 'TW PERRY', 'CARPET', 'SEASONS NURSERY', 'HARDWARE', 'NURSERY'], category: 'Housing', lineItem: 'Home Maintenance' },
  { keywords: ['DENTIST', 'DENTISTRY', 'DIGESTIVE', 'MEDICINE', 'CLINIC', 'HOSPITAL', 'DOCTOR', 'PHYSICIAN', 'FAMILY MED', 'CVS', 'WALGREENS', 'CAREMARK', 'PHARMACY'], category: 'Healthcare', lineItem: 'Prescriptions & Medical' },
  { keywords: ['RESTAURANT', 'TRATTORIA', 'CAFE', 'PANERA', 'MCDONALD', 'STARBUCKS', 'CHIPOTLE', 'MAGNOLIAS', 'SABAI SABAI', 'FOOD & DRINK', 'DINER', 'PIZZA', 'TAQUERIA', 'BAKERY'], category: 'Living', lineItem: 'Dining Out' },
  { keywords: ['GOLF', 'MUSKET RIDGE', 'LAYTONSVILLE GOLF', 'CINEMA', 'THEATER', 'MOVIE', 'CONCERT', 'BOWLING', 'ENTERTAINMENT', 'LEISURE'], category: 'Leisure', lineItem: 'Entertainment' },
  { keywords: ['VINEYARDS', 'BREAUX VINEYARDS', 'WINERY', 'BREWING', 'BREWERY', 'LIQUOR', 'BEER', 'WINE'], category: 'Living', lineItem: 'Dining Out' },
  { keywords: ['ST JUDE', 'STJUDE', 'TUNNEL TO TOWERS', 'TUNNELTOTOWERS', 'WOUNDED WARRIOR', 'CHARITY', 'DONATION', 'CHURCH', 'MINISTRY', 'TITHING'], category: 'Charities', lineItem: 'Charitable Donations' },
  { keywords: ['VERIZON', 'AT&T', 'ATT', 'T-MOBILE', 'COMCAST', 'XFINITY', 'ELECTRIC', 'WATER', 'UTILITIES', 'POWER'], category: 'Housing', lineItem: 'Utilities' },
  { keywords: ['GARAGE', 'PARKING', 'DOT GARAGE', 'TOLL', 'EZPASS', 'UBER', 'LYFT', 'METRO', 'TRANSIT', 'TRAVEL'], category: 'Transportation', lineItem: 'Public Transit & Parking' },
  { keywords: ['COSTCO', 'SAM\'S CLUB', 'BJS WHOLESALE'], category: 'Living', lineItem: 'Groceries' },
  { keywords: ['KOHL\'S', 'KOHLS', 'TARGET', 'WALMART', 'HOBBY LOBBY', 'MICHAELS', 'BATH & BODY', 'BATH AND BODY', 'FAMILY ROOM', 'CLOTHING', 'SHOPPING'], category: 'Living', lineItem: 'Clothing & General Goods' },
];

// --- Matching Engine ---

export interface MatchResult {
  category: string;
  lineItem: string;
  source: 'learned' | 'heuristic' | 'llm' | 'unknown';
  isUnknown: boolean;
}

/**
 * Categorizes a single transaction using the multi-tier hierarchy:
 * 1. Persistent Learned Memory (Exact or prefix match)
 * 2. Local Keyword Heuristics
 * 3. Fallback to Unknown
 */
export function categorizeLocally(
  rawDesc: string,
  rawCat?: string,
  catalog: PlannerExpenseLineItem[] = getPlannerExpenseCatalog()
): MatchResult {
  const normKey = normalizeMerchant(rawDesc);
  const learnedRules = getLearnedMerchantRules();

  // Tier 1: Check Learned Merchant Dictionary
  if (normKey) {
    const directMatch = learnedRules.find(r => r.normalizedKey === normKey);
    if (directMatch) {
      return {
        category: directMatch.category,
        lineItem: directMatch.lineItem,
        source: 'learned',
        isUnknown: false,
      };
    }

    // Prefix / Substring match in learned dictionary
    const prefixMatch = learnedRules.find(r => normKey.startsWith(r.normalizedKey) || r.normalizedKey.startsWith(normKey));
    if (prefixMatch) {
      return {
        category: prefixMatch.category,
        lineItem: prefixMatch.lineItem,
        source: 'learned',
        isUnknown: false,
      };
    }
  }

  // Tier 2: Keyword Heuristics against description and statement category
  const searchText = `${rawDesc} ${rawCat || ''} ${normKey}`.toUpperCase();

  for (const pattern of COMMON_KEYWORD_PATTERNS) {
    for (const kw of pattern.keywords) {
      if (searchText.includes(kw.toUpperCase())) {
        // Verify or reconcile with existing catalog items
        const matchingCatalogItem = catalog.find(
          c => c.name.toLowerCase() === pattern.lineItem.toLowerCase() ||
               c.displayName.toLowerCase().includes(pattern.lineItem.toLowerCase())
        );

        return {
          category: matchingCatalogItem?.groupCategory || pattern.category,
          lineItem: matchingCatalogItem?.name || pattern.lineItem,
          source: 'heuristic',
          isUnknown: false,
        };
      }
    }
  }

  // Check statement category directly if it closely matches any catalog line item
  if (rawCat) {
    const catLower = rawCat.toLowerCase().trim();
    const catalogMatch = catalog.find(
      c => c.name.toLowerCase() === catLower || c.displayName.toLowerCase().includes(catLower)
    );
    if (catalogMatch) {
      return {
        category: catalogMatch.groupCategory,
        lineItem: catalogMatch.name,
        source: 'heuristic',
        isUnknown: false,
      };
    }
  }

  // Fallback: Mark as Unknown
  return {
    category: 'Living',
    lineItem: 'Unknown',
    source: 'unknown',
    isUnknown: true,
  };
}

// --- Gemini & Bedrock LLM Categorization ---

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key.trim());
}

/**
 * Batched LLM Categorization service.
 * - In Cloud mode: calls AWS Bedrock Nova Micro via backend API Gateway if available.
 * - In Local / Demo mode: calls Google Gemini API (gemini-2.5-flash / gemini-1.5-flash) using client key.
 */
export async function batchCategorizeWithLLM(
  merchants: Array<{ rawDesc: string; rawCat?: string; normalized: string }>,
  catalog: PlannerExpenseLineItem[]
): Promise<Map<string, { category: string; lineItem: string }>> {
  const resultMap = new Map<string, { category: string; lineItem: string }>();
  if (merchants.length === 0) return resultMap;

  // Build compact list of allowable catalog targets
  const catalogTargets = catalog.map(c => `${c.groupCategory}:::${c.name}`);
  const uniqueMerchants = Array.from(new Set(merchants.map(m => m.normalized))).filter(Boolean);

  const promptPayload = {
    merchants: uniqueMerchants.slice(0, 50), // Process up to 50 unique merchants per prompt
    catalog: catalogTargets,
  };

  const isCloudAuth = typeof window !== 'undefined' && navigator.onLine && AuthService.isAuthenticated();

  // 1. Try Cloud Mode (AWS Bedrock Nova Micro via backend API)
  if (isCloudAuth) {
    try {
      const idToken = await AuthService.getIdToken();
      if (idToken) {
        const endpoint = `${getCloudConfig().apiEndpoint.replace(/\/$/, '')}/api/expenses/categorize-llm`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: idToken,
          },
          body: JSON.stringify(promptPayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            Object.entries(data).forEach(([merchantKey, mapping]) => {
              const m = mapping as { category?: string; lineItem?: string };
              if (m && m.category && m.lineItem) {
                resultMap.set(merchantKey.toUpperCase(), { category: m.category, lineItem: m.lineItem });
              }
            });
            return resultMap;
          }
        }
      }
    } catch (err) {
      console.warn('Cloud Bedrock Nova categorization failed, checking Gemini fallback:', err);
    }
  }

  // 2. Local / Demo mode fallback: Gemini API via client key
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return resultMap;
  }

  try {
    const prompt = `You are a financial categorization assistant. Given a list of merchant names and statement categories, map each merchant to the SINGLE BEST MATCHING category and line item from the provided catalog.
If no good match exists in the catalog, return "Living:::Unknown".

Catalog choices (Category:::LineItem):
${catalogTargets.join('\n')}

Merchants to categorize:
${uniqueMerchants.join('\n')}

Return ONLY a valid JSON object mapping each merchant name to its chosen "Category:::LineItem" string. Example format:
{
  "PATEL BROTHERS": "Living:::Groceries",
  "SHELL OIL": "Transportation:::Gasoline"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        Object.entries(parsed).forEach(([merchant, catStr]) => {
          if (typeof catStr === 'string' && catStr.includes(':::')) {
            const [cat, item] = catStr.split(':::');
            if (cat && item) {
              resultMap.set(merchant.toUpperCase(), { category: cat.trim(), lineItem: item.trim() });
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Gemini categorization call failed:', err);
  }

  return resultMap;
}
