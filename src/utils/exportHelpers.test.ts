import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeFileName,
  getDefaultExportFileName,
  generateJsonBlob,
  generateExcelExportBlob,
  saveFileWithLocationPrompt,
  isFileSystemAccessSupported,
} from './exportHelpers';
import { AppStateInputs, DEFAULT_DETAILED_EXPENSES_STATE } from '../types';

const mockInputs: AppStateInputs = {
  isSingleFiler: false,
  you: {
    name: 'John Doe',
    birthDate: '1960-05-15',
    plannedRetirementAge: 65,
    plannedRetirementMonth: 5,
    longevityAge: 90,
    activeSalary: 120000,
    targetSSClaimingAge: 70,
    estimatedPIA: 3200,
    preMedicareMonthlyPremium: 600,
    healthcare: undefined,
  },
  wife: {
    name: 'Jane Doe',
    birthDate: '1962-08-20',
    plannedRetirementAge: 65,
    plannedRetirementMonth: 8,
    longevityAge: 92,
    activeSalary: 80000,
    targetSSClaimingAge: 67,
    estimatedPIA: 2100,
    preMedicareMonthlyPremium: 600,
    healthcare: undefined,
  },
  portfolio: {
    yourTaxableBrokerage: 500000,
    yourTaxableBasis: 350000,
    wifeTaxableBrokerage: 200000,
    wifeTaxableBasis: 150000,
    yourPreTaxIRA: 800000,
    wifePreTaxIRA: 400000,
    yourRothIRA: 100000,
    wifeRothIRA: 50000,
    yourCash: 50000,
    wifeCash: 25000,
    taxableDividendYield: 0.02,
    taxableNonQualifiedPortion: 0.15,
  },
  annualLivingExpenses: 90000,
  isConfigured: true,
  useDetailedExpenses: false,
  detailedExpenses: JSON.parse(JSON.stringify(DEFAULT_DETAILED_EXPENSES_STATE)),
  growthAssumptions: {
    equityReturnRate: 0.07,
    fixedIncomeReturnRate: 0.04,
    cpiInflationRate: 0.025,
    healthcareInflationRate: 0.05,
  },
  monteCarloSettings: {
    mode: 'historical',
    trials: 500,
    equityVolatility: 0.15,
    fixedIncomeVolatility: 0.05,
    correlation: 0.15,
    seed: null,
  },
  jurisdiction: {
    currentState: 'MD',
    targetState: 'FL',
    relocationYear: 2030,
  },
  rothConversionStrategy: 'flat',
  annualRothConversion: 0,
  rothConversionTargetValue: 0,
  rothConversionStartYear: 2026,
  rothConversionEndYear: 2035,
};

describe('exportHelpers', () => {
  describe('sanitizeFileName', () => {
    it('appends extension if missing', () => {
      const result = sanitizeFileName('my_plan', '.json');
      expect(result).toBe('my_plan.json');
    });

    it('does not duplicate extension if already included', () => {
      const result = sanitizeFileName('my_plan.json', '.json');
      expect(result).toBe('my_plan.json');
    });

    it('strips illegal characters from filename', () => {
      const result = sanitizeFileName('plan:test/2026*file?<name>|"final"', '.xlsx');
      expect(result).toBe('plan_test_2026_file__name___final_.xlsx');
    });

    it('provides fallback name if input is empty or whitespace', () => {
      const result = sanitizeFileName('   ', '.pdf');
      expect(result).toMatch(/^retirement_plan_\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });

  describe('getDefaultExportFileName', () => {
    it('generates personalized filename with user name and timestamp for json', () => {
      const filename = getDefaultExportFileName('json', mockInputs);
      expect(filename).toMatch(/^John_Doe_Retirement_Plan_\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('generates personalized filename with user name and timestamp for pdf', () => {
      const filename = getDefaultExportFileName('pdf', mockInputs);
      expect(filename).toMatch(/^John_Doe_Retirement_Report_\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('generates personalized filename with user name and timestamp for excel', () => {
      const filename = getDefaultExportFileName('excel', mockInputs);
      expect(filename).toMatch(/^John_Doe_Retirement_Ledger_\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('handles empty user name gracefully without leading underscore', () => {
      const emptyUserInputs: AppStateInputs = {
        ...mockInputs,
        you: { ...mockInputs.you, name: '' },
      };
      const filename = getDefaultExportFileName('json', emptyUserInputs);
      expect(filename).toMatch(/^Retirement_Plan_\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('generateJsonBlob', () => {
    it('generates valid JSON blob containing the input state', async () => {
      const blob = generateJsonBlob(mockInputs);
      expect(blob.type).toBe('application/json');

      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.you.name).toBe('John Doe');
      expect(parsed.portfolio.yourPreTaxIRA).toBe(800000);
      expect(parsed.simulateSurvivor).toBe(false);
    });

    it('preserves simulateSurvivor toggle state in exported JSON', async () => {
      const blob = generateJsonBlob(mockInputs, true);
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.simulateSurvivor).toBe(true);
    });
  });

  describe('generateExcelExportBlob', () => {
    it('generates valid Excel spreadsheet blob', () => {
      const blob = generateExcelExportBlob([], mockInputs);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('generates valid Excel spreadsheet blob with dynamic detailed expenses catalog', () => {
      const detailedInputs: AppStateInputs = {
        ...mockInputs,
        useDetailedExpenses: true,
        detailedExpenses: {
          catalog: {
            categories: ['Hobbies', 'Utilities'],
            items: [
              { id: 'woodworking', name: 'Woodworking Shop', category: 'Hobbies', defaultFrequency: 12 },
              { id: 'newTools', name: 'New Table Saw', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
            ]
          },
          costs: {
            MD: { woodworking: 250, newTools: 1500 },
            FL: { woodworking: 150, newTools: 800 }
          },
          frequencies: {
            woodworking: 12
          }
        }
      };

      const blob = generateExcelExportBlob([], detailedInputs);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('saveFileWithLocationPrompt and browser APIs', () => {
    const originalWindow = (globalThis as any).window;
    const originalDocument = (globalThis as any).document;
    const originalURL = globalThis.URL;

    beforeEach(() => {
      vi.restoreAllMocks();
      (globalThis as any).window = {};
      (globalThis as any).document = {
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        createElement: vi.fn(() => ({
          href: '',
          download: '',
          click: vi.fn(),
        })),
      };
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      globalThis.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      globalThis.URL = originalURL;
    });

    it('uses showSaveFilePicker when available and returns success', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockHandle = {
        name: 'custom_saved_plan.json',
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };

      (globalThis as any).window.showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

      const blob = generateJsonBlob(mockInputs);
      const result = await saveFileWithLocationPrompt(blob, 'custom_saved_plan', 'json', true);

      expect((globalThis as any).window.showSaveFilePicker).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith(blob);
      expect(mockWritable.close).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.savedViaPicker).toBe(true);
      expect(result.filename).toBe('custom_saved_plan.json');
    });

    it('handles cancellation gracefully when user dismisses picker', async () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';

      (globalThis as any).window.showSaveFilePicker = vi.fn().mockRejectedValue(abortErr);

      const blob = generateJsonBlob(mockInputs);
      const result = await saveFileWithLocationPrompt(blob, 'my_plan', 'json', true);

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('falls back to browser anchor download when promptForLocation is false', async () => {
      const blob = generateJsonBlob(mockInputs);
      const result = await saveFileWithLocationPrompt(blob, 'my_download', 'json', false);

      expect(result.success).toBe(true);
      expect(result.savedViaPicker).toBe(false);
      expect(result.filename).toBe('my_download.json');
    });

    it('returns true when showSaveFilePicker is in window', () => {
      (globalThis as any).window.showSaveFilePicker = () => {};
      expect(isFileSystemAccessSupported()).toBe(true);
    });
  });
});
