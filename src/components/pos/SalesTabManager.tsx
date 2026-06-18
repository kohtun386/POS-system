import { Plus, X } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { SalesTab } from '../../types';
import { salesTabsService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';

export function SalesTabManager() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();

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
    <div className="w-16 bg-[#faf8f5] dark:bg-[#2a1a10] border-r border-[#ded7cc] dark:border-[#54463b] flex flex-col h-full">
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
                    ? 'bg-gradient-to-b from-[#9a693a] to-[#7a4f2c] text-white shadow-copper'
                    : 'bg-[#f0ece5] dark:bg-[#3b2613] text-[#7d6b57] dark:text-[#c6bbab] hover:bg-[#e5ddd2] dark:hover:bg-[#473b32] hover:shadow-md'
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
                    isActive ? 'bg-[#faf8f5] text-[#7a4f2c]' : 'bg-[#e55c13] text-white'
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
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#dc2626] text-white flex items-center justify-center hover:bg-[#b91c1c] transition-colors ${
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
      <div className="p-1 border-t border-[#ded7cc] dark:border-[#54463b]">
        <button
          onClick={createNewTab}
          className="w-12 h-10 bg-gradient-to-r from-[#9a693a] to-[#b8854a] hover:from-[#b8854a] hover:to-[#cfa16a] text-white rounded-md transition-all duration-300 flex items-center justify-center mx-auto shadow-soft"
          title="Add New Sale"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
