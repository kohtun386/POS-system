export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_configurations: {
        Row: {
          alert_type: string
          check_frequency_minutes: number | null
          cooldown_minutes: number | null
          created_at: string
          email_template_id: string | null
          id: string
          is_enabled: boolean | null
          shop_id: string
          sms_template_id: string | null
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          check_frequency_minutes?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          email_template_id?: string | null
          id?: string
          is_enabled?: boolean | null
          shop_id?: string
          sms_template_id?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          check_frequency_minutes?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          email_template_id?: string | null
          id?: string
          is_enabled?: boolean | null
          shop_id?: string
          sms_template_id?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_configurations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          alert_type: string
          channel: string | null
          created_at: string
          current_stock: number | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string | null
          min_stock: number | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sent_at: string | null
          shop_id: string
          status: string | null
          template_id: string | null
          threshold_value: number | null
        }
        Insert: {
          alert_type: string
          channel?: string | null
          created_at?: string
          current_stock?: number | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          min_stock?: number | null
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: string | null
          template_id?: string | null
          threshold_value?: number | null
        }
        Update: {
          alert_type?: string
          channel?: string | null
          created_at?: string
          current_stock?: number | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          min_stock?: number | null
          product_id?: string | null
          product_name?: string | null
          product_sku?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: string | null
          template_id?: string | null
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_recipients: {
        Row: {
          alert_types: string[] | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          alert_types?: string[] | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role?: string
          shop_id?: string
          updated_at?: string
        }
        Update: {
          alert_types?: string[] | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_recipients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          shop_id: string
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          shop_id?: string
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          shop_id?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          auto_backup: boolean | null
          created_at: string
          currency: string | null
          id: string
          interface_mode: string | null
          invoice_counter: number | null
          invoice_prefix: string | null
          receipt_printer: boolean | null
          shop_id: string
          store_address: string | null
          store_email: string | null
          store_logo: string | null
          store_name: string | null
          store_phone: string | null
          tax_rate: number | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          auto_backup?: boolean | null
          created_at?: string
          currency?: string | null
          id?: string
          interface_mode?: string | null
          invoice_counter?: number | null
          invoice_prefix?: string | null
          receipt_printer?: boolean | null
          shop_id?: string
          store_address?: string | null
          store_email?: string | null
          store_logo?: string | null
          store_name?: string | null
          store_phone?: string | null
          tax_rate?: number | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          auto_backup?: boolean | null
          created_at?: string
          currency?: string | null
          id?: string
          interface_mode?: string | null
          invoice_counter?: number | null
          invoice_prefix?: string | null
          receipt_printer?: boolean | null
          shop_id?: string
          store_address?: string | null
          store_email?: string | null
          store_logo?: string | null
          store_name?: string | null
          store_phone?: string | null
          tax_rate?: number | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_app_settings_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          shop_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          shop_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          shop_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          cashier_id: string
          closed_at: string | null
          closing_cash: number | null
          expected_cash: number | null
          id: string
          opened_at: string
          opening_cash: number
          shop_id: string
          status: string
          variance: number | null
        }
        Insert: {
          cashier_id: string
          closed_at?: string | null
          closing_cash?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash: number
          shop_id: string
          status?: string
          variance?: number | null
        }
        Update: {
          cashier_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash?: number
          shop_id?: string
          status?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          shop_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_categories_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number | null
          credit_used: number | null
          email: string | null
          id: string
          last_purchase: string | null
          name: string
          phone: string | null
          price_tier: string | null
          shop_id: string
          total_purchases: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_used?: number | null
          email?: string | null
          id?: string
          last_purchase?: string | null
          name: string
          phone?: string | null
          price_tier?: string | null
          shop_id?: string
          total_purchases?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_used?: number | null
          email?: string | null
          id?: string
          last_purchase?: string | null
          name?: string
          phone?: string | null
          price_tier?: string | null
          shop_id?: string
          total_purchases?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean | null
          conditions: Json | null
          created_at: string
          description: string | null
          free_gift_products: string[] | null
          id: string
          max_discount: number | null
          min_amount: number | null
          name: string
          shop_id: string
          type: string
          updated_at: string
          valid_days: number[] | null
          valid_from: string
          valid_to: string
          value: number | null
        }
        Insert: {
          active?: boolean | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          free_gift_products?: string[] | null
          id?: string
          max_discount?: number | null
          min_amount?: number | null
          name: string
          shop_id?: string
          type: string
          updated_at?: string
          valid_days?: number[] | null
          valid_from: string
          valid_to: string
          value?: number | null
        }
        Update: {
          active?: boolean | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          free_gift_products?: string[] | null
          id?: string
          max_discount?: number | null
          min_amount?: number | null
          name?: string
          shop_id?: string
          type?: string
          updated_at?: string
          valid_days?: number[] | null
          valid_from?: string
          valid_to?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_discounts_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_definitions: {
        Row: {
          category: string
          created_at: string
          default_enabled: boolean
          description: string | null
          id: string
          key: string
          name: string
          subscription_tier: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key: string
          name: string
          subscription_tier?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          id?: string
          key?: string
          name?: string
          subscription_tier?: string
        }
        Relationships: []
      }
      notification_service_config: {
        Row: {
          config_data: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          service_name: string
          service_type: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          config_data?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          service_name: string
          service_type?: string
          shop_id?: string
          updated_at?: string
        }
        Update: {
          config_data?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          service_name?: string
          service_type?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_service_config_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          completed_at: string | null
          config_data: Json
          created_at: string
          id: string
          order_id: string | null
          shop_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          config_data?: Json
          created_at?: string
          id?: string
          order_id?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          config_data?: Json
          created_at?: string
          id?: string
          order_id?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string
          cost_price: number | null
          created_at: string
          expiry_date: string | null
          id: string
          manufacturing_date: string | null
          product_id: string | null
          quantity: number
          shop_id: string
          supplier_info: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacturing_date?: string | null
          product_id?: string | null
          quantity?: number
          shop_id?: string
          supplier_info?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacturing_date?: string | null
          product_id?: string | null
          quantity?: number
          shop_id?: string
          supplier_info?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_batches_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          barcode: string | null
          category: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image: string | null
          is_weight_based: boolean | null
          min_stock: number | null
          name: string
          price: number
          price_per_unit: number | null
          shop_id: string
          sku: string
          stock: number | null
          taxable: boolean | null
          track_inventory: boolean | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          barcode?: string | null
          category: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          is_weight_based?: boolean | null
          min_stock?: number | null
          name: string
          price: number
          price_per_unit?: number | null
          shop_id?: string
          sku: string
          stock?: number | null
          taxable?: boolean | null
          track_inventory?: boolean | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          barcode?: string | null
          category?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          is_weight_based?: boolean | null
          min_stock?: number | null
          name?: string
          price?: number
          price_per_unit?: number | null
          shop_id?: string
          sku?: string
          stock?: number | null
          taxable?: boolean | null
          track_inventory?: boolean | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          applied_discounts: Json | null
          card_details: Json | null
          cashier: string | null
          cashier_role: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount_amount: number | null
          free_gifts: Json | null
          id: string
          invoice_number: string
          items: Json
          notes: string | null
          payment_method: string | null
          payments: Json | null
          receipt_number: string | null
          shop_id: string
          status: string | null
          subtotal: number
          tax_amount: number | null
          total: number
          updated_at: string
        }
        Insert: {
          applied_discounts?: Json | null
          card_details?: Json | null
          cashier?: string | null
          cashier_role?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          free_gifts?: Json | null
          id?: string
          invoice_number: string
          items?: Json
          notes?: string | null
          payment_method?: string | null
          payments?: Json | null
          receipt_number?: string | null
          shop_id?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total: number
          updated_at?: string
        }
        Update: {
          applied_discounts?: Json | null
          card_details?: Json | null
          cashier?: string | null
          cashier_role?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          free_gifts?: Json | null
          id?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          payment_method?: string | null
          payments?: Json | null
          receipt_number?: string | null
          shop_id?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tabs: {
        Row: {
          cart: Json | null
          created_at: string
          id: string
          name: string
          selected_customer_id: string | null
          shop_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cart?: Json | null
          created_at?: string
          id?: string
          name: string
          selected_customer_id?: string | null
          shop_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cart?: Json | null
          created_at?: string
          id?: string
          name?: string
          selected_customer_id?: string | null
          shop_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_tabs_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tabs_selected_customer_id_fkey"
            columns: ["selected_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tabs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_features: {
        Row: {
          enabled: boolean
          feature_key: string
          id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          id?: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "shop_features_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_memberships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          role: string
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          role?: string
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          role?: string
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_memberships_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          daily_order_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          phone: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          daily_order_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          daily_order_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          payment_terms: string | null
          phone: string | null
          rating: number | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          shop_id?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean | null
          avatar: string | null
          created_at: string
          email: string
          id: string
          last_login: string | null
          name: string
          permissions: string[] | null
          role: string
          shop_id: string
          updated_at: string
          username: string
        }
        Insert: {
          active?: boolean | null
          avatar?: string | null
          created_at?: string
          email: string
          id: string
          last_login?: string | null
          name: string
          permissions?: string[] | null
          role?: string
          shop_id?: string
          updated_at?: string
          username: string
        }
        Update: {
          active?: boolean | null
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          last_login?: string | null
          name?: string
          permissions?: string[] | null
          role?: string
          shop_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_shop"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_inventory_alerts: {
        Args: never
        Returns: {
          alert_type: string
          current_stock: number
          min_stock: number
          product_id: string
          product_name: string
          product_sku: string
          threshold_value: number
        }[]
      }
      checkout_complete: {
        Args: {
          p_cashier_id: string
          p_payments: Json
          p_sale_data: Json
          p_shop_id: string
        }
        Returns: Json
      }
      current_shop_ids: { Args: never; Returns: string[] }
      generate_invoice_number: { Args: never; Returns: string }
      get_alert_recipients: {
        Args: { alert_type_param: string }
        Returns: {
          email: string
          id: string
          name: string
          phone: string
          role: string
        }[]
      }
      resolve_capabilities: {
        Args: { p_shop_id: string }
        Returns: {
          capability: string
        }[]
      }
      should_send_alert: {
        Args: {
          alert_type_param: string
          product_id_param: string
          recipient_id_param: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
