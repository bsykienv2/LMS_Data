import React, { useRef, useState, useEffect } from 'react';
import { Settings, Download, Upload, AlertTriangle, Save, Database, Server, Layout, Building2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  
  // Config States
  const [appName, setAppName] = useState('');
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    setAppName(db.config.getAppName());
    setSchoolName(db.config.getSchoolName());
  }, []);

  const handleSaveConfig = () => {
    // Attempt to update configuration
    const success = db.config.update({
      appName: appName.trim(),
      schoolName: schoolName.trim()
    });
    
    if (success) {
      db.logActivity(user, 'Cấu hình hệ thống', `Cập nhật thông tin hiển thị hệ thống`);
      // REMOVED window.location.reload() to prevent "File moved/deleted" error
      alert("Đã cập nhật cấu hình thành công!");
    } else {
      console.error("Failed to save config");
    }
  };

  // 1. Export Handler
  const handleExport = () => {
    try {
      const data = db.getBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `lms-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      db.logActivity(user, 'Sao lưu hệ thống', 'Xuất file dữ liệu toàn bộ hệ thống');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xuất dữ liệu.');
    }
  };

  // 2. Import Trigger
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset
      fileInputRef.current.click();
    }
  };

  // 3. File Parse Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic validation
        if (typeof json !== 'object' || json === null) {
          throw new Error('Định dạng file không hợp lệ');
        }

        setPendingData(json);
        setIsConfirmOpen(true);
      } catch (err) {
        alert('File không hợp lệ hoặc bị lỗi. Vui lòng kiểm tra lại.');
      }
    };
    reader.readAsText(file);
  };

  // 4. Confirm Restore
  const handleConfirmRestore = () => {
    if (pendingData) {
      db.restoreBackupData(pendingData);
      db.logActivity(user, 'Khôi phục hệ thống', 'Khôi phục dữ liệu từ file backup');
      setIsConfirmOpen(false);
      
      alert('Khôi phục thành công! Hệ thống sẽ tải lại.');
      // For restore, we still need a reload to reset all Context states, 
      // but we redirect to root first to minimize path errors
      window.location.href = '/'; 
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gray-100 rounded-lg text-gray-600">
           <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h1>
          <p className="text-gray-500 text-sm">Quản lý cấu hình và dữ liệu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Backup & Restore */}
        <Card title="Sao lưu & Khôi phục dữ liệu">
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
              <Database className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-bold text-blue-900">Dữ liệu hệ thống</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Bao gồm toàn bộ: Người dùng, Ngân hàng câu hỏi, Đề thi, Kết quả thi và Nhật ký.
                  <br />Dữ liệu này được lưu trữ cục bộ trên trình duyệt.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                 <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Download size={24} />
                 </div>
                 <h4 className="font-bold text-gray-900 mb-2">Xuất dữ liệu</h4>
                 <p className="text-xs text-gray-500 mb-4">Tải xuống file JSON chứa toàn bộ dữ liệu hiện tại.</p>
                 <Button onClick={handleExport} variant="secondary" fullWidth className="border-green-200 text-green-700 hover:bg-green-50">
                   Tải xuống backup
                 </Button>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                 <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Upload size={24} />
                 </div>
                 <h4 className="font-bold text-gray-900 mb-2">Nhập dữ liệu</h4>
                 <p className="text-xs text-gray-500 mb-4">Khôi phục hệ thống từ file JSON đã sao lưu.</p>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileChange} 
                   accept=".json" 
                   className="hidden" 
                 />
                 <Button onClick={handleImportClick} variant="secondary" fullWidth className="border-orange-200 text-orange-700 hover:bg-orange-50">
                   Chọn file để khôi phục
                 </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Split into System Name Config & Info */}
        <div className="flex flex-col gap-6">
          
          {/* Top: System Name Configuration */}
          <Card title="Cấu hình hiển thị">
             <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg flex gap-3 items-start border border-gray-100">
                   <Layout className="text-gray-500 mt-1" size={20} />
                   <div>
                      <p className="text-sm text-gray-600">
                        Cập nhật các thông tin hiển thị chung của hệ thống.
                      </p>
                   </div>
                </div>
                
                {/* App Name */}
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Tên hệ thống (Sidebar)</label>
                   <input 
                      type="text" 
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="VD: LMS Việt"
                   />
                </div>

                {/* School Name */}
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Tên trường học (Hiển thị trên đề thi)</label>
                   <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                          type="text" 
                          className="w-full pl-10 p-2 border rounded focus:ring-2 focus:ring-blue-500"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="VD: Trường THCS Tân Lập"
                      />
                   </div>
                </div>

                <div className="flex justify-end pt-2">
                   <Button onClick={handleSaveConfig} className="flex items-center gap-2">
                      <Save size={16} /> Lưu cấu hình
                   </Button>
                </div>
             </div>
          </Card>

          {/* Bottom: System Info */}
          <Card title="Thông tin phiên bản">
             <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                   <span className="text-gray-600">Phiên bản</span>
                   <span className="font-mono font-bold text-gray-900">v1.2.0</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                   <span className="text-gray-600">Trạng thái</span>
                   <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
                     <div className="w-2 h-2 rounded-full bg-green-50 animate-pulse"></div> Hoạt động
                   </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                   <span className="text-gray-600">Lần cập nhật cuối</span>
                   <span className="text-gray-900 text-sm">{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                   <span className="text-gray-600">Máy chủ</span>
                   <div className="flex items-center gap-2 text-gray-900 text-sm">
                      <Server size={14} /> Local Storage
                   </div>
                </div>
             </div>
          </Card>

        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Xác nhận khôi phục dữ liệu"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>Hủy bỏ</Button>
            <Button variant="danger" onClick={handleConfirmRestore} className="flex items-center gap-2">
              <AlertTriangle size={18} /> Đồng ý khôi phục
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Cảnh báo: Ghi đè dữ liệu</h3>
          <p className="text-gray-600 mb-4">
            Hành động này sẽ <strong>xóa toàn bộ dữ liệu hiện tại</strong> của hệ thống và thay thế bằng dữ liệu từ file backup. 
            <br/><br/>
            Bạn có chắc chắn muốn tiếp tục không?
          </p>
          <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-500 font-mono text-left overflow-hidden text-ellipsis whitespace-nowrap">
             Dữ liệu mới: {pendingData ? Object.keys(pendingData).length : 0} collection(s)
          </div>
        </div>
      </Modal>
    </div>
  );
};