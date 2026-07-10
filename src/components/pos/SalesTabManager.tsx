import { Plus, X } from 'lucide-react';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { SalesTab } from '../../types';
import { salesTabsService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { UpgradePrompt } from '../ui/UpgradePrompt';

export function SalesTabManager() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const canManageTabs = useCapability('multi_tab_sales');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const createNewTab = async () => {
    if (!user) return;

    try {
      // Save current tab's state before creating a new one
      if (state.activeSalesTab) {
        const currentTab = state.salesTabs.find(tab => tab.id === state.activeSalesTab);
        if (currentTab) {
          const updates = {
            cart: state.cart,
            selectedCustomer: state.selectedCustomer,
          };

          await salesTabsService.update(state.activeSalesTab, updates);
          dispatch({
            type: 'UPDATE_SALES_TAB',
            payload: {
              id: state.activeSalesTab,
              updates
            }
          });
        }
      }

      const newTabData: Omit<SalesTab, 'id' | 'createdAt'> = {
        name: `Sale ${state.salesTabs.length + 1}`,
        cart: [],
        selectedCustomer: null,
      };

      const newTab = await salesTabsService.create(user.id, newTabData);
      dispatch({ type: 'ADD_SALES_TAB', payload: newTab });
    } catch (error) {
      console.error('Error creating new tab:', error);
    }
  };

  const closeTab = async (tabId: string) => {
    if (state.salesTabs.length > 1) {
      try {
        await salesTabsService.delete(tabId);
        dispatch({ type: 'REMOVE_SALES_TAB', payload: tabId });
      } catch (error) {
        console.error('Error closing tab:', error);
      }
    }
  };

  const switchTab = async (tabId: string) => {
    // Save current cart to active tab
    if (state.activeSalesTab) {
      const currentTab = state.salesTabs.find(tab => tab.id === state.activeSalesTab);
      if (currentTab) {
        try {
          const updates = {
            cart: state.cart,
            selectedCustomer: state.selectedCustomer,
          };

          await salesTabsService.update(state.activeSalesTab, updates);
          dispatch({
            type: 'UPDATE_SALES_TAB',
            payload: {
              id: state.activeSalesTab,
              updates
            }
          });
        } catch (error) {
          console.error('Error saving current tab:', error);
        }
      }
    }

    dispatch({ type: 'SET_ACTIVE_SALES_TAB', payload: tabId });
  };

  const getItemCount = (tab: SalesTab) => {
    return tab.cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="w-16 bg-secondary-50 dark:bg-surface-dark border-r border-secondary-200 dark:border-secondary-800 flex flex-col h-full">
      {/* Sale Buttons with Rotated Text */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {state.salesTabs.map((tab, index) => {
          const isActive = state.activeSalesTab === tab.id;
          const itemCount = getItemCount(tab);
          const tabNumber = index + 1;

          return (
            <div key={tab.id} className="relative flex flex-col items-center">
              <button
                onClick={() => switchTab(tab.id)}
                className={`relative w-12 h-20 rounded-md text-xs font-medium transition-all group flex items-center justify-center ${
                  isActive
                    ? 'bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-copper'
                    : 'bg-secondary-100 dark:bg-primary-900 text-secondary-600 dark:text-secondary-300 hover:bg-hover-border dark:hover:bg-secondary-900 hover:shadow-md'
                }`}
              >
                {/* Rotated Text Label */}
                <div className="transform rotate-90 whitespace-nowrap">
                  <span className="text-xs font-medium font-fraunces">
                    Sale {tabNumber}
                  </span>
                </div>

                {/* Item Count Badge */}
                {itemCount > 0 && (
                  <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center ${
                    isActive ? 'bg-secondary-50 text-primary-700' : 'bg-accent-600 text-white'
                  }`}>
                    {itemCount}
                  </div>
                )}

                {/* Close button */}
                {state.salesTabs.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }
                    }}
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-danger-600 text-white flex items-center justify-center hover:bg-danger-700 transition-colors ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <X className="h-2 w-2" />
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Sale Button */}
      <div className="p-1 border-t border-secondary-200 dark:border-secondary-800 relative">
        <button
          onClick={() => {
            if (!canManageTabs) {
              setShowUpgrade(true);
              return;
            }
            createNewTab();
          }}
          disabled={!canManageTabs}
          className={`w-12 h-10 rounded-md transition-all duration-300 flex items-center justify-center mx-auto shadow-soft ${
            canManageTabs
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
          title={canManageTabs ? 'Add New Sale' : 'Multi-tab sales disabled'}
        >
          <Plus className="h-4 w-4" />
        </button>
        {showUpgrade && (
          <div className="absolute left-14 bottom-0 z-50 w-64">
            <UpgradePrompt feature="Multi-tab sales" tier="free" onClose={() => setShowUpgrade(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
