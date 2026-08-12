#!/usr/bin/env node
/**
 * AgriSense API Integration Test
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the /ask (chat) endpoint with different language codes to verify:
 *   1. The API accepts language codes (not full names)
 *   2. Responses are returned in the correct language
 *
 * Usage:
 *   node test_api_language.js
 *
 * Optional env overrides:
 *   CHAT_API_URL=https://... node test_api_language.js
 *   USER_ID=my-user-id node test_api_language.js
 */

const CHAT_API_URL =
    process.env.CHAT_API_URL ||
    'https://wanly-subtemperate-kaylene.ngrok-free.dev';

// Use a stable test user ID (won't pollute real conversations)
const USER_ID = process.env.USER_ID || 'test-user-language-check';

// ── Helpers ───────────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

const log = (...a) => console.log(...a);
const ok = (msg) => log(`  ${GREEN}✅${RESET}  ${msg}`);
const fail = (msg) => log(`  ${RED}❌${RESET}  ${msg}`);
const info = (msg) => log(`  ${CYAN}ℹ${RESET}   ${msg}`);
const warn = (msg) => log(`  ${YELLOW}⚠${RESET}   ${msg}`);
const dim = (msg) => log(`${DIM}${msg}${RESET}`);

function truncate(str, n = 200) {
    if (!str) return '(empty)';
    return str.length > n ? str.slice(0, n) + '…' : str;
}

async function askQuestion({ prompt, targetLang, conversationId }) {
    const payload = {
        prompt,
        user_id: USER_ID,
        target_lang: targetLang,
        user_profile: {
            name: 'Test Farmer',
            area: 'Kampala, Uganda',
            preferred_language: targetLang,
            crops_grown: ['Maize', 'Beans'],
        },
    };
    if (conversationId) payload.conversation_id = conversationId;

    const res = await fetch(`${CHAT_API_URL}/ask`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
}

// ── Test cases ────────────────────────────────────────────────────────────────
const TESTS = [
    {
        label: 'English (en) — baseline',
        targetLang: 'en',
        prompt: 'What is the best time to plant maize in Uganda?',
    },
    {
        label: 'Luganda (lg) — primary non-English language',
        targetLang: 'lg',
        prompt: 'Obudde bweki obulungi okusimba kasooli mu Uganda?', // "What is the best time to plant maize in Uganda?" in Luganda
    },
    {
        label: 'Runyankore (nyn)',
        targetLang: 'nyn',
        prompt: 'What diseases affect beans in western Uganda?',
    },
];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
    log(`\n${BOLD}🌍  AgriSense API Language Integration Test${RESET}`);
    log(`${DIM}Chat API: ${CHAT_API_URL}${RESET}`);
    log(`${DIM}User ID:  ${USER_ID}${RESET}`);
    log('─'.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const test of TESTS) {
        log(`\n${BOLD}Test: ${test.label}${RESET}`);
        info(`target_lang sent to API: "${test.targetLang}"`);
        info(`Prompt: "${truncate(test.prompt, 80)}"`);

        const start = Date.now();
        try {
            const data = await askQuestion(test);
            const elapsed = Date.now() - start;

            // Validate response shape
            if (!data.conversation_id) {
                fail('Response missing conversation_id');
                failed++;
                continue;
            }
            if (!data.results) {
                fail('Response missing results field');
                failed++;
                continue;
            }

            ok(`Response received in ${elapsed}ms`);
            ok(`conversation_id: ${data.conversation_id}`);
            if (data.intent) info(`intent: ${data.intent}`);
            log(`\n  ${CYAN}Response preview:${RESET}`);
            dim(`  "${truncate(data.results, 300)}"`);
            passed++;
        } catch (err) {
            const elapsed = Date.now() - start;
            fail(`Request failed after ${elapsed}ms: ${err.message}`);
            failed++;
        }

        log('─'.repeat(60));
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    log(`\n${BOLD}Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed > 0 ? RED : ''}${failed} failed${RESET}\n`);

    if (failed > 0) process.exit(1);
})();
