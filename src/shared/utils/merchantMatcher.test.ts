import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeMerchant,
  calculateHeaderFingerprint,
  guessColumnMapping,
  categorizeLocally,
  saveLearnedMerchantRule,
  getLearnedMerchantRules,
  isPaymentOrTransfer,
} from './merchantMatcher';

describe('merchantMatcher', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  describe('normalizeMerchant', () => {
    it('normalizes Toast POS and Square prefixes', () => {
      expect(normalizeMerchant('TST*MAGNOLIAS')).toBe('MAGNOLIAS');
      expect(normalizeMerchant('SQ *RK CARPET SERVICES LL')).toBe('RK CARPET SERVICES');
    });

    it('strips store numbers and corporate suffixes', () => {
      expect(normalizeMerchant('GIANT FOOD INC #192')).toBe('GIANT FOOD');
      expect(normalizeMerchant('THE HOME DEPOT 2560')).toBe('THE HOME DEPOT');
      expect(normalizeMerchant("KOHL'S #0265")).toBe("KOHL'S");
      expect(normalizeMerchant('WALGREENS #17928')).toBe('WALGREENS');
      expect(normalizeMerchant('PANERA BREAD #203578 P')).toBe('PANERA BREAD P');
    });

    it('normalizes Amazon order descriptions to AMAZON', () => {
      expect(normalizeMerchant('Amazon.com*5I4ID5RP2')).toBe('AMAZON');
      expect(normalizeMerchant('AMAZON MKTPL*511Z03752')).toBe('AMAZON');
    });

    it('strips long transaction numbers from fuel stations', () => {
      expect(normalizeMerchant('SHELL OIL 57543580203')).toBe('SHELL OIL');
      expect(normalizeMerchant('FLOWER HILL LIBERTY 0756')).toBe('FLOWER HILL LIBERTY');
    });
  });

  describe('calculateHeaderFingerprint', () => {
    it('creates deterministic sorted token signature', () => {
      const headers1 = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount'];
      const headers2 = ['Amount', 'Category', 'Description', 'Post Date', 'Transaction Date', 'Type'];
      expect(calculateHeaderFingerprint(headers1)).toBe(calculateHeaderFingerprint(headers2));
      expect(calculateHeaderFingerprint(headers1)).toBe('amount|category|description|postdate|transactiondate|type');
    });
  });

  describe('guessColumnMapping', () => {
    it('detects Capital One style with negative sales', () => {
      const headers = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount'];
      const sampleRows = [
        ['10/07/2026', '10/07/2026', 'Amazon.com*5I4ID5RP2', 'Shopping', 'Sale', '-7.24'],
        ['10/06/2026', '10/07/2026', 'THE HOME DEPOT 2560', 'Home', 'Sale', '-7.39'],
        ['10/04/2026', '10/04/2026', 'AUTOMATIC PAYMENT - THANK', 'Payment', 'Payment', '2910.23'],
      ];

      const mapping = guessColumnMapping(headers, sampleRows);
      expect(mapping.dateColumn).toBe('Transaction Date');
      expect(mapping.descriptionColumn).toBe('Description');
      expect(mapping.amountColumn).toBe('Amount');
      expect(mapping.chargesAreNegative).toBe(true);
      expect(mapping.categoryColumn).toBe('Category');
      expect(mapping.typeColumn).toBe('Type');
    });

    it('detects separate debit and credit columns', () => {
      const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
      const mapping = guessColumnMapping(headers);
      expect(mapping.amountMode).toBe('split_debit_credit');
      expect(mapping.debitColumn).toBe('Debit');
      expect(mapping.creditColumn).toBe('Credit');
    });
  });

  describe('categorizeLocally', () => {
    it('categorizes via keyword heuristics', () => {
      const resGrocery = categorizeLocally('GIANT FOOD INC #192', 'Groceries');
      expect(resGrocery.category).toBe('Living');
      expect(resGrocery.lineItem).toBe('Groceries');
      expect(resGrocery.isUnknown).toBe(false);

      const resGas = categorizeLocally('SHELL OIL 57543580203', 'Gas');
      expect(resGas.category).toBe('Transportation');
      expect(resGas.lineItem).toBe('Gasoline');

      const resDental = categorizeLocally('THREE CREEK DENTISTRY', 'Health & Wellness');
      expect(resDental.category).toBe('Healthcare');
      expect(resDental.lineItem).toBe('Prescriptions & Medical');
    });

    it('prioritizes learned merchant rules over heuristics', () => {
      saveLearnedMerchantRule({
        normalizedKey: 'GIANT FOOD',
        category: 'CustomCategory',
        lineItem: 'CustomGroceries',
        lastUsed: new Date().toISOString(),
        matchCount: 1,
      });

      expect(getLearnedMerchantRules().length).toBe(1);

      const res = categorizeLocally('GIANT FOOD INC #192', 'Groceries');
      expect(res.category).toBe('CustomCategory');
      expect(res.lineItem).toBe('CustomGroceries');
      expect(res.source).toBe('learned');
    });

    it('marks novel unrecognized merchants as Unknown', () => {
      const res = categorizeLocally('XYZZY UNKNOWN MERCHANT 999', 'Other');
      expect(res.lineItem).toBe('Unknown');
      expect(res.isUnknown).toBe(true);
      expect(res.source).toBe('unknown');
    });
  });

  describe('isPaymentOrTransfer', () => {
    it('detects Capital One automatic payments', () => {
      expect(isPaymentOrTransfer('AUTOMATIC PAYMENT - THANK', 'Payment', 'Payment')).toBe(true);
      expect(isPaymentOrTransfer('AUTOMATIC PAYMENT - THANK')).toBe(true);
    });

    it('detects Chase, Amex, and Discover payment variations', () => {
      expect(isPaymentOrTransfer('PAYMENT - THANK YOU')).toBe(true);
      expect(isPaymentOrTransfer('ONLINE PAYMENT - THANK YOU 1234')).toBe(true);
      expect(isPaymentOrTransfer('AUTOPAY PAYMENT')).toBe(true);
      expect(isPaymentOrTransfer('MOBILE PAYMENT - THANK YOU')).toBe(true);
      expect(isPaymentOrTransfer('ELECTRONIC PAYMENT RECEIVED')).toBe(true);
      expect(isPaymentOrTransfer('ACH PAYMENT - CAPITAL ONE')).toBe(true);
      expect(isPaymentOrTransfer('BILL PAYMENT CHK 123')).toBe(true);
      expect(isPaymentOrTransfer('CREDIT CARD PAYMENT')).toBe(true);
    });

    it('detects account transfers', () => {
      expect(isPaymentOrTransfer('ONLINE TRANSFER FROM CHECKING')).toBe(true);
      expect(isPaymentOrTransfer('ACCOUNT TRANSFER TO SAVINGS')).toBe(true);
    });

    it('detects type/category indicator even with non-standard description', () => {
      expect(isPaymentOrTransfer('XYZ TRANSACTION', 'Payment')).toBe(true);
      expect(isPaymentOrTransfer('UNKNOWN TRANSACTION', undefined, 'Payments')).toBe(true);
      expect(isPaymentOrTransfer('UNKNOWN TRANSACTION', 'transfer')).toBe(true);
    });

    it('does not falsely flag normal merchants as payments', () => {
      expect(isPaymentOrTransfer('GIANT FOOD INC #192', 'Sale', 'Groceries')).toBe(false);
      expect(isPaymentOrTransfer('THE HOME DEPOT 2560', 'Sale', 'Home')).toBe(false);
      expect(isPaymentOrTransfer('SHELL OIL 57543580203', 'Sale', 'Gas')).toBe(false);
      expect(isPaymentOrTransfer('Amazon.com*5I4ID5RP2', 'Sale', 'Shopping')).toBe(false);
      expect(isPaymentOrTransfer("KOHL'S #0265", 'Return', 'Shopping')).toBe(false);
    });
  });
});

