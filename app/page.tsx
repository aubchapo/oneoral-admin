'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminApi, type Lead, type Subscriber } from '@/lib/api';

// Solution colors for visual identification
const solutionColors: Record<string, { bg: string; text: string; badge: string }> = {
  cavities: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  whitening: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  breath: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  'drill-free': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  telehealth: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800' },
  biotest: { bg: 'bg-cyan-50', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800' },
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

type TabType = 'overview' | 'subscribers' | 'leads';

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolution, setSelectedSolution] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subscribersData, leadsData] = await Promise.all([
          adminApi.getSubscribers(),
          adminApi.getLeads(),
        ]);
        setSubscribers(subscribersData);
        setLeads(leadsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Calculate stats
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter(s => s.status === 'active').length;
  const totalMRR = subscribers.filter(s => s.status === 'active').reduce((sum, s) => sum + s.monthlyAmount, 0);
  const newLeadsToday = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.createdAt.startsWith(today);
  }).length;
  const newLeadsThisWeek = leads.filter(l => l.status === 'new').length;

  // Filter leads by solution
  const filteredLeads = selectedSolution === 'all'
    ? leads
    : leads.filter(l => l.solution === selectedSolution);

  // Group leads by solution for the overview
  const leadsBySolution = leads.reduce((acc, lead) => {
    acc[lead.solution] = (acc[lead.solution] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              <span className="text-primary-600">One</span>
              <span className="text-gray-900">Oral</span>
            </h1>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">ADMIN</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6">
          {(['overview', 'subscribers', 'leads'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <span className="text-lg">💰</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">Monthly Revenue</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">${totalMRR.toLocaleString()}</p>
                    <p className="text-sm text-gray-500 mt-1">MRR from {activeSubscribers} active</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <span className="text-lg">👥</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">Total Subscribers</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{totalSubscribers}</p>
                    <p className="text-sm text-green-600 mt-1">{activeSubscribers} active</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <span className="text-lg">📊</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">Total Leads</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{leads.length}</p>
                    <p className="text-sm text-blue-600 mt-1">{newLeadsThisWeek} new this week</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <span className="text-lg">🔥</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">Today&apos;s Leads</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{newLeadsToday}</p>
                    <p className="text-sm text-gray-500 mt-1">New signups today</p>
                  </div>
                </div>

                {/* Leads by Solution */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads by Solution</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(leadsBySolution).map(([solution, count]) => {
                      const colors = solutionColors[solution] || solutionColors.cavities;
                      return (
                        <button
                          key={solution}
                          onClick={() => {
                            setSelectedSolution(solution);
                            setActiveTab('leads');
                          }}
                          className={`${colors.bg} rounded-xl p-4 text-center hover:opacity-80 transition-opacity`}
                        >
                          <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                          <p className={`text-sm capitalize ${colors.text}`}>{solution.replace('-', ' ')}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Leads */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {leads.slice(0, 5).map((lead) => {
                      const colors = solutionColors[lead.solution] || solutionColors.cavities;
                      return (
                        <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                              <span className={`font-semibold ${colors.text}`}>
                                {lead.name?.charAt(0) || lead.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{lead.name || lead.email}</p>
                              <p className="text-sm text-gray-500">{lead.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                              {lead.solution.replace('-', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                              {lead.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 border-t border-gray-100">
                    <button
                      onClick={() => setActiveTab('leads')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View all leads →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subscribers Tab */}
            {activeTab === 'subscribers' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">All Subscribers</h2>
                  <span className="text-sm text-gray-500">{subscribers.length} total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next Billing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monthly
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Spent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {subscribers.map((subscriber) => {
                        const colors = solutionColors[subscriber.solution] || solutionColors.cavities;
                        return (
                          <tr key={subscriber.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                                  <span className={`font-semibold ${colors.text}`}>
                                    {subscriber.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{subscriber.name}</p>
                                  <p className="text-sm text-gray-500">{subscriber.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                                {subscriber.plan}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[subscriber.status]}`}>
                                {subscriber.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(subscriber.startDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(subscriber.nextBillingDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              ${subscriber.monthlyAmount}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              ${subscriber.totalSpent}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leads Tab */}
            {activeTab === 'leads' && (
              <div className="space-y-4">
                {/* Solution Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSolution('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSolution === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    All Solutions
                  </button>
                  {Object.keys(solutionColors).map((solution) => {
                    const colors = solutionColors[solution];
                    const isSelected = selectedSolution === solution;
                    return (
                      <button
                        key={solution}
                        onClick={() => setSelectedSolution(solution)}
                        className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                          isSelected
                            ? `${colors.badge}`
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {solution.replace('-', ' ')}
                      </button>
                    );
                  })}
                </div>

                {/* Leads Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedSolution === 'all' ? 'All Leads' : `${selectedSolution.replace('-', ' ')} Leads`}
                    </h2>
                    <span className="text-sm text-gray-500">{filteredLeads.length} leads</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Lead
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Solution
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredLeads.map((lead) => {
                          const colors = solutionColors[lead.solution] || solutionColors.cavities;
                          return (
                            <tr key={lead.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                                    <span className={`font-semibold ${colors.text}`}>
                                      {lead.name?.charAt(0) || lead.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{lead.name || 'No name'}</p>
                                    <p className="text-sm text-gray-500">{lead.email}</p>
                                    {lead.phone && (
                                      <p className="text-sm text-gray-400">{lead.phone}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${colors.badge}`}>
                                  {lead.solution.replace('-', ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={lead.status}
                                  onChange={(e) => {
                                    // Update status
                                    const newStatus = e.target.value as Lead['status'];
                                    setLeads(leads.map(l =>
                                      l.id === lead.id ? { ...l, status: newStatus } : l
                                    ));
                                  }}
                                  className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${statusColors[lead.status]}`}
                                >
                                  <option value="new">New</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="qualified">Qualified</option>
                                  <option value="converted">Converted</option>
                                  <option value="lost">Lost</option>
                                </select>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {lead.source || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                {lead.notes || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
