
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Search, Upload, Download, Camera, ZoomIn, X, Save, User, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { db } from '../../services/db';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { Grade, Class, User as UserType, Role } from '../../types';
import { formatDate, parseDateToISO, generateUsername } from '../../utils/helpers';
import * as XLSX from 'xlsx';

export const StudentManagerPage: React.FC = () => {
  const { user } = useAuth();
  
  // Data State
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use Debounce for Search Term (300ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<UserType>>({});
  
  // Image Crop State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(new Image());

  // LOAD DATA FROM API
  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('users');
      if (response.success && Array.isArray(response.data)) {
        const studentList = response.data.filter((u: UserType) => u.role === Role.STUDENT);
        setStudents(studentList);
      }
    } catch (e) {
      console.error("Failed to fetch students", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setGrades(db.grades.getAll());
    setClasses(db.classes.getAll());
    fetchStudents();
  }, []);

  // Optimized Filtering with useMemo
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedClassId && s.classId !== selectedClassId) return false;
      
      if (selectedGradeId && !selectedClassId) {
        const cls = classes.find(c => c.id === s.classId);
        if (cls?.gradeId !== selectedGradeId) return false;
      }

      if (debouncedSearchTerm) {
        const lowerTerm = debouncedSearchTerm.toLowerCase();
        return s.name.toLowerCase().includes(lowerTerm) || 
               s.username.toLowerCase().includes(lowerTerm);
      }
      return true;
    });
  }, [students, selectedClassId, selectedGradeId, debouncedSearchTerm, classes]);

  // Handlers
  const handleOpenAdd = () => {
    setFormData({ 
      classId: selectedClassId, 
      isActive: false, // Mặc định chưa kích hoạt
      role: Role.STUDENT,
      password: '1' // Mật khẩu mặc định
    });
    setImageSrc(null);
    setIsModalOpen(true);
  };

  const handleEdit = (student: UserType) => {
    setFormData({ ...student });
    setImageSrc(null); 
    setIsModalOpen(true);
  };

  // Auto generate username when name changes (Only in Create mode)
  useEffect(() => {
    if (!formData.id && formData.name) {
      const genUser = generateUsername(formData.name);
      setFormData(prev => ({ ...prev, username: genUser }));
    }
  }, [formData.name]);

  // ... (Image Handlers - Keep same as before) ...
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
      setFormData({ ...formData, avatar: croppedDataUrl });
      setImageSrc(null); 
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
    setIsDragging(true);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setCropPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  
  const handleMouseUp = () => setIsDragging(false);

  // ... (API & Import Logic) ...
  const handleSaveStudent = async () => {
    if (!formData.name || !formData.username || !formData.classId) {
      alert("Vui lòng điền đầy đủ: Họ tên, Tên đăng nhập, Lớp.");
      return;
    }
    const userPayload: UserType = {
      ...(formData as UserType),
      email: formData.email || `${formData.username}@lms.vn`,
      password: formData.password || '1', 
      role: Role.STUDENT,
      isActive: formData.isActive ?? false // Default false if undefined
    };
    try {
      if (!formData.id) {
        await api.create('users', userPayload);
        alert(`Thêm học sinh thành công! User: ${userPayload.username} / Pass: ${userPayload.password}`);
      } else {
        await api.update('users', formData.id, userPayload);
        alert("Cập nhật thành công!");
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (err) { alert("Có lỗi xảy ra."); }
  };

  const handleDownloadTemplate = () => {
     const headers = ["HoTen", "NgaySinh", "LopId(Option)", "TenDangNhap(Option)"];
     const example = ["Nguyễn Văn A", "20/05/2012", "", ""];
     const ws = XLSX.utils.aoa_to_sheet([headers, example]);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "MauImportHocSinh");
     XLSX.writeFile(wb, "mau_danh_sach_hoc_sinh.xlsx");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !selectedClassId) { alert("Vui lòng chọn lớp!"); return; }
     const reader = new FileReader();
     reader.onload = async (evt) => {
        try {
           const wb = XLSX.read(evt.target?.result, { type: 'array' });
           const ws = wb.Sheets[wb.SheetNames[0]];
           const json = XLSX.utils.sheet_to_json(ws);
           
           let count = 0;
           for (const row of json as any[]) {
              const name = row['HoTen'] || row['Name'];
              // Auto generate if missing
              const uname = row['TenDangNhap'] || row['Username'] || generateUsername(String(name));
              const pass = row['MatKhau'] || '1'; // Default Password '1'

              if (name) {
                 await api.create('users', {
                    name: String(name), 
                    username: String(uname),
                    password: String(pass),
                    role: Role.STUDENT, 
                    classId: selectedClassId, 
                    isActive: false // Default inactive for import
                 });
                 count++;
              }
           }
           alert(`Đã import ${count} học sinh. Tài khoản mặc định chưa kích hoạt.`);
           fetchStudents();
           setIsImportModalOpen(false);
        } catch (e) { alert("Lỗi import"); }
     };
     reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Học sinh (Online)</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2">
            <Upload size={18} /> Import Excel
          </Button>
          <Button onClick={handleOpenAdd} className="flex items-center gap-2">
            <Plus size={18} /> Thêm mới
          </Button>
        </div>
      </div>

      <Card className="bg-gray-50 border-gray-200">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select className="p-2 border rounded" value={selectedGradeId} onChange={(e) => setSelectedGradeId(e.target.value)}>
              <option value="">-- Tất cả Khối --</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="p-2 border rounded" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">-- Tất cả Lớp --</option>
              {classes.filter(c => !selectedGradeId || c.gradeId === selectedGradeId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="md:col-span-2 relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Tìm theo tên hoặc tên đăng nhập..."
                 className="w-full pl-10 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
         </div>
      </Card>

      <Card className="!p-0 overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {/* Skeleton Loading Rows */}
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#17a2a1] text-white text-sm font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">Học sinh</th>
                  <th className="px-6 py-3">Ngày sinh</th>
                  <th className="px-6 py-3">Lớp</th>
                  <th className="px-6 py-3">Tài khoản</th>
                  <th className="px-6 py-3 text-right rounded-tr-lg">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">Không tìm thấy học sinh</td></tr>
                ) : (
                  filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="relative">
                            {s.avatar ? (
                              <img src={s.avatar} alt={s.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <User size={20} />
                              </div>
                            )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">{s.dob ? formatDate(s.dob) : '-'}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                          {classes.find(c => c.id === s.classId)?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block w-fit mb-1">{s.username}</span>
                           <span className={`text-[10px] ${s.isActive ? 'text-green-600' : 'text-red-500 italic'}`}>
                              {s.isActive ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}>Chỉnh sửa</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Cập nhật" : "Thêm mới"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button onClick={handleSaveStudent}>Lưu</Button></div>}>
         <div className="space-y-4">
             <div className="flex flex-col items-center justify-center mb-6">
                <div className="relative w-24 h-24 mb-3">
                  {formData.avatar ? <img src={formData.avatar} className="w-full h-full rounded-full object-cover border-4 border-white shadow" /> : <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center"><User size={40} /></div>}
                  <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer"><Camera size={16} /><input type="file" className="hidden" accept="image/*" onChange={handleFileChange} /></label>
                </div>
                {imageSrc && <div className="mt-4 p-4 border rounded-xl bg-gray-50 w-full"><div className="relative w-full h-64 bg-gray-200 overflow-hidden rounded-lg cursor-move" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}><canvas ref={canvasRef} width={300} height={300} className="w-full h-full object-contain" /></div><div className="flex items-center gap-3 mt-3"><input type="range" min="0.5" max="3" step="0.1" value={cropScale} onChange={(e) => setCropScale(parseFloat(e.target.value))} className="flex-1"/><Button size="sm" onClick={handleCropSave}>Cắt</Button></div></div>}
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-sm mb-1">Họ tên</label><input className="w-full p-2 border rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
               <div><label className="block text-sm mb-1">Ngày sinh</label><input type="date" className="w-full p-2 border rounded" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})}/></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-sm mb-1">Lớp</label><select className="w-full p-2 border rounded" value={formData.classId || ''} onChange={e => setFormData({...formData, classId: e.target.value})}><option value="">-- Chọn --</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
               <div>
                 <label className="block text-sm mb-1">User (Tự sinh)</label>
                 <div className="relative">
                    <input className="w-full p-2 border rounded bg-gray-50" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})}/>
                    {!formData.id && <button onClick={() => setFormData(p => ({...p, username: generateUsername(p.name || '')}))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600" title="Sinh lại user"><RefreshCw size={14}/></button>}
                 </div>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm mb-1">Mật khẩu</label><input className="w-full p-2 border rounded" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mặc định: 1"/></div>
                <div className="flex items-center mt-6">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-sm">Kích hoạt ngay</span>
                   </label>
                </div>
             </div>
         </div>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import Excel" footer={<Button onClick={() => setIsImportModalOpen(false)}>Đóng</Button>}>
         <div className="space-y-4">
            <Button onClick={handleDownloadTemplate} variant="secondary" fullWidth><Download size={18} className="mr-2"/> Tải mẫu</Button>
            <div className="border-2 border-dashed p-8 text-center"><input type="file" accept=".xlsx" onChange={handleImportFile} className="w-full"/></div>
            <p className="text-xs text-gray-500 text-center italic">* User và Pass sẽ tự động sinh nếu để trống. Tài khoản mới sẽ ở trạng thái 'Chưa kích hoạt'.</p>
         </div>
      </Modal>
    </div>
  );
};
