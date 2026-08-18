import { Download } from 'lucide-react';
import { Product } from '../../types';
import { exportProductCsv } from '../../lib/csv';

interface ExportButtonProps {
  products: Product[];
}

export function ExportButton({ products }: ExportButtonProps) {
  return (
    <button
      onClick={() => exportProductCsv(products)}
      className="btn btn-secondary btn-md"
      disabled={!products.length}
    >
      <Download className="h-4 w-4" />
      <span>Export CSV</span>
    </button>
  );
}
