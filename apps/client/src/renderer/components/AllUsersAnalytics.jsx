import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Activity } from 'lucide-react';

export default function AllUsersAnalytics({ allUsersData }) {
  const totalUsers = allUsersData.length;
  const aggregatedData = allUsersData.reduce((acc, user) => ({
    totalRuns: acc.totalRuns + user.totalRuns,
    successfulRuns: acc.successfulRuns + user.successfulRuns,
    failedRuns: acc.failedRuns + user.failedRuns,
    totalErrors: acc.totalErrors + user.totalErrors
  }), { totalRuns: 0, successfulRuns: 0, failedRuns: 0, totalErrors: 0 });

  const successRate = aggregatedData.totalRuns > 0 
    ? Math.round((aggregatedData.successfulRuns / aggregatedData.totalRuns) * 100) 
    : 0;

  // Prepare data for user comparison chart
  const userComparisonData = allUsersData.map(user => ({
    name: user.userName || 'Unknown',
    Successful: user.successfulRuns,
    Failed: user.failedRuns,
    Total: user.totalRuns
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-400" size={24} />
        <h3 className="text-white font-bold text-lg">All Users Analytics</h3>
        <span className="text-gray-400 text-sm">({totalUsers} collaborator{totalUsers !== 1 ? 's' : ''})</span>
      </div>

      {/* Aggregated Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-blue-600 transition-colors">
          <p className="text-gray-400 text-xs font-medium">Total Runs (All Users)</p>
          <p className="text-white text-2xl font-bold mt-1">{aggregatedData.totalRuns}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-green-600 transition-colors">
          <p className="text-gray-400 text-xs font-medium">Success Rate</p>
          <p className="text-green-400 text-2xl font-bold mt-1">{successRate}%</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-green-600 transition-colors">
          <p className="text-gray-400 text-xs font-medium">Successful Runs</p>
          <p className="text-green-400 text-2xl font-bold mt-1">{aggregatedData.successfulRuns}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-red-600 transition-colors">
          <p className="text-gray-400 text-xs font-medium">Failed Runs</p>
          <p className="text-red-400 text-2xl font-bold mt-1">{aggregatedData.failedRuns}</p>
        </div>
      </div>

      {/* User Comparison Chart */}
      <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg mt-6">
        <p className="text-gray-300 text-sm font-medium mb-4">Performance by User</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={userComparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#999" angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#999" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444', borderRadius: '4px', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Successful" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="Failed" fill="#ef4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Individual User Cards */}
      <div className="space-y-3 mt-6">
        <p className="text-gray-300 text-sm font-medium mb-3">Individual Statistics</p>
        {allUsersData.map((user, index) => {
          const userSuccessRate = user.totalRuns > 0 
            ? Math.round((user.successfulRuns / user.totalRuns) * 100) 
            : 0;
          const avgExecTime = user.executionTimes && user.executionTimes.length > 0
            ? Math.round(user.executionTimes.reduce((a, b) => a + b, 0) / user.executionTimes.length)
            : 0;

          return (
            <div key={index} className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-blue-500 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="text-blue-400" size={18} />
                  <h4 className="text-white font-semibold">{user.userName || 'Unknown User'}</h4>
                </div>
                <span className="text-xs text-gray-500">
                  Last active: {new Date(user.lastActivity).toLocaleDateString()}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-gray-400 text-xs">Total</p>
                  <p className="text-white font-bold">{user.totalRuns}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Success</p>
                  <p className="text-green-400 font-bold">{user.successfulRuns}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Failed</p>
                  <p className="text-red-400 font-bold">{user.failedRuns}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Avg Time</p>
                  <p className="text-blue-400 font-bold">{avgExecTime}ms</p>
                </div>
              </div>

              <div className="mt-3 bg-gray-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${userSuccessRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{userSuccessRate}% success rate</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
