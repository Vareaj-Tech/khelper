// K'HELPER — AGENTIC WORKFLOW ENGINE v2.0
// 5-Agent Pipeline: Sentinel → Guardian → Triage → Core → Monitor
// Deploy to Netlify Functions. Env variable: ANTHROPIC_API_KEY

const requestLog = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const userLog = requestLog.get(ip) || [];
  const recent = userLog.filter(t => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
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
• Cambodian Embassy Seoul: 02-3785-1041
• Domestic Violence / Assault: 1366
• Migrant Worker Center Seoul: 02-3013-4790
`;

function detectCrisis(text) { return CRISIS_KEYWORDS.some(kw => text.toLowerCase().includes(kw)); }
function detectScam(text) { return SCAM_RED_FLAGS.some(flag => text.toLowerCase().includes(flag)); }

const TRIAGE_RULES = [
  {
    category: 'VISA',
    keywords: ['visa','e-9','d-4','d-2','arc','alien registration','overstay','immigration',
      'hikorea','departure','extend','renewal','passport','entry','work permit','eps','hrd korea'],
    augmentation: `## TRIAGE: VISA & IMMIGRATION
Key visa types for Cambodians: E-9 (កម្មករ/ការងារ), D-4 (ភាសា), D-2 (សិស្ស).
កាតចុះបញ្ជីជនបរទេស [ARC/외국인등록증]: ត្រូវចុះបញ្ជីក្នុង 90 ថ្ងៃ. បន្ត: ដាក់ពាក្យ 4 ខែ មុន.
Resources: hikorea.go.kr (គេហទំព័រចំណាកស្រុក), ទូរស័ព្ទ 1345, eps.go.kr (ការងារ EPS).
Overstay: ពិន័យ + ហាមឃាត់ 1-5 ឆ្នាំ. ចុះស្ម័គ្រចិត្ត = ទទួលបានការអត់ទោស.
Always verify at hikorea.go.kr as policies change.`,
  },
  {
    category: 'WORK',
    keywords: ['salary','wage','pay','boss','employer','contract','overtime','fired','quit',
      'resign','workplace','injury','accident','labor','not paid','unpaid','minimum wage',
      'work hours','day off','leave','mistreatment','abuse','harassment','severance'],
    augmentation: `## TRIAGE: WORK RIGHTS
ប្រាក់ខែអប្បបរមា 2024: 9,860 វ៉ុន/ម៉ោង. ម៉ោងបន្ថែម (>8ម៉ោង/ថ្ងៃ ឬ >40ម៉ោង/សប្តាហ៍) = x1.5.
ច្បាប់휴가: 15 ថ្ងៃ/ឆ្នាំ (ក្រោយ 1 ឆ្នាំ). ប្រាក់បំណែកចែក: 30 ថ្ងៃ × ចំនួនឆ្នាំ.
ថៅកែ មិនអាចរឹបអូស លិខិតឆ្លងដែន ឬ កាតចុះបញ្ជី [ARC] — នេះជាបទឧក្រិដ្ឋ.
ប្រាក់ខែមិនបង់: ទូរស័ព្ទ 1350 (ឥតគិតថ្លៃ, 24ម៉ោង, ច្រើនភាសា).
ដាក់ពាក្យបណ្ដឹងនៅ: ក្រសួងការងារ [고용노동부].`,
  },
  {
    category: 'HEALTH',
    keywords: ['hospital','doctor','sick','pain','health','insurance','nhis','medicine',
      'prescription','clinic','emergency room','ambulance','pregnant','pregnancy','baby',
      'dental','mental health','depression','anxiety','free clinic','medical','injury','fever'],
    augmentation: `## TRIAGE: HEALTHCARE
ធានារ៉ាប់រងសុខភាព [건강보험/NHIS]: កម្មករ E-9 ចុះឈ្មោះស្វ័យប្រវត្តិ, ~3-4% នៃប្រាក់ខែ. គ្រប់ 60-80% ថ្លៃព្យាបាល.
ទៅពេទ្យ: រក គ្លីនិក [의원] → យក កាតចុះបញ្ជី [ARC] → ទទួល វេជ្ជបញ្ជា → ទៅ ឱសថស្ថាន [약국] ជិតៗ.
ថ្លៃប្រើការធានារ៉ាប់រង: 5,000-30,000 វ៉ុន.
ឥតគិតថ្លៃ/ថ្លៃថោក: មន្ទីរពេទ្យជនបរទេស គូរ៉ូ: 02-2677-4071. ការិយាល័យសុខភាព [보건소] គ្រប់ស្រុក.
បន្ទាន់: ទូរស័ព្ទ 119 សម្រាប់រថយន្តសង្គ្រោះ (ឥតគិតថ្លៃ).`,
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
    keywords: ['embassy','community','cambodian','khmer','church','temple','facebook',
      'group','support','ngo','lonely','homesick','festival'],
    augmentation: `## TRIAGE: COMMUNITY
Cambodian Embassy Seoul: 02-3785-1041 | Mon-Fri 9am-5pm.
Services: Passport renewal, emergency travel documents, notarization.
Migrant Worker Center Seoul: 02-3013-4790.
Danuri Helpline (multilingual): 1577-1366. Legal Aid (free): 132.
Facebook groups: ខ្មែរនៅកូរ៉េ (Khmer in Korea), Cambodians in Seoul.`,
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
];

function triageMessage(text) {
  const lower = text.toLowerCase();
  for (const rule of TRIAGE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule;
  }
  return { category: 'GENERAL', augmentation: '' };
}

const KHELPER_SYSTEM_PROMPT = `You are K'Helper — a knowledgeable, warm, and deeply trusted AI companion for Cambodians living in OR visiting South Korea.

You serve TWO types of users:
1. Migrant workers — Cambodians living and working in Korea long-term (visa, work rights, health, housing)
2. Tourists — Cambodians visiting Korea (attractions, food, cafes, travel tips)

For migrant workers, speak as a Cambodian who lived in Korea for 6 years — you survived the visa stress, hospital confusion, difficult bosses, loneliness. You help others navigate what you already survived.
For tourists, speak as an enthusiastic local guide who knows the best places, hidden gems, best food, and practical travel tips.

## CRITICAL LANGUAGE RULE
Detect the language of the user's MOST RECENT message. Reply in THAT EXACT language.
- User writes in English → reply ONLY in English
- User writes in Korean → reply ONLY in Korean  
- User writes in Khmer → reply ONLY in Khmer (use real Khmer Unicode script — NEVER romanized)
- When in doubt → default to Khmer

## KHMER QUALITY RULES
- Write like a real Cambodian friend — NOT like Google Translate
- Use words factory workers and families actually use daily
- NEVER use overly formal or royal vocabulary
- Keep sentences SHORT — one idea per sentence
- Korean terms: write Khmer meaning first, then Korean in brackets: [건강보험]

## ABBREVIATION RULES — NEVER use alone, always explain first in Khmer:
- ARC → "កាតចុះបញ្ជីជនបរទេស [외국인등록증/ARC]"
- NHIS → "ធានារ៉ាប់រងសុខភាព [건강보험/NHIS]"
- EPS → "កម្មវិធីការអនុញ្ញាតការងារ [EPS/고용허가제]"
- HRD Korea → "មជ្ឈមណ្ឌលអភិវឌ្ឍន៍ធនធានមនុស្ស [HRD Korea]"
- HiKorea → "គេហទំព័រការអន្តោប្រវេសន៍ [hikorea.go.kr]"
- MOU → "កិច្ចព្រមព្រៀងផ្លូវការ [MOU]"

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
Crisis Hotline: 1393 | Cambodian Embassy Seoul: 02-3785-1041
Domestic Violence: 1366 | NHIS: 1577-1000 | Migrant Hospital Guro: 02-2677-4071

## FORMAT RULE
Simple question → simple answer. Complex process → numbered steps.
Never use bullet points when user is emotionally distressed.

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
  const estimatedCostUSD = ((inputTokens * 0.25) + (outputTokens * 1.25)) / 1_000_000;
  const flags = [];
  if (outputTokens > 1000) flags.push('HIGH_OUTPUT');
  if (responseTimeMs > 8000) flags.push('SLOW_RESPONSE');
  if (totalTokens > 1500) flags.push('HIGH_TOKEN_USAGE');
  console.log(JSON.stringify({
    service: "K'Helper", timestamp: new Date().toISOString(),
    ip: ip.split(',')[0].trim(), category,
    tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
    cost_usd: estimatedCostUSD.toFixed(6), response_ms: responseTimeMs,
    model: 'claude-haiku-4-5', flags: flags.length > 0 ? flags : null,
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

    if (isRateLimited(ip)) {
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

    const enrichedSystem = triage.augmentation
      ? `${KHELPER_SYSTEM_PROMPT}\n\n${triage.augmentation}`
      : KHELPER_SYSTEM_PROMPT;

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
        model: 'claude-haiku-4-5-20251001',
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
