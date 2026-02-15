
import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, UserX, Shield, CheckCircle, Settings, Camera, ZoomIn, X, Save, User as UserIcon, GraduationCap, Edit } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';
import { User, Role, Grade, Class } from '../../types';

type TabType = 'ADMIN' | 'STUDENT';

export const UserManagerPage: React.FC = () => {
  const { user } = useAuth();
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('STUDENT');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters for Students
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // --- Edit State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});

  // --- Image Crop State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(new Image());

  useEffect(() => {
    setUsers(db.users.getAll());
    setGrades(db.grades.getAll());
    setClasses(db.classes.getAll());
  }, []);

  // Filter Logic
  const filteredUsers = users.filter(u => {
    // 1. Tab Role Filter
    if (activeTab === 'ADMIN' && u.role !== Role.ADMIN) return false;
    if (activeTab === 'STUDENT' && u.role !== Role.STUDENT) return false;

    // 2. Search Filter
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.username.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 3. Student Specific Filters
    if (activeTab === 'STUDENT') {
      if (selectedClassId && u.classId !== selectedClassId) return false;
      
      if (selectedGradeId && !selectedClassId) {
        const cls = classes.find(c => c.id === u.classId);
        if (cls?.gradeId !== selectedGradeId) return false;
      }
    }

    return true;
  });

  // Helper to get Class/Grade Info
  const getClassInfo = (classId?: string) => {
    if (!classId) return { className: '-', gradeName: '-' };
    const cls = classes.find(c => c.id === classId);
    const grade = grades.find(g => g.id === cls?.gradeId);
    return { 
      className: cls?.name || 'N/A', 
      gradeName: grade?.name || 'N/A' 
    };
  };

  const toggleStatus = (userId: string, currentStatus: boolean) => {
    if (userId === 'admin') {
      alert("Không thể khóa tài khoản quản trị viên chính.");
      return;
    }
    db.users.update(userId, { isActive: !currentStatus });
    setUsers(db.users.getAll());
    db.logActivity(user, !currentStatus ? 'Kích hoạt tài khoản' : 'Khóa tài khoản', `User ID: ${userId}`);
  };

  const toggleAll = (status: boolean) => {
    if (confirm(`Bạn có chắc muốn ${status ? 'KÍCH HOẠT' : 'KHÓA'} tất cả ${filteredUsers.length} tài khoản trong danh sách đang hiển thị không?`)) {
      filteredUsers.forEach(u => {
        if (u.id !== 'admin' && u.id !== user?.id) {
           db.users.update(u.id, { isActive: status });
        }
      });
      setUsers(db.users.getAll());
      db.logActivity(user, 'Thao tác hàng loạt', `${status ? 'Kích hoạt' : 'Khóa'} ${filteredUsers.length} tài khoản`);
    }
  };

  // --- Image Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
        imgRef.current.src = ev.target?.result as string;
        setCropScale(1);
        setCropPos({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = imgRef.current;
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * cropScale;
    const x = (canvas.width - img.width * scale) / 2 + cropPos.x;
    const y = (canvas.height - img.height * scale) / 2 + cropPos.y;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  };

  useEffect(() => {
    if (imageSrc) {
       const timeout = setTimeout(drawCanvas, 10);
       return () => clearTimeout(timeout);
    }
  }, [imageSrc, cropScale, cropPos]);

  const handleCropSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setEditingUser({ ...editingUser, avatar: croppedDataUrl });
      setImageSrc(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setCropPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // --- Update Handler ---
  const handleOpenEdit = (targetUser: User) => {
     setEditingUser({ ...targetUser });
     setImageSrc(null);
     setIsEditModalOpen(true);
  };

  const handleOpenAdminEdit = () => {
    if (user) {
       const currentUser = db.users.getById(user.id);
       handleOpenEdit(currentUser!);
    }
  };

  const handleSaveUser = () => {
    if (!editingUser.id || !editingUser.username) return;
    
    db.users.update(editingUser.id, editingUser);
    db.logActivity(user, 'Cập nhật tài khoản', `Cập nhật thông tin user: ${editingUser.username}`);
    
    alert("Cập nhật thành công!");
    setUsers(db.users.getAll());
    setIsEditModalOpen(false);
    
    // If updating self, reload to reflect changes in header
    if (editingUser.id === user?.id) {
       window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Tài khoản</h1>
        <div className="flex gap-2">
          {user?.role === Role.ADMIN && (
            <Button variant="secondary" onClick={handleOpenAdminEdit} className="flex items-center gap-2 text-blue-700 border-blue-200 bg-blue-50">
               <Settings size={16} /> Cài đặt Admin
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => toggleAll(false)}>Khóa danh sách</Button>
          <Button size="sm" onClick={() => toggleAll(true)}>Kích hoạt danh sách</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('STUDENT')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'STUDENT'
                ? 'border-[#17a2a1] text-[#17a2a1]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <GraduationCap size={18} />
            Học sinh ({users.filter(u => u.role === Role.STUDENT).length})
          </button>
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'ADMIN'
                ? 'border-[#17a2a1] text-[#17a2a1]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <Shield size={18} />
            Quản trị viên ({users.filter(u => u.role === Role.ADMIN).length})
          </button>
        </nav>
      </div>

      {/* Filters */}
      <Card className="bg-gray-50 border-gray-200">
         <div className="flex flex-col md:flex-row gap-4">
            {activeTab === 'STUDENT' && (
              <>
                <div className="w-full md:w-48">
                  <select 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                  >
                    <option value="">-- Tất cả Khối --</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-48">
                  <select 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">-- Tất cả Lớp --</option>
                    {classes
                      .filter(c => !selectedGradeId || c.gradeId === selectedGradeId)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}
            
            <div className="flex-1 relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Tìm theo tên, tài khoản..."
                 className="w-full pl-10 p-2 border rounded focus:ring-2 focus:ring-blue-500"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
         </div>
      </Card>

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
             <thead className="bg-[#17a2a1] text-white text-sm font-semibold uppercase">
               <tr>
                 <th className="px-6 py-3">Người dùng</th>
                 <th className="px-6 py-3">Vai trò</th>
                 {activeTab === 'STUDENT' && (
                   <>
                     <th className="px-6 py-3">Khối</th>
                     <th className="px-6 py-3">Lớp</th>
                   </>
                 )}
                 <th className="px-6 py-3">Tài khoản</th>
                 <th className="px-6 py-3 text-center">Trạng thái</th>
                 <th className="px-6 py-3 text-right">Thao tác</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={activeTab === 'STUDENT' ? 7 : 5} className="text-center py-8 text-gray-500">Không tìm thấy dữ liệu phù hợp</td></tr>
                ) : (
                  filteredUsers.map(u => {
                    const classInfo = activeTab === 'STUDENT' ? getClassInfo(u.classId) : null;
                    
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 flex items-center gap-3">
                           <div className="relative">
                              {u.avatar ? (
                                 <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                              ) : (
                                 <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${u.isActive ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                    {u.name.charAt(0)}
                                 </div>
                              )}
                           </div>
                           <div>
                              <p className={`font-medium text-gray-900 ${!u.isActive && 'opacity-60'}`}>{u.name}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           {u.role === Role.ADMIN ? (
                             <span className="flex items-center gap-1 text-purple-600 font-bold text-xs bg-purple-50 px-2 py-1 rounded w-fit"><Shield size={12} /> Quản trị</span>
                           ) : (
                             <span className="flex items-center gap-1 text-gray-600 text-xs bg-gray-100 px-2 py-1 rounded w-fit"><GraduationCap size={12} /> Học sinh</span>
                           )}
                        </td>

                        {activeTab === 'STUDENT' && (
                          <>
                            <td className="px-6 py-4 text-gray-700">{classInfo?.gradeName}</td>
                            <td className="px-6 py-4">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                {classInfo?.className}
                              </span>
                            </td>
                          </>
                        )}

                        <td className="px-6 py-4 font-mono text-gray-600 text-xs">
                           {u.username}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {u.isActive ? (
                             <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                               <CheckCircle size={12} /> Đang hoạt động
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                               <UserX size={12} /> Đã khóa
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleOpenEdit(u)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Chỉnh sửa thông tin"
                              >
                                <Edit size={18} />
                              </button>
                              
                              <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={u.isActive}
                                    onChange={() => toggleStatus(u.id, u.isActive)}
                                    disabled={u.id === 'admin' || u.id === user?.id}
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
             </tbody>
          </table>
        </div>
      </Card>

      {/* EDIT MODAL (Generic for both Admin & Student) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Cập nhật: ${editingUser.name}`}
        footer={
           <div className="flex justify-end gap-2">
             <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Hủy</Button>
             <Button onClick={handleSaveUser}><Save size={16} className="mr-2" /> Lưu thay đổi</Button>
           </div>
        }
      >
         <div className="space-y-4">
            {/* Image Uploader */}
            <div className="flex flex-col items-center justify-center mb-6">
               <div className="relative w-24 h-24 mb-3">
                  {editingUser.avatar ? (
                    <img src={editingUser.avatar} className="w-full h-full rounded-full object-cover border-4 border-white shadow" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <UserIcon size={40} />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer hover:bg-blue-700 shadow-lg">
                    <Camera size={16} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
               </div>
               
               {imageSrc && (
                 <div className="mt-4 p-4 border rounded-xl bg-gray-50 w-full">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-bold">Chỉnh sửa ảnh</span>
                       <button onClick={() => setImageSrc(null)} className="text-gray-500 hover:text-red-500"><X size={16} /></button>
                    </div>
                    <div className="relative w-full h-64 bg-gray-200 overflow-hidden rounded-lg cursor-move border border-gray-300"
                         onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                       <canvas ref={canvasRef} width={300} height={300} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                       <ZoomIn size={16} className="text-gray-500" />
                       <input 
                         type="range" min="0.5" max="3" step="0.1" 
                         value={cropScale} 
                         onChange={(e) => setCropScale(parseFloat(e.target.value))}
                         className="flex-1"
                       />
                       <Button size="sm" onClick={handleCropSave}>Cắt & Áp dụng</Button>
                    </div>
                 </div>
               )}
            </div>

            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                 <input 
                   className="w-full p-2 border rounded" 
                   value={editingUser.name || ''} 
                   onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                 <input 
                   className={`w-full p-2 border rounded ${editingUser.id === 'admin' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                   value={editingUser.username || ''} 
                   onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                   readOnly={editingUser.id === 'admin'} // Prevent changing main admin username
                 />
                 {editingUser.id === 'admin' && <p className="text-xs text-gray-400 mt-1">Không thể thay đổi tên đăng nhập Admin chính</p>}
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                 <input 
                   type="text"
                   className="w-full p-2 border rounded" 
                   placeholder="Để trống nếu không đổi"
                   value={editingUser.password || ''} 
                   onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Email liên hệ</label>
                 <input 
                   type="email"
                   className="w-full p-2 border rounded" 
                   value={editingUser.email || ''} 
                   onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                 />
               </div>

               <div className="flex items-center pt-2">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingUser.isActive} 
                        onChange={e => setEditingUser({...editingUser, isActive: e.target.checked})} 
                        className="w-4 h-4 text-blue-600 rounded" 
                        disabled={editingUser.id === 'admin' || editingUser.id === user?.id}
                      />
                      <span className="text-sm">Kích hoạt tài khoản</span>
                   </label>
               </div>
            </div>
         </div>
      </Modal>
    </div>
  );
};
