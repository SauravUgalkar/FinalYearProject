import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Activity, ChevronLeft, User } from 'lucide-react';
import AllUsersAnalytics from './AllUsersAnalytics';

export default function Analytics({ data, allUsersData, activityFeed = [] }) {
  const [selectedUser, setSelectedUser] = useState(null);
  
  // If we have allUsersData, show list view for owner
  const isOwnerView = allUsersData && allUsersData.length > 0;
  const recentActivity = activityFeed.slice(0, 8);

  // If a user is selected, show their individual analytics
  if (selectedUser) {
    return (
      <div>
        <button 
          onClick={() => setSelectedUser(null)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4 transition-colors"
        >
          <ChevronLeft size={20} />
          <span>Back to Users</span>
        </button>
        <IndividualAnalytics data={selectedUser} />
      </div>
    );
  }

  // Show user list for owners
  if (isOwnerView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-blue-400" size={24} />
          <h3 className="text-white font-bold text-lg">Team Members</h3>
          <span className="text-gray-400 text-sm">({allUsersData.length} collaborator{allUsersData.length !== 1 ? 's' : ''})</span>
        </div>

        {recentActivity.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <p className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" />
              Live execution activity
            </p>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between bg-gray-900 px-3 py-2 rounded">
                  <div>
                    <p className="text-sm text-white font-semibold">{item.userName || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 break-all">{item.status === 'success' ? 'Ran code successfully' : 'Execution error'}{item.executionTime ? ` • ${item.executionTime}ms` : ''}</p>
                  </div>
                  <span className={`text-xs font-semibold ${item.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {item.status === 'success' ? 'Success' : 'Error'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {allUsersData.map((user, index) => {
            const userSuccessRate = user.totalRuns > 0 
              ? Math.round((user.successfulRuns / user.totalRuns) * 100) 
              : 0;
            
            return (
              <button
                key={index}
                onClick={() => setSelectedUser(user)}
                className="w-full bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-blue-500 hover:bg-gray-750 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 rounded-full p-2">
                      <User size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                        {user.userName || 'Unknown User'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Last active: {new Date(user.lastActivity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Activity className="text-gray-500 group-hover:text-blue-400 transition-colors" size={20} />
                </div>
                
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Total Runs</p>
                    <p className="text-white font-bold text-lg">{user.totalRuns}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Successful</p>
                    <p className="text-green-400 font-bold text-lg">{user.successfulRuns}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Failed</p>
                    <p className="text-red-400 font-bold text-lg">{user.failedRuns}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Success Rate</p>
                    <p className="text-blue-400 font-bold text-lg">{userSuccessRate}%</p>
                  </div>
                </div>

                <div className="mt-3 bg-gray-900 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-500 h-full transition-all duration-300"
                    style={{ width: `${userSuccessRate}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Regular user view (their own analytics)
  if (!data) {
    return <div className="text-gray-400">No analytics data available</div>;
  }

  return <IndividualAnalytics data={data} />;
}

// Individual Analytics Component
function IndividualAnalytics({ data }) {
  if (!data) {
    return <div className="text-gray-400">No analytics data available</div>;
  }

  const successRate = data.totalRuns > 0 
    ? Math.round((data.successfulRuns / data.totalRuns) * 100) 
    : 0;

  const avgExecutionTime = data.executionTimes && data.executionTimes.length > 0
    ? Math.round(data.executionTimes.reduce((a, b) => a + b, 0) / data.executionTimes.length)
    : 0;

  const chartData = [
    {
      name: 'Runs',
      Successful: data.successfulRuns,
      Failed: data.failedRuns
    }
  ];

  const pieData = [
    { name: 'Successful', value: data.successfulRuns, color: '#10b981' },
    { name: 'Failed', value: data.failedRuns, color: '#ef4444' }
  ];

  const COLORS = ['#10b981', '#ef4444'];

  return (
    <div className="space-y-4">
      {data.userName && (
        <div className="flex items-center gap-2 mb-4">
          <User className="text-blue-400" size={24} />
          <h3 className="text-white font-bold text-lg">{data.userName}'s Analytics</h3>
        </div>
      )}
      {!data.userName && <h3 className="text-white font-bold text-lg">Session Analytics</h3>}

      {/* Stats Cards */}
      <div className="space-y-3">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-blue-600 transition-colors">
          <p className="text-gray-400 text-sm font-medium">Total Runs</p>
          <p className="text-white text-3xl font-bold mt-2">{data.totalRuns}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-green-600 transition-colors">
          <p className="text-gray-400 text-sm font-medium">Successful Runs</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-green-400 text-3xl font-bold">{data.successfulRuns}</p>
            <div className="text-right">
              <p className="text-green-400 text-xl font-bold">{successRate}%</p>
              <p className="text-gray-500 text-xs">Success Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-red-600 transition-colors">
          <p className="text-gray-400 text-sm font-medium">Failed Runs</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-red-400 text-3xl font-bold">{data.failedRuns}</p>
            <div className="text-right">
              <p className="text-red-400 text-xl font-bold">{data.totalErrors}</p>
              <p className="text-gray-500 text-xs">Total Errors</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-blue-600 transition-colors">
          <p className="text-gray-400 text-sm font-medium">Average Execution Time</p>
          <p className="text-blue-400 text-3xl font-bold mt-2">{avgExecutionTime}ms</p>
          {data.executionTimes && data.executionTimes.length > 0 && (
            <p className="text-gray-500 text-xs mt-2">Based on {data.executionTimes.length} executions</p>
          )}
        </div>
      </div>

      {/* Bar Chart */}
      {data.totalRuns > 0 && (
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg mt-6">
          <p className="text-gray-300 text-sm font-medium mb-4">Run Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444', borderRadius: '4px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="Successful" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Failed" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie Chart */}
      {data.totalRuns > 0 && (
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-300 text-sm font-medium mb-4">Success Breakdown</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444', borderRadius: '4px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}    </div>
  );
}