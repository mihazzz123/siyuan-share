/**
 * Kramdown парсингтест
 * для
 */

import { parseKramdownToMarkdown } from './kramdown-parser';

/**
 * тест
 */
const testCases = [
    {
        name: " IAL очистка",
        input: `содержимое
{: id="20210101-abc1234" style="color:red"}
содержимое
{: id="20210102-def5678"}`,
        expected: `содержимое

содержимое`
    },
    {
        name: " IAL - ",
        input: `* {: id="20201225220955-2nn1mns"}новый，подновыйдокумент
  {: id="20210131155408-3t627wc"}
* {: id="20201225220955-uwhqnug"}...<kbd>/</kbd> `,
        expected: `* новый，подновыйдокумент

* ...<kbd>/</kbd> `
    },
    {
        name: " IAL - ",
        input: `1. {: id="20251106140708-noc3gik" updated="20251106140708"}
2. {: id="20251106140709-xyz1234" fold="1"}`,
        expected: `1. 
2. `
    },
    {
        name: " IAL - кодаэлемент",
        input: `，\`кода\`{: id="xxx"}содержимое{: style="color:red"}。`,
        expected: `，\`кода\`содержимое。`
    },
    {
        name: "Блокссылка - ",
        input: `ссылка ((20210101-abc1234 "")) 。`,
        expected: `ссылка [] 。`
    },
    {
        name: "Блокссылка - ",
        input: `просмотр ((20210101-abc1234)) 。`,
        expected: `просмотр [ссылка] 。`
    },
    {
        name: "",
        input: `под：
{{SELECT * FROM blocks WHERE content LIKE '%тест%'}}
`,
        expected: `под：

`
    },
    {
        name: "YAML Front Matter очистка",
        input: `---
title: тестдокумент
date: 2021-01-01
---
содержимое`,
        expected: `содержимое`
    },
    {
        name: "структура",
        input: `* {: id="20201225220955-2nn1mns"}новый，подновыйдокумент
  {: id="20210131155408-3t627wc"}
* {: id="20201225220955-uwhqnug"}...<kbd>/</kbd> 
  {: id="20210131155408-btnfw88"}
* просмотр ((20200813131152-0wk5akh "")) `,
        expected: `* новый，подновыйдокумент

* ...<kbd>/</kbd> 

* просмотр [] `
    },
    {
        name: " IAL ",
        input: `1. {: id="item1"}
   {: id="sub1"}
2. {: id="item2" fold="1" heading-fold="1"}

содержимое{: style="color:blue"}。
{: id="para1" updated="20251106140708"}`,
        expected: `1. 

2. 

содержимое。`
    },
    {
        name: "обработка",
        input: "",
        expected: ""
    },
    {
        name: " IAL ",
        input: `{: id="20210101-abc1234"}
{: id="20210102-def5678"}`,
        expected: ``
    }
];

/**
 * тест
 */
function runTests() {
    console.log("🧪  Kramdown парсингтест...\n");
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = parseKramdownToMarkdown(testCase.input);
        const success = result.trim() === testCase.expected.trim();
        
        if (success) {
            console.log(`✅ ${testCase.name}`);
            passed++;
        } else {
            console.log(`❌ ${testCase.name}`);
            console.log(`   : ${JSON.stringify(testCase.expected)}`);
            console.log(`   : ${JSON.stringify(result)}`);
            failed++;
        }
    }
    
    console.log(`\n📊 тест: ${passed} через, ${failed} Ошибка`);
    
    if (failed === 0) {
        console.log("🎉 тестчерез！");
    }
}

// тест（）
if (typeof window !== 'undefined') {
    (window as any).testKramdownParser = runTests;
}
