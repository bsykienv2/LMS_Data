import React, { useState, useEffect } from 'react';
import { Clock, User, Activity, Search, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { db } from '../../services/db';
import { SystemLog } from '../../types';
import { formatDate } from '../../utils/helpers';

export const SystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load logs and sort by newest first
    const allLogs = db.logs.getAll().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setLogs(allLogs);
  }, []);

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="text-blue-600" /> Nhật ký hệ thống
        </h1>
        
        <div className="relative w-full sm:w-auto">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
           <input 
             type="text" 
             placeholder="Tìm kiếm nhật ký..." 
             className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-sm font-semibold text-white uppercase bg-[#17a2a1]">
              <tr>
                <th className="px-6 py-3 w-48 rounded-tl-lg">Thời gian</th>
                <th className="px-6 py-3 w-48">Người thực hiện</th>
                <th className="px-6 py-3 w-48">Hành động</th>
                <th className="px-6 py-3 rounded-tr-lg">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                       <Clock size={48} className="text-gray-200 mb-2" />
                       <p>Chưa có dữ liệu nhật ký.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} 
                      <span className="mx-2">•</span>
                      {formatDate(new Date(log.timestamp))}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                        {log.userName.charAt(0)}
                      </div>
                      {log.userName}
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded text-xs font-semibold 
                         ${log.action.includes('Tạo') || log.action.includes('Thêm') ? 'bg-green-100 text-green-700' : 
                           log.action.includes('Xóa') ? 'bg-red-100 text-red-700' : 
                           log.action.includes('Sửa') || log.action.includes('Cập nhật') ? 'bg-blue-100 text-blue-700' :
                           'bg-gray-100 text-gray-700'}`}>
                         {log.action}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};