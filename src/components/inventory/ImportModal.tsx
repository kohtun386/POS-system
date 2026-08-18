import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useActiveShopId } from '../../hooks/useApp';
import { useModalEscape } from '../../hooks/useModalEscape';
import { swalConfig } from '../../lib/sweetAlert';
import { EXPORT_COLUMNS, UTF8_BOM } from '../../lib/csv';
import {
  parseCsv,
  validateRow,
  checkInBatchDuplicates,
  checkShopSkus,
  mapCategories,
  importProducts,
  NormalizedRow,
  RowError,
  RowResult,
} from '../../lib/services/importProducts';
import Papa from 'papaparse';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'report';

export function ImportModal({ isOpen, onClose, onImported }: ImportModalProps) {
  const shopId = useActiveShopId();
  useModalEscape(onClose, isOpen);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [shopSkus, setShopSkus] = useState<RowError[]>([]);
  const [batchDuplicates, setBatchDuplicates] = useState<RowError[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<RowResult[] | null>(null);
  const [createdCategories, setCreatedCategories] = useState(0);
  const [createdProducts, setCreatedProducts] = useState(0);
  const [failedProducts, setFailedProducts] = useState(0);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setErrors([]);
    setShopSkus([]);
    setBatchDuplicates([]);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setCreatedCategories(0);
    setCreatedProducts(0);
    setFailedProducts(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = useCallback(() => {
    const exampleRow: Record<string, string> = {};
    EXPORT_COLUMNS.forEach((col) => {
      exampleRow[col] = '';
    });
    exampleRow.name = 'Example Product';
    exampleRow.sku = 'EX-001';
    exampleRow.price = '10.00';
    exampleRow.cost = '5.00';
    exampleRow.stock = '100';
    exampleRow.minStock = '10';
    exampleRow.category = 'Coffee';
    exampleRow.description = 'Sample product';
    exampleRow.taxable = 'true';
    exampleRow.active = 'true';

    const csv = Papa.unparse({ fields: EXPORT_COLUMNS, data: [exampleRow] });
    const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      const { normalizedRows } = parseCsv(content);
      const fileErrors = normalizedRows.flatMap((row, idx) => validateRow(row, idx + 2));
      const batchDupes = checkInBatchDuplicates(normalizedRows);
      const shopDupes = await checkShopSkus(normalizedRows, shopId);

      setFileName(file.name);
      setRows(normalizedRows);
      setErrors(fileErrors);
      setBatchDuplicates(batchDupes);
      setShopSkus(shopDupes);
      setStep('preview');
    } catch (err) {
      swalConfig.error(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const allErrors = [...errors, ...batchDuplicates, ...shopSkus];
  const hasBlockingErrors = errors.length > 0 || batchDuplicates.length > 0 || shopSkus.length > 0;

  const startImport = async () => {
    setStep('importing');
    try {
      const catMap = await mapCategories(rows, shopId);
      const res = await importProducts(rows, catMap, shopId, {
        onProgress: (current, total) => setProgress({ current, total }),
      });
      setResult(res.rowResults);
      setCreatedCategories(res.createdCategories);
      setCreatedProducts(res.createdProducts);
      setFailedProducts(res.failedProducts);
      setStep('report');
      if (res.createdProducts > 0) onImported();
    } catch (err) {
      swalConfig.error(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-secondary-900 font-fraunces">Import Products</h2>
          <button
            onClick={handleClose}
            className="text-secondary-400 hover:text-secondary-600 p-2 rounded-xl hover:bg-secondary-100 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="modal-body space-y-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-secondary-600">Upload a CSV file with your products. Max 500 rows.</p>
              <div className="border-2 border-dashed border-secondary-300 rounded-xl p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-secondary-400 mb-3" />
                <label className="btn btn-secondary btn-md cursor-pointer inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Choose CSV File
                  <input type="file" accept=".csv" className="hidden" onChange={onFileChange} />
                </label>
              </div>
              <button onClick={downloadTemplate} className="text-primary-600 hover:text-primary-800 text-sm underline">
                Download CSV Template
              </button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-secondary-600">
                  <strong>{fileName}</strong> — {rows.length} row(s)
                </p>
                <button onClick={() => setStep('upload')} className="text-sm text-primary-600 underline">
                  Change File
                </button>
              </div>

              {allErrors.length > 0 && (
                <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <p className="text-danger-700 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {allErrors.length} issue(s) found
                  </p>
                  <ul className="text-sm text-danger-600 space-y-1 list-disc ml-5">
                    {allErrors.map((e, i) => (
                      <li key={i}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto max-h-64 border rounded-xl">
                <table className="table text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Line</th>
                      <th className="table-header-cell">Name</th>
                      <th className="table-header-cell">SKU</th>
                      <th className="table-header-cell">Price</th>
                      <th className="table-header-cell">Category</th>
                      <th className="table-header-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {rows.slice(0, 50).map((row, idx) => {
                      const lineErrors = allErrors.filter((e) => e.line === idx + 2);
                      return (
                        <tr key={idx} className="table-row">
                          <td className="table-cell">{idx + 2}</td>
                          <td className="table-cell">{row.name}</td>
                          <td className="table-cell">{row.sku}</td>
                          <td className="table-cell">{row.price}</td>
                          <td className="table-cell">{row.category}</td>
                          <td className="table-cell">
                            {lineErrors.length > 0 ? (
                              <span className="text-danger-600 text-xs">{lineErrors.length} error(s)</span>
                            ) : (
                              <span className="text-success-600 text-xs">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="text-xs text-secondary-500 p-2 text-center">Showing first 50 of {rows.length} rows</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="space-y-4 text-center py-8">
              <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-secondary-700">
                Importing... {progress.current}/{progress.total}
              </p>
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Report */}
          {step === 'report' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-success-700">
                <CheckCircle2 className="h-6 w-6" />
                <p className="font-medium">Import Complete</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-success-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-success-700">{createdProducts}</p>
                  <p className="text-sm text-success-600">Created</p>
                </div>
                <div className="bg-danger-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-danger-700">{failedProducts}</p>
                  <p className="text-sm text-danger-600">Failed</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-primary-700">{createdCategories}</p>
                  <p className="text-sm text-primary-600">New Categories</p>
                </div>
              </div>

              {failedProducts > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-xl p-3 text-sm space-y-1">
                  {result
                    .filter((r) => r.status === 'failed')
                    .map((r, i) => (
                      <div key={i} className="text-danger-600">
                        Line {r.line}: {r.error}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={handleClose} className="btn btn-secondary btn-md">
            {step === 'report' ? 'Close' : 'Cancel'}
          </button>
          {step === 'preview' && (
            <button onClick={startImport} disabled={hasBlockingErrors} className="btn btn-primary btn-md">
              Start Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
