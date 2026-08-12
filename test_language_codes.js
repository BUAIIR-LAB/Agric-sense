// Simple test for the language name → code mapping
// Mirrors src/constants/languages.ts (plain JS so it runs without a bundler)

const languageToCode = {
    English: 'en',
    Luganda: 'lg',
    Ateso: 'at',
    Acholi: 'ac',
    Japadhola: 'jp',
    Runyankore: 'nyn',
};

const getLanguageCode = (language) =>
    languageToCode[language ?? ''] ?? 'en';

// ── Test cases ────────────────────────────────────────────────────────────────
const tests = [
    // [input,       expectedCode, description]
    ['Luganda', 'lg', 'Luganda → lg (the reported bug case)'],
    ['English', 'en', 'English → en'],
    ['Ateso', 'at', 'Ateso → at'],
    ['Acholi', 'ac', 'Acholi → ac'],
    ['Japadhola', 'jp', 'Japadhola → jp'],
    ['Runyankore', 'nyn', 'Runyankore → nyn'],
    [undefined, 'en', 'undefined → falls back to en'],
    [null, 'en', 'null → falls back to en'],
    ['French', 'en', 'Unknown language → falls back to en'],
    ['luganda', 'en', 'Lowercase "luganda" → falls back to en (case-sensitive)'],
];

let passed = 0;
let failed = 0;

console.log('\n🌍  Language Code Mapping Tests\n' + '─'.repeat(52));

for (const [input, expected, desc] of tests) {
    const result = getLanguageCode(input);
    const ok = result === expected;
    if (ok) {
        passed++;
        console.log(`  ✅  ${desc}`);
        console.log(`       getLanguageCode(${JSON.stringify(input)}) → "${result}"\n`);
    } else {
        failed++;
        console.log(`  ❌  ${desc}`);
        console.log(`       getLanguageCode(${JSON.stringify(input)}) → "${result}" (expected "${expected}")\n`);
    }
}

console.log('─'.repeat(52));
console.log(`  ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
