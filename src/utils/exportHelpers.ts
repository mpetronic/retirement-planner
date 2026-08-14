import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { AppStateInputs, SimulationResultRow } from '../types';
import { ConfigurationPDF } from '../components/ConfigurationPDF';
import { generateExcelBlob } from './excelExport';

export type ExportFormatType = 'json' | 'pdf' | 'excel';

export interface FileTypeDefinition {
  description: string;
  accept: Record<string, string[]>;
  extension: string;
  mimeType: string;
}

export const EXPORT_FORMAT_CONFIGS: Record<ExportFormatType, FileTypeDefinition> = {
  json: {
    description: 'JSON Retirement Plan Configuration',
    accept: { 'application/json': ['.json'] },
    extension: '.json',
    mimeType: 'application/json',
  },
  pdf: {
    description: 'PDF Retirement Plan Report',
    accept: { 'application/pdf': ['.pdf'] },
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  excel: {
    description: 'Excel Simulation Ledger',
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

/**
 * Checks if the browser natively supports the File System Access API
 * allowing the user to choose an exact folder/directory on disk.
 */
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
};

/**
 * Sanitizes an input string to be a safe filesystem filename with appropriate extension.
 */
export const sanitizeFileName = (fileName: string, extension: string): string => {
  const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
  // Strip any illegal file path characters
  let clean = fileName.trim().replace(/[\\/:*?"<>|]/g, '_');
  
  if (!clean) {
    clean = `retirement_plan_${new Date().toISOString().split('T')[0]}`;
  }

  // Remove the extension if user included it, then re-append to ensure single extension
  if (clean.toLowerCase().endsWith(safeExt.toLowerCase())) {
    clean = clean.slice(0, -safeExt.length);
  }

  return `${clean}${safeExt}`;
};

/**
 * Generates a clean default timestamped filename based on client name and export format.
 */
export const getDefaultExportFileName = (
  type: ExportFormatType,
  inputs: AppStateInputs
): string => {
  const timeStamp = new Date().toISOString().split('T')[0];
  const primaryName = inputs.you.name?.trim().replace(/\s+/g, '_') || '';
  const prefix = primaryName ? `${primaryName}_` : '';

  switch (type) {
    case 'json':
      return `${prefix}Retirement_Plan_${timeStamp}.json`;
    case 'pdf':
      return `${prefix}Retirement_Report_${timeStamp}.pdf`;
    case 'excel':
      return `${prefix}Retirement_Ledger_${timeStamp}.xlsx`;
  }
};

export const generateJsonBlob = (
  inputs: AppStateInputs,
  simulateSurvivor?: boolean
): Blob => {
  const payload: AppStateInputs = {
    ...inputs,
    simulateSurvivor: simulateSurvivor !== undefined ? simulateSurvivor : (inputs.simulateSurvivor ?? false),
  };
  const dataStr = JSON.stringify(payload, null, 2);
  return new Blob([dataStr], { type: 'application/json' });
};

/**
 * Generates a Blob for the Excel simulation ledger.
 */
export const generateExcelExportBlob = (
  ledger: SimulationResultRow[],
  inputs: AppStateInputs
): Blob => {
  return generateExcelBlob(ledger, inputs);
};

/**
 * Generates a Blob for the PDF report asynchronously using @react-pdf/renderer.
 */
export const generatePdfBlob = async (inputs: AppStateInputs): Promise<Blob> => {
  const doc = React.createElement(ConfigurationPDF, { inputs });
  const pdfInstance = pdf(doc as any);
  return await pdfInstance.toBlob();
};

export interface SaveFileResult {
  success: boolean;
  cancelled?: boolean;
  savedViaPicker?: boolean;
  filename: string;
  error?: string;
}

/**
 * Saves a Blob to the user's system:
 * - If promptForLocation is true & showSaveFilePicker is available, prompts OS Save As dialog to choose directory & name.
 * - Otherwise, initiates standard browser download with the specified filename.
 */
export const saveFileWithLocationPrompt = async (
  blob: Blob,
  fileName: string,
  formatType: ExportFormatType,
  promptForLocation: boolean = true
): Promise<SaveFileResult> => {
  const config = EXPORT_FORMAT_CONFIGS[formatType];
  const sanitized = sanitizeFileName(fileName, config.extension);

  if (promptForLocation && isFileSystemAccessSupported()) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: sanitized,
        types: [
          {
            description: config.description,
            accept: config.accept,
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        success: true,
        savedViaPicker: true,
        filename: handle.name || sanitized,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          cancelled: true,
          filename: sanitized,
        };
      }
      console.warn('showSaveFilePicker encountered an issue, falling back to download:', err);
    }
  }

  // Standard browser download mechanism
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitized;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      savedViaPicker: false,
      filename: sanitized,
    };
  } catch (err: any) {
    console.error('File download failed:', err);
    return {
      success: false,
      filename: sanitized,
      error: err?.message || 'Download failed',
    };
  }
};
