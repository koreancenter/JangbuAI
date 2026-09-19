import { 
  parseFinancialInputDeterministically, 
  parseKoreanAmount, 
  anonymizeFinancialInput 
} from '../src/financialParser';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

console.log('=== Running Financial Parser Test Suite ===\n');

// Test 1: Korean Amount Parsing
assert(parseKoreanAmount('4만원') === 40000, '4만원 parses to 40,000');
assert(parseKoreanAmount('4만 5천원') === 45000, '4만 5천원 parses to 45,000');
assert(parseKoreanAmount('1.5만') === 15000, '1.5만 parses to 15,000');
assert(parseKoreanAmount('3,500,000원') === 3500000, '3,500,000원 parses to 3,500,000');
assert(parseKoreanAmount('150만원') === 1500000, '150만원 parses to 1,500,000');
assert(parseKoreanAmount('20k') === 20000, '20k parses to 20,000');
assert(parseKoreanAmount('$35') === 35, '$35 parses to 35');
assert(parseKoreanAmount('1억 2천만원') === 120000000, '1억 2천만원 parses to 120,000,000');

// Test 2: PII Sanitization
const piiInput = '신한카드 9410-1234-5678-9999로 010-1234-5678에서 5만원 결제함 950101-1234567';
const sanitized = anonymizeFinancialInput(piiInput);
assert(!sanitized.includes('9410-1234-5678-9999'), 'Card number is stripped');
assert(!sanitized.includes('010-1234-5678'), 'Phone number is stripped');
assert(!sanitized.includes('950101-1234567'), 'RRN is stripped');
assert(sanitized.includes('[CARD]'), 'Card token added');

// Test 3: Dutch Pay Parsing (The critical bug)
const dutchPrompt = '민수랑 파스타 4만원 더치페이하고 토스로 2만원 받음';
const dutchResult = parseFinancialInputDeterministically(dutchPrompt);
assert(dutchResult.length === 2, 'Dutch pay creates 2 transactions (expense & settlement)');
assert(dutchResult[0].type === 'EXPENSE', 'First transaction is EXPENSE');
assert(dutchResult[0].amount === 40000, 'Expense amount is 40,000 (not 4)');
assert(dutchResult[0].category === 'Food', 'Category is Food (not Uncategorized)');
assert(dutchResult[1].type === 'SETTLEMENT', 'Second transaction is SETTLEMENT');
assert(dutchResult[1].amount === 20000, 'Settlement amount is 20,000');
assert(dutchResult[1].paymentMethod === 'Toss', 'Settlement method is Toss');

// Test 4: Quick Tag Suggestions
const starbucksResult = parseFinancialInputDeterministically('스타벅스 아메리카노 4500원 카드 결제');
assert(starbucksResult[0].amount === 4500, 'Starbucks amount is 4500');
assert(starbucksResult[0].category === 'Food', 'Starbucks category is Food');
assert(starbucksResult[0].subCategory === 'Cafe', 'Starbucks subCategory is Cafe');

const emartResult = parseFinancialInputDeterministically('이마트 장보기 35000원 현대카드');
assert(emartResult[0].amount === 35000, 'Emart amount is 35000');
assert(emartResult[0].category === 'Food', 'Emart category is Food');
assert(emartResult[0].subCategory === 'Grocery', 'Emart subCategory is Grocery');
assert(emartResult[0].paymentMethod === '현대카드', 'Payment method is 현대카드');

const sundubuResult = parseFinancialInputDeterministically('점심 순두부찌개 12000원 계좌이체');
assert(sundubuResult[0].amount === 12000, 'Sundubu amount is 12000');
assert(sundubuResult[0].category === 'Food', 'Sundubu category is Food');
assert(sundubuResult[0].subCategory === 'Dining', 'Sundubu subCategory is Dining');

// Test 5: Multi-item clauses
const multiResult = parseFinancialInputDeterministically('쿠팡에서 화장지 2만원, 영양제 3만원 결제함');
assert(multiResult.length === 2, 'Multi-clause creates 2 items');
assert(multiResult[0].amount === 20000, 'First item is 20000');
assert(multiResult[0].category === 'Living', 'First item is Living');
assert(multiResult[1].amount === 30000, 'Second item is 30000');
assert(multiResult[1].category === 'Health', 'Second item is Health');

// Test 6: Salary & Transfer
const salaryResult = parseFinancialInputDeterministically('이번 달 월급 3,500,000원 기업은행 입금');
assert(salaryResult[0].type === 'INCOME', 'Salary type is INCOME');
assert(salaryResult[0].amount === 3500000, 'Salary amount is 3,500,000');

const transferResult = parseFinancialInputDeterministically('주택청약 통장으로 150만원 자동이체');
assert(transferResult[0].type === 'TRANSFER', 'Transfer type is TRANSFER');
assert(transferResult[0].amount === 1500000, 'Transfer amount is 1,500,000');

console.log('\n=== All Tests Passed Successfully! ===');
