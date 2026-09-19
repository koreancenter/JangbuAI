import { describe, it, expect } from 'vitest';
import { 
  parseFinancialInputDeterministically, 
  parseKoreanAmount, 
  anonymizeFinancialInput 
} from '../src/financialParser';

describe('Financial Parser Deterministic Engine', () => {
  it('parses Korean amount representations accurately', () => {
    expect(parseKoreanAmount('4만원')).toBe(40000);
    expect(parseKoreanAmount('4만 5천원')).toBe(45000);
    expect(parseKoreanAmount('1.5만')).toBe(15000);
    expect(parseKoreanAmount('3,500,000원')).toBe(3500000);
    expect(parseKoreanAmount('150만원')).toBe(1500000);
    expect(parseKoreanAmount('20k')).toBe(20000);
    expect(parseKoreanAmount('$35')).toBe(35);
    expect(parseKoreanAmount('1억 2천만원')).toBe(120000000);
  });

  it('anonymizes and strips sensitive PII (card, phone, RRN)', () => {
    const piiInput = '신한카드 9410-1234-5678-9999로 010-1234-5678에서 5만원 결제함 950101-1234567';
    const sanitized = anonymizeFinancialInput(piiInput);
    expect(sanitized).not.toContain('9410-1234-5678-9999');
    expect(sanitized).not.toContain('010-1234-5678');
    expect(sanitized).not.toContain('950101-1234567');
    expect(sanitized).toContain('[CARD]');
  });

  it('correctly splits Dutch Pay into expense and settlement', () => {
    const dutchPrompt = '민수랑 파스타 4만원 더치페이하고 토스로 2만원 받음';
    const dutchResult = parseFinancialInputDeterministically(dutchPrompt);
    expect(dutchResult).toHaveLength(2);
    expect(dutchResult[0].type).toBe('EXPENSE');
    expect(dutchResult[0].amount).toBe(40000);
    expect(dutchResult[0].category).toBe('Food');
    expect(dutchResult[1].type).toBe('SETTLEMENT');
    expect(dutchResult[1].amount).toBe(20000);
    expect(dutchResult[1].paymentMethod).toBe('Toss');
  });

  it('suggests appropriate categories and subcategories', () => {
    const starbucksResult = parseFinancialInputDeterministically('스타벅스 아메리카노 4500원 카드 결제');
    expect(starbucksResult[0].amount).toBe(4500);
    expect(starbucksResult[0].category).toBe('Food');
    expect(starbucksResult[0].subCategory).toBe('Cafe');

    const emartResult = parseFinancialInputDeterministically('이마트 장보기 35000원 현대카드');
    expect(emartResult[0].amount).toBe(35000);
    expect(emartResult[0].category).toBe('Food');
    expect(emartResult[0].subCategory).toBe('Grocery');
    expect(emartResult[0].paymentMethod).toBe('현대카드');

    const sundubuResult = parseFinancialInputDeterministically('점심 순두부찌개 12000원 계좌이체');
    expect(sundubuResult[0].amount).toBe(12000);
    expect(sundubuResult[0].category).toBe('Food');
    expect(sundubuResult[0].subCategory).toBe('Dining');
  });

  it('handles multi-item compound clauses', () => {
    const multiResult = parseFinancialInputDeterministically('쿠팡에서 화장지 2만원, 영양제 3만원 결제함');
    expect(multiResult).toHaveLength(2);
    expect(multiResult[0].amount).toBe(20000);
    expect(multiResult[0].category).toBe('Living');
    expect(multiResult[1].amount).toBe(30000);
    expect(multiResult[1].category).toBe('Health');
  });

  it('identifies salary income and transfers', () => {
    const salaryResult = parseFinancialInputDeterministically('이번 달 월급 3,500,000원 기업은행 입금');
    expect(salaryResult[0].type).toBe('INCOME');
    expect(salaryResult[0].amount).toBe(3500000);

    const transferResult = parseFinancialInputDeterministically('주택청약 통장으로 150만원 자동이체');
    expect(transferResult[0].type).toBe('TRANSFER');
    expect(transferResult[0].amount).toBe(1500000);
  });
});
