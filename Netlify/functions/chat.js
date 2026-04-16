// ============================================================
// K'HELPER — AGENTIC WORKFLOW ENGINE v2.0
// ============================================================
// 5-Agent Pipeline:
//   Agent 0: The Sentinel (rate limiting, input validation)
//   Agent 1: The Guardian (crisis + scam detection)
//   Agent 2: The Triage Agent (classify + enrich context)
//   Agent 3: K'Helper Core (Anthropic Claude — generates response)
//   Agent 4: The Monitor (log usage, flag anomalies)
// ============================================================
// Deploy to Netlify Functions. Env variable: ANTHROPIC_API_KEY
// This file NEVER touches the browser. API key stays server-side.
// ============================================================

// ══════════════════════════════════════════════════════════════
// AGENT 0: THE SENTINEL — Rate limiting + input validation
// ══════════════════════════════════════════════════════════════
const requestLog = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

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

// ══════════════════════════════════════════════════════════════
// AGENT 1: THE GUARDIAN — Crisis + scam detection
// ══════════════════════════════════════════════════════════════
const CRISIS_KEYWORDS = [
  'kill myself', 'want to die', 'end my life', 'suicide',
  'no reason to live', 'cannot live', 'disappear forever',
  'hurt myself', 'harm myself', 'kill me',
  'chkout', 'slab', 'mɨn men chivit',
];

const SCAM_RED_FLAGS = [
  'send money first', 'deposit first', 'transfer before',
  'guaranteed visa', 'buy visa', 'cheap visa agent',
  'work without visa', 'fake documents', 'buy documents',
  'guaranteed job offer', 'pay to get job',
];

const EMERGENCY_CONTACTS = `
🆘 EMERGENCY CONTACTS — KOREA
• Crisis Hotline: 1393 (24hr, multilingual)
• Police: 112
• Ambulance / Fire: 119
• Immigration Hotline: 1345
• Labor Rights: 1350
• Cambodian Embassy Seoul: 02-3785-1041
• Domestic Violence / Assault: 1366
• Migrant Worker Center Seoul: 02-3013-4790
`;

function detectCrisis(text) {
  return CRISIS_KEYWORDS.some(kw => text.includes(kw));
}

function detectScam(text) {
  return SCAM_RED_FLAGS.some(flag => text.includes(flag));
}

// ══════════════════════════════════════════════════════════════
// AGENT 2: THE TRIAGE AGENT — Classify + enrich context
// ══════════════════════════════════════════════════════════════
//
// This is the "intelligence layer" before the AI even runs.
// It reads the message, classifies the problem category,
// and injects targeted, category-specific knowledge into
// the system prompt. K'Helper then answers with that context
// already loaded — no extra AI call needed.
//
// Categories → specialized prompt augmentation:
//   VISA       → E-9/D-4/ARC renewal procedures + hikorea.go.kr
//   WORK       → Labor law, wage theft steps, Ministry of Labor
//   HEALTH     → NHIS, free clinics, hospital navigation
//   DAILY      → Banking, SIM, transport, remittance apps
//   HOUSING    → Jeonse/wolse, tenant rights, landlord scripts
//   SCHOOL     → Child enrollment docs, multicultural center
//   COMMUNITY  → Embassy contacts, Facebook groups, support orgs
//   GENERAL    → No augmentation, standard K'Helper response

const TRIAGE_RULES = [
  {
    category: 'VISA',
    keywords: ['visa', 'e-9', 'd-4', 'd-2', 'arc', 'alien registration', 'overstay',
      'immigration', 'hikorea', 'departure', 'extend', 'renewal', 'passport',
      'entry', 'work permit', 'eps', 'hrd korea'],
    augmentation: `
## TRIAGE: VISA & IMMIGRATION QUERY
The user is asking about visa/immigration. Use this verified context:

**Key visa types for Cambodians in Korea:**
- E-9: Non-professional employment (factory, farm, construction). Requires EPS test.
- E-9 Employer Change: Allowed up to 3 times in exceptional cases (employer closure, abuse, non-payment). Call 1350 to initiate.
- D-4: Language training visa (language schools)
- D-2: Student visa (universities)
- F-series (F-4, F-5, F-6): Long-term residence visas for eligible workers/spouses

**ARC (Alien Registration Card):**
- Must register within 90 days of arrival
- Renewal: Apply at local immigration office 4 months before expiry
- Lost ARC: Report to immigration office immediately with passport + photo

**Critical resources:**
- HiKorea (English/Korean): www.hikorea.go.kr
- Immigration call center (24hr, free, multilingual): 1345
- EPS Korea official: www.eps.go.kr

**Overstay consequences:** Fines, detention, deportation ban of 1-5 years. Voluntary surrender gets leniency. Call 1345.

Always tell user: verify current rules at www.hikorea.go.kr as policies change.`,
  },
  {
    category: 'WORK',
    keywords: ['salary', 'wage', 'pay', 'boss', 'employer', 'contract', 'overtime',
      'fired', 'quit', 'resign', 'workplace', 'injury', 'accident', 'labor',
      'not paid', 'unpaid', 'minimum wage', 'work hours', 'day off', 'leave',
      'mistreatment', 'abuse', 'harassment', 'severance'],
    augmentation: `
## TRIAGE: WORK RIGHTS QUERY
The user is asking about work/labor rights. Use this verified context:

**Korean Labor Law — Key Facts:**
- Minimum wage 2024: 9,860 KRW/hour (verify current rate)
- Overtime: Anything over 8 hrs/day or 40 hrs/week = 1.5x pay
- Paid leave: 15 days/year after 1 year of work
- Severance: 30 days pay per year worked (mandatory for 1yr+ contracts)
- Employer CANNOT confiscate passport or ARC card — this is a crime

**Wage Theft Response — Immediate Steps:**
1. Gather evidence: payslips, bank statements, text messages, photos
2. File complaint: Ministry of Employment and Labor office (고용노동부)
3. Call Labor Rights hotline: 1350 (free, multilingual, 24hr)
4. Request "Unpaid Wage Certificate" — required for legal action
5. Small claims court (소액심판): recovers unpaid wages under 30M KRW cheaply

**E-9 Employer Change (if abuse/non-payment):**
- Permitted under exceptional circumstances
- Call 1350 or visit local HRD Korea center
- Document everything before leaving

**This is ALWAYS illegal in Korea:**
- Not paying wages on time
- Not paying minimum wage
- Confiscating worker documents
- Physical/verbal abuse
- Forcing unpaid overtime`,
  },
  {
    category: 'HEALTH',
    keywords: ['hospital', 'doctor', 'sick', 'pain', 'health', 'insurance', 'nhis',
      'medicine', 'prescription', 'clinic', 'emergency room', 'ambulance',
      'pregnant', 'pregnancy', 'baby', 'dental', 'mental health', 'depression',
      'anxiety', 'free clinic', 'medical', 'injury', 'fever', 'hurt'],
    augmentation: `
## TRIAGE: HEALTHCARE QUERY
The user is asking about healthcare in Korea. Use this verified context:

**NHIS (National Health Insurance Service [건강보험]):**
- E-9 workers: Automatically enrolled, ~3-4% of salary deducted
- Covers: 60-80% of most medical costs at approved hospitals
- Card: Get your 건강보험증 from NHIS website or 1577-1000
- Check coverage: nhis.or.kr

**How to see a doctor in Korea:**
1. Find a clinic (의원) or hospital (병원) — clinics are cheaper for common illness
2. Bring: ARC card + NHIS card (or just ARC, they can look it up)
3. Register at reception → see doctor → get prescription
4. Take prescription to pharmacy (약국) next door
5. Typical cost with insurance: 5,000-30,000 KRW for clinic visit

**Free / Low-Cost Options for Migrants:**
- Migrant Health Center Seoul (Guro): 02-2677-4071 (free/discounted)
- Community Health Centers (보건소): very cheap, found in every district
- Free mental health counseling: Danuri call center 1577-1366

**Emergency:**
- Call 119 for ambulance — they are free to call
- 24hr emergency rooms: Go directly, no appointment needed
- Language: Show your phone with symptoms in Korean if needed

**Common Symptoms → Korean:**
- 열이 나요 (I have a fever)
- 배가 아파요 (My stomach hurts)
- 머리가 아파요 (I have a headache)
- 기침이 나요 (I am coughing)`,
  },
  {
    category: 'DAILY',
    keywords: ['bank', 'account', 'sim', 'phone', 'money', 'send money', 'remittance',
      'transfer', 'kakao', 'app', 'bus', 'subway', 'transport', 'food',
      'market', 'shop', 'store', 'internet', 'wifi', 'license', 'driving',
      'tax', 'refund', 'atm', 'cash', 'card'],
    augmentation: `
## TRIAGE: DAILY LIFE QUERY
The user is asking about daily life in Korea. Use this verified context:

**Banking for Migrants (E-9 workers):**
- IBK Bank (기업은행): Most migrant-friendly, branches near industrial areas
- Required: ARC card + passport + employer letter
- Many branches have Khmer/English support
- Kakao Bank: Easy mobile banking, English interface available

**SIM Cards:**
- KT M Mobile, SK LTE-M: Migrant-friendly MVNOs, affordable
- Required: ARC card + passport
- Monthly plans: 15,000-30,000 KRW for calls + data

**Sending Money Home:**
- WireBarley, Wise, SentBe: Best rates for KRW → KHR/USD
- Woori Bank WON remittance: Reliable, KRW → USD → Cambodia
- Kakao Pay: Can send to some Cambodian banks
- Typical fee: 0-3%, exchange rate matters more than fee

**Public Transport:**
- T-money card: Works on all buses and subways nationwide
- Charge at convenience stores (GS25, CU, 7-Eleven)
- Kakao Maps (카카오맵): Best navigation app, shows buses/subway
- Naver Map: Also good, has English option

**Tax Refund (year-end):**
- Year-End Tax Settlement (연말정산): Usually February
- Employer handles this, but you may need to submit receipts
- Can claim refund for medical, insurance, education costs`,
  },
  {
    category: 'HOUSING',
    keywords: ['house', 'room', 'rent', 'landlord', 'jeonse', 'wolse', 'deposit',
      'apartment', 'goshiwon', 'contract', 'moving', 'eviction', 'roommate',
      'accommodation', 'dormitory', 'factory housing'],
    augmentation: `
## TRIAGE: HOUSING QUERY
The user is asking about housing in Korea. Use this verified context:

**Korean Rental System:**
- 월세 (Wolse): Monthly rent + security deposit (most common for migrants)
- 전세 (Jeonse): Pay large lump sum deposit (30-80% of property value), no monthly rent
- For E-9 workers: Usually employer-provided housing is deducted from salary (legal if below 20% of wage)

**Tenant Rights:**
- Landlord must give 30 days notice before asking you to leave
- Deposit MUST be returned within 1 month of moving out
- Landlord cannot enter your room without permission
- If landlord refuses deposit return: file with local court or call 1345

**Finding Housing:**
- Daebang (대방) or Zigbang (직방) apps: Search for 고시원 (goshiwon) or 원룸 (studio)
- Migrant support centers often have housing lists
- Facebook groups: "Cambodians in Korea" often share rooms

**Landlord Conversation Scripts:**
- "보증금은 언제 돌려주나요?" (When will you return my deposit?)
- "계약서를 주세요" (Please give me a contract)
- "집에 문제가 있어요" (There is a problem with the house)

**If Landlord Is Problematic:**
- Legal Aid: Korean Legal Aid Corporation 132 (free legal advice)
- Housing counseling: Local 주민센터 (community service center)`,
  },
  {
    category: 'SCHOOL',
    keywords: ['school', 'child', 'kid', 'son', 'daughter', 'enroll', 'education',
      'kindergarten', 'elementary', 'class', 'teacher', 'multicultural',
      'hagwon', 'tutor', 'study', 'learn korean', 'language class'],
    augmentation: `
## TRIAGE: SCHOOL / CHILDREN'S EDUCATION QUERY
The user is asking about education for children in Korea. Use this verified context:

**School Enrollment for Migrant Children:**
- ALL children in Korea have the right to attend school regardless of visa status
- This applies to undocumented children too (guaranteed by Korean law)
- Free: Elementary (초등학교, ages 6-12) and Middle School (중학교, ages 13-15)

**Enrollment Documents:**
- Proof of residence (utility bill, rental contract, employer letter)
- Family relationship document (birth certificate with Apostille or simple declaration)
- ARC card (yours)
- Passport (child's, if available)
- School will accept incomplete documents — do NOT let them turn you away

**Multicultural Family Support Center (다문화가족지원센터):**
- FREE Korean language classes for children and parents
- Located in most cities/districts
- Call: 1577-1366 (Danuri helpline)
- Services: translation, school orientation, social integration

**If School Refuses Enrollment:**
- Call the Danuri helpline: 1577-1366
- Contact: Ministry of Education student support line
- It is illegal for schools to reject migrant children

**Free Learning Resources:**
- EBS (Korean public broadcaster): Free online classes ebs.co.kr
- Multicultural education portal: www.edu4mc.or.kr`,
  },
  {
    category: 'COMMUNITY',
    keywords: ['embassy', 'community', 'cambodian', 'khmer', 'church', 'temple',
      'facebook', 'group', 'support', 'help center', 'ngo', 'volunteer',
      'organization', 'association', 'friend', 'lonely', 'homesick', 'festival'],
    augmentation: `
## TRIAGE: COMMUNITY & SUPPORT QUERY
The user is asking about community resources. Use this verified context:

**Official Cambodian Contacts in Korea:**
- Cambodian Embassy Seoul: 02-3785-1041
  Address: 657-162 Hannam-dong, Yongsan-gu, Seoul
  Hours: Mon-Fri 9am-5pm
  Services: Passport renewal, emergency travel documents, notarization

**Key Support Organizations:**
- Migrant Worker Center Seoul: 02-3013-4790
- Danuri Helpline (multilingual support): 1577-1366
- Korea Support Center for Foreign Workers: Multiple locations
- Legal Aid: Korean Legal Aid Corporation 132

**Cambodian Facebook Groups in Korea (active):**
- "ខ្មែរនៅកូរ៉េ" (Khmer in Korea) — largest community group
- "Cambodians in Seoul"
- "ការងារនៅកូរ៉េ" (Work in Korea)
- Factory-specific groups by region (Ansan, Suwon, Incheon)

**Khmer Buddhist Temples in Korea:**
- Seoul Cambodian Buddhist Center: Community hub, Khmer New Year celebrations
- Community gatherings during: Khmer New Year (April), Pchum Ben (October)

**Migrant Support Centers by Region:**
- Ansan: Ansan Global Village Center (Khmer staff available)
- Seoul: Seoul Global Center 02-2075-4180
- Incheon: Incheon Global Village Center`,
  },
];

function triageMessage(text) {
  const lower = text.toLowerCase();
  for (const rule of TRIAGE_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule;
    }
  }
  return { category: 'GENERAL', augmentation: '' };
}

// ══════════════════════════════════════════════════════════════
// AGENT 3: K'HELPER CORE SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════
const KHELPER_SYSTEM_PROMPT = `You are K'Helper — a knowledgeable, warm, and deeply trusted AI companion for Cambodians living in South Korea.

You are NOT a customer service bot. You are NOT a generic AI assistant.

You speak as if you are a Cambodian person who has lived in Korea for 6 years — you went through all of this yourself: the visa stress, the hospital confusion, the difficult bosses, the loneliness. You now help others navigate what you already survived.

## YOUR IDENTITY
- Name: K'Helper
- Voice: Warm, direct, practical. Like a trusted older sibling.
- Never robotic. Never corporate. Never generic.
- You care about the person you're talking to.

## CRITICAL LANGUAGE RULE
Detect the language of the user's MOST RECENT message. Reply in THAT EXACT language.
- User writes in English → reply ONLY in English
- User writes in Korean → reply ONLY in Korean
- User writes in Khmer → reply ONLY in Khmer (use real Khmer Unicode script — NEVER romanized Khmer)
- When in doubt → default to Khmer

## KHMER QUALITY RULES (Only when responding in Khmer)
- Write like a real Cambodian friend — NOT like Google Translate
- Use words factory workers and families actually use daily
- NEVER use overly formal or royal vocabulary
- Keep sentences SHORT — one idea per sentence
- Use ខ្ញុំ for "I". Address user as បងប្អូន or អ្នក
- Korean terms: write Khmer meaning first, then Korean in brackets: [건강보험]

## HOW TO OPEN YOUR RESPONSES
NEVER start with: "I'm sorry to hear that", "I understand your concern", "That must be difficult"
These sound fake. Instead, open with:
- Acknowledgment + action: "That's not okay — here's what you can do right now."
- Direct empathy: "Two months of no pay is serious. Your boss is breaking Korean law."
- Validation + steps: "I've been through this too. Let's fix it together."

## WHEN SOMEONE REPORTS ILLEGAL TREATMENT
If a user reports: unpaid wages, workplace abuse, illegal working conditions, employer threats, or visa violations by an employer —
→ ALWAYS state clearly: "This is ILLEGAL in Korea."
→ NEVER say "it could be a misunderstanding"
→ Give them actionable steps immediately
→ Always include the Labor Rights hotline: 1350

## CRISIS RESPONSE
If the user seems to be in immediate danger, distress, or mentions self-harm:
→ Lead with warmth and the emergency contacts
→ Do not lecture. Do not give steps. Just be human and give them a lifeline.

## SCAM WARNINGS
If a user describes something suspicious (unusual job offer, upfront payment request, unofficial visa agent):
→ Start your response with: ⚠️ WARNING: This looks like a scam.
→ Explain the red flags clearly
→ Give verification steps

## SOURCE RULE
For immigration, legal, or policy information: always note "Please verify at www.hikorea.go.kr as rules change frequently."

## FORMAT RULE
- Match the complexity of the answer to the weight of the question
- Simple question → simple answer (no headers needed)
- Complex process → numbered steps
- Never use bullet points when the user is emotionally distressed

## THE GOLDEN RULE
Every response should make the user feel: "This is someone who actually knows what they're talking about AND cares about me."`;

// ── Sanitize messages for Anthropic (strict alternation required) ──
function sanitizeMessages(messages) {
  return messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') &&
                 typeof m.content === 'string' && m.content.trim().length > 0)
    .reduce((acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
        acc[acc.length - 1] = msg; // merge consecutive same-role
      } else {
        acc.push(msg);
      }
      return acc;
    }, [])
    .filter((_, i, arr) => i === 0 ? arr[i].role === 'user' : true);
}

// ══════════════════════════════════════════════════════════════
// AGENT 4: THE MONITOR — Logging + anomaly detection
// ══════════════════════════════════════════════════════════════
function logUsage(ip, category, inputTokens, outputTokens, responseTimeMs) {
  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUSD = ((inputTokens * 0.25) + (outputTokens * 1.25)) / 1_000_000;

  // Anomaly flags
  const flags = [];
  if (outputTokens > 1000) flags.push('HIGH_OUTPUT');
  if (responseTimeMs > 8000) flags.push('SLOW_RESPONSE');
  if (totalTokens > 1500) flags.push('HIGH_TOKEN_USAGE');

  console.log(JSON.stringify({
    service: "K'Helper",
    timestamp: new Date().toISOString(),
    ip: ip.split(',')[0].trim(), // first IP only (may be proxied)
    category,
    tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
    cost_usd: estimatedCostUSD.toFixed(6),
    response_ms: responseTimeMs,
    model: 'claude-haiku-4-5',
    flags: flags.length > 0 ? flags : null,
  }));
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER — The 5-Agent Pipeline
// ══════════════════════════════════════════════════════════════
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
    // ── AGENT 0: SENTINEL — Parse & validate ──
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON.' }) };
    }

    const { messages } = body;
    const validation = validateInput(messages);
    if (!validation.valid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: validation.error }) };
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (isRateLimited(ip)) {
      return {
        statusCode: 429, headers,
        body: JSON.stringify({
          error: "You've sent too many messages. Please wait an hour before continuing. If this is urgent, call 1345 (Immigration) or 112 (Police)."
        })
      };
    }

    // ── AGENT 1: GUARDIAN — Crisis & scam detection ──
    const lastText = (messages[messages.length - 1]?.content || '').toLowerCase();

    if (detectCrisis(lastText)) {
      logUsage(ip, 'CRISIS', 0, 0, Date.now() - startTime);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          choices: [{
            message: {
              content: `I can see you might be going through something really serious right now.\n\nYou are not alone. Please reach out to someone who can help you right now:\n${EMERGENCY_CONTACTS}\nI am here too. Tell me what's happening and let's work through this together.`
            }
          }],
          _meta: { category: 'CRISIS', triage: true }
        })
      };
    }

    const isScam = detectScam(lastText);
    const scamWarning = isScam
      ? '\n\n⚠️ SCAM ALERT: The situation described contains red flags commonly seen in scams targeting migrant workers. Address this carefully in the response.'
      : '';

    // ── AGENT 2: TRIAGE AGENT — Classify + enrich ──
    const triage = triageMessage(lastText);
    const enrichedSystem = KHELPER_SYSTEM_PROMPT + scamWarning + triage.augmentation;

    // ── Check API key ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: 'Service configuration error. Please try again later.' })
      };
    }

    // ── AGENT 3: K'HELPER CORE — Call Claude ──
    const cleanMessages = sanitizeMessages(messages);

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
      const err = await response.json();
      console.error("[K'Helper] Anthropic error:", JSON.stringify(err));
      return {
        statusCode: 502, headers,
        body: JSON.stringify({
          error: 'AI service temporarily unavailable. For urgent help call 1345 (Immigration) or 112 (Police).'
        })
      };
    }

    const data = await response.json();
    const replyText = data.content?.[0]?.text || '';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    // ── AGENT 4: MONITOR — Log usage + anomalies ──
    logUsage(ip, triage.category, inputTokens, outputTokens, Date.now() - startTime);

    // Return in OpenAI-compatible shape — frontend needs zero changes
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        choices: [{ message: { content: replyText } }],
        usage: { total_tokens: inputTokens + outputTokens },
        _meta: {
          category: triage.category,
          scam_detected: isScam,
          response_ms: Date.now() - startTime,
        }
      })
    };

  } catch (error) {
    console.error("[K'Helper] Unexpected error:", error);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Something went wrong. For urgent help, call 1345 or 112." })
    };
  }
};
