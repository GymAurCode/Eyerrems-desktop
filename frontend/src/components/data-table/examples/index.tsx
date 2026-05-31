/**
 * DataTable Examples
 * Comprehensive examples showing different use cases
 */

import React from 'react';
import EmployeeTable from './EmployeeTable';
import ChartOfAccountsRefactored from '../../finance/ChartOfAccountsRefactored';

export default function DataTableExamples() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-200 mb-2">DataTable Examples</h1>
        <p className="text-gray-400 mb-8">
          Professional table implementations across different modules
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-gray-200 mb-4">HR Module - Employee Management</h2>
        <EmployeeTable />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Finance Module - Chart of Accounts</h2>
        <ChartOfAccountsRefactored />
      </section>
    </div>
  );
}