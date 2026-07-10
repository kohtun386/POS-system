import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { swalConfig } from '../../lib/sweetAlert';
import Swal from 'sweetalert2';

interface FeatureDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  subscription_tier: string;
  default_enabled: boolean;
}

export function FeatureDefinitions() {
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    setLoading(true);
    const { data, error } = await supabase
      .from('feature_definitions')
      .select('*')
      .order('key');
    if (error) {
      swalConfig.error('Failed to load features');
    } else {
      setFeatures(data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    const result = await Swal.fire({
      title: 'New Feature',
      input: 'text',
      inputPlaceholder: 'Feature name',
      showCancelButton: true,
      confirmButtonText: 'Create',
      cancelButtonText: 'Cancel',
    });
    if (!result.value) return;
    const { error } = await supabase.from('feature_definitions').insert({
      key: result.value.toLowerCase().replace(/\s+/g, '_'),
      name: result.value,
      description: '',
      subscription_tier: 'free',
      default_enabled: true,
    });
    if (error) {
      swalConfig.error('Failed to create feature');
      return;
    }
    swalConfig.success('Feature created');
    loadFeatures();
  }

  async function handleToggle(id: string, currentState: boolean) {
    const { error } = await supabase
      .from('feature_definitions')
      .update({ default_enabled: !currentState })
      .eq('id', id);
    if (error) {
      swalConfig.error('Failed to toggle feature');
      return;
    }
    setFeatures(features.map(f => f.id === id ? { ...f, default_enabled: !currentState } : f));
  }

  async function handleDelete(id: string) {
    const result = await swalConfig.confirm('Delete this feature?', 'This cannot be undone.');
    if (!result.isConfirmed) return;
    const { error } = await supabase.from('feature_definitions').delete().eq('id', id);
    if (error) {
      swalConfig.error('Failed to delete feature');
      return;
    }
    swalConfig.success('Feature deleted');
    loadFeatures();
  }

  if (loading) return <div className="text-center py-8">Loading features…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100">
          Feature Definitions
        </h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          Add Feature
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Key</th>
              <th className="table-header-cell">Name</th>
              <th className="table-header-cell">Tier</th>
              <th className="table-header-cell">Enabled</th>
              <th className="table-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {features.map(feature => (
              <tr key={feature.id} className="table-row">
                <td className="table-cell font-mono text-sm">{feature.key}</td>
                <td className="table-cell">{feature.name}</td>
                <td className="table-cell">
                  <span className="badge badge-info">{feature.subscription_tier}</span>
                </td>
                <td className="table-cell">
                  <button
                    className={`btn btn-sm ${feature.default_enabled ? 'btn-success' : 'btn-ghost'}`}
                    onClick={() => handleToggle(feature.id, feature.default_enabled)}
                  >
                    {feature.default_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td className="table-cell">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(feature.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {features.length === 0 && (
          <div className="p-8 text-center text-secondary-600 dark:text-secondary-300">
            No features defined yet.
          </div>
        )}
      </div>
    </div>
  );
}