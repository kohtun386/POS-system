import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, User, Mail, Phone, CreditCard, Eye } from 'lucide-react';
import { Customer } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { DEFAULT_CURRENCY } from '../../lib/constants';
import { CustomerModal } from './CustomerModal';
import { CustomerDetailModal } from './CustomerDetailModal';
import { swalConfig } from '../../lib/sweetAlert';

export function CustomerManager() {
  const { state, dispatch } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const filteredCustomers = state.customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowCustomerModal(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setViewingCustomer(customer);
  };

    const handleDeleteCustomer = async (customerId: string) => {
    const result = await swalConfig.deleteConfirm('customer');
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting customer...');
        const { customersService } = await import('../../lib/services');
        await customersService.delete(customerId);
        dispatch({ type: 'DELETE_CUSTOMER', payload: customerId });
        swalConfig.success('Customer deleted successfully!');
      } catch (error) {
        console.error('Error deleting customer:', error);
        swalConfig.error('Failed to delete customer. Please try again.');
      }
    }
  };

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowCustomerModal(true);
  };

  const totalCustomers = state.customers.length;
  const totalPurchases = state.customers.reduce((sum: number, c: Customer) => sum + c.totalPurchases, 0);
  const averagePurchase = totalCustomers > 0 ? totalPurchases / totalCustomers : 0;
  const activeCustomers = state.customers.filter((c: Customer) => c.lastPurchase && 
    new Date().getTime() - new Date(c.lastPurchase).getTime() < 30 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">Total Customers</p>
              <p className="text-2xl md:text-3xl font-bold">{totalCustomers}</p>
            </div>
            <User className="h-8 w-8 text-primary-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-success-500 to-success-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium">Total Purchases</p>
              <p className="text-xl md:text-2xl font-bold">{DEFAULT_CURRENCY} {totalPurchases.toFixed(2)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-success-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-accent-500 to-accent-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-100 text-sm font-medium">Average Purchase</p>
              <p className="text-xl md:text-2xl font-bold">{DEFAULT_CURRENCY} {averagePurchase.toFixed(2)}</p>
            </div>
            <Mail className="h-8 w-8 text-accent-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-warning-500 to-warning-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium">Active (30 days)</p>
              <p className="text-2xl md:text-3xl font-bold">{activeCustomers}</p>
            </div>
            <Phone className="h-8 w-8 text-warning-200" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-secondary-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-secondary-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleAddCustomer}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all font-semibold shadow-lg hover:shadow-xl whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                  Total Purchases
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                  Price Tier
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider hidden sm:table-cell">
                  Last Purchase
                </th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-secondary-50 divide-y divide-secondary-200">
              {filteredCustomers.map((customer: Customer) => (
                <tr key={customer.id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gradient-to-r from-primary-500 to-accent-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-semibold text-secondary-900 truncate">{customer.name}</div>
                        <div className="text-xs text-secondary-500">ID: {customer.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-900 truncate max-w-xs">{customer.email}</div>
                    <div className="text-sm text-secondary-500">{customer.phone}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-semibold text-secondary-900">
                    {DEFAULT_CURRENCY} {customer.totalPurchases.toFixed(2)}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-primary-800">
                      {customer.priceTier}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-secondary-900 hidden sm:table-cell">
                    {customer.lastPurchase 
                      ? new Date(customer.lastPurchase).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewCustomer(customer)}
                        className="text-success-600 hover:text-success-900 p-2 rounded-xl hover:bg-success-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditCustomer(customer)}
                        className="text-primary-600 hover:text-primary-900 p-2 rounded-xl hover:bg-primary-50 transition-colors"
                        title="Edit Customer"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="text-danger-600 hover:text-danger-900 p-2 rounded-xl hover:bg-danger-50 transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        customer={editingCustomer}
      />

      {viewingCustomer && (
        <CustomerDetailModal
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
        />
      )}
    </div>
  );
}