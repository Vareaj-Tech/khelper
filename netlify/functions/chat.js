// K'HELPER — AGENTIC WORKFLOW ENGINE v2.0
// 5-Agent Pipeline: Sentinel → Guardian → Triage → Core → Monitor
// Deploy to Netlify Functions. Env variable: ANTHROPIC_API_KEY

const RATE_LIMIT = 30;          // max requests per IP per window
const RATE_WINDOW_SECONDS = 3600; // 1 hour

// Persistent rate limiter via Upstash Redis REST API.
// Falls back to "allow" if env vars are missing (dev / misconfigured env).
async function isRateLimited(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false; // no Redis → no limit (fail open)

  const key = `khelper:rl:${ip.split(',')[0].trim()}`;
  try {
    // INCR atomically increments the counter and returns the new value
    const incrRes = await fetch(`${url}/incr/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { result: count } = await incrRes.json();

    // On first request, set the TTL so the key auto-expires after 1 hour
    if (count === 1) {
      await fetch(`${url}/expire/${key}/${RATE_WINDOW_SECONDS}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return count > RATE_LIMIT;
  } catch (e) {
    console.error('Rate limiter error:', e.message);
    return false; // if Redis is down, fail open rather than block users
  }
}

function validateInput(messages) {
  if (!Array.isArray(messages) || messages.length === 0)
    return { valid: false, error: 'Invalid message format.' };
  const last = messages[messages.length - 1]?.content || '';
  if (last.length > 2000)
    return { valid: false, error: 'Message too long. Please keep it under 2000 characters.' };
  if (messages.length > 50)
    return { valid: false, error: 'Conversation too long. Please start a new chat.' };
  return { valid: true };
}

const CRISIS_KEYWORDS = [
  'kill myself','want to die','end my life','suicide','no reason to live',
  'cannot live','disappear forever','hurt myself','harm myself','kill me',
];
const SCAM_RED_FLAGS = [
  'send money first','deposit first','transfer before','guaranteed visa',
  'buy visa','cheap visa agent','work without visa','fake documents',
  'buy documents','guaranteed job offer','pay to get job',
];
const EMERGENCY_CONTACTS = `
🆘 EMERGENCY CONTACTS — KOREA
• Crisis Hotline: 1393 (24hr, multilingual)
• Police: 112 | Ambulance / Fire: 119
• Immigration Hotline: 1345 | Labor Rights: 1350
• Migrant Support (multilingual): 1577-1366
• Domestic Violence / Assault: 1366
• Migrant Worker Center Seoul: 02-3013-4790
`;

function detectCrisis(text) { return CRISIS_KEYWORDS.some(kw => text.toLowerCase().includes(kw)); }
function detectScam(text) { return SCAM_RED_FLAGS.some(flag => text.toLowerCase().includes(flag)); }

// ── LANGUAGE DETECTION ──────────────────────────────────────────────────────
function detectLanguage(text) {
  const khmerChars    = (text.match(/[ក-៿᧠-᧿]/g) || []).length;
  const koreanChars   = (text.match(/[가-힯ᄀ-ᇿ㄰-㆏]/g) || []).length;
  const chineseChars  = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const thaiChars     = (text.match(/[฀-๿]/g) || []).length;
  const arabicChars   = (text.match(/[؀-ۿݐ-ݿ]/g) || []).length;
  const vietnameseChars = (text.match(/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/gi) || []).length;
  const total = text.replace(/\s/g, '').length || 1;

  if (khmerChars / total > 0.15)    return 'km';
  if (koreanChars / total > 0.15)   return 'kr';
  if (chineseChars / total > 0.15)  return 'zh';
  if (thaiChars / total > 0.15)     return 'th';
  if (arabicChars / total > 0.15)   return 'ar';
  if (vietnameseChars / total > 0.08) return 'vi';
  return 'en';  // default to English for all other scripts
}

const LANG_INSTRUCTIONS = {
  km: `## ⚠️ ABSOLUTE LANGUAGE RULE — KHMER ONLY ⚠️
The user wrote in Khmer. Your ENTIRE reply must be in Khmer script ONLY.
DO NOT write even a single word in English or Korean.
DO NOT start with English greetings like "Hello", "Great", "Sure", "Of course".
Phone numbers (1345, 119 etc.) and website URLs are allowed.
Korean institution names may appear in brackets only: [건강보험].
Write like a trusted friend — short sentences, everyday Khmer, NOT formal.`,

  en: `## ⚠️ ABSOLUTE LANGUAGE RULE — ENGLISH ONLY ⚠️
The user wrote in English. Your ENTIRE reply must be in English ONLY.
DO NOT write even a single word in Khmer or Korean.
Korean institution names may appear in brackets only: [건강보험].
Be warm, clear, and direct.`,

  kr: `## ⚠️ ABSOLUTE LANGUAGE RULE — KOREAN ONLY ⚠️
The user wrote in Korean. Your ENTIRE reply must be in Korean (한국어) ONLY.
DO NOT write even a single word in other languages.
Speak naturally and warmly in Korean.`,

  zh: `## ⚠️ ABSOLUTE LANGUAGE RULE — CHINESE ONLY ⚠️
The user wrote in Chinese. Your ENTIRE reply must be in Chinese (中文) ONLY.
DO NOT mix in English, Korean, or any other script.
Phone numbers and website URLs are allowed. Korean institution names in brackets: [건강보험].
Be warm, helpful, and concise.`,

  th: `## ⚠️ ABSOLUTE LANGUAGE RULE — THAI ONLY ⚠️
The user wrote in Thai. Your ENTIRE reply must be in Thai (ภาษาไทย) ONLY.
DO NOT mix in English, Korean, or any other script.
Phone numbers and website URLs are allowed. Korean institution names in brackets: [건강보험].
Be warm and helpful.`,

  ar: `## ⚠️ ABSOLUTE LANGUAGE RULE — ARABIC ONLY ⚠️
The user wrote in Arabic. Your ENTIRE reply must be in Arabic (العربية) ONLY.
DO NOT mix in English, Korean, or any other script.
Phone numbers and website URLs are allowed. Korean institution names in brackets: [건강보험].
Be warm and helpful.`,

  vi: `## ⚠️ ABSOLUTE LANGUAGE RULE — VIETNAMESE ONLY ⚠️
The user wrote in Vietnamese. Your ENTIRE reply must be in Vietnamese (Tiếng Việt) ONLY.
DO NOT mix in English, Korean, or any other language.
Phone numbers and website URLs are allowed. Korean institution names in brackets: [건강보험].
Be warm, clear, and helpful.`,
};

const TRIAGE_RULES = [
  {
    category: 'VISA',
    keywords: [
      'visa','arc','alien registration','overstay','immigration','hikorea','departure',
      'extend','renewal','passport','entry','work permit','eps','hrd korea',
      // Work visas
      'e-1','e-2','e-3','e-4','e-5','e-6','e-7','e-8','e-9','e-10',
      'e1','e2','e3','e4','e5','e6','e7','e8','e9','e10',
      // Student / language visas
      'd-1','d-2','d-3','d-4','d-5','d-6','d-7','d-8','d-9','d-10',
      'd1','d2','d3','d4','d5','d6','d7','d8','d9','d10',
      // Family / residence visas
      'f-1','f-2','f-3','f-4','f-5','f-6',
      'f1','f2','f3','f4','f5','f6',
      // Short-stay / tourist
      'c-3','b-1','b-2','k-eta','k eta','visa waiver','visa free','tourist visa',
      // Misc
      'work visa','student visa','spouse visa','dependent visa','permanent residency',
      'pr visa','naturalization','citizenship','change of status','visa change',
      'alien registration card','등록증','체류','비자','입국','출국','체류기간',
    ],
    augmentation: `## BACKGROUND: VISA & IMMIGRATION — ALL TYPES (reply in user's language)
WORK VISAS:
• E-9: Non-professional employment (EPS program — manufacturing, agriculture, fishery). Apply via eps.go.kr.
• E-7: Skilled worker (points-based). Minimum salary thresholds apply. Employer-sponsored.
• E-2: English teaching (must have BA + TEFL/CELTA, clean background check).
• E-1: Professor / E-3: Researcher / E-4: Technology transfer.
• E-6: Arts/entertainment. E-8: Seasonal work. E-10: Maritime crew.
STUDENT VISAS:
• D-2: University/grad student. D-4: Language school (institutes). D-1: Culture/arts training.
• D-2/D-4 work hours: Limited without TOPIK 4+. See D-2/D-4 Work Hours Calculator in K'Helper.
FAMILY / RESIDENCE:
• F-1: Dependent family. F-2: Residence (long-term). F-3: Accompanying family of worker.
• F-4: Ethnic Korean (overseas Korean). F-5: Permanent resident (PR). F-6: Marriage to Korean national.
• F-5 PR eligibility: 5 years continuous legal stay + income/tax requirements.
TOURIST / SHORT STAY:
• C-3: Short-term general (90 days, visa-required countries). K-ETA required for many nationalities.
• Visa-free: 60+ countries including most of Europe, US, Japan, Singapore up to 90 days.
ARC (외국인등록증 — Alien Registration Card):
• Required for all stays 90+ days. Register within 90 days of arrival at local immigration office.
• Renew at hikorea.go.kr or immigration office. Carry it at all times.
OVERSTAY: Fine + entry ban 1-10 years depending on duration. Voluntary surrender = reduced penalty.
KEY RESOURCES: hikorea.go.kr (all services) · 1345 (immigration hotline, 24hr multilingual)`,
  },
  {
    category: 'WORK',
    keywords: ['salary','wage','pay','boss','employer','contract','overtime','fired','quit',
      'resign','workplace','injury','accident','labor','not paid','unpaid','minimum wage',
      'work hours','day off','leave','mistreatment','abuse','harassment','severance'],
    augmentation: `## BACKGROUND: WORK RIGHTS (AI knowledge — reply in user's language)
Minimum wage 2024: 9,860 won/hour. Overtime (>8hrs/day or >40hrs/week) = x1.5 pay.
Annual leave: 15 days/year after 1 year. Severance pay: 30 days x years worked.
Employers CANNOT confiscate passport or ARC card — this is a criminal offense.
Unpaid wages: call 1350 (free, 24hr, multilingual). File complaint at Ministry of Employment and Labor.
Employer housing deduction must not exceed 20% of wage.`,
  },
  {
    category: 'HEALTH',
    keywords: ['hospital','doctor','sick','pain','health','insurance','nhis','medicine',
      'prescription','clinic','emergency room','ambulance','pregnant','pregnancy','baby',
      'dental','mental health','depression','anxiety','free clinic','medical','injury','fever'],
    augmentation: `## BACKGROUND: HEALTHCARE (AI knowledge — reply in user's language)
Health insurance (NHIS / 건강보험): E-9 workers auto-enrolled, ~3-4% of wage. Covers 60-80% of medical costs.
How to visit doctor: find clinic (의원) → bring ARC card → get prescription → go to nearby pharmacy (약국).
Co-pay with insurance: 5,000-30,000 won.
Free/low-cost options: Migrants hospital Guro 02-2677-4071. Local health center (보건소) in every district.
Emergency: call 119 for ambulance (free).`,
  },
  {
    category: 'DAILY',
    keywords: ['bank','account','sim','phone','money','send money','remittance','transfer',
      'kakao','app','bus','subway','transport','food','market','internet','wifi','tax',
      'refund','atm','cash','card'],
    augmentation: `## TRIAGE: DAILY LIFE
Banking: IBK Bank most migrant-friendly. Need ARC + passport + employer letter.
SIM: KT M Mobile or SK LTE-M — need ARC + passport. Plans: 15,000-30,000 KRW/month.
Sending money: WireBarley, Wise, SentBe — best rates for KRW → KHR/USD.
Transport: T-money card works on all buses and subways. Charge at GS25, CU, 7-Eleven.
Navigation: Kakao Maps or Naver Map — both have English options.`,
  },
  {
    category: 'HOUSING',
    keywords: ['house','room','rent','landlord','jeonse','wolse','deposit','apartment',
      'goshiwon','contract','moving','eviction','accommodation'],
    augmentation: `## TRIAGE: HOUSING
월세 (Wolse): monthly rent + deposit (most common for migrants).
전세 (Jeonse): large lump sum deposit, no monthly rent.
E-9 employer housing: legal if deduction below 20% of wage.
Tenant rights: 30 days eviction notice required. Deposit must return within 1 month.
If landlord refuses deposit return: call 1345 or Korean Legal Aid: 132.`,
  },
  {
    category: 'SCHOOL',
    keywords: ['school','child','kid','son','daughter','enroll','education','kindergarten',
      'elementary','multicultural','hagwon','study','learn korean'],
    augmentation: `## TRIAGE: EDUCATION
ALL children in Korea have the right to attend school — regardless of visa status.
Enrollment documents: proof of residence + family relationship + ARC card.
Schools must accept incomplete documents. Illegal to reject migrant children.
Free support: Multicultural Family Support Center (다문화가족지원센터).
Korean classes free for children and parents. Danuri: 1577-1366.`,
  },
  {
    category: 'COMMUNITY',
    keywords: [
      'embassy','community','church','temple','mosque','facebook',
      'group','support','ngo','lonely','homesick','festival','expat','foreigner',
      'cambodian','khmer','vietnamese','viet','chinese','thai','filipino','nepali',
      'indonesian','bangladeshi','pakistani','uzbek','russian','american','british',
      'french','german','japanese','indian','sri lankan','myanmar','burmese',
      'neighbor','neighbourhood','neighborhood','friend','meet people','social',
    ],
    augmentation: `## TRIAGE: COMMUNITY & SUPPORT
Migrant & Expat Support (multilingual, all nationalities): Danuri 1577-1366 | Legal Aid (free): 132.
Migrant Worker Center Seoul: 02-3013-4790.
Multicultural Family Support Centers (다문화가족지원센터) in every district — free Korean classes, counseling, legal help.
For expats & English speakers: Seoul Global Center 02-2075-4180 | Itaewon / Haebangchon community.
MAJOR EMBASSIES IN SEOUL:
• Cambodian Embassy: 02-3785-1041 | Vietnamese Embassy: 02-738-2318
• Chinese Embassy: 02-738-1333 | Thai Embassy: 02-795-3098
• Filipino Embassy: 02-721-7387 | Indonesian Embassy: 02-783-5675
• US Embassy: 02-397-4114 | UK Embassy: 02-3210-5500
→ Search "[your nationality] in Korea" on Facebook — most nationalities have very active groups.`,
  },
  {
    category: 'TOURIST',
    keywords: ['tourist','tourism','visit','travel','sightseeing','attraction','palace',
      'temple','museum','tour','itinerary','where to go','must see','restaurant','cafe',
      'coffee shop','food street','market','shopping','k-drama','hallyu','kpop','busan',
      'jeju','incheon','gyeongju','namsan','myeongdong','hongdae','insadong','bukchon',
      'itaewon','nami island','dmz','lotte world','everland','hanbok','explore','discover',
      'hidden gem','best place','recommended'],
    augmentation: `## TRIAGE: TOURIST & EXPLORATION
Seoul Must-Visit: 경복궁 (Gyeongbokgung Palace) — wear hanbok for free entry.
남산서울타워 (Namsan Tower) — best city view, cable car.
명동 (Myeongdong) — K-beauty, street food. 홍대 (Hongdae) — night market, young energy.
성수동 (Seongsu-dong) — specialty coffee, best brunch.
Day trips: 남이섬 (Nami Island) 1hr from Seoul. DMZ border tour.
Must-try food: 삼겹살 (BBQ pork), 떡볶이 (spicy rice cakes), 치맥 (chicken+beer).
Best markets: 광장시장 (Gwangjang) — best street food. 노량진수산시장 — 24hr seafood.
Cafe streets: 성수동, 연남동, 익선동, 인사동, 북촌.
Korea Tourism Hotline (English): 1330 (24hr, free). visitkorea.or.kr for info.`,
  },
  {
    category: 'LOCATION',
    keywords: [
      'where is','where can i find','how to get to','directions to','nearest','closest',
      'find hospital','find clinic','find office','find embassy','find church','find mosque',
      'immigration office location','address of','location of','map',
      '어디','위치','찾아가','근처','가까운','어떻게 가','주소',
      'ណា','ទីណា','ស្វែងរកទីតាំង','ទីតាំង','ជិតបំផុត','ផ្លូវ','អាសយដ្ឋាន',
    ],
    augmentation: `## TRIAGE: LOCATION QUERY
The user is looking for a specific place or directions. Be helpful and specific.
Always mention the Korean name in parentheses so they can search on Kakao Map.
Format place names as: English Name (한국어 이름).
Suggest they use 카카오맵 (Kakao Map) — tap the 📍 button in K'Helper to search live.
Include phone number and hours if known.`,
  },
];

function triageMessage(text) {
  const lower = text.toLowerCase();
  for (const rule of TRIAGE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule;
  }
  return { category: 'GENERAL', augmentation: '' };
}

const KHELPER_SYSTEM_PROMPT = `You are K'Helper — a knowledgeable, warm, and deeply trusted AI companion for ANYONE navigating life in South Korea.

You serve ALL foreigners in Korea regardless of nationality, visa type, or reason for being here:
1. Workers & professionals — E-7, E-2, E-9, EPS workers, English teachers, skilled workers
2. Students — D-2 university students, D-4 language students
3. Families & long-term residents — F-series visas, permanent residents, multicultural families
4. Tourists & visitors — sightseeing, travel tips, K-drama spots, food, cafes
5. Anyone else — expats, digital nomads, diplomats, trailing spouses, newly arrived

You know Korean visa rules, labor law, healthcare, housing, and daily life for ALL nationalities — not just one community.
For anyone dealing with the system (visa, work, health, housing), speak as someone who has lived in Korea for years and survived every bureaucratic headache. You help others navigate what you already know.
For tourists, speak as an enthusiastic local guide who knows the best places, hidden gems, and practical tips.

## CRITICAL LANGUAGE RULE
Detect the language of the user's MOST RECENT message. Reply in THAT EXACT language.
- User writes in English → reply ONLY in English
- User writes in Korean → reply ONLY in Korean
- User writes in Khmer → reply ONLY in Khmer (use real Khmer Unicode script — NEVER romanized)
- When in doubt → default to English

## TONE RULES
- Be warm, direct, and helpful — like a trusted friend who knows Korea well
- Keep sentences SHORT — one idea per sentence
- Korean institution names may appear in brackets: [건강보험]
- NEVER start with: "I'm sorry to hear that", "I understand your concern", "That must be difficult"
- Open with direct empathy + action: "That's not okay — here's what you do right now."

## EVERY POINT MUST HAVE AN ACTION
After every piece of advice, always give the user something concrete to DO next:
→ A hotline number to call (e.g. 1350, 1345, 119)
→ A website to check (e.g. hikorea.go.kr, eps.go.kr)
→ A place to go (e.g. ការិយាល័យចំណាកស្រុក)
→ A follow-up question they can ask K'Helper
NEVER leave the user with information and no next step.

## HOW TO OPEN YOUR RESPONSES
NEVER start with: "I'm sorry to hear that", "I understand your concern", "That must be difficult"
Instead open with direct empathy + action: "That's not okay — here's what you do right now."

## WHEN SOMEONE REPORTS ILLEGAL TREATMENT
→ ALWAYS state clearly: "This is ILLEGAL in Korea."
→ Give actionable steps immediately. Always include Labor Rights hotline: 1350

## VERIFIED EMERGENCY CONTACTS
Immigration & Visa: 1345 | Labor Rights: 1350 | Police: 112 | Ambulance: 119
Crisis Hotline: 1393 | Migrant Support (multilingual): 1577-1366
Domestic Violence: 1366 | NHIS: 1577-1000 | Migrant Hospital Guro: 02-2677-4071

## FORMAT RULE
Simple question → simple answer. Complex process → numbered steps.
Never use bullet points when user is emotionally distressed.

## ANSWER ONLY WHAT WAS ASKED — CRITICAL
- Answer the SPECIFIC question. Nothing more.
- Do NOT add extra tips, sections, tables, or "bonus advice" they didn't ask for.
- Do NOT add closing questions like "មានបញ្ហាអ្វីទៀតទេ?" or "ប្រាប់ខ្ញុំបន្ថែម!" unless the user's question was vague.
- If user asks HOW → explain how. Stop there.
- If user asks YES/NO → answer yes or no + one sentence reason. Stop there.
- Keep responses SHORT. Max 5-7 lines for most questions.
- A long response is only justified when the user asks for a full guide/checklist explicitly.

## THE GOLDEN RULE
Every response should make the user feel: "This is someone who actually knows what they're talking about AND cares about me."`;

function sanitizeMessages(messages) {
  return messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') &&
                 typeof m.content === 'string' && m.content.trim().length > 0)
    .reduce((acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) { acc[acc.length - 1] = msg; }
      else { acc.push(msg); }
      return acc;
    }, [])
    .filter((_, i, arr) => i === 0 ? arr[i].role === 'user' : true);
}

function logUsage(ip, category, inputTokens, outputTokens, responseTimeMs) {
  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUSD = ((inputTokens * 3) + (outputTokens * 15)) / 1_000_000;
  const flags = [];
  if (outputTokens > 1000) flags.push('HIGH_OUTPUT');
  if (responseTimeMs > 8000) flags.push('SLOW_RESPONSE');
  if (totalTokens > 1500) flags.push('HIGH_TOKEN_USAGE');
  console.log(JSON.stringify({
    service: "K'Helper", timestamp: new Date().toISOString(),
    ip: ip.split(',')[0].trim(), category,
    tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
    cost_usd: estimatedCostUSD.toFixed(6), response_ms: responseTimeMs,
    model: 'claude-sonnet-4-6', flags: flags.length > 0 ? flags : null,
  }));
}

exports.handler = async function(event, context) {
  const startTime = Date.now();

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';

    if (await isRateLimited(ip)) {
      return {
        statusCode: 429, headers,
        body: JSON.stringify({ error: 'ចំណុចកំណត់សារ: សូមចាំ 1 ម៉ោង។ / Rate limit reached. Wait 1 hour. / 요청 한도 초과. 1시간 후 재시도.' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { messages } = body;

    const validation = validateInput(messages);
    if (!validation.valid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: validation.error }) };
    }

    const lastMessage = messages[messages.length - 1]?.content || '';
    const lastLower = lastMessage.toLowerCase();

    if (detectCrisis(lastLower)) {
      const crisisReply = `🆘 ខ្ញុំស្ដាប់អ្នក។ / I hear you. You are not alone.\n\n${EMERGENCY_CONTACTS}\n\nPlease call **1393** right now — they speak your language and they care. You matter.`;
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          choices: [{ message: { content: crisisReply } }],
          _meta: { category: 'CRISIS', scam_detected: false, response_ms: Date.now() - startTime }
        }),
      };
    }

    const isScam = detectScam(lastLower);
    const triage = triageMessage(lastMessage);
    const detectedLang = detectLanguage(lastMessage);
    const langInstruction = LANG_INSTRUCTIONS[detectedLang];

    // Language lock goes at BOTH TOP and BOTTOM — sandwiches everything
    const enrichedSystem = [
      langInstruction,
      KHELPER_SYSTEM_PROMPT,
      triage.augmentation || '',
      langInstruction,  // repeat at end for emphasis
    ].filter(Boolean).join('\n\n');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Service configuration error. Please contact support.' }) };
    }

    const cleanMessages = sanitizeMessages(messages);
    if (cleanMessages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid messages to process.' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: enrichedSystem,
        messages: cleanMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return {
        statusCode: 502, headers,
        body: JSON.stringify({ error: 'AI service temporarily unavailable. Please try again in a moment.' }),
      };
    }

    const data = await response.json();
    const replyText = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please try again.';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const responseTimeMs = Date.now() - startTime;

    logUsage(ip, triage.category, inputTokens, outputTokens, responseTimeMs);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        choices: [{ message: { content: replyText } }],
        usage: { total_tokens: inputTokens + outputTokens },
        _meta: {
          category: triage.category,
          scam_detected: isScam,
          response_ms: responseTimeMs,
          location_query: triage.category === 'LOCATION' ? lastMessage.slice(0, 100) : null,
        },
      }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Internal server error. For urgent help call 1345 or 112.' }),
    };
  }
};
