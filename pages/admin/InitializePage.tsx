import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Filter, AlertTriangle, Search, X, Layers, Users, BookOpen, Bookmark, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { Grade, Class, Subject, Topic, Lesson } from '../../types';

type TabType = 'grades' | 'classes' | 'subjects' | 'topics' | 'lessons';

const TAB_CONFIG = [
  { 
    id: 'grades', 
    label: 'Khối lớp', 
    icon: Layers, 
    activeBorder: 'border-blue-500', 
    iconBg: 'bg-blue-100', 
    iconColor: 'text-blue-600',
    activeIconBg: 'bg-blue-600',
    activeIconColor: 'text-white'
  },
  { 
    id: 'classes', 
    label: 'Lớp học', 
    icon: Users, 
    activeBorder: 'border-green-500',
    iconBg: 'bg-green-100', 
    iconColor: 'text-green-600',
    activeIconBg: 'bg-green-600',
    activeIconColor: 'text-white'
  },
  { 
    id: 'subjects', 
    label: 'Môn học', 
    icon: BookOpen, 
    activeBorder: 'border-purple-500',
    iconBg: 'bg-purple-100', 
    iconColor: 'text-purple-600',
    activeIconBg: 'bg-purple-600',
    activeIconColor: 'text-white'
  },
  { 
    id: 'topics', 
    label: 'Chủ đề', 
    icon: Bookmark, 
    activeBorder: 'border-orange-500',
    iconBg: 'bg-orange-100', 
    iconColor: 'text-orange-600',
    activeIconBg: 'bg-orange-600',
    activeIconColor: 'text-white'
  },
  { 
    id: 'lessons', 
    label: 'Bài học', 
    icon: FileText, 
    activeBorder: 'border-pink-500', 
    iconBg: 'bg-pink-100', 
    iconColor: 'text-pink-600',
    activeIconBg: 'bg-pink-600',
    activeIconColor: 'text-white'
  },
];

export const InitializePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('grades');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Data State
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [schoolName, setSchoolName] = useState('');

  // Filter State
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({});

  const refreshData = () => {
    setGrades(db.grades.getAll());
    setClasses(db.classes.getAll());
    setSubjects(db.subjects.getAll());
    setTopics(db.topics.getAll());
    setLessons(db.lessons.getAll());
    setSchoolName(db.config.getSchoolName());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filter Logic
  const getFilteredData = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'grades':
        data = grades;
        break;
      case 'classes':
        data = selectedGradeId 
          ? classes.filter(c => c.gradeId === selectedGradeId)
          : classes;
        break;
      case 'subjects':
        data = selectedGradeId
          ? subjects.filter(s => s.gradeId === selectedGradeId)
          : subjects;
        break;
      case 'topics':
        let filteredTopics = topics;
        if (selectedSubjectId) {
          filteredTopics = filteredTopics.filter(t => t.subjectId === selectedSubjectId);
        } else if (selectedGradeId) {
          // Find subjects in this grade
          const gradeSubjectIds = subjects
            .filter(s => s.gradeId === selectedGradeId)
            .map(s => s.id);
          filteredTopics = filteredTopics.filter(t => gradeSubjectIds.includes(t.subjectId));
        }
        data = filteredTopics;
        break;
      case 'lessons':
         data = lessons;
         break;
      default:
        data = [];
    }

    // Apply Search Filter
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(item => {
        const name = item.name || item.title || '';
        return name.toLowerCase().includes(lowerTerm);
      });
    }

    return data;
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({});
    // Pre-fill keys if filters are active
    if (activeTab === 'classes') {
      setFormData({ gradeId: selectedGradeId, type: 'REGULAR' });
    }
    if (activeTab === 'subjects' && selectedGradeId) setFormData({ gradeId: selectedGradeId });
    if (activeTab === 'topics' && selectedSubjectId) setFormData({ subjectId: selectedSubjectId });
    
    setIsModalOpen(true);
  };

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    
    switch (activeTab) {
      case 'grades': db.grades.remove(id); break;
      case 'classes': db.classes.remove(id); break;
      case 'subjects': db.subjects.remove(id); break;
      case 'topics': db.topics.remove(id); break;
      case 'lessons': db.lessons.remove(id); break;
    }
    
    refreshData();
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const handleSave = () => {
    const isEdit = !!editingItem;
    const id = isEdit ? editingItem.id : Math.random().toString(36).substr(2, 9);
    const data = { ...formData, id };

    // Validation basic
    if (!data.name && !data.title) return alert("Vui lòng nhập tên/tiêu đề");

    switch (activeTab) {
      case 'grades': 
        isEdit ? db.grades.update(id, data) : db.grades.add(data); 
        break;
      case 'classes': 
        if (!data.gradeId) return alert("Chọn khối");
        isEdit ? db.classes.update(id, data) : db.classes.add(data); 
        break;
      case 'subjects': 
        if (!data.gradeId) return alert("Chọn khối");
        isEdit ? db.subjects.update(id, data) : db.subjects.add(data); 
        break;
      case 'topics': 
        if (!data.subjectId) return alert("Chọn môn học");
        isEdit ? db.topics.update(id, data) : db.topics.add(data); 
        break;
      case 'lessons': 
        if (!data.topicId) return alert("Chọn chủ đề");
        isEdit ? db.lessons.update(id, data) : db.lessons.add(data); 
        break;
    }

    refreshData();
    setIsModalOpen(false);
  };

  // Helper to get name
  const getGradeName = (id: string) => grades.find(g => g.id === id)?.name || 'N/A';
  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || 'N/A';
  const getTopicName = (id: string) => topics.find(t => t.id === id)?.name || 'N/A';

  // Render Form Content
  const renderForm = () => {
    return (
      <div className="space-y-4">
        {/* Name/Title Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {activeTab === 'lessons' ? 'Tiêu đề bài học' : 'Tên hiển thị'}
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            value={activeTab === 'lessons' ? (formData.title || '') : (formData.name || '')}
            onChange={(e) => setFormData({ ...formData, [activeTab === 'lessons' ? 'title' : 'name']: e.target.value })}
          />
        </div>

        {/* Dynamic Fields */}
        {activeTab === 'classes' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Thuộc Khối</label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={formData.gradeId || ''}
                onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })}
              >
                <option value="">-- Chọn Khối --</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Loại lớp</label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={formData.type || 'REGULAR'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="REGULAR">Lớp thường</option>
                <option value="SELECTED">Lớp chọn</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ghi chú (Tùy chọn)</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                rows={3}
                placeholder="Nhập ghi chú cho lớp..."
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>
          </>
        )}

        {activeTab === 'subjects' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Thuộc Khối</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              value={formData.gradeId || ''}
              onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })}
            >
              <option value="">-- Chọn Khối --</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {activeTab === 'topics' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Thuộc Môn</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              value={formData.subjectId || ''}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
            >
              <option value="">-- Chọn Môn --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({getGradeName(s.gradeId)})</option>)}
            </select>
          </div>
        )}

        {activeTab === 'lessons' && (
          <>
             <div>
              <label className="block text-sm font-medium text-gray-700">Thuộc Chủ đề</label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={formData.topicId || ''}
                onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
              >
                <option value="">-- Chọn Chủ đề --</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Thứ tự</label>
              <input
                type="number"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={formData.order || 0}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Khởi tạo dữ liệu</h1>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus size={20} /> Thêm mới
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gray-50 border-gray-200">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Filter size={20} />
            <span className="font-medium">Bộ lọc:</span>
          </div>
          <div className="flex-1 w-full md:w-auto flex flex-col md:flex-row gap-4">
             <select 
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
            >
              <option value="">Tất cả Khối</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select 
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="">Tất cả Môn học</option>
              {subjects
                .filter(s => !selectedGradeId || s.gradeId === selectedGradeId)
                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* Search Input */}
            <div className="flex-1 flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm theo tên..." 
                className="flex-1 outline-none text-sm bg-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs - Horizontal Row Design */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 h-full
                ${isActive 
                  ? `${tab.activeBorder} bg-white shadow-md transform -translate-y-1` 
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                }
              `}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${isActive ? tab.activeIconBg : tab.iconBg} ${isActive ? tab.activeIconColor : tab.iconColor}`}>
                <Icon size={20} />
              </div>
              <span className={`font-bold text-sm sm:text-base ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                {tab.label}
              </span>
              
              {isActive && (
                <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b-2 border-r-2 ${tab.activeBorder} bg-white z-10`}></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Table Content */}
      <Card className="!p-0 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="font-semibold text-white uppercase bg-[#17a2a1] text-base">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">ID</th>
                <th className="px-6 py-4">
                  {activeTab === 'lessons' ? 'Tiêu đề' : 'Tên'}
                </th>
                {/* Dynamic Columns */}
                {activeTab === 'grades' && <th className="px-6 py-4">Trường học</th>}
                
                {activeTab === 'classes' && <th className="px-6 py-4">Khối</th>}
                {activeTab === 'classes' && <th className="px-6 py-4">Loại lớp</th>}
                {activeTab === 'classes' && <th className="px-6 py-4">Ghi chú</th>}

                {activeTab === 'subjects' && <th className="px-6 py-4">Khối</th>}
                {activeTab === 'topics' && <th className="px-6 py-4">Môn học</th>}
                {activeTab === 'lessons' && <th className="px-6 py-4">Chủ đề</th>}
                
                <th className="px-6 py-4 text-right rounded-tr-lg">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-base">
              {getFilteredData().length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'classes' ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                    Không có dữ liệu phù hợp
                  </td>
                </tr>
              ) : (
                getFilteredData().map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-gray-500">{item.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.title || item.name}
                    </td>
                    
                    {activeTab === 'grades' && (
                      <td className="px-6 py-4 text-gray-600 font-medium">{schoolName}</td>
                    )}

                    {activeTab === 'classes' && (
                      <>
                        <td className="px-6 py-4">{getGradeName(item.gradeId)}</td>
                        <td className="px-6 py-4">
                          {item.type === 'SELECTED' ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-sm font-semibold">Lớp chọn</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-sm font-semibold">Lớp thường</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500 italic max-w-xs truncate">{item.note || '-'}</td>
                      </>
                    )}

                    {activeTab === 'subjects' && <td className="px-6 py-4">{getGradeName(item.gradeId)}</td>}
                    {activeTab === 'topics' && <td className="px-6 py-4">{getSubjectName(item.subjectId)}</td>}
                    {activeTab === 'lessons' && <td className="px-6 py-4">{getTopicName(item.topicId)}</td>}

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Cập nhật thông tin" : "Thêm mới"}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu thông tin</Button>
          </div>
        }
      >
        {renderForm()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xác nhận xóa"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleConfirmDelete}>Xóa vĩnh viễn</Button>
          </div>
        }
      >
        <div className="flex items-center gap-4 text-gray-600">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-medium text-gray-900">Bạn có chắc chắn muốn xóa?</p>
            <p className="text-sm mt-1">Hành động này không thể hoàn tác. Dữ liệu liên quan có thể bị ảnh hưởng.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};